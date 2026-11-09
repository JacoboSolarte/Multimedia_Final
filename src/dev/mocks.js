import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OBJETOS } from '../data/objetos.js';

// Contratos 9.5–9.7 sin archivos externos, IA ni mundo físico compartido.
export async function escenaFlujo(ctx) {
  const escena = ctx.engine.scene;
  escena.background = new THREE.Color(0x101b18);
  ctx.engine.camera.position.set(0, 4, 8);
  ctx.engine.camera.lookAt(0, 0, 0);
  escena.add(new THREE.HemisphereLight(0xcadac5, 0x293329, 2));
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ color: 0x263c32 }));
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo, new THREE.GridHelper(16, 16, 0xa4af80, 0x435c4c));
  const origen = new THREE.Vector3();
  const ventana = { id: 'sala', caja: new THREE.Box3(new THREE.Vector3(-1, 0, -4), new THREE.Vector3(1, 2, -3)), posicion: new THREE.Vector3(0, 1, -3.5), sellada: false };
  const ambiente = new THREE.AmbientLight(0xffffff, 0.08);
  const luna = new THREE.DirectionalLight(0xb2cbff, 1);
  luna.position.set(4, 8, 2);
  escena.add(ambiente, luna);
  const tvPantalla = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.125), new THREE.MeshBasicMaterial({ color: 0x647867 }));
  tvPantalla.position.set(0, 1.5, -3);
  escena.add(tvPantalla);
  const items = [];
  const world = {
    waypoints: [{ id: 'WP_01', posicion: origen.clone(), vecinos: [] }],
    rutaBruja: [], obstaculos: [], objetosFisicos: [],
    spawns: { jugador: origen.clone(), items: [new THREE.Vector3(1, 0, 1)], espantos: { duende: new THREE.Vector3(3, 0, 0), bruja: new THREE.Vector3(-3, 0, 0), silbon: new THREE.Vector3(0, 0, -3) } },
    ventanas: [ventana], escondites: [],
    salida: { caja: new THREE.Box3(new THREE.Vector3(6, 0, -1), new THREE.Vector3(7, 2, 1)) },
    tvPantalla, velas: [new THREE.Vector3(-2, 1, -2)], pozo: new THREE.Vector3(5, 0, 5),
    luces: { ambiente, luna }, items,
    zonaDe() { return 'sala'; },
    sellarVentana(id) { if (id === ventana.id) ventana.sellada = true; },
    generarItems(tipos) {
      items.splice(0, items.length, ...tipos.map((tipo, i) => ({ tipo, posicion: new THREE.Vector3(i % 4, 0, Math.floor(i / 4)), ...OBJETOS[tipo] })));
    },
    reiniciarNoche() { ventana.sellada = false; this.generarItems(items.map((item) => item.tipo)); },
    setLuzAmbiente(valor) { ambiente.intensity = valor; },
  };
  const luz = new THREE.SpotLight(0xffffff, 0);
  ctx.engine.camera.add(luz);
  const player = {
    body: new CANNON.Body({ mass: 0 }), posicion: origen.clone(), direccion: new THREE.Vector3(0, 0, -1),
    isHidden: false, esconditeActual: null, bloqueado: true,
    linterna: { encendida: false, bateria: 100, luz },
    inventario: { espacios: [null, null, null, null], activo: 0 },
    update() {},
    respawn() {
      const inv = this.inventario;
      const item = inv.espacios[inv.activo];
      if (item) {
        const body = new CANNON.Body({ mass: 1 });
        body.position.copy(this.body.position);
        ctx.bus.emit('item:soltado', { tipo: item.tipo, posicion: this.posicion.clone(), body });
        inv.espacios[inv.activo] = null;
      }
      this.posicion.copy(world.spawns.jugador);
      this.body.position.copy(this.posicion);
      this.isHidden = false;
      this.esconditeActual = null;
    },
    bloquear(valor) { this.bloqueado = valor; },
    tieneObjeto(tipo) { return this.inventario.espacios.some((item) => item?.tipo === tipo); },
    quitarObjeto(tipo) {
      const i = this.inventario.espacios.findIndex((item) => item?.tipo === tipo);
      if (i < 0) return false;
      this.inventario.espacios[i] = null;
      return true;
    },
    configurar(modo) { this.linterna.encendida = modo.linterna !== false; this.linterna.bateria = 100; },
  };
  const espantos = {
    lista: [],
    async precargar() { return this; },
    iniciar(tipos, multiplicadores = {}) {
      this.lista.forEach((e) => e.destruir());
      this.lista = [];
      for (const tipo of tipos) this.agregar(tipo, multiplicadores);
    },
    agregar(tipo, multiplicadores = {}) {
      const existente = this.lista.find((e) => e.tipo === tipo);
      if (existente) { existente.setActivo(true); return existente; }
      const modelo = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xb0a477 }));
      modelo.position.copy(world.spawns.espantos[tipo] ?? origen).setY(0.75);
      escena.add(modelo);
      const espanto = {
        tipo, estado: 'PATRULLA', modelo, body: new CANNON.Body({ mass: 0 }), activo: true,
        velocidad: { ...multiplicadores }, update() {}, oirRuido() {}, aplicarContra() {},
        setActivo(valor) { this.activo = valor; modelo.visible = valor; },
        destruir() { escena.remove(modelo); modelo.geometry.dispose(); modelo.material.dispose(); },
      };
      espanto.body.position.copy(modelo.position);
      this.lista.push(espanto);
      return espanto;
    },
    detenerTodos() { this.lista.forEach((e) => e.setActivo(false)); },
    update(dt) { this.lista.filter((e) => e.activo).forEach((e) => { e.modelo.rotation.y += dt * 0.3; }); },
    masCercano(posicion) {
      let espanto = null;
      let distancia = Infinity;
      for (const e of this.lista) {
        const d = e.modelo.position.distanceTo(posicion);
        if (e.activo && d < distancia) { espanto = e; distancia = d; }
      }
      return { espanto, distancia };
    },
  };
  ctx.world = world;
  ctx.player = player;
  ctx.espantos = espantos;
  const quitarJugador = ctx.engine.onUpdate((dt) => player.update(dt), 10);
  const quitarEspantos = ctx.engine.onUpdate((dt) => espantos.update(dt), 40);
  const escuchar = (e) => {
    if (e.repeat || player.bloqueado || /INPUT|SELECT|TEXTAREA/.test(e.target?.tagName)) return;
    if (e.code === 'KeyT') ctx.bus.emit('jugador:atrapado', { tipo: 'duende', posicion: world.spawns.espantos.duende.clone() });
    if (e.code === 'KeyY') ctx.bus.emit('jugador:salida', { conLlave: player.tieneObjeto('llave_porton') });
    if (e.code === 'KeyU') {
      const i = player.inventario.espacios.indexOf(null);
      if (i >= 0 && !player.tieneObjeto('llave_porton')) {
        player.inventario.espacios[i] = { tipo: 'llave_porton', ...OBJETOS.llave_porton };
        ctx.bus.emit('item:recogido', { tipo: 'llave_porton' });
      }
    }
    if (e.code === 'KeyI') ctx.bus.emit('ruido', { posicion: player.posicion.clone(), intensidad: 6, fuente: 'jugador' });
  };
  window.addEventListener('keydown', escuchar);
  return { world, player, espantos, destruir() {
    window.removeEventListener('keydown', escuchar);
    quitarJugador();
    quitarEspantos();
    espantos.lista.forEach((e) => e.destruir());
    escena.remove(suelo, tvPantalla, ambiente, luna);
    ctx.engine.camera.remove(luz);
    suelo.geometry.dispose(); suelo.material.dispose();
    tvPantalla.geometry.dispose(); tvPantalla.material.dispose();
  } };
}
