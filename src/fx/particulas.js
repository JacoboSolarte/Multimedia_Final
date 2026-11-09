import * as THREE from 'three';
// Un solo Points por sistema, con buffers reutilizados y calidad por drawRange.
export class Particulas {
  constructor(ctx, cantidad, color, tamano, aditivo = false) {
    this.ctx = ctx; this.cantidad = cantidad;
    this.posiciones = new Float32Array(cantidad * 3);
    this.geometria = new THREE.BufferGeometry();
    this.geometria.setAttribute('position', new THREE.BufferAttribute(this.posiciones, 3));
    this.material = new THREE.PointsMaterial({ color, size: tamano, transparent: true, opacity: 0.65, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.puntos = new THREE.Points(this.geometria, this.material);
    this.puntos.frustumCulled = false;
    ctx.engine.scene.add(this.puntos);
  }
  cantidadVisible(factor = 1) {
    const escala = { baja: 0.25, media: 0.6, alta: 1 }[this.ctx.game.datos.opciones.calidad];
    const n = Math.floor(this.cantidad * escala * factor);
    this.geometria.setDrawRange(0, n); return n;
  }
  actualizar() { this.geometria.attributes.position.needsUpdate = true; }
}
