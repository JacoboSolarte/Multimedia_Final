import * as THREE from 'three';
export class Jumpscare {
  constructor(ctx) {
    this.ctx = ctx; this.tiempo = -1; this.capa = document.getElementById('susto');
    ctx.bus.on('juego:estado', ({ estado }) => {
      if (estado !== 'ATRAPADO') { this.tiempo = -1; this.capa.hidden = true; return; }
      this.tiempo = 0; this.capa.hidden = false;
      this.capa.classList.remove('captura'); void this.capa.offsetWidth; this.capa.classList.add('captura');
      const tipo = ctx.game.captura.tipo;
      const espanto = ctx.espantos.lista.find((e) => e.tipo === tipo);
      const destino = espanto?.modelo.getWorldPosition(new THREE.Vector3()) ?? ctx.game.captura.posicion.clone().add(new THREE.Vector3(0, 1, -1));
      const cam = ctx.engine.camera;
      this.inicio = cam.quaternion.clone();
      cam.lookAt(destino.clone().setY(destino.y + 0.8));
      this.fin = cam.quaternion.clone(); cam.quaternion.copy(this.inicio);
      ctx.audio.sonar('/sounds/ui/grito_captura.wav', { volumen: 0.7 });
    });
  }
  update(dt) {
    if (this.tiempo < 0) return;
    this.tiempo += dt;
    this.ctx.engine.camera.quaternion.slerpQuaternions(this.inicio, this.fin, Math.min(1, this.tiempo / 0.3));
    if (this.tiempo >= 2.2) {
      this.tiempo = -1; this.capa.hidden = true; this.ctx.game.finalizarCaptura();
    }
  }
}
