// (Yuly) Modos de juego (punto 5): la misma partida con distinta configuración.
export const NOCHES = [
  { numero: 1, espantos: ['duende'], lluvia: 0.2, tormenta: false },
  { numero: 2, espantos: ['bruja'], lluvia: 0.4, tormenta: false },
  { numero: 3, espantos: ['silbon'], lluvia: 0.3, tormenta: false },
  { numero: 4, espantos: ['duende', 'bruja'], lluvia: 0.6, tormenta: false },
  { numero: 5, espantos: ['duende', 'bruja', 'silbon'], lluvia: 1.0, tormenta: true },
];

export const MODOS = {
  historia: {
    id: 'historia', nombre: 'Historia',
    noches: NOCHES, vidas: 3, duracionNoche: 360,
    linterna: true, bateria: true, salida: true,
    multVelocidad: 1, multEscucha: 1, luzAmbiente: 0.08,
  },
  supervivencia: {
    id: 'supervivencia', nombre: 'Supervivencia',
    noches: null, vidas: 1, duracionNoche: Infinity,
    linterna: true, bateria: true, salida: false,
    oleadas: { cadaSegundos: 90, orden: ['duende', 'bruja', 'silbon'], subirDificultad: 0.1 },
    multVelocidad: 1, multEscucha: 1, luzAmbiente: 0.08,
  },
  apagon: {
    id: 'apagon', nombre: 'Apagón',
    noches: NOCHES, vidas: 3, duracionNoche: 360,
    linterna: false, bateria: false, salida: true,
    multVelocidad: 0.9, multEscucha: 1.3, luzAmbiente: 0.02,
  },
  nocheLibre: {
    id: 'nocheLibre', nombre: 'Noche libre',
    noches: null,
    vidas: 3, duracionNoche: 360, linterna: true, bateria: true, salida: true,
    multVelocidad: 1, multEscucha: 1, luzAmbiente: 0.08,
  },
  museo: {
    id: 'museo', nombre: 'Museo de espantos',
    noches: null, vidas: Infinity, duracionNoche: Infinity,
    linterna: true, bateria: false, salida: false, sinEspantos: true,
    multVelocidad: 0, multEscucha: 0, luzAmbiente: 0.25,
  },
};
