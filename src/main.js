import { Engine } from './core/engine.js';
import { Physics } from './core/physics.js';
import { Loader } from './core/loader.js';
import { Bus } from './core/bus.js';
import { crearDebug } from './core/debug.js';
import { AudioSistema } from './audio/audioSistema.js';
import { World } from './world/world.js';
import { Player } from './player/player.js';
import { EspantoManager } from './espantos/espantoManager.js';
import { GameManager } from './game/gameManager.js';
import { MODOS } from './game/modos.js';
import { Menus } from './ui/menus.js';
import { Hud } from './ui/hud.js';
import { Jumpscare } from './ui/jumpscare.js';
import { Tv } from './ui/tv.js';
import { Bestiario } from './game/bestiario.js';
import { Lluvia } from './fx/lluvia.js';
import { Polvo } from './fx/polvo.js';
import { Fuego } from './fx/fuego.js';
import { AguaPozo } from './fx/aguaPozo.js';
import { Relampagos } from './fx/relampagos.js';
import { Ambiente } from './audio/ambiente.js';

const espantosPresentes = new Set(Object.keys(import.meta.glob('/public/sounds/espantos/*.mp3')).map((p) => p.replace('/public', '')));
const sonidosProvisionales = new Set(['duende_risa_1', 'duende_risa_2', 'duende_risa_3', 'duende_pasos', 'bruja_carcajada', 'bruja_aleteo', 'bruja_viento', 'silbon_silbido', 'silbon_pasos', 'silbon_huesos', 'ladridos']);

