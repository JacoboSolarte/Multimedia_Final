export class Ambiente {
  constructor(ctx) {
    this.ctx = ctx; this.sonidos = {}; this.zona = 'cuarto'; this.tension = false;
    ctx.bus.on('jugador:zona', ({ zona }) => { this.zona = zona; });
    ctx.bus.on('espanto:estado', ({ estado }) => { this.tension = estado === 'PERSECUCION'; });
    ctx.bus.on('juego:estado', ({ estado }) => {
      if (estado !== 'JUGANDO') this.pausar();
      if (estado === 'VICTORIA' || estado === 'GAME_OVER') ctx.audio.sonar(`/sounds/ui/${estado === 'VICTORIA' ? 'victoria' : 'game_over'}.wav`, { volumen: 0.5 });
    });
  }
  async cargar() {
    await Promise.all(['grillos', 'viento', 'lluvia', 'latido'].map(async (tipo) => {
      const buffer = await this.ctx.audio.buffer(`/sounds/ambiente/${tipo}.wav`);
      if (buffer) this.sonidos[tipo] = this.ctx.audio.crearAudio(buffer, { volumen: 0, loop: true });
    }));
  }
  pausar() { for (const sonido of Object.values(this.sonidos)) if (sonido.isPlaying) sonido.pause(); }
  update() {
    const { ctx } = this;
    const volumen = ctx.game.datos.opciones.ambiente;
    const fuera = ['patio', 'exterior', 'corredor'].includes(this.zona);
    const distancia = ctx.espantos.masCercano(ctx.player.posicion).distancia;
    const peligro = Math.max(0, 1 - distancia / 14);
    for (const [tipo, audio] of Object.entries(this.sonidos)) {
      if (!audio.isPlaying && ctx.audio.listener.context.state === 'running') audio.play();
      const nivel = tipo === 'latido' ? peligro * 0.65 : tipo === 'lluvia' ? (ctx.game.noche?.lluvia ?? 0) * (fuera ? 0.55 : 0.15) : tipo === 'grillos' ? (fuera ? 0.5 : 0.1) : fuera ? 0.3 : this.zona === 'sotano' ? 0.22 : 0.08;
      audio.setVolume(nivel * volumen);
      if (tipo === 'latido') audio.setPlaybackRate(0.85 + peligro * 0.8);
    }
  }
}
