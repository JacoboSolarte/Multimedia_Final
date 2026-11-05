export class Reloj {
  constructor(ctx) { this.ctx = ctx; this.reiniciar(360); }
  reiniciar(duracion) { this.duracion = duracion; this.transcurrido = 0; }
  update(dt) { this.transcurrido += Math.max(0, dt); }
  get termino() { return Number.isFinite(this.duracion) && this.transcurrido >= this.duracion; }
  get hora() {
    const minutos = Number.isFinite(this.duracion) ? Math.min(360, Math.floor(this.transcurrido / this.duracion * 360)) : 0;
    const horas = Math.floor(minutos / 60);
    return `${horas === 0 ? 12 : horas}:${String(minutos % 60).padStart(2, '0')} a.m.`;
  }
}
