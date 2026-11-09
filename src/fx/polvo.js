import { Particulas } from './particulas.js';
import * as THREE from 'three';
export class Polvo extends Particulas {
  constructor(ctx) {
    super(ctx, 500, 0xc5b997, 0.018);
    const muestra = new THREE.Vector3();
    for (let i = 0; i < this.cantidad; i++) {
      let x, z, dentro = false;
      for (let intento = 0; intento < 30 && !dentro; intento++) {
        x = (Math.random() - 0.5) * 26; z = (Math.random() - 0.5) * 20;
        muestra.set(x, 1, z);
        dentro = !['patio', 'exterior', 'corredor'].includes(ctx.world.zonaDe(muestra));
      }
      this.posiciones.set([x, dentro ? Math.random() * 2.5 + 0.2 : -100, z], i * 3);
    }
    this.tiempo = 0;
  }
  update(dt) {
    this.tiempo += dt; const n = this.cantidadVisible();
    for (let i = 0; i < n; i++) this.posiciones[i * 3] += Math.sin(this.tiempo * 0.4 + i) * dt * 0.025;
    this.actualizar();
  }
}
