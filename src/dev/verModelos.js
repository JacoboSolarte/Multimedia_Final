import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Revisión de los .glb antes de pasárselos a Jerónimo: ?escena=modelos
// Muestra polígonos, medidas, origen, frente (+Z) y reproduce las animaciones (punto 11.1).
const MODELOS = [
  { ruta: '/models/espantos/silbon.glb', alto: 2.8, limite: 5000, anims: ['idle', 'caminar', 'correr'] },
  { ruta: '/models/espantos/duende.glb', alto: 0.9, limite: 5000, anims: ['idle', 'caminar', 'correr'] },
  { ruta: '/models/espantos/bruja.glb', alto: 1.7, limite: 5000, anims: ['idle', 'volar'] },
  ...['llave', 'pilas', 'aji', 'radio', 'latigo', 'tijeras', 'sal', 'panela', 'olla', 'botella', 'caja'].map((n) => ({
    ruta: `/models/objetos/${n}.glb`, limite: 500, objeto: true,
  })),
  { ruta: '/models/finca.glb', limite: 35000, finca: true },
];

export async function verModelos(ctx) {
  const { engine, loader } = ctx;
  const scene = engine.scene;
  const cam = engine.camera;
  scene.background = new THREE.Color(0x2a2d33);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2);
  sol.position.set(3, 6, 4);
  scene.add(sol);
  const grilla = new THREE.GridHelper(10, 20, 0x888888, 0x444444);
  scene.add(grilla);
  // flecha azul = +Z de Three.js = el frente que deben mirar los espantos
  const frente = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.01, 0), 1, 0x3399ff, 0.2, 0.1);
  scene.add(frente);

  const orbita = new OrbitControls(cam, engine.renderer.domElement);
  orbita.enableDamping = true;
  cam.position.set(2.5, 2, 3.5);

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:10px;left:10px;width:320px;max-height:95vh;overflow:auto;padding:12px;' +
    'background:#111c;color:#eee;font:13px/1.45 system-ui,sans-serif;border-radius:8px;z-index:10';
  document.body.appendChild(panel);

  let actual = null;
  let mixer = null;
  engine.onUpdate((dt) => {
    mixer?.update(dt);
    orbita.update();
  }, 40);

  async function mostrar(def) {
    if (actual) scene.remove(actual);
    mixer = null;
    let gltf;
    try {
      gltf = await loader.cargarGLB(def.ruta);
    } catch {
      return pintar(def, null);
    }
    actual = gltf.scene;
    scene.add(actual);
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(actual);
    }
    // los huesos se calculan al dibujar: hay que actualizarlos antes de medir un modelo con skin
    actual.updateMatrixWorld(true);
    actual.traverse((o) => o.isSkinnedMesh && o.skeleton.update());
    const caja = new THREE.Box3().setFromObject(actual, true);
    const tam = caja.getSize(new THREE.Vector3());
    const r = Math.max(tam.x, tam.y, tam.z);
    orbita.target.set(0, tam.y / 2, 0);
    cam.position.set(r * 0.9, tam.y * 0.6 + r * 0.3, r * 1.4);
    frente.setLength(Math.max(0.15, r * 0.4), r * 0.08, r * 0.05);
    grilla.scale.setScalar(def.finca ? 6 : Math.max(0.05, r / 3));
    pintar(def, gltf, caja, tam);
  }

  function pintar(def, gltf, caja, tam) {
    const filas = [];
    const ok = (b) => (b ? '✅' : '❌');
    filas.push(`<select id="vm-sel" style="width:100%;margin-bottom:8px">${MODELOS.map((m, i) =>
      `<option value="${i}" ${m === def ? 'selected' : ''}>${m.ruta.split('/').pop()}</option>`).join('')}</select>`);
    if (!gltf) {
      filas.push(`❌ No existe <code>${def.ruta}</code>`);
    } else {
      let tris = 0;
      let mallas = 0;
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        mallas++;
        const g = o.geometry;
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      });
      filas.push(`<b>${def.ruta}</b>`);
      filas.push(`${ok(tris < def.limite)} Triángulos: <b>${tris}</b> (límite ${def.limite}) · mallas: ${mallas}`);
      filas.push(`Medidas: ${tam.x.toFixed(2)} × ${tam.y.toFixed(2)} × ${tam.z.toFixed(2)} m`);
      if (def.alto) {
        filas.push(`${ok(Math.abs(tam.y - def.alto) < def.alto * 0.1)} Alto ${tam.y.toFixed(2)} m (esperado ≈ ${def.alto})`);
        filas.push(`${ok(Math.abs(caja.min.y) < 0.03)} Origen en los pies (min y = ${caja.min.y.toFixed(3)})`);
        filas.push('Frente: debe mirar la flecha azul (+Z)');
      }
      if (def.objeto) {
        const c = caja.getCenter(new THREE.Vector3());
        filas.push(`${ok(c.length() < 0.02)} Origen en el centro (${c.x.toFixed(3)}, ${c.y.toFixed(3)}, ${c.z.toFixed(3)})`);
      }
      if (def.ruta.includes('silbon')) {
        filas.push(`${ok(!!gltf.scene.getObjectByName('silbon_costal'))} Objeto <code>silbon_costal</code>`);
      }
      const nombres = gltf.animations.map((a) => a.name);
      if (def.anims) {
        for (const n of def.anims) filas.push(`${ok(nombres.includes(n))} Animación <code>${n}</code>`);
      }
      if (nombres.length) {
        filas.push('<div style="margin-top:6px">Reproducir:</div>');
        filas.push(nombres.map((n) => `<button data-anim="${n}" style="margin:2px">${n} (${gltf.animations.find((a) => a.name === n).duration.toFixed(2)} s)</button>`).join(''));
      } else if (!def.objeto && !def.finca) {
        filas.push('⚠️ Sin animaciones: avisarle a Jerónimo para animarlo en código');
      }
    }
    panel.innerHTML = filas.join('<br>');
    panel.querySelector('#vm-sel').onchange = (e) => mostrar(MODELOS[+e.target.value]);
    panel.querySelectorAll('[data-anim]').forEach((b) => {
      b.onclick = () => {
        mixer.stopAllAction();
        const clip = THREE.AnimationClip.findByName(gltf.animations, b.dataset.anim);
        const accion = mixer.clipAction(clip);
        accion.setLoop(clip.name === 'atrapar' ? THREE.LoopOnce : THREE.LoopRepeat);
        accion.clampWhenFinished = true;
        accion.reset().play();
      };
    });
    // arranca con idle si existe
    panel.querySelector('[data-anim="idle"]')?.click();
  }

  engine.start();
  await mostrar(MODELOS[0]);
}
