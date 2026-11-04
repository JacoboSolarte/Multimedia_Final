// Reparte el evento de ruido del jugador y de los choques físicos.
export class RuidoSistema {
  constructor(ctx) {
    this.ctx = ctx;
    this._quitar = ctx.bus.on('ruido', (datos) => {
      for (const espanto of ctx.espantos?.lista ?? []) if (espanto.activo) espanto.oirRuido(datos);
    });
  }

  update(_dt) {}
  destruir() { this._quitar?.(); }
}
