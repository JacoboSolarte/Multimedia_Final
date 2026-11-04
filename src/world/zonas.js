import * as THREE from 'three';

// ZONE_<nombre>: para el HUD, el audio ambiente y los pasos (madera adentro, tierra afuera)
export class Zonas {
  constructor(ctx, mallas) {
    this.ctx = ctx;
    this.lista = mallas.map((mesh) => {
      mesh.updateWorldMatrix(true, false);
      const caja = new THREE.Box3().setFromObject(mesh);
      mesh.visible = false;
      const tam = caja.getSize(new THREE.Vector3());
      return { nombre: mesh.name.slice('ZONE_'.length), caja, volumen: tam.x * tam.y * tam.z, mesh };
    });
    // la zona más pequeña gana cuando se solapan (el corredor dentro del patio, etc.)
    this.lista.sort((a, b) => a.volumen - b.volumen);
    this.actual = null;
  }

  zonaDe(posicion) {
    for (const z of this.lista) if (z.caja.containsPoint(posicion)) return z.nombre;
    return 'exterior';
  }

  // Emite jugador:zona solo cuando cambia
  update(posicionJugador) {
    // un poco arriba de los pies para no quedar justo en el borde del piso
    const p = new THREE.Vector3(posicionJugador.x, posicionJugador.y + 0.3, posicionJugador.z);
    const zona = this.zonaDe(p);
    if (zona !== this.actual) {
      this.actual = zona;
      this.ctx.bus.emit('jugador:zona', { zona });
    }
  }
}
