// (Jerónimo) Duende: hereda de Espanto. Pendiente de implementar.
import { Espanto } from './espanto.js';

export class Duende extends Espanto {
  constructor(ctx, config = {}) {
    super(ctx, 'duende', config);
  }
}
