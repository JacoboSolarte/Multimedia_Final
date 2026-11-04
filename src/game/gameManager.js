// (Yuly) Flujo del juego: estados, noches, vidas. Firma del contrato 9.8.
export class GameManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.estado = 'CARGANDO'; // ver punto 7.4
    this.vidas = 3;
    this.nocheActual = 1;
    this.horaJuego = '12:00 a.m.';
  }

  iniciarModo(idModo, opciones = {}) {}
  pausar() {}
  reanudar() {}
}
