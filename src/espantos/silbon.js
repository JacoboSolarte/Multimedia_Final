import * as THREE from 'three';
import { Espanto } from './espanto.js';

export class Silbon extends Espanto {
  constructor(ctx, config = {}) {
    super(ctx, 'silbon', config);
    this._radios = [];
    this._aji = [];
    this._volumenSilbido = 0;
    this._antesDeCapturar = () => {
      if (!this.ctx.player.tieneObjeto('latigo')) return true;
      this.ctx.player.quitarObjeto('latigo');
      this.duracionHuida = 4;
      const alejamiento = this.body.position.distanceTo(this.ctx.player.posicion) || 1;
      const destino = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z)
        .add(new THREE.Vector3(this.body.position.x - this.ctx.player.posicion.x, 0, this.body.position.z - this.ctx.player.posicion.z).normalize().multiplyScalar(10 / alejamiento));
      this._cambiarEstado('HUIDA', destino);
      this.ctx.audio?.sonarEn('/sounds/espantos/silbon_huesos.mp3', this.ctx.player.posicion, { volumen: 0.8, refDistance: 2, maxDistance: 10 });
      return false;
    };
    this._cargarSonidos();
  }

  async _cargarSonidos() {
    this.silbido = await this.cargarSonido('silbon_silbido', { posicional: false, volumen: 0, loop: true });
    this.pasos = await this.cargarSonido('silbon_pasos', { volumen: 0.65, maxDistance: 6, refDistance: 0.5 });
    this.huesos = await this.cargarSonido('silbon_huesos', { volumen: 0.7, maxDistance: 6, refDistance: 0.5 });
  }

  _actualizarUnico(dt) {
    const jugador = this.ctx.player;
    if (this.silbido && jugador) {
      const pos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
      const volumen = THREE.MathUtils.clamp(pos.distanceTo(jugador.posicion) / 25, 0.05, 1);
      this._volumenSilbido += (volumen - this._volumenSilbido) * (1 - Math.exp(-dt * 3));
      this.silbido.setVolume(this._volumenSilbido);
      if (this.activo && !this.silbido.isPlaying && this.ctx.audio.listener.context.state === 'running') this.silbido.play();
    }
    const pos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    for (let i = this._radios.length - 1; i >= 0; i--) {
      const radio = this._radios[i];
      radio.tiempo -= dt;
      if (radio.tiempo <= 0) {
        if (radio.audio?.isPlaying) radio.audio.stop();
        radio.audio?.disconnect();
        if (radio.ancla) this.ctx.engine.scene.remove(radio.ancla);
        this._sonidos = this._sonidos.filter((sonido) => sonido !== radio.audio);
        this._radios.splice(i, 1);
        continue;
      }
      const waypointBloqueado = this.rutaActual.find((wp) => wp.distanceTo(radio.posicion) < 6);
      if (waypointBloqueado) {
        const alternativa = this.grafo.waypoints
          .map((wp) => wp.posicion ?? wp)
          .filter((wp) => wp.distanceTo(radio.posicion) >= 6)
          .sort((a, b) => a.distanceToSquared(waypointBloqueado) - b.distanceToSquared(waypointBloqueado))[0];
        if (alternativa) this._irA(alternativa);
      }
      if (pos.distanceTo(radio.posicion) < 6 && this.estado !== 'HUIDA') {
        const direccion = pos.clone().sub(radio.posicion).normalize();
        this._irA(pos.clone().addScaledVector(direccion, 4));
        if (radio.audio && !radio.audio.isPlaying && this.ctx.audio.listener.context.state === 'running') radio.audio.play();
      }
    }
    for (let i = this._aji.length - 1; i >= 0; i--) {
      const body = this._aji[i];
      const d = pos.distanceTo(new THREE.Vector3(body.position.x, body.position.y, body.position.z));
      if (d < 1.5) this._aturdirPorAji(body);
    }
    if (this.estado === 'ATURDIDO') this.body.velocity.set(0, 0, 0);
  }

  _aplicarContraUnico(tipo, datos) {
    if (tipo === 'aji' && datos.body) {
      this._aji.push(datos.body);
      const revisarImpacto = (evento) => {
        if (evento.body === this.body) {
          datos.body.removeEventListener('collide', revisarImpacto);
          this._aturdirPorAji(datos.body);
        }
      };
      datos.body.addEventListener('collide', revisarImpacto);
      this._listenersAji ??= new Map();
      this._listenersAji.set(datos.body, revisarImpacto);
      return true;
    }
    if (tipo !== 'radio') return false;
    const posicion = datos.posicion?.clone?.() ?? datos.posicion;
    if (!posicion) return false;
    const radio = { posicion, tiempo: 30, audio: null };
    this._radios.push(radio);
    this.ctx.audio?.buffer('/sounds/espantos/ladridos.mp3').then((buffer) => {
      if (!buffer) return;
      radio.audio = this.ctx.audio.crearPositional(buffer, { volumen: 0.45, loop: true, refDistance: 2, maxDistance: 12 });
      const ancla = new THREE.Object3D(); ancla.position.copy(posicion); ancla.add(radio.audio); this.ctx.engine.scene.add(ancla);
      radio.ancla = ancla;
      this._sonidos.push(radio.audio);
      if (this.activo && this.ctx.audio.listener.context.state === 'running') radio.audio.play();
    });
    return true;
  }

  _aturdirPorAji(body) {
    const indice = this._aji.indexOf(body);
    if (indice < 0) return;
    this._aji.splice(indice, 1);
    this._listenersAji?.delete(body);
    this.duracionAturdido = 5;
    this._cambiarEstado('ATURDIDO');
  }

  setActivo(valor) {
    super.setActivo(valor);
    if (!valor && this.silbido?.isPlaying) this.silbido.pause();
  }

  destruir() {
    for (const [body, fn] of this._listenersAji ?? []) body.removeEventListener('collide', fn);
    this._listenersAji?.clear();
    for (const r of this._radios) {
      if (r.audio?.isPlaying) r.audio.stop();
      r.audio?.disconnect();
      if (r.ancla) this.ctx.engine.scene.remove(r.ancla);
    }
    this._radios.length = 0;
    super.destruir();
  }
}
