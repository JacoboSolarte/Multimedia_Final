import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ESPANTOS } from '../data/espantos.js';
import { GrafoWaypoints } from './grafoWaypoints.js';

const TEMP_ALTURA = { duende: 0.9, bruja: 1.7, silbon: 2.8 };
const clamp = THREE.MathUtils.clamp;

// Lógica compartida: percepción, rutas, estados, física y animación.
export class Espanto {
  constructor(ctx, tipo, config = {}) {
    this.ctx = ctx;
    this.tipo = tipo;
    this.config = { ...ESPANTOS[tipo], ...config };
    this.estado = 'PATRULLA';
    this.modelo = null;
    this.body = null;
    this.activo = false;
    this.velocidad = { multVelocidad: 1, multEscucha: 1 };
    this.grafo = new GrafoWaypoints(ctx.world?.waypoints ?? [], ctx.world?.obstaculos ?? [], ctx.engine.scene);
    this.rutaActual = [];
    this.objetivo = null;
    this.ultimaPosicion = new THREE.Vector3();
    this._sinVision = 0;
    this._tiempoVision = 0;
    this._veEnCache = false;
    this._sinAvance = 0;
    this._posAnterior = new THREE.Vector3();
    this._tiempoEstado = 0;
    this._tiempoFlotar = Math.random() * Math.PI * 2;
    this._raycaster = new THREE.Raycaster();
    this._direccion = new THREE.Vector3(0, 0, 1);
    this._acciones = new Map();
    this._accionActual = null;
    this._ultimaCaptura = false;
    this._vioEsconderse = false;
    this._sonidos = [];
    this._estadoInicializado = false;
    this._crearCuerpo(config.spawn ?? ctx.world?.spawns?.espantos?.[tipo]);
    this._crearModeloTemporal();
    this._conectarEventos();
  }

