export class Relampagos {
  constructor(ctx) {
    this.ctx = ctx; this.espera = 20 + Math.random() * 20; this.destello = 0; this.trueno = -1;
    ctx.bus.on('juego:estado', ({ estado }) => {
      if (estado !== 'JUGANDO') { this.destello = 0; this.ctx.world.setLuzAmbiente(this.ctx.modo.luzAmbiente); }
    });
  }
  update(dt) {
    if (!this.ctx.game.noche?.tormenta) return;
    this.espera -= dt;
    if (this.espera <= 0) { this.espera = 20 + Math.random() * 20; this.destello = 0.22; this.trueno = 1.2; }
    if (this.destello > 0) {
      this.destello -= dt;
      this.ctx.world.setLuzAmbiente(this.destello > 0 ? 0.7 : this.ctx.modo.luzAmbiente);
    }
    if (this.trueno >= 0) {
      this.trueno -= dt;
      if (this.trueno < 0) this.ctx.audio.sonar('/sounds/ambiente/trueno.wav', { volumen: this.ctx.game.datos.opciones.ambiente });
    }
  }
}
