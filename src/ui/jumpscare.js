import * as THREE from 'three';

// Altura a la que queda la cara de cada modelo (origen en los pies)
const CARA = { duende: 0.85, bruja: 1.5, silbon: 2.45 };
const DURACION = 2.4;

// Captura: el espanto salta frente a la cámara, sacudida + grito, y luego negro con el texto.
export class Jumpscare {
  constructor(ctx) {
    this.ctx = ctx; this.tiempo = -1; this.capa = document.getElementById('susto');
    // Luz desde abajo para la cara del espanto. Siempre en escena (intensidad 0) para no recompilar shaders.
    this.luz = new THREE.PointLight(0xff5a3c, 0, 3, 1.2);
    this.luz.position.set(0, -0.5, -0.2);
    ctx.engine.camera.add(this.luz);
    ctx.bus.on('juego:estado', ({ estado }) => {
      if (estado !== 'ATRAPADO') { this.tiempo = -1; this.capa.hidden = true; this.luz.intensity = 0; return; }
      this.tiempo = 0; this.capa.hidden = false;
      this.capa.classList.remove('captura'); void this.capa.offsetWidth; this.capa.classList.add('captura');
      const cam = ctx.engine.camera;
      this.camBase = cam.position.clone();
      this.espanto = ctx.espantos.lista.find((e) => e.tipo === ctx.game.captura.tipo) ?? null;
      // Gira la cámara hacia el espanto y lo pone a 0.9 m de la cara, mirándote
      const delante = cam.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      if (this.espanto?.modelo) {
        const m = this.espanto.modelo;
        const cara = CARA[this.espanto.tipo] ?? 1.5;
        m.visible = true;
        m.position.copy(this.camBase).addScaledVector(delante, 0.9);
        m.position.y = this.camBase.y - cara;
        m.rotation.set(0, Math.atan2(-delante.x, -delante.z), 0);
        this.espanto.mixer?.update(0);
      }
      ctx.audio.sonar('/sounds/ui/grito_captura.wav', { volumen: 0.9 });
    });
  }
  update(dt) {
    if (this.tiempo < 0) return;
    this.tiempo += dt;
    const cam = this.ctx.engine.camera;
    // Sacudida fuerte al principio que se apaga
    const fuerza = Math.max(0, 1 - this.tiempo / 1.1) * 0.06;
    cam.position.set(
      this.camBase.x + (Math.random() - 0.5) * fuerza,
      this.camBase.y + (Math.random() - 0.5) * fuerza,
      this.camBase.z + (Math.random() - 0.5) * fuerza,
    );
    this.espanto?.mixer?.update(dt);
    this.luz.intensity = this.tiempo < 1.4 ? 6 * (0.75 + Math.random() * 0.25) : 0;
    if (this.tiempo >= DURACION) {
      this.tiempo = -1; this.capa.hidden = true; this.luz.intensity = 0;
      cam.position.copy(this.camBase);
      this.ctx.game.finalizarCaptura();
    }
  }
}
