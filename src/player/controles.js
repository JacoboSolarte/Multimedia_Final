import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// Teclado y mouse del punto 3.1. Guarda el estado de las teclas y avisa las acciones de un toque.
export class Controles {
  constructor(ctx) {
    this.ctx = ctx;
    this.pointer = new PointerLockControls(ctx.engine.camera, ctx.engine.renderer.domElement);
    this.teclas = { adelante: false, atras: false, izquierda: false, derecha: false, correr: false, agachado: false };
    this.acciones = {}; // nombre -> fn, las asigna el Player
    this.habilitado = true;

    const MAPA = {
      KeyW: 'adelante', ArrowUp: 'adelante',
      KeyS: 'atras', ArrowDown: 'atras',
      KeyA: 'izquierda', ArrowLeft: 'izquierda',
      KeyD: 'derecha', ArrowRight: 'derecha',
      ShiftLeft: 'correr', ShiftRight: 'correr',
      KeyC: 'agachado', ControlLeft: 'agachado',
    };
    const TOQUES = {
      Space: 'saltar', KeyE: 'interactuar', KeyQ: 'soltar', KeyF: 'linterna',
      Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'slot3',
    };

    this._abajo = (e) => {
      if (MAPA[e.code]) this.teclas[MAPA[e.code]] = true;
      if (!this.activo || e.repeat) return;
      const accion = TOQUES[e.code];
      if (accion) {
        e.preventDefault();
        this._disparar(accion);
      }
    };
    this._arriba = (e) => {
      if (MAPA[e.code]) this.teclas[MAPA[e.code]] = false;
    };
    this._mouse = (e) => {
      if (this.activo && e.button === 0) this._disparar('lanzar');
    };
    this._rueda = (e) => {
      if (this.activo) this._disparar(e.deltaY > 0 ? 'slotSiguiente' : 'slotAnterior');
    };
    window.addEventListener('keydown', this._abajo);
    window.addEventListener('keyup', this._arriba);
    document.addEventListener('mousedown', this._mouse);
    document.addEventListener('wheel', this._rueda, { passive: true });
    // al perder el foco se sueltan todas las teclas (si no, el jugador sigue caminando solo)
    window.addEventListener('blur', () => this.soltarTodo());
    this.pointer.addEventListener('unlock', () => this.soltarTodo());
  }

  _disparar(accion) {
    this.acciones[accion]?.();
  }

  // El mouse solo controla la cámara con el puntero capturado
  get activo() {
    return this.habilitado && this.pointer.isLocked;
  }

  bloquearPuntero() {
    if (this.habilitado) this.pointer.lock();
  }

  liberarPuntero() {
    this.pointer.unlock();
  }

  soltarTodo() {
    for (const k in this.teclas) this.teclas[k] = false;
  }
}
