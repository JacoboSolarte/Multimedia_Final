import * as THREE from 'three';
import { crearColliders, mostrarColliders } from './colliders.js';
import { Puertas } from './puertas.js';
import { crearEscondites } from './escondites.js';
import { Portales } from './portales.js';
import { Zonas } from './zonas.js';
import { ObjetosMundo } from './objetos.js';
import { Iluminacion } from './iluminacion.js';

const RUTA_FINCA = '/models/finca.glb';
const posMundo = (o) => o.getWorldPosition(new THREE.Vector3());
const porNombre = (a, b) => a.name.localeCompare(b.name, 'es', { numeric: true });

// La finca: lee finca.glb por prefijos (punto 11) y expone los datos del contrato 9.5
export class World {
  constructor(ctx) {
    this.ctx = ctx;
    this.waypoints = [];
    this.rutaBruja = [];
    this.spawns = { jugador: new THREE.Vector3(), items: [], espantos: {} };
    this.ventanas = [];
    this.escondites = [];
    this.salida = { caja: new THREE.Box3() };
    this.obstaculos = [];
    this.objetosFisicos = [];
    this.tvPantalla = null;
    this.velas = [];
    this.pozo = new THREE.Vector3();
    this.luces = { ambiente: null, luna: null };
    this._ultimosItems = [];
  }

  async cargar() {
    const ctx = this.ctx;
    const gltf = await ctx.loader.cargarGLB(RUTA_FINCA);
    this.escena = gltf.scene;
    ctx.engine.scene.add(this.escena);
    this.escena.updateMatrixWorld(true);

    // Separar por prefijo (GLTFLoader quita los puntos: solo se revisa el prefijo)
    const g = {};
    const prefijos = ['COL_', 'WP_', 'BRUJA_PATH_', 'SPAWN_PLAYER', 'SPAWN_ITEM_', 'SPAWN_DUENDE', 'SPAWN_BRUJA',
      'SPAWN_SILBON', 'DOOR_', 'HIDECAM_', 'HIDE_', 'WIN_', 'PORTAL_', 'ZONE_', 'EXIT_', 'VELA_', 'TV_pantalla',
      'POZO_agua', 'PHYS_'];
    const visibles = [];
    this.escena.traverse((o) => {
      if (o === this.escena) return;
      const pre = prefijos.find((p) => o.name.startsWith(p));
      if (pre) (g[pre] ??= []).push(o);
      else if (o.isMesh) visibles.push(o);
    });
    for (const k in g) g[k].sort(porNombre);
    const lista = (k) => g[k] ?? [];

    // Geometría visible: recibe y proyecta sombras
    for (const m of visibles) {
      m.castShadow = true;
      m.receiveShadow = true;
    }

    // Colliders sólidos
    this.obstaculos = lista('COL_');
    this.bodiesColliders = crearColliders(ctx.physics, this.obstaculos);

    // Empties: datos para espantos y juego
    this.waypoints = lista('WP_').map((o) => ({ id: o.name, posicion: posMundo(o), vecinos: [] }));
    this.rutaBruja = lista('BRUJA_PATH_').map(posMundo);
    this.spawns = {
      jugador: g.SPAWN_PLAYER ? posMundo(g.SPAWN_PLAYER[0]) : new THREE.Vector3(),
      items: lista('SPAWN_ITEM_').map(posMundo),
      espantos: {
        duende: g.SPAWN_DUENDE ? posMundo(g.SPAWN_DUENDE[0]) : null,
        bruja: g.SPAWN_BRUJA ? posMundo(g.SPAWN_BRUJA[0]) : null,
        silbon: g.SPAWN_SILBON ? posMundo(g.SPAWN_SILBON[0]) : null,
      },
    };
    this.velas = lista('VELA_').map(posMundo);
    this.pozo = g.POZO_agua ? posMundo(g.POZO_agua[0]) : new THREE.Vector3();
    this.tvPantalla = g.TV_pantalla?.[0] ?? null;

    // Volúmenes (invisibles en el juego)
    this.ventanas = lista('WIN_').map((m) => {
      const caja = new THREE.Box3().setFromObject(m);
      m.visible = false;
      return { id: m.name.slice('WIN_'.length), caja, sellada: false, posicion: caja.getCenter(new THREE.Vector3()), mesh: m, sello: null };
    });
    this.escondites = crearEscondites(lista('HIDE_'), lista('HIDECAM_'));
    if (g.EXIT_) {
      this.salida = { caja: new THREE.Box3().setFromObject(g.EXIT_[0]), mesh: g.EXIT_[0] };
      g.EXIT_[0].visible = false;
    }
    this.volumenes = [...lista('WIN_'), ...lista('HIDE_'), ...lista('PORTAL_'), ...lista('ZONE_'), ...lista('EXIT_')];

    // Sistemas
    this.puertas = new Puertas(ctx, lista('DOOR_'));
    this.waypoints.push(...this._waypointsDePuertas());
    this.portales = new Portales(ctx, lista('PORTAL_'));
    this.zonas = new Zonas(ctx, lista('ZONE_'));
    this.objetos = new ObjetosMundo(ctx, this.spawns.items);
    await this.objetos.precargar();
    this.objetos.crearFisicos(lista('PHYS_'));
    this.objetosFisicos = this.objetos.objetosFisicos;

    this.iluminacion = new Iluminacion(ctx, this.velas);
    this.luces = { ambiente: this.iluminacion.ambiente, luna: this.iluminacion.luna };
    await this.iluminacion.cargarCielo();

    this._resumen(g);
    this._debug();

    // Triggers del mundo: prioridad 30 (punto 7.3)
    ctx.engine.onUpdate((dt, t) => this.update(dt, t), 30);
    return this;
  }

