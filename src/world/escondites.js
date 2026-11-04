import * as THREE from 'three';

// HIDE_<id> (volumen) + HIDECAM_<id> (dónde queda la cámara) -> world.escondites
export function crearEscondites(volumenes, camaras) {
  const porId = new Map(camaras.map((o) => [o.name.slice('HIDECAM_'.length), o]));
  return volumenes.map((mesh) => {
    const id = mesh.name.slice('HIDE_'.length);
    mesh.updateWorldMatrix(true, false);
    const caja = new THREE.Box3().setFromObject(mesh);
    mesh.visible = false;
    const cam = porId.get(id);
    if (!cam) console.warn(`[escondites] falta HIDECAM_${id}`);
    const puntoCamara = cam ? cam.getWorldPosition(new THREE.Vector3()) : caja.getCenter(new THREE.Vector3());
    return { id, caja, puntoCamara, mesh };
  });
}
