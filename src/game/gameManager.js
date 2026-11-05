import { MODOS } from './modos.js';
import { OBJETOS } from '../data/objetos.js';
import { Reloj } from './reloj.js';
import { guardado } from './guardado.js';

export class GameManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.estado = 'CARGANDO';
    this.vidas = 3;
    this.nocheActual = 1;
    this.horaJuego = '12:00 a.m.';
    this.reloj = new Reloj(ctx);
    this.datos = guardado.cargar();
    this.puntaje = 0;
    this.oleada = 0;
    this.opcionesModo = {};
    this._quitar = [
      ctx.bus.on('jugador:salida', ({ conLlave }) => {
        if (this.estado === 'JUGANDO' && ctx.modo.salida && conLlave) this.superarNoche();
      }),
      ctx.bus.on('jugador:atrapado', (datos) => this.atrapado(datos)),
    ];
  }
  cambiarEstado(estado) {
    this.estado = estado;
    this.ctx.player?.bloquear(estado !== 'JUGANDO');
    if (estado !== 'JUGANDO') this.ctx.liberarPuntero?.();
    this.ctx.bus.emit('juego:estado', { estado });
  }
  iniciarModo(idModo, opciones = {}) {
    if (!Object.hasOwn(MODOS, idModo)) throw new Error('Modo desconocido');
    this.ctx.espantos.detenerTodos();
    this.opcionesModo = opciones;
    this.mensaje = '';
    const base = MODOS[idModo];
    const dificultad = idModo === 'nocheLibre' ? ({ facil: 0.8, normal: 1, pesadilla: 1.3 }[opciones.dificultad] ?? 1) : 1;
    this.ctx.modo = { ...base, multVelocidad: base.multVelocidad * dificultad, multEscucha: base.multEscucha * dificultad };
    this.vidas = base.vidas;
    this.nocheActual = 1;
    this.puntaje = 0;
    this.oleada = 0;
    this.ctx.player.configurar(this.ctx.modo);
    this.ctx.world.setLuzAmbiente(this.ctx.modo.luzAmbiente);
    if (idModo === 'museo') { this.cambiarEstado('MUSEO'); return; }
    this.prepararNoche();
  }
  prepararNoche() {
    const { ctx } = this;
    ctx.espantos.detenerTodos();
    // Vaciar por métodos del contrato: respawn solo suelta el objeto activo.
    for (const item of [...ctx.player.inventario.espacios]) if (item) ctx.player.quitarObjeto(item.tipo);
    ctx.player.respawn();
    ctx.world.reiniciarNoche();
    this.noche = ctx.modo.noches?.[this.nocheActual - 1] ?? {
      numero: 1,
      espantos: ctx.modo.id === 'supervivencia' ? ['duende'] : [...new Set((this.opcionesModo.espantos ?? ['duende']).filter((t) => ['duende', 'bruja', 'silbon'].includes(t)))],
      lluvia: 0.4, tormenta: false,
    };
    const tiposConContras = ctx.modo.id === 'supervivencia' ? ['duende', 'bruja', 'silbon'] : this.noche.espantos;
    const contras = Object.keys(OBJETOS).filter((t) => tiposConContras.includes(OBJETOS[t].contra));
    // Incluye las tres llaves de cuarto configuradas en el mundo.
    ctx.world.generarItems(['llave_porton', 'pilas', 'llave_cocina', 'llave_sotano', 'llave_atico', ...contras]);
    this.reloj.reiniciar(ctx.modo.duracionNoche);
    this.horaJuego = this.reloj.hora;
    this._proximaOleada = ctx.modo.oleadas?.cadaSegundos ?? Infinity;
    this.oleada = ctx.modo.id === 'supervivencia' ? 1 : 0;
    this._pendienteCaptura = false;
    this.cambiarEstado('INTRO_NOCHE');
    ctx.bus.emit('noche:inicio', { numero: this.nocheActual, espantos: [...this.noche.espantos] });
  }
  comenzarNoche() {
    if (this.estado !== 'INTRO_NOCHE') return;
    this.ctx.renovarEspantos(this.noche.espantos, this.ctx.modo);
    this.cambiarEstado('JUGANDO');
    this.ctx.capturarPuntero?.();
  }
  pausar() { if (this.estado === 'JUGANDO') this.cambiarEstado('PAUSA'); }
  reanudar() {
    if (this.estado !== 'PAUSA') return;
    this.cambiarEstado('JUGANDO');
    this.ctx.capturarPuntero?.();
  }
  atrapado(datos) {
    if (this.estado !== 'JUGANDO') return;
    this.captura = datos;
    this.vidas -= 1;
    this._pendienteCaptura = true;
    this.cambiarEstado('ATRAPADO');
  }
  finalizarCaptura() {
    if (this.estado !== 'ATRAPADO' || !this._pendienteCaptura) return;
    this._pendienteCaptura = false;
    if (this.vidas <= 0) { this.terminarPartida(); return; }
    // Conserva la finca; respawn deja únicamente el objeto activo en el suelo.
    this.ctx.player.respawn();
    this.ctx.renovarEspantos(this.tiposActivos(), this.ctx.modo);
    this.mensaje = 'Despiertas en el cuarto. La finca sigue como la dejaste.';
    this.cambiarEstado('PAUSA');
  }
  tiposActivos() {
    return [...new Set(this.ctx.espantos.lista.filter((e) => e.activo).map((e) => e.tipo))];
  }
  superarNoche() {
    if (this.estado !== 'JUGANDO') return;
    this.ctx.espantos.detenerTodos();
    this.ctx.bus.emit('noche:fin', { resultado: 'escapo' });
    if (this.ctx.modo.id === 'historia') {
      this.datos.desbloqueados = [...new Set([...this.datos.desbloqueados, ...this.noche.espantos])];
      guardado.guardar(this.datos);
    }
    this.cambiarEstado('NOCHE_SUPERADA');
  }
  continuar() {
    if (this.estado === 'NOCHE_SUPERADA') {
      const total = this.ctx.modo.noches?.length ?? 1;
      if (this.nocheActual >= total) { this.cambiarEstado('VICTORIA'); return; }
      this.nocheActual += 1;
      this.prepararNoche();
    } else if (this.estado === 'AMANECIO') {
      if (this.vidas <= 0) this.terminarPartida();
      else this.prepararNoche();
    }
  }
  terminarPartida() {
    this.ctx.espantos.detenerTodos();
    if (this.ctx.modo.id === 'supervivencia') {
      this.datos.record = Math.max(this.datos.record, this.puntaje);
      guardado.guardar(this.datos);
    }
    this.cambiarEstado('GAME_OVER');
  }
  menu() { this.ctx.espantos.detenerTodos(); this.mensaje = ''; this.cambiarEstado('MENU'); }
  update(dt) {
    if (this.estado !== 'JUGANDO') return;
    this.reloj.update(dt);
    this.horaJuego = this.reloj.hora;
    this.puntaje += dt;
    if (this.ctx.modo.id === 'supervivencia' && this.puntaje >= this._proximaOleada) {
      const config = this.ctx.modo.oleadas;
      const tipos = this.tiposActivos();
      if (this.oleada < config.orden.length) {
        const tipo = config.orden[this.oleada];
        this.ctx.espantos.agregar(tipo);
      } else {
        this.ctx.modo.multVelocidad *= 1 + config.subirDificultad;
        this.ctx.modo.multEscucha *= 1 + config.subirDificultad;
        this.ctx.renovarEspantos(tipos, this.ctx.modo);
      }
      this.oleada += 1;
      this._proximaOleada += config.cadaSegundos;
    }
    if (this.reloj.termino) {
      this.vidas -= 1;
      this.ctx.espantos.detenerTodos();
      this.ctx.bus.emit('noche:fin', { resultado: 'amanecio' });
      this.cambiarEstado('AMANECIO');
    }
  }
}
