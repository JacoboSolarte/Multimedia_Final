import * as THREE from 'three';

// Luces de la noche (Fase 3). Solo 2 luces con sombra en todo el juego: la luna y la linterna.
export class Iluminacion {
  constructor(ctx, posicionesVelas) {
    this.ctx = ctx;
    const scene = ctx.engine.scene;

    // Ambiente bajo: el valor real lo pone el GameManager con modo.luzAmbiente
    this.ambiente = new THREE.AmbientLight(0x6c7aa8, ctx.modo?.luzAmbiente ?? 0.08);
    scene.add(this.ambiente);

    // Luna azulada con sombra; la cámara de sombra cubre la casa y el patio
    this.luna = new THREE.DirectionalLight(0x9fb4ff, 0.55);
    this.luna.position.set(-18, 30, 14);
    this.luna.target.position.set(0, 0, 6);
    this.luna.castShadow = true;
    const t = ctx.engine.tamanoSombra;
    this.luna.shadow.mapSize.set(t, t);
    Object.assign(this.luna.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
    this.luna.shadow.bias = -0.0006;
    this.luna.shadow.normalBias = 0.03;
    scene.add(this.luna, this.luna.target);

    // Velas: PointLight cálida SIN sombra (una con sombra serían 6 renders por frame)
    const geoCera = new THREE.CylinderGeometry(0.025, 0.028, 0.12, 8);
    const matCera = new THREE.MeshStandardMaterial({ color: 0xeee6cc, roughness: 0.8 });
    this.velas = posicionesVelas.map((pos, i) => {
      const luz = new THREE.PointLight(0xff9a3c, 2.2, 7, 1.6);
      luz.position.copy(pos).add(new THREE.Vector3(0, 0.22, 0));
      const cera = new THREE.Mesh(geoCera, matCera);
      cera.position.copy(pos).add(new THREE.Vector3(0, 0.06, 0));
      scene.add(luz, cera);
      return { luz, cera, base: luz.intensity, fase: i * 1.7 };
    });
    this.parpadeo = 1;

    // Niebla oscura: tapa el fondo y vuelve más corta la vista
    this.niebla = new THREE.FogExp2(0x05070c, 0.055);
    scene.fog = this.niebla;
    scene.background = new THREE.Color(0x05070c);

    this._debug();
  }

  // HDRI nocturno de fondo y como environment, con intensidad baja
  async cargarCielo(ruta = '/textures/noche.hdr') {
    try {
      const hdr = await this.ctx.loader.cargarHDR(ruta);
      const scene = this.ctx.engine.scene;
      scene.background = hdr;
      scene.backgroundIntensity = 0.25;
      scene.backgroundBlurriness = 0.05;
      scene.environment = hdr;
      this.hdr = hdr;
      this.setIntensidadEntorno(0.15);
    } catch {
      console.warn(`[iluminacion] no se pudo cargar ${ruta}; queda el fondo oscuro`);
    }
  }

  // three 0.160 no tiene scene.environmentIntensity: se ajusta en cada material
  setIntensidadEntorno(valor) {
    this.intensidadEntorno = valor;
    this.ctx.engine.scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m && 'envMapIntensity' in m) m.envMapIntensity = valor;
      }
    });
  }

  setLuzAmbiente(valor) {
    this.ambiente.intensity = valor;
  }

  // Parpadeo de las velas con seno + random (semana 4)
  update(dt, tiempo) {
    for (const v of this.velas) {
      const s = Math.sin(tiempo * 9 + v.fase) * 0.12 + Math.sin(tiempo * 23 + v.fase * 2) * 0.06;
      v.luz.intensity = v.base * this.parpadeo * (0.85 + s + Math.random() * 0.08);
    }
  }

  _debug() {
    const f = this.ctx.debug?.addFolder('Luces');
    if (!f) return;
    f.add(this.ambiente, 'intensity', 0, 1, 0.01).name('ambiente');
    f.add(this.luna, 'intensity', 0, 3, 0.01).name('luna');
    f.addColor({ color: '#' + this.luna.color.getHexString() }, 'color').name('color luna').onChange((c) => this.luna.color.set(c));
    f.add(this, 'parpadeo', 0, 3, 0.01).name('velas');
    f.add(this.niebla, 'density', 0, 0.2, 0.001).name('niebla');
    f.add({ entorno: 0.15 }, 'entorno', 0, 1, 0.01).name('HDRI').onChange((v) => this.setIntensidadEntorno(v));
    f.add(this.ctx.engine.renderer, 'toneMappingExposure', 0.2, 3, 0.01).name('exposición');
    f.close();
  }
}
