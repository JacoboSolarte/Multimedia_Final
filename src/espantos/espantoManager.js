// (Jerónimo) Crea y actualiza los espantos de la noche. Firma del contrato 9.7.
export class EspantoManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.lista = []; // espantos activos
  }

  async precargar() {}                      // carga los 3 glb y sus sonidos una sola vez
  iniciar(listaTipos, multiplicadores) {}   // { multVelocidad, multEscucha }
  agregar(tipo) {}                          // para supervivencia
  detenerTodos() {}
  update(dt) {}

  // { espanto, distancia } para el latido del HUD
  masCercano(posicion) {
    return { espanto: null, distancia: Infinity };
  }
}
