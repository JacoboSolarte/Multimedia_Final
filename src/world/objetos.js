import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OBJETOS, FISICOS } from '../data/objetos.js';
import { barajar } from '../core/utils.js';

const SONIDO_GOLPE = '/sounds/mundo/golpe_objeto.mp3';
const UMBRAL_RUIDO = 1.5; // velocidad de impacto mínima para que suene (punto 3.6)
const _caja = new THREE.Box3();
const _tam = new THREE.Vector3();

// Objetos físicos de la finca (PHYS_) e items de la noche (en SPAWN_ITEM_).
// Todo choque fuerte emite `ruido`, incluso los que provoca el Duende: el ruido sale de aquí.
export class ObjetosMundo {
  constructor(ctx, spawnsItems) {
    this.ctx = ctx;
    this.spawnsItems = spawnsItems;
    this.objetosFisicos = []; // [{ body, mesh, tipo }]
    this.items = []; // [{ tipo, mesh, body|null, colocado }]
    this.modelos = new Map(); // tipo -> THREE.Object3D plantilla
    this._ultimoGolpe = new WeakMap();
  }

  // Precarga los modelos de los items (la misma llave sirve para todas las llaves)
  async precargar() {
    const tipos = Object.entries(OBJETOS);
    await Promise.all(
      tipos.map(async ([tipo, def]) => {
        try {
          const gltf = await this.ctx.loader.cargarGLB(def.modelo);
          this.modelos.set(tipo, gltf.scene);
        } catch {
          console.warn(`[objetos] no se pudo cargar ${def.modelo}, uso un cubo`);
          this.modelos.set(tipo, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xffaa00 })));
        }
      }),
    );
  }

  // ---------------------------------------------------------------- PHYS_ de la finca
  crearFisicos(mallas) {
    for (const mesh of mallas) {
      const tipo = mesh.name.slice('PHYS_'.length).split('_')[0];
      const masa = FISICOS[tipo]?.masa ?? 1;
      // la malla pasa a la raíz de la escena: el body manda su posición en coordenadas del mundo
      this.ctx.engine.scene.attach(mesh);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const body = this._crearBody(mesh, masa);
      this.ctx.physics.agregar(body, mesh);
      const obj = { body, mesh, tipo, inicio: { p: body.position.clone(), q: body.quaternion.clone() } };
      this.objetosFisicos.push(obj);
    }
  }

  // Caja del tamaño del objeto (colliders siempre cajas/esferas, punto 13)
  _crearBody(mesh, masa) {
    // tamaño en el espacio del objeto, sin su rotación actual
    const q = mesh.quaternion.clone();
    mesh.quaternion.identity();
    mesh.updateMatrixWorld(true);
    _caja.makeEmpty().expandByObject(mesh, true);
    _caja.getSize(_tam);
    const centro = _caja.getCenter(new THREE.Vector3()).sub(mesh.position);
    mesh.quaternion.copy(q);
    mesh.updateMatrixWorld(true);

    const body = new CANNON.Body({
      mass: masa,
      material: this.ctx.physics.materiales.objeto,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      quaternion: new CANNON.Quaternion(q.x, q.y, q.z, q.w),
      linearDamping: 0.1,
      angularDamping: 0.2,
      allowSleep: true,
      sleepSpeedLimit: 0.15,
      sleepTimeLimit: 0.6,
    });
    body.addShape(
      new CANNON.Box(new CANNON.Vec3(Math.max(_tam.x, 0.04) / 2, Math.max(_tam.y, 0.04) / 2, Math.max(_tam.z, 0.04) / 2)),
      new CANNON.Vec3(centro.x, centro.y, centro.z),
    );
    body.addEventListener('collide', (e) => this._alChocar(body, e));
    return body;
  }

  _alChocar(body, e) {
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (v <= UMBRAL_RUIDO) return;
    // un mismo choque dispara varios contactos: máximo un ruido cada 0.15 s por objeto
    const ahora = performance.now();
    if (ahora - (this._ultimoGolpe.get(body) ?? 0) < 150) return;
    this._ultimoGolpe.set(body, ahora);
    const posicion = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
    this.ctx.bus.emit('ruido', { posicion, intensidad: v * 1.2, fuente: 'objeto' });
    this.ctx.audio?.sonarEn(SONIDO_GOLPE, posicion, {
      volumen: Math.min(1, v / 6),
      refDistance: 2,
      detune: (Math.random() - 0.5) * 600,
    });
  }

  // ---------------------------------------------------------------- items de la noche
  _modelo(tipo) {
    const plantilla = this.modelos.get(tipo);
    const m = plantilla ? plantilla.clone(true) : new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    m.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.itemTipo = tipo;
      }
    });
    m.userData.itemTipo = tipo;
    return m;
  }

  // Pone los items en SPAWN_ITEM_ aleatorios, sin repetir lugar
  generarItems(listaTipos) {
    this.limpiarItems();
    const lugares = barajar(this.spawnsItems);
    if (listaTipos.length > lugares.length) console.warn('[objetos] hay más items que SPAWN_ITEM_');
    listaTipos.slice(0, lugares.length).forEach((tipo, i) => {
      const mesh = this._modelo(tipo);
      mesh.position.copy(lugares[i]).add(new THREE.Vector3(0, 0.06, 0));
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.ctx.engine.scene.add(mesh);
      this.items.push({ tipo, mesh, body: null, colocado: false });
    });
  }

  // Item suelto con física: al soltarlo, lanzarlo o dejar una contra en el piso
  crearItemFisico(tipo, posicion, velocidad = null, colocado = false) {
    const mesh = this._modelo(tipo);
    mesh.position.copy(posicion);
    this.ctx.engine.scene.add(mesh);
    mesh.updateMatrixWorld(true);
    const body = this._crearBody(mesh, 0.4);
    if (velocidad) {
      body.velocity.set(velocidad.x, velocidad.y, velocidad.z);
      body.angularVelocity.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
    }
    this.ctx.physics.agregar(body, mesh);
    const item = { tipo, mesh, body, colocado };
    this.items.push(item);
    return item;
  }

  // Lo llama el jugador al recogerlo
  quitarItem(item) {
    this.ctx.engine.scene.remove(item.mesh);
    if (item.body) this.ctx.physics.quitar(item.body);
    this.items = this.items.filter((i) => i !== item);
  }

  // Item más cercano a la línea de la mirada, dentro del alcance
  itemEnMira(origen, direccion, alcance = 2.2) {
    let mejor = null;
    let mejorDist = 0.45; // qué tan lejos de la línea de la mirada se acepta
    const v = new THREE.Vector3();
    for (const item of this.items) {
      if (item.colocado) continue;
      v.copy(item.mesh.position).sub(origen);
      const a = v.dot(direccion);
      if (a < 0 || a > alcance) continue;
      const lateral = v.addScaledVector(direccion, -a).length();
      if (lateral < mejorDist) {
        mejorDist = lateral;
        mejor = item;
      }
    }
    return mejor;
  }

  limpiarItems() {
    for (const item of [...this.items]) this.quitarItem(item);
  }

  // Devuelve ollas, botellas y cajas a su lugar
  reiniciarFisicos() {
    for (const o of this.objetosFisicos) {
      o.body.position.copy(o.inicio.p);
      o.body.quaternion.copy(o.inicio.q);
      o.body.velocity.setZero();
      o.body.angularVelocity.setZero();
      o.body.wakeUp();
    }
  }
}
