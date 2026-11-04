import * as THREE from 'three';
import { Espanto } from './espanto.js';

export class Bruja extends Espanto {
  constructor(ctx, config = {}) {
    super(ctx, 'bruja', config);
    this._estadoInicial = 'VOLANDO';
    this.estado = 'VOLANDO';
    this.modelo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this._ruta = ctx.world.rutaBruja ?? [];
    this._indiceRuta = 0;
    this._ventanaAtraida = null;
    this._ventanaEntrada = null;
    this._tiempoDentro = 0;
    this._desuscribir.push(
      ctx.bus.on('linterna:cambio', () => this._buscarVentana()),
    );
    this._cargarSonidos();
  }

  async _cargarSonidos() {
    await this.cargarSonido('bruja_aleteo', { volumen: 0.35, maxDistance: 20 });
    await this.cargarSonido('bruja_viento', { volumen: 0.25, maxDistance: 22 });
  }

  _veJugador() { return Boolean(this._ventanaEntrada) && super._veJugador(); }

  _buscarVentana() {
    if (!this.ctx.player?.linterna?.encendida || !['VOLANDO', 'ATRAIDA'].includes(this.estado)) return;
    const p = this.ctx.player.posicion;
    const ventana = (this.ctx.world.ventanas ?? []).find((v) => !v.sellada && v.posicion.distanceTo(p) < 6);
    if (!ventana) {
      if (this.estado === 'ATRAIDA') this._volverAFuera();
      return;
    }
    this._ventanaAtraida = ventana;
    this._cambiarEstado('ATRAIDA', ventana.posicion);
  }

  _actualizarUnico(dt) {
    if (this.estado === 'VOLANDO') {
      if (this._ruta.length) {
        const punto = this._ruta[this._indiceRuta % this._ruta.length];
        const destino = punto.clone(); destino.y += 2.1;
        this._irA(destino);
        if (this.body.position.distanceTo(destino) < 0.8) this._indiceRuta = (this._indiceRuta + 1) % this._ruta.length;
      }
      this._buscarVentana();
    } else if (this.estado === 'ATRAIDA' && this._ventanaAtraida) {
      const v = this._ventanaAtraida;
      if (v.sellada) { this._volverAFuera(); return; }
      const destino = v.posicion.clone(); destino.y += 1.5;
      this._irA(destino);
      if (this.body.position.distanceTo(destino) < 1) {
        this._ventanaEntrada = v;
        const wp = this.grafo.waypointAleatorio();
        if (wp) {
          const destinoInterior = wp.posicion.clone(); destinoInterior.y += 1.5;
          this.body.position.set(destinoInterior.x, destinoInterior.y, destinoInterior.z);
          this.body.velocity.setZero();
          this._posAnterior.set(destinoInterior.x, destinoInterior.y, destinoInterior.z);
          this._cambiarEstado('DENTRO', wp.posicion);
          this._tiempoDentro = 40;
          this._reproducirUnaVez('bruja_carcajada');
        } else this._volverAFuera();
      }
    } else if (this._ventanaEntrada && ['DENTRO', 'PERSECUCION', 'ALERTA', 'PATRULLA'].includes(this.estado)) {
      this._tiempoDentro -= dt;
      if (this._tiempoDentro <= 0) this._volverAFuera();
    } else if (this.estado === 'SALIR' && this._ventanaEntrada) {
      const destino = this._ventanaEntrada.posicion.clone(); destino.y += 1.8;
      this._irA(destino);
      if (this.body.position.distanceTo(destino) < 1) {
        this._ventanaAtraida = null;
        this._ventanaEntrada = null;
        this._cambiarEstado('VOLANDO');
      }
    }
  }

  async _reproducirUnaVez(nombre) {
    const buffer = await this.ctx.audio?.buffer(`/sounds/espantos/${nombre}.mp3`);
    if (!buffer || !this.modelo || !this.activo) return;
    const audio = this.ctx.audio.crearPositional(buffer, { volumen: 0.7, refDistance: 2, maxDistance: 18 });
    this.modelo.add(audio); audio.play(); this._sonidos.push(audio);
  }

  _volverAFuera() {
    if (this._ventanaEntrada) this._cambiarEstado('SALIR');
    else { this._ventanaAtraida = null; this._cambiarEstado('VOLANDO'); }
  }

  _llegoObjetivo() {
    if (this.estado === 'ALERTA') this._cambiarEstado('PATRULLA');
    else if (this.estado === 'PATRULLA' || this.estado === 'DENTRO') this._elegirPatrulla();
  }

  _aplicarContraUnico(tipo, datos) {
    if (!['tijeras', 'sal'].includes(tipo) || !datos.ventanaId) return false;
    const ventana = this.ctx.world.ventanas.find((v) => v.id === datos.ventanaId);
    if (ventana) this.ctx.world.sellarVentana?.(datos.ventanaId, tipo);
    if (this._ventanaAtraida?.id === datos.ventanaId) this._volverAFuera();
    return Boolean(ventana);
  }
}
