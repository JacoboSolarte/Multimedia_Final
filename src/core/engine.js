import * as THREE from 'three';

// Calidades: pixelRatio y tamaño de los shadow maps (punto 13)
const CALIDADES = {
  baja: { pixelRatio: () => 1, sombra: 512 },
  media: { pixelRatio: () => Math.min(window.devicePixelRatio, 1.5), sombra: 1024 },
  alta: { pixelRatio: () => Math.min(window.devicePixelRatio, 2), sombra: 1024 },
};

// Engine: escena, cámara, renderer y el bucle con prioridades (punto 7.3)
export class Engine {
  constructor(contenedor = document.body) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 200);
    // la cámara va en la escena para que la linterna (hija de la cámara) se renderice
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    contenedor.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock(false);
    this.tiempoTotal = 0;
    this._suscritos = [];
    this._idFrame = null;
    this.calidad = 'media';
    this.setCalidad(this.calidad);

    // el render es un suscrito más, siempre el último (prioridad 100)
    this.onUpdate(() => this.renderer.render(this.scene, this.camera), 100);

    this._alRedimensionar = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._alRedimensionar);
  }

  // fn(dt, tiempoTotal). Devuelve una función para quitarla.
  onUpdate(fn, prioridad = 50) {
    const entrada = { fn, prioridad };
    this._suscritos.push(entrada);
    // sort estable: a igual prioridad se respeta el orden de suscripción
    this._suscritos.sort((a, b) => a.prioridad - b.prioridad);
    return () => {
      const i = this._suscritos.indexOf(entrada);
      if (i >= 0) this._suscritos.splice(i, 1);
    };
  }

  start() {
    if (this._idFrame !== null) return;
    this.clock.start();
    const bucle = () => {
      this._idFrame = requestAnimationFrame(bucle);
      // dt limitado a 0.05 s: si la pestaña se congela, la física no explota
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.tiempoTotal += dt;
      for (const { fn } of [...this._suscritos]) fn(dt, this.tiempoTotal);
    };
    bucle();
  }

  stop() {
    if (this._idFrame !== null) cancelAnimationFrame(this._idFrame);
    this._idFrame = null;
    this.clock.stop();
  }

  setCalidad(nivel) {
    const c = CALIDADES[nivel];
    if (!c) return console.warn(`[engine] calidad desconocida: ${nivel}`);
    this.calidad = nivel;
    this.renderer.setPixelRatio(c.pixelRatio());
    // cambiar el tamaño del shadow map exige botar el mapa viejo para que se cree de nuevo
    this.scene.traverse((o) => {
      if (o.isLight && o.castShadow && o.shadow) {
        o.shadow.mapSize.set(c.sombra, c.sombra);
        o.shadow.map?.dispose();
        o.shadow.map = null;
      }
    });
  }

  get tamanoSombra() {
    return CALIDADES[this.calidad].sombra;
  }
}
