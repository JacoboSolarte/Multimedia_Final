import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LEYENDAS } from '../data/leyendas.js';
export class Bestiario {
  constructor(ctx) {
    this.ctx = ctx; this.grupo = new THREE.Group(); this.grupo.position.set(100, 0, 100); this.grupo.visible = false;
    ctx.engine.scene.add(this.grupo); this.modelos = new Map();
    this.grupo.add(new THREE.HemisphereLight(0xd9e2d2, 0x252f26, 3));
    const luz = new THREE.DirectionalLight(0xffdfb6, 2); luz.position.set(2, 7, 5); this.grupo.add(luz);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.45, 32), new THREE.MeshStandardMaterial({ color: 0x26382d, roughness: 0.7 }));
    base.position.y = -0.23; this.grupo.add(base);
    const datos = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const nx = (x - 64) / 64, ny = (y - 64) / 64;
      const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const luz = Math.max(0.1, -nx * 0.3 - ny * 0.5 + z * 0.7);
      datos.set([Math.min(255, 200 * luz), Math.min(255, 215 * luz), Math.min(255, 160 * luz), 255], (y * 128 + x) * 4);
    }
    this.matcap = new THREE.DataTexture(datos, 128, 128); this.matcap.colorSpace = THREE.SRGBColorSpace; this.matcap.needsUpdate = true;
    ctx.bus.on('juego:estado', ({ estado }) => {
      if (estado === 'MUSEO') this.entrar();
      else if (this.grupo.visible) this.salir();
    });
  }
  async cargar() {
    await Promise.all(Object.keys(LEYENDAS).map(async (tipo) => {
      try { this.modelos.set(tipo, await this.ctx.loader.cargarGLB(`/models/espantos/${tipo}.glb`)); } catch {}
    }));
  }
  entrar() {
    const e = this.ctx.engine;
    this.anterior = { posicion: e.camera.position.clone(), rotacion: e.camera.quaternion.clone(), niebla: e.scene.fog, fondo: e.scene.background };
    e.scene.fog = null; e.scene.background = new THREE.Color(0x0b1712);
    e.camera.position.set(98.2, 1.7, 106.5); e.camera.lookAt(98.2, 1.2, 100);
    this.grupo.visible = true; this.seleccionar('duende');
  }
  salir() {
    const e = this.ctx.engine;
    e.camera.position.copy(this.anterior.posicion); e.camera.quaternion.copy(this.anterior.rotacion);
    e.scene.fog = this.anterior.niebla; e.scene.background = this.anterior.fondo;
    this.grupo.visible = false; this.limpiar();
  }
  limpiar() {
    if (!this.figuras) return;
    this.grupo.remove(this.figuras);
    this.figuras.traverse((o) => { if (o.isMesh) { if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); } });
    this.figuras = null;
  }
  seleccionar(tipo) {
    if (!LEYENDAS[tipo]) return;
    this.tipo = tipo; this.limpiar();
    this.figuras = new THREE.Group(); this.grupo.add(this.figuras);
    const desbloqueado = this.ctx.game.datos.desbloqueados.includes(tipo);
    for (let i = 0; i < 2; i++) {
      const modelo = this.modelos.has(tipo) ? clone(this.modelos.get(tipo).scene) : new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, 6));
      const caja = new THREE.Box3().setFromObject(modelo); const tamano = caja.getSize(new THREE.Vector3()); const centro = caja.getCenter(new THREE.Vector3());
      const escala = 1.8 / Math.max(0.01, tamano.y);
      modelo.scale.multiplyScalar(escala);
      modelo.position.set((i === 0 ? -1.05 : 1.05) - centro.x * escala, -caja.min.y * escala, -centro.z * escala);
      modelo.traverse((o) => {
        if (!o.isMesh) return;
        o.material = !desbloqueado ? new THREE.MeshBasicMaterial({ color: 0x030504 }) : i === 0
          ? new THREE.MeshMatcapMaterial({ matcap: this.matcap, color: 0xc9d9b0 })
          : new THREE.MeshPhysicalMaterial({ color: 0xbab58a, metalness: 0.15, roughness: 0.3, clearcoat: 0.8 });
      });
      this.figuras.add(modelo);
    }
    const articulo = document.getElementById('leyenda');
    if (articulo) {
      articulo.querySelectorAll('video').forEach((video) => video.pause());
      articulo.replaceChildren();
      for (const texto of [LEYENDAS[tipo].nombre + (desbloqueado ? ' · Desbloqueado' : ' · Silueta bloqueada'), LEYENDAS[tipo].texto, 'Izquierda: MatCap. Derecha: material físico con barniz.']) {
        const p = document.createElement('p'); p.textContent = texto; articulo.append(p);
      }
      const video = document.createElement('video'); video.controls = true; video.preload = 'none'; video.src = `/video/leyenda_${tipo}.mp4`; video.volume = this.ctx.game.datos.opciones.volumen;
      articulo.append(video);
    }
  }
  update(dt) { if (this.grupo.visible && this.figuras) this.figuras.rotation.y += dt * 0.22; }
}