  update(dt, tiempo) {
    const player = this.ctx.player;
    this.puertas.update(dt);
    this.iluminacion.update(dt, tiempo);
    if (player) {
      this.portales.update(dt, player, tiempo);
      this.zonas.update(player.posicion);
    }
  }

  // Los WP_ del .glb quedan en el centro de cada cuarto y los muros cortan la visibilidad entre ellos,
  // así que el grafo salía en islas. Un par de puntos a cada lado del vano de cada puerta las une.
  _waypointsDePuertas() {
    const puntos = [];
    const abajo = new THREE.Vector3(0, -1, 0);
    const rayo = new THREE.Raycaster();
    for (const p of this.puertas.lista) {
      const bisagra = p.mesh.getWorldPosition(new THREE.Vector3());
      const centro = p.centroLocal.clone();
      p.mesh.localToWorld(centro);
      const base = new THREE.Box3().setFromObject(p.mesh).min.y;
      const normal = new THREE.Vector3(centro.z - bisagra.z, 0, bisagra.x - centro.x).normalize();
      for (const [lado, signo] of [['a', 1], ['b', -1]]) {
        const punto = centro.clone().addScaledVector(normal, 0.9 * signo);
        rayo.set(new THREE.Vector3(punto.x, base + 1, punto.z), abajo);
        rayo.far = 2.5;
        const piso = rayo.intersectObjects(this.obstaculos, false)[0];
        punto.y = piso ? piso.point.y : base;
        puntos.push({ id: `WP_puerta_${p.id}_${lado}`, posicion: punto, vecinos: [] });
      }
    }
    return puntos;
  }

  // ---------------------------------------------------------------- contrato 9.5
  zonaDe(posicion) {
    return this.zonas.zonaDe(posicion);
  }

  // Pone el objeto de la contra (tijeras o sal) a la vista en la ventana
  sellarVentana(id, tipo = 'tijeras') {
    const v = this.ventanas.find((w) => w.id === id);
    if (!v || v.sellada) return false;
    v.sellada = true;
    const sello = this.objetos._modelo(tipo);
    sello.scale.setScalar(1.6); // más grande para que se vea desde lejos
    sello.position.set(v.posicion.x, v.caja.min.y + 1.5, v.posicion.z);
    if (tipo === 'tijeras') sello.rotation.set(Math.PI / 2, 0, Math.PI / 4); // abiertas en cruz
    this.ctx.engine.scene.add(sello);
    v.sello = sello;
    return true;
  }

  generarItems(listaTipos) {
    this._ultimosItems = [...listaTipos];
    this.objetos.generarItems(listaTipos);
  }

  // Puertas cerradas, items nuevos, ventanas sin sellar, objetos en su lugar
  reiniciarNoche() {
    this.puertas.reiniciar();
    for (const v of this.ventanas) {
      v.sellada = false;
      if (v.sello) this.ctx.engine.scene.remove(v.sello);
      v.sello = null;
    }
    this.objetos.reiniciarFisicos();
    this.objetos.generarItems(this._ultimosItems);
    this.portales.cooldown = 0;
  }

  setLuzAmbiente(valor) {
    this.iluminacion.setLuzAmbiente(valor);
  }

  // Lista de items en el piso (para el Duende y el HUD)
  get items() {
    return this.objetos.items;
  }

  // ---------------------------------------------------------------- debug
  _resumen(g) {
    const cuenta = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length]));
    console.info('[world] finca cargada', cuenta);
  }

  _debug() {
    const f = this.ctx.debug?.addFolder('Mundo');
    if (!f) return;
    const estado = { colliders: false, triggers: false, waypoints: false };
    f.add(estado, 'colliders').name('colliders (wireframe)').onChange((v) => mostrarColliders(this.obstaculos, v));
    f.add(estado, 'triggers').name('volúmenes de triggers').onChange((v) => {
      for (const m of this.volumenes) {
        m.visible = v;
        if (m.material) m.material.depthWrite = false;
      }
    });
    f.add(estado, 'waypoints').onChange((v) => {
      if (!this._puntosWP) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          ...this.waypoints.map((w) => w.posicion.clone().add(new THREE.Vector3(0, 0.2, 0))),
          ...this.rutaBruja,
        ]);
        this._puntosWP = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x00ff88, size: 0.25 }));
        this.ctx.engine.scene.add(this._puntosWP);
      }
      this._puntosWP.visible = v;
    });
    f.add({ reiniciar: () => this.reiniciarNoche() }, 'reiniciar').name('reiniciarNoche()');
    f.close();
  }
}
