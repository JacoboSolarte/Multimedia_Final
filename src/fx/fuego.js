import { Particulas } from './particulas.js';
export class Fuego extends Particulas {
  constructor(ctx) {
    super(ctx, ctx.world.velas.length * 72, 0xffa14b, 0.055, true);
    this.edades = new Float32Array(this.cantidad);
    for (let i = 0; i < this.cantidad; i++) this.reponer(i);
  }
  reponer(i) {
    const vela = this.ctx.world.velas[Math.floor(i / 72)];
    if (!vela) return;
    this.posiciones.set([vela.x + (Math.random() - 0.5) * 0.07, vela.y + Math.random() * 0.23, vela.z + (Math.random() - 0.5) * 0.07], i * 3);
    this.edades[i] = Math.random() * 0.6;
  }
  update(dt) {
    // Mantiene partículas para todas las velas también en calidad baja.
    const porVela = Math.floor(72 * ({ baja: 0.25, media: 0.6, alta: 1 }[this.ctx.game.datos.opciones.calidad]));
    for (let i = 0; i < this.cantidad; i++) {
      this.edades[i] += dt; this.posiciones[i * 3 + 1] += dt * 0.32;
      if (this.edades[i] > 0.65) this.reponer(i);
      if (i % 72 >= porVela) this.posiciones[i * 3 + 1] = -100;
    }
    this.actualizar();
  }
}
