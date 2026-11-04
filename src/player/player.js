import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Controles } from './controles.js';
import { Linterna } from './linterna.js';
import { Inventario } from './inventario.js';
import { CONTRAS_VENTANA, CONTRAS_PISO } from '../data/objetos.js';
import { suavizado } from '../core/utils.js';

const RADIO = 0.35;
const OJOS = { de_pie: 1.6, agachado: 0.95 };
const VELOCIDAD = { caminar: 3.0, correr: 5.5, agachado: 1.4 };
const RUIDO = { caminar: 2, correr: 6, agachado: 0.5 }; // punto 3.6
const PASO = { caminar: 0.52, correr: 0.34, agachado: 0.75 }; // segundos entre pasos
const SALTO = 4.6;
const ALCANCE = 2.4; // distancia máxima para interactuar con E
const SONIDOS = {
  madera: '/sounds/jugador/pasos_madera.mp3',
  tierra: '/sounds/jugador/pasos_tierra.mp3',
  salto: '/sounds/jugador/salto.mp3',
};
const ZONAS_TIERRA = ['patio', 'exterior'];
const ARRIBA = new THREE.Vector3(0, 1, 0);

// Jugador en primera persona (contrato 9.6)
export class Player {
  constructor(ctx) {
    this.ctx = ctx;
    const cam = ctx.engine.camera;

    this.body = new CANNON.Body({
      mass: 70,
      shape: new CANNON.Sphere(RADIO),
      material: ctx.physics.materiales.jugador,
      fixedRotation: true,
      linearDamping: 0.05,
      allowSleep: false,
    });
    ctx.physics.agregar(this.body);

    this.posicion = new THREE.Vector3(); // a la altura de los PIES; solo lectura para los demás
    this.direccion = new THREE.Vector3(0, 0, -1);
    this.isHidden = false;
    this.esconditeActual = null;
    this.bloqueado = false;
    this.invulnerable = false; // modo dios del debug (Jerónimo/Yuly lo pueden revisar al atrapar)

    this.controles = new Controles(ctx);
    this.linterna = new Linterna(ctx);
    this.inventario = new Inventario(ctx);

    this.enSuelo = false;
    this.agachado = false;
    this.movimiento = 'quieto'; // quieto | caminar | correr | agachado
    this._ojos = OJOS.de_pie;
    this._tRuido = 0;
    this._tPaso = 0;
    this._fase = 0;
    this._velCaida = 0;
    this._enSalida = false;
    this._raycaster = new THREE.Raycaster();

    this._conectarAcciones();
    this.respawn(false);
    cam.position.copy(this.body.position).add(new THREE.Vector3(0, this._ojos - RADIO, 0));
    this._debug();
  }

  _conectarAcciones() {
    const a = this.controles.acciones;
    a.saltar = () => this._saltar();
    a.interactuar = () => this.interactuar();
    const mirar = () => this.ctx.engine.camera.getWorldDirection(this.direccion);
    a.soltar = () => !this.bloqueado && !this.isHidden && (mirar(), this.inventario.soltar(this));
    a.lanzar = () => !this.bloqueado && !this.isHidden && (mirar(), this.inventario.lanzar(this));
    a.linterna = () => !this.bloqueado && this.linterna.alternar();
    for (let i = 0; i < 4; i++) a['slot' + i] = () => this.inventario.seleccionar(i);
    a.slotSiguiente = () => this.inventario.seleccionar(this.inventario.activo + 1);
    a.slotAnterior = () => this.inventario.seleccionar(this.inventario.activo - 1);
  }

