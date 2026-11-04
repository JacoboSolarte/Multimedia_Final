import * as THREE from 'three';
import { OBJETOS } from '../data/objetos.js';

const SONIDO_RECOGER = '/sounds/mundo/recoger.mp3';
const FUERZA_LANZAR = 11;

// 4 espacios, uno activo "en mano". espacios: [{ tipo } | null x4] (contrato player.inventario)
export class Inventario {
  constructor(ctx) {
    this.ctx = ctx;
    this.espacios = [null, null, null, null];
    this.activo = 0;
  }

  get enMano() {
    return this.espacios[this.activo];
  }

  get lleno() {
    return this.espacios.every(Boolean);
  }

  seleccionar(i) {
    this.activo = (i + 4) % 4;
  }

  tieneObjeto(tipo) {
    return this.espacios.some((e) => e?.tipo === tipo);
  }

  // Lo guarda en el espacio activo si está libre; si no, en el primero libre
  agregar(tipo) {
    let i = this.espacios[this.activo] ? this.espacios.findIndex((e) => !e) : this.activo;
    if (i < 0) return -1;
    this.espacios[i] = { tipo, nombre: OBJETOS[tipo]?.nombre ?? tipo };
    this.activo = i;
    return i;
  }

  quitarObjeto(tipo) {
    const i = this.espacios.findIndex((e) => e?.tipo === tipo);
    if (i < 0) return false;
    this.espacios[i] = null;
    return true;
  }

  quitarEnMano() {
    const item = this.enMano;
    this.espacios[this.activo] = null;
    return item;
  }

  vaciar() {
    this.espacios = [null, null, null, null];
    this.activo = 0;
  }

  recoger(item) {
    if (this.agregar(item.tipo) < 0) return false;
    this.ctx.world.objetos.quitarItem(item);
    this.ctx.bus.emit('item:recogido', { tipo: item.tipo });
    this.ctx.audio?.sonar(SONIDO_RECOGER, { volumen: 0.6 });
    return true;
  }

  // Q: el objeto en mano cae frente al jugador
  soltar(player, posicion = null) {
    const item = this.quitarEnMano();
    if (!item) return null;
    const dir = player.direccion.clone().setY(0).normalize();
    const pos = posicion ?? player.posicion.clone().addScaledVector(dir, 0.6).add(new THREE.Vector3(0, 0.6, 0));
    const suelto = this.ctx.world.objetos.crearItemFisico(item.tipo, pos, new THREE.Vector3(dir.x, 0.5, dir.z));
    this.ctx.bus.emit('item:soltado', { tipo: item.tipo, posicion: pos.clone(), body: suelto.body });
    this.ctx.bus.emit('ruido', { posicion: pos.clone(), intensidad: 2, fuente: 'jugador' });
    return suelto;
  }

  // Clic: proyectil físico en la dirección de la cámara (semana 6)
  lanzar(player) {
    const item = this.enMano;
    if (!item || !OBJETOS[item.tipo]?.lanzable) return null;
    this.quitarEnMano();
    const cam = this.ctx.engine.camera;
    const origen = cam.getWorldPosition(new THREE.Vector3()).addScaledVector(player.direccion, 0.5);
    const vel = player.direccion.clone().multiplyScalar(FUERZA_LANZAR).add(new THREE.Vector3(0, 1.5, 0));
    vel.x += player.body.velocity.x;
    vel.z += player.body.velocity.z;
    const lanzado = this.ctx.world.objetos.crearItemFisico(item.tipo, origen, vel);
    this.ctx.bus.emit('item:lanzado', { tipo: item.tipo, body: lanzado.body });
    return lanzado;
  }
}
