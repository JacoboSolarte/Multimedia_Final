import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const _caja = new THREE.Box3();
const _tam = new THREE.Vector3();
const _centro = new THREE.Vector3();
const _escala = new THREE.Vector3();
const _quat = new THREE.Quaternion();

// Cada COL_ se vuelve un CANNON.Box estático.
// Tamaño = bounding box LOCAL de la geometría × escala; posición y rotación = las del MUNDO,
// así funcionan los colliders rotados (las rampas).
export function crearColliders(physics, mallas) {
  const bodies = [];
  const materialDebug = new THREE.MeshBasicMaterial({ color: 0xff3030, wireframe: true });

  for (const mesh of mallas) {
    mesh.updateWorldMatrix(true, false);
    mesh.geometry.computeBoundingBox();
    _caja.copy(mesh.geometry.boundingBox);
    _caja.getSize(_tam).multiply(mesh.getWorldScale(_escala));
    _caja.getCenter(_centro);
    mesh.localToWorld(_centro);
    mesh.getWorldQuaternion(_quat);

    // losa delgada (más ancha que alta) = piso; lo demás = muro
    const esPiso = _tam.y < Math.min(_tam.x, _tam.z) && _tam.y < 0.5;
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: esPiso ? physics.materiales.piso : physics.materiales.muro,
      shape: new CANNON.Box(new CANNON.Vec3(_tam.x / 2, _tam.y / 2, _tam.z / 2)),
      position: new CANNON.Vec3(_centro.x, _centro.y, _centro.z),
      quaternion: new CANNON.Quaternion(_quat.x, _quat.y, _quat.z, _quat.w),
    });
    body.userData = { nombre: mesh.name };
    physics.agregar(body);
    bodies.push(body);

    // La malla se queda en la escena para el Raycaster de los espantos, pero no se dibuja
    mesh.userData.materialOriginal = mesh.material;
    mesh.material = mesh.material.clone();
    mesh.material.visible = false;
    mesh.userData.materialDebug = materialDebug;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }
  return bodies;
}

// Debug: ver los colliders en wireframe
export function mostrarColliders(mallas, visible) {
  for (const m of mallas) {
    if (visible) {
      m.userData.materialOculto ??= m.material;
      m.material = m.userData.materialDebug;
    } else if (m.userData.materialOculto) {
      m.material = m.userData.materialOculto;
    }
  }
}
