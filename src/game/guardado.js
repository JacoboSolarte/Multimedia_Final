const CLAVE = 'espantos:v1';
export const OPCIONES = { volumen: 0.8, ambiente: 0.55, sensibilidad: 1, calidad: 'media' };
const numero = (valor, defecto, min, max) => typeof valor === 'number' && Number.isFinite(valor) ? Math.min(max, Math.max(min, valor)) : defecto;
export const guardado = {
  cargar() {
    let datos = {};
    try { datos = JSON.parse(globalThis.localStorage?.getItem(CLAVE) || '{}') || {}; } catch {}
    const o = datos.opciones ?? {};
    return {
      record: numero(datos.record, 0, 0, 1e9),
      desbloqueados: Array.isArray(datos.desbloqueados) ? [...new Set(datos.desbloqueados.filter((t) => ['duende', 'bruja', 'silbon'].includes(t)))] : [],
      opciones: {
        volumen: numero(o.volumen, OPCIONES.volumen, 0, 1),
        ambiente: numero(o.ambiente, OPCIONES.ambiente, 0, 1),
        sensibilidad: numero(o.sensibilidad, OPCIONES.sensibilidad, 0.2, 2),
        calidad: ['baja', 'media', 'alta'].includes(o.calidad) ? o.calidad : OPCIONES.calidad,
      },
    };
  },
  guardar(datos) {
    try { globalThis.localStorage.setItem(CLAVE, JSON.stringify(datos)); return true; } catch { return false; }
  },
};
