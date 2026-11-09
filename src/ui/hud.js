import { OBJETOS } from '../data/objetos.js';
export class Hud {
  constructor(ctx) {
    this.ctx = ctx; this.ruido = 0; this.zona = 'cuarto'; this.tMensaje = 0;
    this.capa = document.getElementById('hud');
    this.estado = document.getElementById('estado');
    this.inventario = document.getElementById('inventario');
    this.aviso = document.getElementById('aviso');
    ctx.bus.on('ruido', (d) => { if (d.fuente === 'jugador') this.ruido = Math.max(this.ruido, d.intensidad); });
    ctx.bus.on('jugador:zona', (d) => { this.zona = d.zona; });
    ctx.bus.on('item:recogido', (d) => this.mensaje(`Recogiste: ${OBJETOS[d.tipo]?.nombre ?? d.tipo}`));
    ctx.bus.on('puerta:bloqueada', (d) => this.mensaje(`Necesitas: ${OBJETOS[d.llaveRequerida]?.nombre ?? d.llaveRequerida}`));
    ctx.bus.on('puerta:abierta', () => this.mensaje('Puerta abierta. El ruido puede atraer a los espantos.'));
    ctx.bus.on('jugador:salida', (d) => { if (!d.conLlave && ctx.modo.salida) this.mensaje('Busca la llave del portón para escapar.'); });
    ctx.bus.on('jugador:portal', () => {
      this.mensaje('El pasadizo te llevó al otro extremo.');
      this.capa.classList.remove('portal'); void this.capa.offsetWidth; this.capa.classList.add('portal');
    });
  }
  mensaje(texto) { this.aviso.textContent = texto; this.tMensaje = 4; }
  update(dt) {
    const { ctx } = this;
    this.capa.hidden = ctx.game.estado !== 'JUGANDO';
    if (this.capa.hidden) return;
    this.ruido = Math.max(0, this.ruido - dt * 2);
    this.tMensaje = Math.max(0, this.tMensaje - dt);
    this.aviso.hidden = this.tMensaje <= 0;
    this._hastaActualizar = (this._hastaActualizar ?? 0) - dt;
    if (this._hastaActualizar > 0) return;
    this._hastaActualizar = 0.1;
    const g = ctx.game;
    this.estado.textContent = `${ctx.modo.id === 'supervivencia' ? Math.floor(g.puntaje) + ' s · Oleada ' + g.oleada : g.horaJuego + ' · Noche ' + g.nocheActual} · ${g.vidas} vidas · ${this.zona}`;
    document.getElementById('bateria').textContent = ctx.modo.linterna ? `Linterna ${ctx.player.linterna.encendida ? 'encendida' : 'apagada'} · ${Math.round(ctx.player.linterna.bateria)} %` : 'Apagón · sin linterna';
    document.getElementById('ruido').value = this.ruido;
    this.inventario.replaceChildren(...ctx.player.inventario.espacios.map((item, i) => {
      const slot = document.createElement('span'); slot.className = i === ctx.player.inventario.activo ? 'slot activo' : 'slot';
      slot.textContent = `${i + 1} · ${item?.nombre ?? 'Vacío'}`; return slot;
    }));
  }
}
