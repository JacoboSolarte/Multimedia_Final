import * as THREE from 'three';

const DISTANCIA_MAXIMA = 7;

// Grafo de visibilidad entre los puntos de patrulla de la finca.
export class GrafoWaypoints {
  constructor(waypoints = [], obstaculos = [], escena = null) {
    this.waypoints = waypoints;
    this.obstaculos = obstaculos;
    this.escena = escena;
    this.raycaster = new THREE.Raycaster();
    this._conectar();
    this.lineas = null;
  }

  _conectar() {
    const porPosicion = this.waypoints.map((w) => w.posicion ?? w);
    for (let i = 0; i < this.waypoints.length; i++) {
      const actual = this.waypoints[i];
      actual.vecinos ??= [];
      actual.vecinos.length = 0;
      for (let j = i + 1; j < this.waypoints.length; j++) {
        const distancia = porPosicion[i].distanceTo(porPosicion[j]);
        if (distancia >= DISTANCIA_MAXIMA || this._bloqueado(porPosicion[i], porPosicion[j])) continue;
        const otro = this.waypoints[j];
        actual.vecinos.push(otro.id ?? otro);
        otro.vecinos ??= [];
        otro.vecinos.push(actual.id ?? actual);
      }
    }
  }

  _bloqueado(a, b) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const distancia = delta.length();
    if (!distancia || !this.obstaculos.length) return false;
    this.raycaster.set(a.clone().add(new THREE.Vector3(0, 0.2, 0)), delta.normalize());
    this.raycaster.far = Math.max(0, distancia - 0.08);
    return this.raycaster.intersectObjects(this.obstaculos, false).length > 0;
  }

  _indiceMasCercano(posicion) {
    let indice = -1;
    let distancia = Infinity;
    this.waypoints.forEach((w, i) => {
      const d = (w.posicion ?? w).distanceToSquared(posicion);
      if (d < distancia) { distancia = d; indice = i; }
    });
    return indice;
  }

  ruta(desde, hasta) {
    if (!this.waypoints.length) return [];
    const inicio = this._indiceMasCercano(desde);
    const fin = this._indiceMasCercano(hasta);
    if (inicio < 0 || fin < 0) return [];
    if (inicio === fin) return [this.waypoints[fin].posicion ?? this.waypoints[fin]];
    const indices = new Map(this.waypoints.map((w, i) => [w.id ?? w, i]));
    const cola = [inicio];
    const anterior = new Map([[inicio, -1]]);
    while (cola.length) {
      const i = cola.shift();
      if (i === fin) break;
      for (const vecino of this.waypoints[i].vecinos ?? []) {
        const j = typeof vecino === 'number' ? vecino : indices.get(vecino.id ?? vecino);
        if (j === undefined || anterior.has(j)) continue;
        anterior.set(j, i);
        cola.push(j);
      }
    }
    if (!anterior.has(fin)) return [this.waypoints[fin].posicion ?? this.waypoints[fin]];
    const camino = [];
    for (let i = fin; i !== -1; i = anterior.get(i)) camino.push(this.waypoints[i].posicion ?? this.waypoints[i]);
    camino.reverse();
    return camino;
  }

  waypointAleatorio() {
    return this.waypoints.length ? this.waypoints[Math.floor(Math.random() * this.waypoints.length)] : null;
  }

  siguienteDePatrulla(actual) {
    const actualId = actual?.id ?? actual;
    const nodo = this.waypoints.find((w) => w.id === actualId) ?? this.waypoints[this._indiceMasCercano(actual?.posicion ?? actual)];
    if (!nodo) return null;
    const vecinos = nodo.vecinos ?? [];
    if (!vecinos.length) return this.waypointAleatorio();
    const elegido = vecinos[Math.floor(Math.random() * vecinos.length)];
    return this.waypoints.find((w) => w.id === (elegido.id ?? elegido)) ?? elegido;
  }

  mostrar(escena = this.escena, visible = true) {
    if (!escena) return null;
    if (!this.lineas) {
      const puntos = [];
      const ids = new Map(this.waypoints.map((w, i) => [w.id ?? w, i]));
      this.waypoints.forEach((w, i) => {
        for (const vecino of w.vecinos ?? []) {
          const j = typeof vecino === 'number' ? vecino : ids.get(vecino.id ?? vecino);
          if (j === undefined || j <= i) continue;
          puntos.push(w.posicion ?? w, this.waypoints[j].posicion ?? this.waypoints[j]);
        }
      });
      const geo = new THREE.BufferGeometry().setFromPoints(puntos);
      this.lineas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x37d6a2 }));
      escena.add(this.lineas);
    }
    this.lineas.visible = visible;
    return this.lineas;
  }
}
