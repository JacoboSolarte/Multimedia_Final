// Utilidades pequeñas que usan todos los módulos

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const lerp = (a, b, t) => a + (b - a) * t;

// Distancia en el plano del piso (ignora la altura)
export const distanciaXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const aleatorio = (min, max) => min + Math.random() * (max - min);

export const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Fisher-Yates: copia barajada sin tocar la original
export function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Lerp independiente de los FPS: suavizado(velocidad, dt) da el factor t
export const suavizado = (velocidad, dt) => 1 - Math.exp(-velocidad * dt);
