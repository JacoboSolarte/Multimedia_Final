import * as CANNON from 'cannon-es';

// Mundo de Cannon con los materiales del juego (punto 9.3)
export class Physics {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    this.materiales = {
      piso: new CANNON.Material('piso'),
      muro: new CANNON.Material('muro'),
      jugador: new CANNON.Material('jugador'),
      objeto: new CANNON.Material('objeto'),
      espanto: new CANNON.Material('espanto'),
    };

    const m = this.materiales;
    // jugador y espantos se mueven asignando velocidad: sin fricción para que no se peguen a los muros
    const contactos = [
      [m.jugador, m.piso, 0.0, 0.0],
      [m.jugador, m.muro, 0.0, 0.0],
      [m.jugador, m.objeto, 0.1, 0.0],
      [m.espanto, m.piso, 0.0, 0.0],
      [m.espanto, m.muro, 0.0, 0.0],
      [m.espanto, m.objeto, 0.1, 0.0],
      [m.espanto, m.jugador, 0.0, 0.0],
      // los objetos sí ruedan, rebotan un poco y se frenan
      [m.objeto, m.piso, 0.4, 0.25],
      [m.objeto, m.muro, 0.3, 0.35],
      [m.objeto, m.objeto, 0.4, 0.2],
    ];
    for (const [a, b, friction, restitution] of contactos) {
      this.world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction, restitution }));
    }

    this._sincronizados = new Map(); // body -> mesh
  }

  // Si hay mesh, se copia la posición y rotación del body cada frame
  agregar(body, mesh = null) {
    this.world.addBody(body);
    if (mesh) this._sincronizados.set(body, mesh);
    return body;
  }

  quitar(body) {
    this.world.removeBody(body);
    this._sincronizados.delete(body);
  }

  step(dt) {
    // paso fijo de 1/60 con subpasos: estable aunque los FPS varíen
    this.world.step(1 / 60, dt, 3);
    // Posición interpolada entre los dos últimos pasos: sin ella, en los frames sin paso el objeto
    // se queda quieto y en el siguiente avanza el doble (tirones, sobre todo en pantallas de 75-144 Hz).
    // Un body dormido no actualiza previousPosition: si el Duende o el reinicio lo movieron,
    // la interpolación lo dejaría a medio camino. Dormido = quieto, así que se usa su posición real.
    for (const [body, mesh] of this._sincronizados) {
      const dormido = body.sleepState === CANNON.Body.SLEEPING;
      mesh.position.copy(dormido ? body.position : body.interpolatedPosition);
      mesh.quaternion.copy(dormido ? body.quaternion : body.interpolatedQuaternion);
    }
  }
}
