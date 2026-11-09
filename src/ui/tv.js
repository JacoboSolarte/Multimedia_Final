import * as THREE from 'three';
import { LEYENDAS } from '../data/leyendas.js';
export class Tv {
  constructor(ctx) {
    this.ctx = ctx; this.video = document.getElementById('relato-video');
    this.caja = document.getElementById('video-contenedor');
    this.aviso = document.getElementById('video-aviso');
    this.textura = new THREE.VideoTexture(this.video);
    this.textura.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({ map: this.textura, toneMapped: false });
    if (ctx.world.tvPantalla) {
      this.original = ctx.world.tvPantalla.material;
      ctx.world.tvPantalla.material = this.material;
    }
    const datos = new Uint8Array(32 * 32 * 4);
    for (let i = 0; i < datos.length; i += 4) { const gris = Math.floor(Math.random() * 140); datos.set([gris, gris, gris, 255], i); }
    this.estatica = new THREE.DataTexture(datos, 32, 32); this.estatica.needsUpdate = true;
    this.material.map = this.estatica;
    ctx.bus.on('noche:inicio', ({ espantos }) => {
      this.cola = [...espantos]; this.siguiente();
    });
    ctx.bus.on('juego:estado', ({ estado }) => {
      if (estado !== 'INTRO_NOCHE') { this.video.pause(); this.caja.hidden = true; this.material.map = this.estatica; this.material.needsUpdate = true; }
    });
    this.video.addEventListener('ended', () => this.siguiente());
    this.video.addEventListener('error', () => { this.aviso.textContent = 'Video no disponible. Puedes leer el consejo y comenzar la noche.'; });
  }
  siguiente() {
    if (this.ctx.game.estado !== 'INTRO_NOCHE') return;
    const tipo = this.cola.shift();
    if (!tipo) {
      this.aviso.textContent = 'Relato terminado. Pulsa el botón para comenzar la noche.';
      return;
    }
    this.caja.hidden = false; this.aviso.textContent = LEYENDAS[tipo].nombre + ' · relato y protección';
    this.video.src = `/video/leyenda_${tipo}.mp4`;
    this.video.volume = this.ctx.game.datos.opciones.volumen;
    this.material.map = this.textura; this.material.needsUpdate = true;
    this.video.play().catch(() => { this.aviso.textContent = 'Pulsa reproducir para escuchar el relato o comienza la noche.'; });
  }
  update() {}
}
