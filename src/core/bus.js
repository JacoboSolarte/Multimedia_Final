// Bus de eventos (punto 10). Los módulos se hablan por aquí, nunca llamando funciones internas de otro.
export class Bus {
  constructor() {
    this.oyentes = new Map();
  }

  // Devuelve una función para desuscribirse
  on(evento, fn) {
    if (!this.oyentes.has(evento)) this.oyentes.set(evento, new Set());
    this.oyentes.get(evento).add(fn);
    return () => this.off(evento, fn);
  }

  off(evento, fn) {
    this.oyentes.get(evento)?.delete(fn);
  }

  emit(evento, datos) {
    const lista = this.oyentes.get(evento);
    if (!lista) return;
    // copia: un oyente puede desuscribirse mientras se recorre
    for (const fn of [...lista]) {
      try {
        fn(datos);
      } catch (err) {
        // un oyente con error no debe tumbar a los demás
        console.error(`[bus] error en un oyente de "${evento}"`, err);
      }
    }
  }
}