  // ---------------------------------------------------------------- bucle (prioridad 10)
  update(dt) {
    const cam = this.ctx.engine.camera;
    const t = this.ctx.engine.tiempoTotal;
    cam.getWorldDirection(this.direccion);
    this._detectarSuelo();

    const teclas = this.controles.teclas;
    const quieto = this.bloqueado || this.isHidden || !this.controles.activo;
    this.agachado = !quieto && teclas.agachado;

    // dirección de movimiento relativa a hacia dónde mira la cámara
    const adelante = this.direccion.clone().setY(0).normalize();
    const derecha = adelante.clone().cross(ARRIBA);
    const deseo = new THREE.Vector3();
    if (!quieto) {
      if (teclas.adelante) deseo.add(adelante);
      if (teclas.atras) deseo.sub(adelante);
      if (teclas.derecha) deseo.add(derecha);
      if (teclas.izquierda) deseo.sub(derecha);
    }
    const moviendo = deseo.lengthSq() > 0;
    this.movimiento = !moviendo ? 'quieto' : this.agachado ? 'agachado' : teclas.correr ? 'correr' : 'caminar';
    if (moviendo) deseo.normalize().multiplyScalar(VELOCIDAD[this.movimiento]);

    // en el aire se controla menos
    const k = suavizado(this.enSuelo ? 14 : 2.5, dt);
    const v = this.body.velocity;
    v.x += (deseo.x - v.x) * k;
    v.z += (deseo.z - v.z) * k;
    if (quieto && this.enSuelo) v.x = v.z = 0; // no resbalar en las rampas

    this.posicion.set(this.body.position.x, this.body.position.y - RADIO, this.body.position.z);

    // cámara: altura de ojos (más baja agachado) + balanceo al caminar
    this._ojos += ((this.agachado ? OJOS.agachado : OJOS.de_pie) - this._ojos) * suavizado(10, dt);
    if (this.isHidden) {
      cam.position.copy(this.escondite.puntoCamara);
    } else {
      const vel = Math.hypot(v.x, v.z);
      if (this.enSuelo && moviendo) this._fase += dt * vel * 2.4;
      const balanceo = this.enSuelo && moviendo ? Math.sin(this._fase) * 0.035 * Math.min(1, vel / 3) : 0;
      cam.position.set(this.body.position.x, this.body.position.y - RADIO + this._ojos + balanceo, this.body.position.z);
    }

    this._ruidoYPasos(dt, moviendo);
    this.linterna.update(dt, t);
    this._revisarSalida();
  }

  // Suelo por normal de contacto (semana 6): algún contacto con normal hacia arriba
  _detectarSuelo() {
    const antes = this.enSuelo;
    this.enSuelo = false;
    for (const c of this.ctx.physics.world.contacts) {
      let ny;
      if (c.bi === this.body) ny = -c.ni.y;
      else if (c.bj === this.body) ny = c.ni.y;
      else continue;
      if (ny > 0.5) {
        this.enSuelo = true;
        break;
      }
    }
    // al caer de un salto suena (ruido 3)
    if (!antes && this.enSuelo && this._velCaida < -3) {
      this._emitirRuido(3);
      this._sonarPaso(1);
    }
    this._velCaida = this.body.velocity.y;
  }

  _saltar() {
    if (this.bloqueado || this.isHidden || !this.enSuelo) return;
    this.body.velocity.y = SALTO;
    this.enSuelo = false;
    this.ctx.audio?.sonarEn(SONIDOS.salto, this.posicion, { volumen: 0.4 });
  }

  _ruidoYPasos(dt, moviendo) {
    if (!moviendo || !this.enSuelo) {
      this._tRuido = 0.25;
      return;
    }
    // ruido cada 0.5 s mientras se mueve
    this._tRuido -= dt;
    if (this._tRuido <= 0) {
      this._tRuido = 0.5;
      this._emitirRuido(RUIDO[this.movimiento]);
    }
    this._tPaso -= dt;
    if (this._tPaso <= 0) {
      this._tPaso = PASO[this.movimiento];
      this._sonarPaso(this.movimiento === 'correr' ? 0.8 : this.movimiento === 'agachado' ? 0.2 : 0.5);
    }
  }

  _emitirRuido(intensidad) {
    this.ctx.bus.emit('ruido', { posicion: this.posicion.clone(), intensidad, fuente: 'jugador' });
  }

  // madera adentro, tierra afuera según la zona
  _sonarPaso(volumen) {
    const zona = this.ctx.world.zonaDe(new THREE.Vector3(this.posicion.x, this.posicion.y + 0.3, this.posicion.z));
    const ruta = ZONAS_TIERRA.includes(zona) ? SONIDOS.tierra : SONIDOS.madera;
    this.ctx.audio?.sonar(ruta, { volumen, detune: (Math.random() - 0.5) * 400 });
  }

  _revisarSalida() {
    const dentro = this.ctx.world.salida.caja.containsPoint(this.posicion.clone().setY(this.posicion.y + 0.3));
    if (dentro && !this._enSalida) {
      this.ctx.bus.emit('jugador:salida', { conLlave: this.tieneObjeto('llave_porton') });
    }
    this._enSalida = dentro;
  }

