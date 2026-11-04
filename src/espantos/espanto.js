// (Jerónimo) Clase base de los espantos. Firma del contrato 9.7, métodos vacíos para que todos puedan importar.
export class Espanto {
  constructor(ctx, tipo, config = {}) {
    this.ctx = ctx;
    this.tipo = tipo;          // 'duende' | 'bruja' | 'silbon'
    this.config = config;
    this.estado = 'PATRULLA';  // 'PATRULLA' | 'ALERTA' | 'PERSECUCION' | 'ATURDIDO' | ... (punto 4)
    this.modelo = null;        // THREE.Group
    this.body = null;          // CANNON.Body
    this.activo = false;
  }

  update(dt) {}
  oirRuido({ posicion, intensidad }) {}
  aplicarContra(tipoContra, datos) {}
  setActivo(valor) { this.activo = valor; }
  destruir() {}
}
