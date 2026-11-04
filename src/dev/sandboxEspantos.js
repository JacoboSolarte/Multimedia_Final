import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EspantoManager } from '../espantos/espantoManager.js';

const materialMuro = new THREE.MeshStandardMaterial({ color: 0x77716a, transparent: true, opacity: 0.72 });

// Escena aislada para probar IA, waypoints, escondites y contras sin cargar la finca.
export async function sandboxEspantos(ctx) {
  const escena = ctx.engine.scene;
  escena.background = new THREE.Color(0x10131b);
  escena.fog = new THREE.Fog(0x10131b, 18, 50);
  ctx.engine.camera.position.set(12, 13, 15);
  const controles = new OrbitControls(ctx.engine.camera, ctx.engine.renderer.domElement);
  controles.target.set(0, 0.5, 0);
  controles.update();
  escena.add(new THREE.HemisphereLight(0x9eb5dc, 0x29221c, 2));
  const sol = new THREE.DirectionalLight(0xffe2b0, 2); sol.position.set(4, 12, 5); sol.castShadow = true; escena.add(sol);

  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(24, 20), new THREE.MeshStandardMaterial({ color: 0x343c34 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.08; suelo.receiveShadow = true; escena.add(suelo);
  const obstaculos = [];
  const agregarMuro = (x, z, ancho, alto, fondo, color = 0x77716a) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), materialMuro.clone());
    mesh.material.color.setHex(color); mesh.position.set(x, alto / 2, z); mesh.castShadow = true; mesh.receiveShadow = true;
    escena.add(mesh); obstaculos.push(mesh);
    const body = new CANNON.Body({ mass: 0, material: ctx.physics.materiales.muro, position: new CANNON.Vec3(x, alto / 2, z) });
    body.addShape(new CANNON.Box(new CANNON.Vec3(ancho / 2, alto / 2, fondo / 2))); ctx.physics.agregar(body);
    return mesh;
  };
  agregarMuro(0, -9.7, 24, 3, 0.6); agregarMuro(0, 9.7, 24, 3, 0.6);
  agregarMuro(-11.7, 0, 0.6, 3, 20); agregarMuro(11.7, 0, 0.6, 3, 20);
  agregarMuro(-4, 0, 0.5, 3, 12); agregarMuro(4, -3, 0.5, 3, 8); agregarMuro(4, 6, 0.5, 3, 4);
  agregarMuro(0, 3, 7, 2.6, 0.5, 0x705d49);

  const crearVolumen = (x, z, sx, sz, nombre, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.7, sz), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, wireframe: true }));
    m.position.set(x, 0.85, z); m.name = nombre; escena.add(m); return m;
  };
  const escondites = [-8, -2, 6].map((x, i) => {
    const m = crearVolumen(x, 7, 1.5, 1.2, `HIDE_armario_${i + 1}`, 0x47a2ff);
    return { id: m.name, caja: new THREE.Box3().setFromObject(m), puntoCamara: new THREE.Vector3(x, 1.5, 7) };
  });
  const ventanas = [-7, 0, 8].slice(0, 2).map((x, i) => {
    const m = crearVolumen(x, -9.2, 2, 0.6, `WIN_${i + 1}`, 0xffd45e);
    const caja = new THREE.Box3().setFromObject(m);
    return { id: String(i + 1), caja, posicion: caja.getCenter(new THREE.Vector3()), sellada: false };
  });
  const waypoints = [];
  const puntos = [[-8,-6],[-6,-4],[-2,-6],[2,-6],[7,-6],[8,-1],[7,3],[8,7],[3,7],[0,5],[-3,7],[-8,5]];
  puntos.forEach(([x,z], i) => { const posicion = new THREE.Vector3(x, 0.3, z); waypoints.push({ id: `WP_${String(i+1).padStart(2,'0')}`, posicion, vecinos: [] }); });
  const rutaBruja = [[-10,-8],[0,-8],[10,-8],[10,8],[0,8],[-10,8]].map(([x,z]) => new THREE.Vector3(x, 1, z));
  const spawnsItems = [new THREE.Vector3(-9,0,-6),new THREE.Vector3(-1,0,-7),new THREE.Vector3(6,0,-5),new THREE.Vector3(9,0,5)];
  const jugadorVisual = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 3, 6), new THREE.MeshStandardMaterial({ color: 0x4ab5ff }));
  jugadorVisual.position.set(-8, 0.7, -7); escena.add(jugadorVisual);
  const luz = new THREE.SpotLight(0xffefc4, 0, 8, Math.PI / 7, 0.4); luz.position.set(0,0,0); luz.target.position.set(0,0,-5); ctx.engine.camera.add(luz, luz.target);
  ctx.player = {
    posicion: new THREE.Vector3(-8, 0, -7), isHidden: false,
    linterna: { encendida: false, luz },
    invulnerable: false,
    tieneObjeto: (tipo) => inventario.has(tipo),
    quitarObjeto: (tipo) => inventario.delete(tipo),
  };
  const inventario = new Set();
  ctx.world = {
    waypoints, obstaculos, ventanas, escondites, rutaBruja,
    spawns: { jugador: ctx.player.posicion.clone(), items: spawnsItems, espantos: { duende: new THREE.Vector3(-8,0,-6), bruja: new THREE.Vector3(-10,1,-8), silbon: new THREE.Vector3(8,0,6) } },
    objetosFisicos: [], items: [],
    sellarVentana(id) { const v = ventanas.find((w) => w.id === id); if (v) v.sellada = true; },
  };
  ctx.espantos = new EspantoManager(ctx);
  await ctx.espantos.precargar();
  ctx.espantos.iniciar(['duende', 'bruja', 'silbon'], { multVelocidad: 1, multEscucha: 1 });

  const estado = { duende: true, bruja: true, silbon: true, muros: true, waypoints: false, contra: 'aji' };
  const gui = ctx.debug?.addFolder('Sandbox de espantos');
  if (gui) {
    gui.add(estado, 'duende').onChange((v) => ctx.espantos.lista.find((e) => e.tipo === 'duende')?.setActivo(v));
    gui.add(estado, 'bruja').onChange((v) => ctx.espantos.lista.find((e) => e.tipo === 'bruja')?.setActivo(v));
    gui.add(estado, 'silbon').onChange((v) => ctx.espantos.lista.find((e) => e.tipo === 'silbon')?.setActivo(v));
    gui.add(estado, 'muros').onChange((v) => obstaculos.forEach((m) => { m.material.visible = v; m.material.opacity = v ? 0.72 : 0; }));
    gui.add(estado, 'waypoints').onChange((v) => ctx.espantos.lista[0]?.grafo.mostrar(escena, v));
    gui.add(estado, 'contra', ['aji','radio','latigo','tijeras','sal','panela']).name('contra');
    gui.add({ aplicar: () => {
      const datos = { tipo: estado.contra, posicion: ctx.player.posicion.clone(), ventanaId: ventanas[0].id };
      if (estado.contra === 'latigo') inventario.add('latigo');
      ctx.espantos.contras.aplicar(estado.contra, datos);
    } }, 'aplicar').name('Aplicar contra');
  }

  const teclas = new Set();
  const keydown = (e) => {
    if (e.repeat) return;
    teclas.add(e.code);
    if (e.code === 'KeyR') ctx.bus.emit('ruido', { posicion: ctx.player.posicion.clone(), intensidad: 8, fuente: 'jugador' });
    if (e.code === 'KeyF') { ctx.player.linterna.encendida = !ctx.player.linterna.encendida; luz.intensity = ctx.player.linterna.encendida ? 8 : 0; ctx.bus.emit('linterna:cambio', { encendida: ctx.player.linterna.encendida, bateria: 100 }); }
    if (e.code === 'KeyH') { ctx.player.isHidden = !ctx.player.isHidden; ctx.bus.emit(ctx.player.isHidden ? 'jugador:escondido' : 'jugador:salioEscondite', { id: escondites[0].id }); }
  };
  const keyup = (e) => teclas.delete(e.code);
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
  const limpiar = ctx.engine.onUpdate((dt) => {
    const dir = new THREE.Vector3((teclas.has('KeyD') ? 1 : 0) - (teclas.has('KeyA') ? 1 : 0), 0, (teclas.has('KeyS') ? 1 : 0) - (teclas.has('KeyW') ? 1 : 0));
    if (dir.lengthSq()) { dir.normalize().multiplyScalar(dt * 4); ctx.player.posicion.add(dir); }
    jugadorVisual.position.set(ctx.player.posicion.x, 0.7, ctx.player.posicion.z);
    controles.target.set(ctx.player.posicion.x, 0.5, ctx.player.posicion.z); controles.update();
  }, 10);
  ctx.engine.onUpdate((dt) => ctx.physics.step(dt), 20);
  ctx.engine.onUpdate(() => {
    const p = ctx.player.posicion;
    luz.position.copy(ctx.engine.camera.position);
    luz.target.position.set(p.x, p.y + 0.2, p.z - 5);
  }, 30);
  window.addEventListener('beforeunload', () => { limpiar(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); ctx.espantos.destruir(); });
  if (!ctx.engine._idFrame) ctx.engine.start();
  console.info('[sandboxEspantos] WASD mueve, R hace ruido, F linterna, H esconderse. Órbita: arrastrar mouse.');
}
