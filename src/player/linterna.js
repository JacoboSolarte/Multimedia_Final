import * as THREE from 'three';

const SONIDO_CLICK = '/sounds/jugador/linterna_click.mp3';
const SEGUNDOS_POR_PUNTO = 3; // gasta 1 % cada 3 s encendida (punto 3.3)

// SpotLight hija de la cámara, con sombra. Cumple el contrato player.linterna { encendida, bateria, luz }.
export class Linterna {
  constructor(ctx) {
    this.ctx = ctx;
    this.encendida = false;
    this.bateria = 100;
    this.habilitada = true; // modo Apagón: false
    this.conBateria = true;
    this._acumulado = 0;

    this.luz = new THREE.SpotLight(0xfff1d6, 0, 22, 0.42, 0.45, 1.4);
    this.luz.castShadow = true;
    const t = ctx.engine.tamanoSombra;
    this.luz.shadow.mapSize.set(t, t);
    this.luz.shadow.camera.near = 0.2;
    this.luz.shadow.camera.far = 22;
    this.luz.shadow.bias = -0.0008;
    this.luz.shadow.normalBias = 0.02;
    this.luz.position.set(0.18, -0.15, 0.05); // en la mano derecha, un poco abajo
    this.luz.target.position.set(0, 0, -5);   // apunta al frente de la cámara
    ctx.engine.camera.add(this.luz, this.luz.target);
    this.intensidad = 28;
  }

  configurar(habilitada, conBateria) {
    this.habilitada = habilitada;
    this.conBateria = conBateria;
    if (!habilitada) this.apagar();
  }

  alternar() {
    if (!this.habilitada) return;
    if (!this.encendida && this.bateria <= 0) {
      this.ctx.audio?.sonar(SONIDO_CLICK, { volumen: 0.5, detune: -500 });
      return;
    }
    this.encendida = !this.encendida;
    this.ctx.audio?.sonar(SONIDO_CLICK, { volumen: 0.6 });
    this._avisar();
  }

  apagar() {
    if (!this.encendida) return;
    this.encendida = false;
    this._avisar();
  }

  // Las pilas recargan 50 %
  recargar(cantidad = 50) {
    this.bateria = Math.min(100, this.bateria + cantidad);
    this._avisar();
  }

  _avisar() {
    this.ctx.bus.emit('linterna:cambio', { encendida: this.encendida, bateria: Math.round(this.bateria) });
  }

  update(dt, tiempo) {
    if (this.encendida && this.conBateria) {
      this._acumulado += dt;
      if (this._acumulado >= SEGUNDOS_POR_PUNTO) {
        this._acumulado -= SEGUNDOS_POR_PUNTO;
        this.bateria = Math.max(0, this.bateria - 1);
        if (this.bateria <= 0) this.encendida = false;
        this._avisar();
      }
    }
    // con poca batería titila
    let factor = 1;
    if (this.encendida && this.bateria < 10) {
      factor = Math.sin(tiempo * 31) > 0.85 || Math.random() < 0.04 ? 0.15 : 0.7 + Math.random() * 0.2;
    }
    this.luz.intensity = this.encendida ? this.intensidad * factor : 0;
  }
}
