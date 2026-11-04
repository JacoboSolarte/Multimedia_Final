import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PUERTAS } from '../data/puertas.js';
import { suavizado } from '../core/utils.js';

const SONIDO_ABRIR = '/sounds/mundo/puerta_abrir.mp3';
const SONIDO_CERRADA = '/sounds/mundo/puerta_cerrada.mp3';
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

// Puerta = malla con el origen en la bisagra + body kinemático que la sigue.
// Con E gira 90° en Y de forma animada, alejándose del jugador.
export class Puertas {
  constructor(ctx, mallas) {
    this.ctx = ctx;
    this.lista = mallas.map((mesh) => this._crear(mesh));
    this.mallas = this.lista.map((p) => p.mesh);
  }

  _crear(mesh) {
    const id = mesh.name.slice('DOOR_'.length);
    mesh.geometry.computeBoundingBox();
    const caja = mesh.geometry.boundingBox;
    const tam = caja.getSize(new THREE.Vector3());
    const centroLocal = caja.getCenter(new THREE.Vector3());
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: this.ctx.physics.materiales.muro,
      shape: new CANNON.Box(new CANNON.Vec3(tam.x / 2, tam.y / 2, tam.z / 2)),
    });
    this.ctx.physics.agregar(body);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.puertaId = id;
    const puerta = {
      id,
      mesh,
      body,
      centroLocal,
      anguloCerrada: mesh.rotation.y,
      angulo: 0, // giro actual respecto a cerrada
      objetivo: 0,
      abierta: false,
      llave: PUERTAS[id] ?? null,
      desbloqueada: !PUERTAS[id],
    };
    this._sincronizar(puerta);
    return puerta;
  }

  // El body sigue a la malla (centro de la hoja, no la bisagra)
  _sincronizar(p) {
    p.mesh.updateWorldMatrix(true, false);
    _v.copy(p.centroLocal);
    p.mesh.localToWorld(_v);
    p.mesh.getWorldQuaternion(_q);
    p.body.position.set(_v.x, _v.y, _v.z);
    p.body.quaternion.set(_q.x, _q.y, _q.z, _q.w);
  }

  porMalla(mesh) {
    return this.lista.find((p) => p.mesh === mesh) ?? null;
  }

  // La llama el jugador con E. Devuelve true si la puerta se movió.
  interactuar(puerta, player) {
    if (!puerta.desbloqueada) {
      if (puerta.llave && player.tieneObjeto(puerta.llave)) {
        puerta.desbloqueada = true; // la llave no se gasta: la puerta queda abierta para siempre
      } else {
        this.ctx.bus.emit('puerta:bloqueada', { id: puerta.id, llaveRequerida: puerta.llave });
        this.ctx.audio?.sonarEn(SONIDO_CERRADA, this._posicion(puerta), { volumen: 0.8 });
        return false;
      }
    }
    puerta.abierta = !puerta.abierta;
    if (puerta.abierta) {
      puerta.objetivo = this._sentidoApertura(puerta, player.posicion) * (Math.PI / 2);
      this.ctx.bus.emit('puerta:abierta', { id: puerta.id });
    } else {
      puerta.objetivo = 0;
    }
    const pos = this._posicion(puerta);
    this.ctx.bus.emit('ruido', { posicion: pos, intensidad: 4, fuente: 'jugador' });
    this.ctx.audio?.sonarEn(SONIDO_ABRIR, pos, { volumen: 0.9, detune: puerta.abierta ? 0 : -300 });
    return true;
  }

  // +1 o -1: la hoja gira hacia el lado contrario a donde está el jugador
  _sentidoApertura(p, posJugador) {
    const bisagra = p.mesh.getWorldPosition(new THREE.Vector3());
    const centro = p.centroLocal.clone();
    p.mesh.localToWorld(centro);
    const dx = centro.x - bisagra.x;
    const dz = centro.z - bisagra.z;
    // girar +90° en Y lleva la hoja (dx, dz) a (dz, -dx)
    const lado = (posJugador.x - bisagra.x) * dz + (posJugador.z - bisagra.z) * -dx;
    return lado > 0 ? -1 : 1;
  }

  _posicion(p) {
    return p.mesh.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.2, 0));
  }

  update(dt) {
    for (const p of this.lista) {
      if (Math.abs(p.objetivo - p.angulo) < 0.0005) continue;
      p.angulo += (p.objetivo - p.angulo) * suavizado(6, dt);
      p.mesh.rotation.y = p.anguloCerrada + p.angulo;
      this._sincronizar(p);
    }
  }

  reiniciar() {
    for (const p of this.lista) {
      p.abierta = false;
      p.objetivo = p.angulo = 0;
      p.desbloqueada = !p.llave;
      p.mesh.rotation.y = p.anguloCerrada;
      this._sincronizar(p);
    }
  }
}
