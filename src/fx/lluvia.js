import { Particulas } from './particulas.js';
import * as THREE from 'three';
export class Lluvia extends Particulas {
  constructor(ctx) {
    super(ctx, 4000, 0xa8bdcf, 0.035);
    this.muestra = new THREE.Vector3();
    for (let i = 0; i < this.cantidad; i++) this.reponer(i, true);
  }
  reponer(i, inicial = false) {
    const p = this.posiciones;
    const x = (Math.random() - 0.5) * 54, z = (Math.random() - 0.5) * 48;
    this.muestra.set(x, 0.6, z);
    // Las zonas interiores se descartan: no llueve a través de los techos.
    const exterior = ['exterior', 'patio', 'corredor'].includes(this.ctx.world.zonaDe(this.muestra));
    p.set([x, exterior ? (inicial ? Math.random() * 13 : 13) : -100, z], i * 3);
  }
  update(dt) {
    const n = this.cantidadVisible(this.ctx.game.noche?.lluvia ?? 0.2);
    for (let i = 0; i < n; i++) {
      const j = i * 3; this.posiciones[j + 1] -= dt * 9;
      if (this.posiciones[j + 1] < 0) this.reponer(i);
    }
    this.actualizar();
  }
}