  // ---------------------------------------------------------------- E: interactuar
  interactuar() {
    if (this.bloqueado) return;
    if (this.isHidden) return this.salirEscondite();
    const world = this.ctx.world;
    const cam = this.ctx.engine.camera;
    cam.getWorldDirection(this.direccion); // la mirada de este instante, no la del frame anterior
    const ojo = cam.getWorldPosition(new THREE.Vector3());
    const enMano = this.inventario.enMano?.tipo;

    // 1. recoger un item que esté en la mira
    const item = world.objetos.itemEnMira(ojo, this.direccion, ALCANCE);
    if (item && !this.inventario.lleno) return this.inventario.recoger(item);

    // 2. abrir o cerrar una puerta en la mira (Raycaster desde la cámara)
    this._raycaster.set(ojo, this.direccion);
    this._raycaster.far = ALCANCE;
    const golpe = this._raycaster.intersectObjects(world.puertas.mallas, false)[0];
    if (golpe) return world.puertas.interactuar(world.puertas.porMalla(golpe.object), this);

    const pie = this.posicion.clone().setY(this.posicion.y + 0.3);
    // 3. tijeras o sal dentro del volumen de una ventana: la sella
    if (CONTRAS_VENTANA.includes(enMano)) {
      const ventana = world.ventanas.find((w) => !w.sellada && w.caja.containsPoint(pie));
      if (ventana) {
        world.sellarVentana(ventana.id, enMano);
        this.inventario.quitarEnMano();
        this.ctx.bus.emit('contra:colocada', { tipo: enMano, posicion: ventana.posicion.clone(), ventanaId: ventana.id });
        return;
      }
    }

    // 4. esconderse si está dentro de un HIDE_
    const escondite = world.escondites.find((h) => h.caja.containsPoint(pie));
    if (escondite) return this.esconderse(escondite);

    // 5. radio o panela: se dejan en el piso frente al jugador
    if (CONTRAS_PISO.includes(enMano)) {
      const dir = this.direccion.clone().setY(0).normalize();
      const pos = this.posicion.clone().addScaledVector(dir, 0.8).add(new THREE.Vector3(0, 0.15, 0));
      this.inventario.quitarEnMano();
      world.objetos.crearItemFisico(enMano, pos, null, true);
      this.ctx.bus.emit('contra:colocada', { tipo: enMano, posicion: pos.clone() });
      return;
    }

    // 6. pilas en mano: recargan la linterna
    if (enMano === 'pilas' && this.linterna.bateria < 100) {
      this.inventario.quitarEnMano();
      this.linterna.recargar(50);
    }
  }

  esconderse(escondite) {
    this.isHidden = true;
    this.esconditeActual = escondite.id;
    this.escondite = escondite;
    this.body.velocity.set(0, this.body.velocity.y, 0);
    this.ctx.bus.emit('jugador:escondido', { id: escondite.id });
  }

  salirEscondite() {
    if (!this.isHidden) return;
    const id = this.esconditeActual;
    this.isHidden = false;
    this.esconditeActual = null;
    this.escondite = null;
    this.ctx.bus.emit('jugador:salioEscondite', { id });
  }

  // ---------------------------------------------------------------- contrato
  // Al SPAWN_PLAYER; el objeto en mano queda tirado donde estaba (como Granny)
  respawn(soltarEnMano = true) {
    if (soltarEnMano && this.inventario.enMano) {
      this.inventario.soltar(this, this.posicion.clone().add(new THREE.Vector3(0, 0.3, 0)));
    }
    if (this.isHidden) this.salirEscondite();
    this.teletransportar(this.ctx.world.spawns.jugador);
    this._enSalida = false;
  }

  // Lo usan los portales y el respawn. destino = punto en el piso.
  teletransportar(destino) {
    this.body.position.set(destino.x, destino.y + RADIO + 0.05, destino.z);
    this.body.velocity.setZero();
    this.posicion.set(destino.x, destino.y + 0.05, destino.z);
  }

  bloquear(valor) {
    this.bloqueado = valor;
    if (valor) {
      this.controles.soltarTodo();
      this.body.velocity.set(0, this.body.velocity.y, 0);
    }
  }

  tieneObjeto(tipo) {
    return this.inventario.tieneObjeto(tipo);
  }

  quitarObjeto(tipo) {
    return this.inventario.quitarObjeto(tipo);
  }

  // modo.linterna y modo.bateria (punto 5)
  configurar(modo) {
    this.linterna.configurar(modo.linterna !== false, modo.bateria !== false);
    this.linterna.bateria = 100;
  }

  // ---------------------------------------------------------------- debug
  _debug() {
    const f = this.ctx.debug?.addFolder('Jugador');
    if (!f) return;
    f.add(this, 'invulnerable').name('modo dios');
    f.add(this.linterna, 'conBateria').name('gasta batería');
    f.add(this.linterna, 'intensidad', 0, 100, 1).name('linterna');
    f.add(this.linterna, 'bateria', 0, 100, 1).listen();
    f.add(this, 'movimiento').listen().disable();
    f.add(this, 'enSuelo').listen().disable();
    const ir = { zona: '(elige)' };
    const zonas = this.ctx.world.zonas.lista;
    f.add(ir, 'zona', ['(elige)', ...zonas.map((z) => z.nombre)]).name('ir a zona').onChange((n) => {
      const z = zonas.find((x) => x.nombre === n);
      if (z) this.teletransportar(z.caja.getCenter(new THREE.Vector3()).setY(z.caja.min.y + 0.2));
    });
    f.close();
  }
}
