// Qué llave pide cada puerta (DOOR_<id> de finca.glb). null = abre sin llave.
// La cocina guarda el sótano; el ático se cierra arriba de la rampa del zaguán.
// El portal sótano <-> ático es la ruta alterna si solo tienes una de las dos llaves.
export const PUERTAS = {
  principal: null,
  sala: null,
  cuarto1: null, // cuarto del spawn: siempre se puede salir
  cuarto2: null,
  bano: null,
  cocina: 'llave_cocina',
  sotano: 'llave_sotano',
  atico: 'llave_atico',
};
