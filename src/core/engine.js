import * as THREE from 'three';

// Calidades: pixelRatio y tamaño de los shadow maps (punto 13)
// escalaMin: hasta dónde puede bajar la resolución dinámica si los FPS caen.
// lunaCada: la sombra de la luna (fija) se recalcula cada N frames; la linterna sigue en cada frame.
const CALIDADES = {
  baja: { pixelRatio: () => 1, sombra: 512, escalaMin: 0.6, lunaCada: 4 },
  media: { pixelRatio: () => Math.min(window.devicePixelRatio, 1.5), sombra: 1024, escalaMin: 0.7, lunaCada: 2 },
  alta: { pixelRatio: () => Math.min(window.devicePixelRatio, 2), sombra: 1024, escalaMin: 0.85, lunaCada: 1 },
};

// Resolución dinámica: se mide el tiempo medio de frame cada segundo
const MS_LENTO = 21; // < ~48 FPS: baja la resolución
const MS_HOLGADO = 17.5; // ~60 FPS estables: la sube poco a poco
const SEGUNDOS_PARA_SUBIR = 3;

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
    this._frame = 0;
    this._sombrasLentas = new Set();
    this.resolucionDinamica = true;
    this.escala = 1;
    this._medicion = { ms: 0, frames: 0, holgados: 0 };
    this.calidad = 'media';
    this.setCalidad(this.calidad);

    // el render es un suscrito más, siempre el último (prioridad 100)
    this.onUpdate(() => {
      const cada = CALIDADES[this.calidad].lunaCada;
      // three vuelve needsUpdate a false después de dibujar esa sombra
      if (this._frame % cada === 0) for (const luz of this._sombrasLentas) luz.shadow.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
      this._frame++;
    }, 100);

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
      const real = this.clock.getDelta();
      // dt limitado a 0.05 s: si la pestaña se congela, la física no explota
      const dt = Math.min(real, 0.05);
      this.tiempoTotal += dt;
      // copia solo si la lista cambia durante el frame (antes se copiaba en cada frame)
      const lista = this._suscritos;
      for (let i = 0; i < lista.length; i++) {
        const s = lista[i];
        s.fn(dt, this.tiempoTotal);
        if (lista[i] !== s) {
          // alguien se quitó o se agregó: seguir justo después de este suscrito
          const j = lista.indexOf(s);
          i = j >= 0 ? j : i - 1;
        }
      }
      this._medirFrame(real);
    };
    bucle();
  }

  // Baja la resolución si el juego va lento y la sube cuando sobra GPU.
  _medirFrame(segundos) {
    if (!this.resolucionDinamica) return;
    // pausas, cambios de pestaña o compilación de shaders no cuentan como "lento"
    if (segundos > 0.25 || document.hidden) return;
    const m = this._medicion;
    m.ms += segundos * 1000;
    m.frames++;
    if (m.ms < 1000) return;
    const medio = m.ms / m.frames;
    m.ms = 0;
    m.frames = 0;
    const { escalaMin } = CALIDADES[this.calidad];
    if (medio > MS_LENTO && this.escala > escalaMin) {
      this._aplicarEscala(Math.max(escalaMin, this.escala - 0.1));
      m.holgados = 0;
    } else if (medio < MS_HOLGADO && this.escala < 1) {
      if (++m.holgados >= SEGUNDOS_PARA_SUBIR) {
        this._aplicarEscala(Math.min(1, this.escala + 0.05));
        m.holgados = 0;
      }
    } else m.holgados = 0;
  }

  _aplicarEscala(escala) {
    this.escala = Math.round(escala * 100) / 100;
    this.renderer.setPixelRatio(CALIDADES[this.calidad].pixelRatio() * this.escala);
  }

  // Luces con sombra que no necesitan recalcularse en cada frame (la luna)
  registrarSombraLenta(luz) {
    luz.shadow.autoUpdate = false;
    luz.shadow.needsUpdate = true;
    this._sombrasLentas.add(luz);
  }

  // Compila de una vez los shaders de todo lo que hay en la escena, incluidos objetos ocultos
  // (Duende invisible, espantos inactivos). Sin esto, la primera vez que algo aparece en
  // pantalla el navegador se congela compilando (los "tirones" al ver un espanto o un objeto).
  precompilar(ocultos = []) {
    const antes = ocultos.map((o) => [o, o.visible]);
    for (const o of ocultos) o.visible = true;
    try {
      this.renderer.compile(this.scene, this.camera);
    } finally {
      for (const [o, v] of antes) o.visible = v;
    }
  }

  stop() {
    if (this._idFrame !== null) cancelAnimationFrame(this._idFrame);
    this._idFrame = null;
    this.clock.stop();
  }

  setCalidad(nivel) {
    const c = CALIDADES[nivel];
    if (!c) return console.warn(`[engine] calidad desconocida: ${nivel}`);
    const cambio = nivel !== this.calidad || !this._calidadAplicada;
    this.calidad = nivel;
    this._calidadAplicada = true;
    if (cambio) this.escala = 1; // la resolución dinámica vuelve a empezar desde arriba
    this.renderer.setPixelRatio(c.pixelRatio() * this.escala);
    if (!cambio) return; // guardar opciones sin cambiar la calidad no debe rehacer las sombras (tirón)
    // cambiar el tamaño del shadow map exige botar el mapa viejo para que se cree de nuevo
    this.scene.traverse((o) => {
      if (o.isLight && o.castShadow && o.shadow) {
        o.shadow.mapSize.set(c.sombra, c.sombra);
        o.shadow.map?.dispose();
        o.shadow.map = null;
        o.shadow.needsUpdate = true;
      }
    });
  }

  get tamanoSombra() {
    return CALIDADES[this.calidad].sombra;
  }
}
