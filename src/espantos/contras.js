// Distribuye únicamente las contras a las que responde cada leyenda.
const AFECTA = {
  aji: ['silbon'], radio: ['silbon'], latigo: ['silbon'],
  tijeras: ['bruja'], sal: ['bruja'], panela: ['duende'],
};

export class Contras {
  constructor(ctx) {
    this.ctx = ctx;
    this._quitar = [
      ctx.bus.on('contra:colocada', (datos) => this.aplicar(datos.tipo, datos)),
      ctx.bus.on('item:lanzado', (datos) => this.aplicar(datos.tipo, datos)),
    ];
  }

  aplicar(tipo, datos) {
    const permitidos = AFECTA[tipo];
    if (!permitidos) return;
    for (const espanto of this.ctx.espantos?.lista ?? []) {
      if (espanto.activo && permitidos.includes(espanto.tipo)) espanto.aplicarContra(tipo, datos);
    }
  }

  destruir() { for (const fn of this._quitar) fn(); }
}