  _crearCuerpo(spawn) {
    const p = spawn ?? new THREE.Vector3();
    const material = this.ctx.physics.materiales.espanto;
    this.body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, shape: new CANNON.Sphere(0.38), material, fixedRotation: true, allowSleep: false });
    this.body.position.set(p.x, p.y + 0.38, p.z);
    // Los espantos atrapan por distancia: su cuerpo no debe empujar al jugador (el Duende invisible lo frenaba).
    this.body.collisionResponse = false;
    this.ctx.physics.agregar(this.body);
    this._posAnterior.set(p.x, p.y + 0.38, p.z);
  }

  _crearModeloTemporal() {
    const h = TEMP_ALTURA[this.tipo] ?? 1.7;
    const color = this.tipo === 'duende' ? 0x618b50 : this.tipo === 'bruja' ? 0x30233f : 0x8f8378;
    const m = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(0.22, h * 0.16), h * 0.45, 3, 6), mat);
    torso.position.y = h * 0.48;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(h * 0.14, 8, 6), mat);
    cabeza.position.y = h * 0.87;
    m.add(torso, cabeza);
    if (this.tipo === 'duende') {
      const sombrero = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 6), new THREE.MeshStandardMaterial({ color: 0x332819 }));
      sombrero.position.y = h * 1.12;
      m.add(sombrero);
    }
    if (this.tipo === 'silbon') {
      const costal = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0x604b36 }));
      costal.name = 'silbon_costal';
      costal.position.set(-0.27, h * 0.47, -0.12);
      m.add(costal);
    }
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    m.userData.temporal = true;
    this.modelo = m;
    this.ctx.engine.scene.add(m);
  }

  configurarModelo(gltf) {
    if (!gltf?.scene) return;
    const anterior = this.modelo;
    const raiz = gltf.scene;
    raiz.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.modelo = raiz;
    this.modelo.visible = this.activo && this.tipo !== 'duende';
    this.ctx.engine.scene.add(this.modelo);
    if (anterior) {
      this.ctx.engine.scene.remove(anterior);
      anterior.traverse((o) => { o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material?.dispose(); });
    }
    if (gltf.animations?.length) {
      this.mixer = new THREE.AnimationMixer(this.modelo);
      for (const clip of gltf.animations) this._acciones.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    }
  }

  _conectarEventos() {
    const bus = this.ctx.bus;
    this._desuscribir = [
      bus.on('jugador:escondido', ({ id }) => {
        if (this.estado === 'PERSECUCION' && this._veEnCache) {
          this._vioEsconderse = true;
          const escondite = this.ctx.world.escondites?.find((h) => h.id === id);
          if (escondite) this._irA(escondite.caja.getCenter(new THREE.Vector3()));
        } else {
          this._vioEsconderse = false;
          if (this.estado === 'PERSECUCION') this._cambiarEstado('ALERTA', this.ultimaPosicion);
        }
        this._esconditeObjetivo = id;
      }),
      bus.on('jugador:salioEscondite', () => { this._vioEsconderse = false; this._esconditeObjetivo = null; }),
    ];
  }

  _cambiarEstado(estado, objetivo = null) {
    if (this.estado === estado && this._estadoInicializado) {
      if (objetivo && (!this.objetivo || this.objetivo.distanceTo?.(objetivo) > 0.75)) this._irA(objetivo);
      return;
    }
    this.estado = estado;
    this._estadoInicializado = true;
    this._tiempoEstado = 0;
    // Recalcular la ruta: antes guardaba el objetivo nuevo pero seguía la ruta vieja de patrulla.
    if (objetivo) this._irA(objetivo.clone?.() ?? objetivo);
    if (estado === 'PATRULLA' && !this.objetivo) this._elegirPatrulla();
    if (estado === 'PERSECUCION') this._alPerseguir();
    this.ctx.bus.emit('espanto:estado', { tipo: this.tipo, estado });
  }

  // Aviso sonoro al empezar a perseguir (cada espanto pone el suyo)
  _alPerseguir() {}

  // ¿Puede notar al jugador muy cerca aunque no lo esté mirando? (la Bruja solo dentro de la casa)
  _puedeSentir() { return true; }

  _elegirPatrulla() {
    const wp = this.grafo.waypointAleatorio();
    if (wp) this._irA(wp.posicion ?? wp);
    else this.objetivo = null;
  }

  _irA(posicion) {
    if (!posicion) return;
    const actual = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    this.rutaActual = this.grafo.ruta(actual, posicion);
    this.objetivo = posicion.clone?.() ?? posicion;
    if (this.rutaActual.length && this.rutaActual[0].distanceTo(actual) < 0.6) this.rutaActual.shift();
  }

  _veJugador() {
    const jugador = this.ctx.player;
    if (!jugador || jugador.isHidden) return false;
    const origen = new THREE.Vector3(this.body.position.x, this.body.position.y + 0.15, this.body.position.z);
    const destino = jugador.posicion.clone().add(new THREE.Vector3(0, 0.9, 0));
    const hacia = destino.sub(origen);
    const distancia = hacia.length();
    if (distancia > this.config.radioVision) return false;
    hacia.normalize();
    if (this._direccion.dot(hacia) < Math.cos(Math.PI / 4)) return false;
    this._raycaster.set(origen, hacia);
    this._raycaster.far = distancia;
    const impactos = this._raycaster.intersectObjects(this.ctx.world.obstaculos ?? [], false);
    return impactos.length === 0;
  }

  oirRuido({ posicion, intensidad }) {
    if (!this.activo || !posicion || !intensidad || this.estado === 'CAPTURA') return;
    const pos = posicion.isVector3 ? posicion : new THREE.Vector3(posicion.x, posicion.y, posicion.z);
    const alcance = intensidad * 3 * (this.velocidad.multEscucha ?? 1);
    const actual = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    if (actual.distanceTo(pos) > alcance || ['ATURDIDO', 'DISTRAIDO', 'HUIDA', 'CAPTURA'].includes(this.estado)) return;
    this.ultimaPosicion.copy(pos);
    this._cambiarEstado('ALERTA', pos);
  }

  _mover(dt) {
    let destino = this.objetivo;
    // Distancia en el plano: el cuerpo flota 0.38 m sobre el waypoint y en 3D nunca "llegaba", se quedaba congelado.
    const pos = this.body.position;
    while (this.rutaActual.length && Math.hypot(this.rutaActual[0].x - pos.x, this.rutaActual[0].z - pos.z) < 0.55) this.rutaActual.shift();
    if (this.rutaActual.length) destino = this.rutaActual[0];
    if (!destino) { this.body.velocity.set(0, 0, 0); return; }
    const dx = destino.x - this.body.position.x;
    const dz = destino.z - this.body.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.45) {
      const diferenciaY = destino.y + 0.38 - this.body.position.y; // el cuerpo va 0.38 m sobre el punto (radio de la esfera)
      if (this.tipo === 'bruja' && Math.abs(diferenciaY) > 0.25) {
        this.body.velocity.set(0, clamp(diferenciaY * 2.5, -3, 3), 0);
        return;
      }
      this.body.velocity.set(0, 0, 0);
      if (!this.rutaActual.length) this._llegoObjetivo();
      return;
    }
    if (this.estado === 'ATURDIDO') { this.body.velocity.set(0, 0, 0); return; }
    const persecucion = this.estado === 'PERSECUCION' || this.estado === 'HUIDA';
    const base = persecucion ? this.config.velPersecucion : this.config.velPatrulla;
    const v = base * (this.velocidad.multVelocidad ?? 1) * (this.estado === 'ATURDIDO' ? 0 : 1);
    const vy = this.tipo === 'bruja' ? clamp((destino.y + 0.38 - this.body.position.y) * 2.5, -3, 3) : 0;
    this.body.velocity.set((dx / d) * v, vy, (dz / d) * v);
    this._direccion.set(dx / d, 0, dz / d).normalize();
    this.modelo.rotation.y = Math.atan2(this._direccion.x, this._direccion.z);
    if (this.body.position.distanceTo(this._posAnterior) < 0.08) this._sinAvance += dt;
    else { this._sinAvance = 0; this._posAnterior.set(this.body.position.x, this.body.position.y, this.body.position.z); }
    if (this._sinAvance >= 2 && this.rutaActual.length) { this.rutaActual.shift(); this._sinAvance = 0; }
  }

  _llegoObjetivo() {
    if (this.estado === 'ALERTA') this._cambiarEstado('PATRULLA');
    else if (this.estado === 'PATRULLA' || this.estado === 'ACECHO') this._elegirPatrulla();
  }

  _actualizarAnimacion(dt) {
    const velocidad = Math.hypot(this.body.velocity.x, this.body.velocity.z);
    const nombre = this.tipo === 'bruja' && velocidad > 0.1 ? 'volar' : velocidad < 0.1 ? 'idle' : velocidad > this.config.velPatrulla * 1.25 ? 'correr' : 'caminar';
    const accion = this._acciones.get(nombre);
    if (accion && accion !== this._accionActual) {
      accion.reset().fadeIn(0.2).play();
      this._accionActual?.fadeOut(0.2);
      this._accionActual = accion;
    }
    this.mixer?.update(dt);
    if (!this.mixer && this.modelo?.userData.temporal) {
      this._tiempoFlotar += dt;
      const altura = this.tipo === 'bruja' ? 1.45 : 0;
      this.modelo.position.y = this.body.position.y - 0.38 + altura + Math.sin(this._tiempoFlotar * 2) * (this.tipo === 'bruja' ? 0.12 : 0.025);
      this.modelo.rotation.z = Math.sin(this._tiempoFlotar * 1.8) * 0.025;
    }
  }

  update(dt) {
    if (!this.activo) return;
    this._tiempoEstado += dt;
    this.modelo.position.x = this.body.position.x;
    this.modelo.position.z = this.body.position.z;
    this.modelo.position.y = this.body.position.y - 0.38;
    if (this.estado === 'CAPTURA') { this.body.velocity.set(0, 0, 0); this._actualizarAnimacion(dt); return; }
    this._tiempoVision -= dt;
    if (this._tiempoVision <= 0) { this._tiempoVision = 0.1; this._veEnCache = this._veJugador(); }
    // A 2 m o menos te nota aunque esté de espaldas: antes pasaba a tu lado sin hacer nada.
    const jugador = this.ctx.player;
    const cerca = this._puedeSentir() && this.body.position.distanceTo(jugador.posicion) < this.config.radioCaptura + 0.8;
    const ve = (this._veEnCache || cerca) && !jugador.isHidden;
    const sigueAlEscondite = this.ctx.player.isHidden && this._vioEsconderse;
    if (ve) {
      this._sinVision = 0;
      this.ultimaPosicion.copy(this.ctx.player.posicion);
      if (!['ATURDIDO', 'DISTRAIDO', 'HUIDA'].includes(this.estado)) this._cambiarEstado('PERSECUCION', this.ultimaPosicion);
    } else if (this.estado === 'PERSECUCION' && !sigueAlEscondite) {
      this._sinVision += dt;
      if (this._sinVision >= 5) this._cambiarEstado('ALERTA', this.ultimaPosicion);
    }
    if (this.estado === 'ATURDIDO' && this._tiempoEstado >= (this.duracionAturdido ?? 5)) this._cambiarEstado('ALERTA', this.ultimaPosicion);
    if (this.estado === 'DISTRAIDO' && this._tiempoEstado >= (this.duracionDistraido ?? 20)) this._cambiarEstado('PATRULLA');
    if (this.estado === 'HUIDA' && this._tiempoEstado >= (this.duracionHuida ?? 4)) this._cambiarEstado('ALERTA', this.ultimaPosicion);
    if (this.estado === 'ALERTA' && this.objetivo && this.body.position.distanceTo(this.objetivo) < 0.65) this._cambiarEstado('PATRULLA');
    this._actualizarUnico(dt);
    this._mover(dt);
    this._revisarCaptura();
    this._actualizarAnimacion(dt);
  }

  _actualizarUnico(_dt) {}

  _revisarCaptura() {
    const p = this.ctx.player;
    if (!p || this.estado !== 'PERSECUCION' || p.invulnerable || this.body.position.distanceTo(p.posicion) > this.config.radioCaptura) return;
    if (p.isHidden && !this._vioEsconderse) return;
    if (this._antesDeCapturar?.() === false) return;
    if (this._ultimaCaptura) return;
    this._ultimaCaptura = true;
    this._cambiarEstado('CAPTURA');
    this.ctx.bus.emit('jugador:atrapado', { tipo: this.tipo, posicion: p.posicion.clone() });
  }

  aplicarContra(tipoContra, datos = {}) {
    return this._aplicarContraUnico(tipoContra, datos);
  }

  _aplicarContraUnico(_tipoContra, _datos) { return false; }

  setActivo(valor) {
    this.activo = Boolean(valor);
    this.modelo.visible = this.activo && this.tipo !== 'duende';
    if (!this.activo) this.body.velocity.set(0, 0, 0);
    else {
      this._ultimaCaptura = false;
      this._vioEsconderse = false;
      this._esconditeObjetivo = null;
      this._sinVision = 0;
      this._sinAvance = 0;
      this._cambiarEstado(this._estadoInicial ?? 'PATRULLA');
      if (this._estadoInicial !== 'VOLANDO') this._elegirPatrulla();
    }
    for (const sonido of this._sonidos) {
      if (this.activo) { if (sonido.loop && sonido.buffer && !sonido.isPlaying) sonido.play(); }
      else if (sonido.isPlaying) sonido.pause();
    }
  }

  async cargarSonido(nombre, { posicional = true, volumen = 0.5, loop = true, refDistance = 2, maxDistance = 18 } = {}) {
    const ruta = `/sounds/espantos/${nombre}.mp3`;
    const buffer = await this.ctx.audio?.buffer(ruta);
    if (!buffer || !this.modelo) return null;
    const sonido = posicional
      ? this.ctx.audio.crearPositional(buffer, { volumen, loop, refDistance, maxDistance, rolloff: 1 })
      : this.ctx.audio.crearAudio(buffer, { volumen, loop });
    (posicional ? this.modelo : this.ctx.engine.camera).add(sonido);
    this._sonidos.push(sonido);
    if (loop && this.activo && this.ctx.audio.listener.context.state === 'running') sonido.play();
    return sonido;
  }

  destruir() {
    for (const fn of this._desuscribir ?? []) fn();
    for (const sonido of this._sonidos) { if (sonido.isPlaying) sonido.stop(); sonido.disconnect(); }
    this._sonidos.length = 0;
    this.mixer?.stopAllAction();
    if (this.body) this.ctx.physics.quitar(this.body);
    if (this.modelo) {
      this.ctx.engine.scene.remove(this.modelo);
      // El modelo real comparte geometría y materiales con el GLB en caché: liberarlos obliga a recompilar (tirón).
      if (this.modelo.userData.temporal) this.modelo.traverse((o) => { o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material?.dispose(); });
    }
    this.activo = false;
  }
}