async function arrancar() {
  const motor = new Engine(document.getElementById('juego'));
  const ctx = {
    engine: motor, physics: new Physics(), loader: new Loader(), bus: new Bus(),
    world: null, player: null, espantos: null, audio: null,
    modo: MODOS.historia, debug: crearDebug(motor),
  };
  const escena = new URLSearchParams(location.search).get('escena');
  const herramienta = ['modelos', 'espantos'].includes(escena);
  // Adaptador de prioridades: pausa la simulación, conserva render y UI.
  if (!herramienta) {
    const registrar = motor.onUpdate.bind(motor);
    motor.onUpdate = (fn, prioridad = 50) => registrar((dt, t) => {
      if (prioridad >= 10 && prioridad <= 60 && ctx.game?.estado !== 'JUGANDO') return;
      fn(dt, t);
    }, prioridad);
  }
  ctx.audio = new AudioSistema(ctx);
  const cargarBuffer = ctx.audio.buffer.bind(ctx.audio);
  // Los sonidos definitivos tienen prioridad sobre la síntesis provisional de Yuly.
  ctx.audio.buffer = (ruta) => {
    if (!ruta.startsWith('/sounds/espantos/') || espantosPresentes.has(ruta)) return cargarBuffer(ruta);
    const nombre = ruta.match(/^\/sounds\/espantos\/([a-z0-9_]+)\.mp3$/)?.[1];
    const provisional = `/sounds/ambiente/provisional_${nombre}.wav`;
    return sonidosProvisionales.has(nombre) ? cargarBuffer(provisional) : Promise.resolve(null);
  };
  if (import.meta.env.DEV) window.ctx = ctx;
  const quitarProgreso = ctx.loader.onProgreso((p) => {
    document.getElementById('progreso').value = p;
    document.getElementById('mensaje').textContent = `Cargando la vereda… ${Math.round(p * 100)} %`;
  });
  try {
    if (herramienta) {
      document.getElementById('pantalla').hidden = true;
      if (escena === 'modelos') await (await import('./dev/verModelos.js')).verModelos(ctx);
      else await (await import('./dev/sandboxEspantos.js')).sandboxEspantos(ctx);
      return;
    }
    ctx.game = new GameManager(ctx);
    if (escena === 'flujo') {
      await (await import('./dev/mocks.js')).escenaFlujo(ctx);
      ctx.renovarEspantos = (tipos, modo) => ctx.espantos.iniciar(tipos, modo);
      document.getElementById('laboratorio').hidden = false;
    } else {
      ctx.world = new World(ctx); await ctx.world.cargar();
      ctx.player = new Player(ctx);
      ctx.espantos = new EspantoManager(ctx);
      await ctx.espantos.precargar();
      // Usa la limpieza pública que ya ofrece Jerónimo para reiniciar IA y dificultad.
      ctx.renovarEspantos = (tipos, modo) => {
        ctx.espantos.destruir();
        ctx.espantos = new EspantoManager(ctx);
        ctx.espantos.iniciar(tipos, { multVelocidad: modo.multVelocidad, multEscucha: modo.multEscucha });
        // shaders de los espantos e items de esta noche listos antes de verlos (evita congelones al aparecer)
        motor.precompilar(ctx.espantos.lista.map((e) => e.modelo).filter(Boolean));
      };
      motor.onUpdate((dt) => ctx.player.update(dt), 10);
      motor.onUpdate((dt) => ctx.physics.step(dt), 20);
      motor.onUpdate(() => ctx.player.actualizarCamara(), 25);
    }
    ctx.capturarPuntero = () => ctx.player.controles?.bloquearPuntero();
    ctx.liberarPuntero = () => ctx.player.controles?.liberarPuntero();
    ctx.aplicarOpciones = () => {
      const o = ctx.game.datos.opciones;
      ctx.audio.listener.setMasterVolume(ctx.game.estado === 'PAUSA' ? 0 : o.volumen);
      motor.setCalidad(o.calidad);
      ctx.player.linterna.luz.castShadow = o.calidad !== 'baja';
      if (ctx.player.controles) ctx.player.controles.pointer.pointerSpeed = o.sensibilidad;
      const video = document.getElementById('relato-video'); video.volume = o.volumen;
    };
    ctx.bestiario = new Bestiario(ctx); await ctx.bestiario.cargar();
    ctx.hud = new Hud(ctx);
    ctx.menus = new Menus(ctx);
    ctx.tv = new Tv(ctx);
    ctx.jumpscare = new Jumpscare(ctx);
    ctx.ambiente = new Ambiente(ctx); await ctx.ambiente.cargar();
    ctx.bus.on('juego:estado', ({ estado }) => {
      ctx.audio.listener.setMasterVolume(estado === 'PAUSA' ? 0 : ctx.game.datos.opciones.volumen);
    });
    const efectos = [new Lluvia(ctx), new Polvo(ctx), new Fuego(ctx), new AguaPozo(ctx), new Relampagos(ctx)];
    motor.onUpdate((dt) => ctx.game.update(dt), 50);
    motor.onUpdate((dt) => { for (const efecto of efectos) efecto.update(dt); ctx.ambiente.update(dt); }, 60);
    motor.onUpdate((dt) => { ctx.hud.update(dt); ctx.jumpscare.update(dt); ctx.bestiario.update(dt); }, 70);
    if (ctx.player.controles) {
      ctx.player.controles.pointer.addEventListener('unlock', () => ctx.game.pausar());
      window.addEventListener('blur', () => ctx.game.pausar());
      document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.game.pausar(); });
      document.addEventListener('pointerlockerror', () => {
        ctx.game.mensaje = 'El navegador no permitió capturar el mouse. Espera un momento y pulsa Continuar.';
        ctx.game.pausar();
        ctx.menus.mostrar();
      });
    }
    const carpeta = ctx.debug?.addFolder('Juego');
    if (carpeta) {
      carpeta.add(ctx.game, 'estado').listen().disable();
      carpeta.add(ctx.game, 'vidas').listen().disable();
      carpeta.add(ctx.game, 'nocheActual', 1, 5, 1).name('noche (Historia)');
      carpeta.add({ saltar: () => { if (ctx.modo.noches) ctx.game.prepararNoche(); } }, 'saltar').name('preparar noche');
      carpeta.add({ adelantar: () => { ctx.game.reloj.transcurrido += 60; } }, 'adelantar').name('adelantar 1 minuto');
    }
    ctx.aplicarOpciones();
    document.getElementById('carga').hidden = true;
    ctx.game.menu();
    motor.precompilar();
    motor.start();
  } finally { quitarProgreso(); }
}
arrancar().catch((error) => {
  console.error('[arranque]', error);
  const pantalla = document.getElementById('pantalla'); pantalla.hidden = false;
  document.getElementById('carga').hidden = true;
  document.getElementById('contenido').innerHTML = '<h2>No se pudo abrir la finca</h2><p>Revisa la consola y los archivos del proyecto. Puedes recargar para intentarlo de nuevo.</p><button onclick="location.reload()">Reintentar</button>';
});
