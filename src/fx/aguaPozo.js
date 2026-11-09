import { Particulas } from './particulas.js';
export class AguaPozo extends Particulas {
  constructor(ctx) {
    super(ctx, 250, 0x90cddd, 0.035);
    this.velocidades = new Float32Array(this.cantidad * 3);
    for (let i = 0; i < this.cantidad; i++) this.reponer(i);
  }
  reponer(i) {
    const origen = this.ctx.world.pozo; const j = i * 3; const a = Math.random() * Math.PI * 2;
    this.posiciones.set([origen.x, origen.y, origen.z], j);
    this.velocidades.set([Math.cos(a) * 0.3, 0.8 + Math.random() * 0.8, Math.sin(a) * 0.3], j);
  }
  update(dt) {
    const n = this.cantidadVisible();
    for (let i = 0; i < n; i++) {
      const j = i * 3; this.velocidades[j + 1] -= 3 * dt;
      for (let eje = 0; eje < 3; eje++) this.posiciones[j + eje] += this.velocidades[j + eje] * dt;
      if (this.posiciones[j + 1] < this.ctx.world.pozo.y - 0.3) this.reponer(i);
    }
    this.actualizar();
  }
}
