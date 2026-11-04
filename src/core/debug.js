import GUI from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';

// Modo debug (punto 14): solo existe si la URL trae ?debug
export function crearDebug(engine) {
  if (!new URLSearchParams(window.location.search).has('debug')) return null;
  return new Debug(engine);
}

export class Debug {
  constructor(engine) {
    this.gui = new GUI({ title: 'Debug · Espantos' });
    this.stats = new Stats();
    document.body.appendChild(this.stats.dom);

    // llamadas de dibujo y triángulos del último frame
    this.render = { llamadas: 0, triangulos: 0, calidad: engine.calidad };
    const carpeta = this.gui.addFolder('Render');
    carpeta.add(this.render, 'llamadas').listen().disable();
    carpeta.add(this.render, 'triangulos').listen().disable();
    carpeta.add(this.render, 'calidad', ['baja', 'media', 'alta']).onChange((v) => engine.setCalidad(v));

    // se mide justo después del render (prioridad 100)
    engine.onUpdate(() => {
      this.stats.update();
      this.render.llamadas = engine.renderer.info.render.calls;
      this.render.triangulos = engine.renderer.info.render.triangles;
    }, 101);
  }

  // cada módulo agrega su carpeta: ctx.debug?.addFolder('...')
  addFolder(nombre) {
    return this.gui.addFolder(nombre);
  }
}
