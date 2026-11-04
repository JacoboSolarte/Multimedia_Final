import * as THREE from 'three';

// AudioListener pegado a la cámara y helpers para crear sonidos (punto 9 / Fase 5).
// Yuly arma el ambiente encima de esto (audio/ambiente.js).
export class AudioSistema {
  constructor(ctx) {
    this.ctx = ctx;
    this.listener = new THREE.AudioListener();
    ctx.engine.camera.add(this.listener);
    this._faltantes = new Set();
  }

  // El navegador bloquea el audio hasta un gesto del usuario (autoplay)
  desbloquear() {
    const c = this.listener.context;
    if (c.state === 'suspended') c.resume();
  }

  // THREE.Audio normal (no posicional): UI, silbido invertido del Silbón, etc.
  crearAudio(buffer, { volumen = 1, loop = false } = {}) {
    const a = new THREE.Audio(this.listener);
    if (buffer) a.setBuffer(buffer);
    a.setVolume(volumen);
    a.setLoop(loop);
    return a;
  }

  // THREE.PositionalAudio: hay que agregarlo a un Object3D para que suene desde ahí
  crearPositional(buffer, { volumen = 1, refDistance = 2, maxDistance = 25, rolloff = 1, loop = false } = {}) {
    const a = new THREE.PositionalAudio(this.listener);
    if (buffer) a.setBuffer(buffer);
    a.setVolume(volumen);
    a.setRefDistance(refDistance);
    a.setMaxDistance(maxDistance);
    a.setRolloffFactor(rolloff);
    a.setDistanceModel('linear');
    a.setLoop(loop);
    return a;
  }

  // Carga un buffer sin romper si el archivo todavía no existe
  async buffer(ruta) {
    try {
      return await this.ctx.loader.cargarAudio(ruta);
    } catch {
      if (!this._faltantes.has(ruta)) console.warn(`[audio] no se pudo cargar ${ruta}`);
      this._faltantes.add(ruta);
      return null;
    }
  }

  // Sonido de una vez, no posicional
  async sonar(ruta, opciones = {}) {
    const buf = await this.buffer(ruta);
    if (!buf || this.listener.context.state !== 'running') return null;
    const a = this.crearAudio(buf, opciones);
    // play() aplica this.detune; setDetune() antes de play() falla porque aún no hay source
    if (opciones.detune) a.detune = opciones.detune;
    a.play();
    return a;
  }

  // Sonido de una vez en un punto del mundo; se limpia solo al terminar
  async sonarEn(ruta, posicion, opciones = {}) {
    const buf = await this.buffer(ruta);
    if (!buf || this.listener.context.state !== 'running') return null;
    const ancla = new THREE.Object3D();
    ancla.position.copy(posicion);
    this.ctx.engine.scene.add(ancla);
    const a = this.crearPositional(buf, opciones);
    // play() aplica this.detune; setDetune() antes de play() falla porque aún no hay source
    if (opciones.detune) a.detune = opciones.detune;
    ancla.add(a);
    a.onEnded = () => {
      a.isPlaying = false;
      ancla.remove(a);
      this.ctx.engine.scene.remove(ancla);
    };
    a.play();
    return a;
  }
}
