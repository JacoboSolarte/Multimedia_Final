import * as THREE from 'three';

const COOLDOWN = 3;
const SONIDO = '/sounds/mundo/portal.mp3';

// Pasadizo secreto: PORTAL_<nombre>_A <-> PORTAL_<nombre>_B (como en la semana 9).
// Los espantos no los usan: es la ruta de escape del jugador.
export class Portales {
  constructor(ctx, mallas) {
    this.ctx = ctx;
    this.cooldown = 0;
    const porNombre = new Map();
    for (const mesh of mallas) {
      const [, nombre, lado] = mesh.name.match(/^PORTAL_(.+)_([AB])$/) ?? [];
      if (!nombre) continue;
      mesh.updateWorldMatrix(true, false);
      const caja = new THREE.Box3().setFromObject(mesh);
      mesh.visible = false;
      if (!porNombre.has(nombre)) porNombre.set(nombre, {});
      porNombre.get(nombre)[lado] = { id: `${nombre}_${lado}`, caja, efecto: this._crearEfecto(caja) };
    }
    this.pares = [...porNombre.entries()]
      .filter(([n, par]) => (par.A && par.B) || console.warn(`[portales] el portal ${n} no tiene par A/B`))
      .map(([nombre, par]) => ({ nombre, ...par }));
  }

  // Anillo (TorusGeometry) + chispas (Points, 1 draw call) en el piso del volumen
  _crearEfecto(caja) {
    const grupo = new THREE.Group();
    const centro = caja.getCenter(new THREE.Vector3());
    const radio = Math.min(caja.max.x - caja.min.x, caja.max.z - caja.min.z) * 0.4;
    grupo.position.set(centro.x, caja.min.y + 0.05, centro.z);

    const anillo = new THREE.Mesh(
      new THREE.TorusGeometry(radio, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x9a4dff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    anillo.rotation.x = Math.PI / 2;
    grupo.add(anillo);

    const n = 60;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * radio, Math.random() * 1.6, Math.sin(a) * radio], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const chispas = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xc89bff, size: 0.04, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    grupo.add(chispas);
    grupo.userData = { anillo, chispas };
    this.ctx.engine.scene.add(grupo);
    return grupo;
  }

  update(dt, player, tiempo) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const par of this.pares) {
      for (const lado of [par.A, par.B]) {
        const { anillo, chispas } = lado.efecto.userData;
        anillo.scale.setScalar(1 + Math.sin(tiempo * 3) * 0.06);
        chispas.rotation.y += dt * 0.8;
        // el anillo se apaga mientras corre el cooldown
        anillo.material.opacity = this.cooldown > 0 ? 0.25 : 0.8;
      }
    }
    if (this.cooldown > 0 || player.bloqueado || player.isHidden) return;

    const p = player.posicion.clone().add(new THREE.Vector3(0, 0.3, 0));
    for (const par of this.pares) {
      const desde = par.A.caja.containsPoint(p) ? par.A : par.B.caja.containsPoint(p) ? par.B : null;
      if (!desde) continue;
      const hasta = desde === par.A ? par.B : par.A;
      const destino = hasta.caja.getCenter(new THREE.Vector3());
      destino.y = hasta.caja.min.y;
      player.teletransportar(destino);
      this.cooldown = COOLDOWN;
      this.ctx.audio?.sonar(SONIDO, { volumen: 0.8 });
      this.ctx.bus.emit('jugador:portal', { desde: desde.id, hasta: hasta.id });
      return;
    }
  }
}
