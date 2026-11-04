import * as THREE from 'three';
import { clone as clonarEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Duende } from './duende.js';
import { Bruja } from './bruja.js';
import { Silbon } from './silbon.js';
import { RuidoSistema } from './ruido.js';
import { Contras } from './contras.js';

const CLASES = { duende: Duende, bruja: Bruja, silbon: Silbon };
const MODELOS = {
  duende: '/models/espantos/duende.glb', bruja: '/models/espantos/bruja.glb', silbon: '/models/espantos/silbon.glb',
};

// Crea y actualiza los espantos de la noche (contrato 9.7).
export class EspantoManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.lista = [];
    this.modelos = new Map();
    this.ruido = new RuidoSistema(ctx);
    this.contras = new Contras(ctx);
    this._multiplicadores = { multVelocidad: 1, multEscucha: 1 };
    this._desuscribirUpdate = ctx.engine.onUpdate((dt) => this.update(dt), 40);
    this._ultimoUpdate = -1;
    this._promesaPrecarga = null;
    this.precargar();
  }

  async precargar() {
    if (this._promesaPrecarga) return this._promesaPrecarga;
    this._promesaPrecarga = Promise.all(Object.entries(MODELOS).map(async ([tipo, ruta]) => {
      try { this.modelos.set(tipo, await this.ctx.loader.cargarGLB(ruta)); }
      catch (err) { console.warn(`[espantos] no se pudo cargar ${ruta}; se usará el modelo temporal`, err); }
    }));
    await this._promesaPrecarga;
    for (const tipo of Object.keys(MODELOS)) {
      const rutas = {
        duende: ['duende_risa_1', 'duende_risa_2', 'duende_risa_3', 'duende_pasos'],
        bruja: ['bruja_carcajada', 'bruja_aleteo', 'bruja_viento'],
        silbon: ['silbon_silbido', 'silbon_pasos', 'silbon_huesos', 'ladridos'],
      }[tipo];
      await Promise.all(rutas.map((nombre) => this.ctx.audio?.buffer(`/sounds/espantos/${nombre}.mp3`)));
    }
    for (const espanto of this.lista) this._configurarModelo(espanto);
    return this;
  }

  iniciar(listaTipos, multiplicadores = {}) {
    this.detenerTodos();
    this._multiplicadores = { multVelocidad: multiplicadores.multVelocidad ?? 1, multEscucha: multiplicadores.multEscucha ?? 1 };
    for (const tipo of listaTipos ?? []) this.agregar(tipo);
    return this.lista;
  }

  agregar(tipo) {
    const Clase = CLASES[tipo];
    if (!Clase) { console.warn(`[espantos] tipo desconocido: ${tipo}`); return null; }
    const existente = this.lista.find((e) => e.tipo === tipo);
    if (existente) { existente.setActivo(true); return existente; }
    const spawn = this.ctx.world?.spawns?.espantos?.[tipo];
    if (!spawn) console.warn(`[espantos] falta world.spawns.espantos.${tipo}; se usará el origen`);
    const espanto = new Clase(this.ctx, { ...this._multiplicadores, spawn });
    espanto.velocidad = { ...this._multiplicadores };
    this.lista.push(espanto);
    this._configurarModelo(espanto);
    espanto.setActivo(true);
    return espanto;
  }

  _configurarModelo(espanto) {
    const gltf = this.modelos.get(espanto.tipo);
    if (!gltf || espanto.modelo?.userData.modeloReal) return;
    const escena = gltf.animations?.length ? clonarEsqueleto(gltf.scene) : gltf.scene.clone(true);
    escena.userData.modeloReal = true;
    espanto.configurarModelo({ scene: escena, animations: gltf.animations });
  }

  detenerTodos() { for (const espanto of this.lista) espanto.setActivo(false); }

  conectar() {
    if (!this._desuscribirUpdate) this._desuscribirUpdate = this.ctx.engine.onUpdate((dt) => this.update(dt), 40);
    return this;
  }

  desconectar() {
    this._desuscribirUpdate?.();
    this._desuscribirUpdate = null;
  }
  update(dt) {
    // main.js provisional también registra update en prioridad 40; evita procesar dos veces el mismo frame.
    const frame = this.ctx.engine.tiempoTotal;
    if (frame === this._ultimoUpdate) return;
    this._ultimoUpdate = frame;
    for (const espanto of this.lista) espanto.update(dt);
  }

  // { espanto, distancia } para el latido del HUD
  masCercano(posicion) {
    let cercano = null;
    let distancia = Infinity;
    for (const espanto of this.lista) {
      if (!espanto.activo) continue;
      const d = new THREE.Vector3(espanto.body.position.x, espanto.body.position.y, espanto.body.position.z).distanceTo(posicion);
      if (d < distancia) { cercano = espanto; distancia = d; }
    }
    return { espanto: cercano, distancia };
  }

  destruir() {
    this.desconectar();
    for (const espanto of this.lista) espanto.destruir();
    this.lista.length = 0;
    this.ruido.destruir();
    this.contras.destruir();
  }
}
