// Definición de items (punto 9.9). El GameManager decide cuáles aparecen cada noche.
// llave_atico y llave_sotano completan las "llaves de cuarto" del punto 3.4.
export const OBJETOS = {
  llave_porton: { nombre: 'Llave del portón', modelo: '/models/objetos/llave.glb', lanzable: false },
  llave_cocina: { nombre: 'Llave de la cocina', modelo: '/models/objetos/llave.glb', lanzable: false },
  llave_atico: { nombre: 'Llave del ático', modelo: '/models/objetos/llave.glb', lanzable: false },
  llave_sotano: { nombre: 'Llave del sótano', modelo: '/models/objetos/llave.glb', lanzable: false },
  pilas: { nombre: 'Pilas', modelo: '/models/objetos/pilas.glb', lanzable: true },
  aji: { nombre: 'Ají', modelo: '/models/objetos/aji.glb', lanzable: true, contra: 'silbon' },
  radio: { nombre: 'Radio', modelo: '/models/objetos/radio.glb', lanzable: false, contra: 'silbon' },
  latigo: { nombre: 'Látigo', modelo: '/models/objetos/latigo.glb', lanzable: false, contra: 'silbon' },
  tijeras: { nombre: 'Tijeras', modelo: '/models/objetos/tijeras.glb', lanzable: false, contra: 'bruja' },
  sal: { nombre: 'Sal', modelo: '/models/objetos/sal.glb', lanzable: false, contra: 'bruja' },
  panela: { nombre: 'Dulce de panela', modelo: '/models/objetos/panela.glb', lanzable: false, contra: 'duende' },
};

// Objetos de ambiente de la finca (PHYS_<tipo>): masa en kg para Cannon
export const FISICOS = {
  olla: { masa: 1.5, modelo: '/models/objetos/olla.glb' },
  botella: { masa: 0.6, modelo: '/models/objetos/botella.glb' },
  caja: { masa: 3, modelo: '/models/objetos/caja.glb' },
};

// Contras que se usan con E: en una ventana (bruja) o dejándolas en el piso
export const CONTRAS_VENTANA = ['tijeras', 'sal'];
export const CONTRAS_PISO = ['radio', 'panela'];
