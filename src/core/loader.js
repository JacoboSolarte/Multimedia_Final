import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Carga de assets con un LoadingManager para la barra de carga (punto 9.4)
export class Loader {
  constructor() {
    this.manager = new THREE.LoadingManager();
    this._fnsProgreso = new Set();
    this.manager.onProgress = (_url, cargados, total) => {
      const p = total ? cargados / total : 1;
      for (const fn of this._fnsProgreso) fn(p);
    };

    this.gltf = new GLTFLoader(this.manager);
    this.rgbe = new RGBELoader(this.manager);
    this.texturas = new THREE.TextureLoader(this.manager);
    this.audios = new THREE.AudioLoader(this.manager);

    // caché por ruta: la misma promesa para todos los que piden el mismo archivo
    this._cacheAudio = new Map();
    this._cacheGLB = new Map();
  }

  cargarGLB(ruta) {
    if (!this._cacheGLB.has(ruta)) {
      const p = this.gltf.loadAsync(ruta).catch((err) => {
        this._cacheGLB.delete(ruta);
        throw err;
      });
      this._cacheGLB.set(ruta, p);
    }
    return this._cacheGLB.get(ruta);
  }

  async cargarHDR(ruta) {
    const tex = await this.rgbe.loadAsync(ruta);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  async cargarTextura(ruta) {
    const tex = await this.texturas.loadAsync(ruta);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Promise<AudioBuffer>, con caché
  cargarAudio(ruta) {
    if (!this._cacheAudio.has(ruta)) {
      const p = this.audios.loadAsync(ruta).catch((err) => {
        this._cacheAudio.delete(ruta);
        throw err;
      });
      this._cacheAudio.set(ruta, p);
    }
    return this._cacheAudio.get(ruta);
  }

  // fn(0..1). Devuelve una función para quitarla.
  onProgreso(fn) {
    this._fnsProgreso.add(fn);
    return () => this._fnsProgreso.delete(fn);
  }
}
