import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Espanto } from './espanto.js';

export class Duende extends Espanto {
  constructor(ctx, config = {}) {
    super(ctx, 'duende', config);
    this._estadoInicial = 'ACECHO';
    this.modelo.visible = false;
    this.estado = 'ACECHO';
    this._estadoInicializado = false;
    this._acechoTimer = 15 + Math.random() * 10;
    this._tiempoIluminado = 0;
    this._tiempoPersecucion = 0;
    this._robo = null;
    this._panela = null;
    this._desuscribir.push(ctx.bus.on('item:soltado', (d) => { if (d.tipo !== 'panela') this._robo = d; }));
    this._cargarSonidos();
  }

  async _cargarSonidos() {
    this.risas = [];
    for (const n of ['duende_risa_1', 'duende_risa_2', 'duende_risa_3']) {
      const audio = await this.cargarSonido(n, { volumen: 0.35, loop: false, maxDistance: 10 });
      if (audio) this.risas.push(audio);
    }
    this.pasos = await this.cargarSonido('duende_pasos', { volumen: 0.3, maxDistance: 7 });
    this.risaObjeto = await this.cargarSonido('duende_risa_1', { volumen: 0.08, maxDistance: 8 });
  }

  _estaEnLinterna() {
    const p = this.ctx.player;
    if (!p?.linterna?.encendida || !p.linterna.luz) return false;
    const luz = p.linterna.luz;
    const origen = luz.getWorldPosition(new THREE.Vector3());
    const destino = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    const hacia = destino.sub(origen);
    if (hacia.length() >= 8) return false;
    // Hacia el target de la SpotLight: getWorldDirection() da el +Z local, que en la cámara apunta HACIA ATRÁS.
    luz.target.getWorldPosition(_dir).sub(origen).normalize();
    return _dir.dot(hacia.normalize()) >= Math.cos(luz.angle ?? 0.42);
  }

  // El Duende solo adquiere al jugador cuando la linterna lo revela.
  _veJugador() { return false; }
  _puedeSentir() { return false; }

  _alPerseguir() {
    const risa = this.risas?.[0];
    if (risa && this.ctx.audio.listener.context.state === 'running') { if (risa.isPlaying) risa.stop(); risa.play(); }
  }

  _actualizarUnico(dt) {
    const iluminado = this._estaEnLinterna();
    this.modelo.visible = this.activo && iluminado;
    if (iluminado) this._tiempoIluminado += dt;
    else this._tiempoIluminado = 0;
    if (this.estado === 'PERSECUCION') {
      this._tiempoPersecucion -= dt;
      if (this._tiempoPersecucion <= 0) this._cambiarEstado('ALERTA', this.ultimaPosicion);
    } else if (iluminado) {
      if (this._tiempoIluminado >= 2) {
        this._tiempoPersecucion = 8;
        this._cambiarEstado('PERSECUCION', this.ctx.player.posicion);
      } else if (this.estado !== 'HUIDA') this._cambiarEstado('HUIDA', this._puntoLejano());
    }

    if (this.estado !== 'CAPTURA' && this._robo?.posicion) {
      const objetivo = this._robo.posicion;
      if (this.body.position.distanceTo(objetivo) < 1) {
        const lugares = (this.ctx.world.spawns.items ?? []).filter((p) => p.distanceTo(this.ctx.player.posicion) > 8);
        const destino = lugares[Math.floor(Math.random() * lugares.length)];
        const item = this.ctx.world.items?.find((i) => i.tipo === this._robo.tipo && i.body === this._robo.body);
        if (item && destino) {
          item.body?.position.set(destino.x, destino.y + 0.3, destino.z);
          item.body?.velocity.setZero();
          item.mesh.position.copy(destino);
          item.colocado = false;
          if (this.risaObjeto) {
            const audio = this.ctx.audio.crearPositional(this.risaObjeto.buffer, { volumen: 0.08, loop: true, refDistance: 1, maxDistance: 8 });
            item.mesh.add(audio);
            if (this.activo && this.ctx.audio.listener.context.state === 'running') audio.play();
            this._sonidos.push(audio);
          }
        }
        this._robo = null;
      } else this._irA(objetivo);
    }
    if (this._panela && this.estado !== 'CAPTURA') {
      if (this.body.position.distanceTo(this._panela) < 1.2) {
        this.duracionDistraido = 20;
        this._cambiarEstado('DISTRAIDO', this._panela);
        this._panela = null;
      } else this._irA(this._panela);
    }
    this._acechoTimer -= dt;
    if (this._acechoTimer <= 0) {
      this._empujarObjeto();
      this._acechoTimer = 15 + Math.random() * 10;
    }
    this._tiempoRisa = (this._tiempoRisa ?? 5 + Math.random() * 10) - dt;
    if (this._tiempoRisa <= 0) {
      const risa = this.risas?.[Math.floor(Math.random() * this.risas.length)];
      if (risa && this.activo && this.ctx.audio.listener.context.state === 'running') {
        if (risa.isPlaying) risa.stop();
        risa.play();
      }
      this._tiempoRisa = 9 + Math.random() * 14;
    }
  }

  _puntoLejano() {
    // Lejos del jugador, en la dirección contraria (antes era al azar y a veces corría hacia él)
    const p = this.ctx.player.posicion;
    const huir = new THREE.Vector3(this.body.position.x - p.x, 0, this.body.position.z - p.z);
    if (huir.lengthSq() < 0.01) huir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    huir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2);
    return p.clone().addScaledVector(huir, 8 + Math.random() * 4);
  }

  _empujarObjeto() {
    const p = this.ctx.player.posicion;
    const candidatos = (this.ctx.world.objetosFisicos ?? []).filter((o) => o.body && new THREE.Vector3(o.body.position.x, o.body.position.y, o.body.position.z).distanceTo(p) < 8);
    const obj = candidatos[Math.floor(Math.random() * candidatos.length)];
    if (!obj) return;
    const impulso = new THREE.Vector3((Math.random() - 0.5) * 4, 3, (Math.random() - 0.5) * 4);
    obj.body.applyImpulse(new CANNON.Vec3(impulso.x, impulso.y, impulso.z), obj.body.position);
    obj.body.wakeUp();
  }

  _aplicarContraUnico(tipo, datos) {
    if (tipo !== 'panela') return false;
    this._panela = datos.posicion?.clone?.() ?? datos.posicion;
    if (this._panela) this._cambiarEstado('DISTRAIDO', this._panela);
    return true;
  }
}

const _dir = new THREE.Vector3();
