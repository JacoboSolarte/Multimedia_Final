// (Jerónimo) Bruja: hereda de Espanto. Pendiente de implementar.
import { Espanto } from './espanto.js';

export class Bruja extends Espanto {
  constructor(ctx, config = {}) {
    super(ctx, 'bruja', config);
  }
}
