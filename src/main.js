// main.js PROVISIONAL (Jacobo, Fase 0). Yuly lo reemplaza por el definitivo con el GameManager.
// Arma el ctx (punto 7.2) y, mientras no existe el juego completo, abre una escena de prueba
// de la Etapa 1: la finca con colisiones, el jugador, puertas, items, escondites y portal.
//   /                 -> prueba de la Etapa 1 (Jacobo)
//   /?escena=modelos  -> revisar los .glb (Jacobo)
//   /?escena=espantos -> sandbox de Jerónimo
//   /?escena=flujo    -> mocks de Yuly
//   agrega &debug para el panel lil-gui y los FPS
import { Engine } from './core/engine.js';
import { Physics } from './core/physics.js';
import { Loader } from './core/loader.js';
import { Bus } from './core/bus.js';
import { crearDebug } from './core/debug.js';
import { AudioSistema } from './audio/audioSistema.js';
import { World } from './world/world.js';
import { Player } from './player/player.js';
import { EspantoManager } from './espantos/espantoManager.js';
import { MODOS } from './game/modos.js';
import { OBJETOS } from './data/objetos.js';
import { verModelos } from './dev/verModelos.js';
import { sandboxEspantos } from './dev/sandboxEspantos.js';
import { escenaFlujo } from './dev/mocks.js';

const engine = new Engine();
const ctx = {
  engine,
  physics: new Physics(),
  loader: new Loader(),
  bus: new Bus(),
  world: null,
  player: null,
  espantos: null,
  audio: null,
  modo: MODOS.historia,
  debug: crearDebug(engine),
};
ctx.audio = new AudioSistema(ctx);
window.ctx = ctx; // para revisar desde la consola del navegador

const escena = new URLSearchParams(location.search).get('escena');
if (escena === 'modelos') verModelos(ctx);
else if (escena === 'espantos') sandboxEspantos(ctx);
else if (escena === 'flujo') escenaFlujo(ctx);
else pruebaEtapa1(ctx);

async function pruebaEtapa1(ctx) {
  const ui = crearUIProvisional();
  const quitarProgreso = ctx.loader.onProgreso((p) => (ui.carga.textContent = `Cargando la finca... ${Math.round(p * 100)} %`));

  ctx.world = new World(ctx);
  await ctx.world.cargar();
  ctx.player = new Player(ctx);
  ctx.espantos = new EspantoManager(ctx);
  ctx.player.configurar(ctx.modo);
  ctx.world.setLuzAmbiente(ctx.modo.luzAmbiente);
  // para probar: todos los items en la finca
  ctx.world.generarItems(Object.keys(OBJETOS));

  // orden del bucle (punto 7.3); el mundo ya se suscribió solo en la prioridad 30
  engine.onUpdate((dt) => ctx.player.update(dt), 10);
  engine.onUpdate((dt) => ctx.physics.step(dt), 20);
  engine.onUpdate((dt) => ctx.espantos.update(dt), 40);
  engine.onUpdate(() => ui.actualizar(ctx), 70);
  engine.start();

  quitarProgreso(); // los sonidos se cargan después y no deben tapar el aviso
  ui.carga.textContent = 'Clic para jugar';
  ui.carga.onclick = () => {
    ctx.audio.desbloquear();
    ctx.player.controles.bloquearPuntero();
  };
  ctx.player.controles.pointer.addEventListener('lock', () => (ui.carga.style.display = 'none'));
  ctx.player.controles.pointer.addEventListener('unlock', () => {
    ui.carga.style.display = 'flex';
    ui.carga.textContent = 'Pausa · clic para seguir';
  });

  // registro de eventos del punto 10 (para ver que se emiten bien)
  const eventos = ['item:recogido', 'item:soltado', 'item:lanzado', 'contra:colocada', 'puerta:abierta',
    'puerta:bloqueada', 'jugador:escondido', 'jugador:salioEscondite', 'jugador:zona', 'jugador:portal',
    'linterna:cambio', 'jugador:salida'];
  for (const ev of eventos) {
    ctx.bus.on(ev, (d) => ui.log(`${ev} ${JSON.stringify(d, (k, v) => (k === 'body' ? '[body]' : v?.isVector3 ? v.toArray().map((n) => +n.toFixed(1)) : v))}`));
  }
  ctx.bus.on('ruido', (d) => (ui.ruido = Math.max(ui.ruido, d.intensidad)));
}

// HUD mínimo solo para la prueba (el HUD real es de Yuly)
function crearUIProvisional() {
  const css = 'position:fixed;font:13px/1.4 monospace;color:#ddd;text-shadow:0 0 3px #000;z-index:5;pointer-events:none';
  const carga = document.createElement('div');
  carga.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:#000a;color:#fff;font:22px system-ui;cursor:pointer;z-index:6';
  carga.textContent = 'Cargando...';
  const estado = document.createElement('div');
  estado.style.cssText = css + ';left:12px;bottom:12px;white-space:pre';
  const registro = document.createElement('div');
  registro.style.cssText = css + ';right:12px;top:12px;max-width:46vw;text-align:right;white-space:pre-wrap;opacity:.85';
  const mira = document.createElement('div');
  mira.style.cssText = css + ';left:50%;top:50%;transform:translate(-50%,-50%);font-size:18px';
  mira.textContent = '·';
  const ayuda = document.createElement('div');
  ayuda.style.cssText = css + ';left:12px;top:12px;white-space:pre;opacity:.8';
  ayuda.textContent = 'WASD mover · Shift correr · C agacharse · Espacio saltar\nE interactuar · Q soltar · Clic lanzar · 1-4 / rueda inventario · F linterna · Esc pausa';
  document.body.append(carga, estado, registro, mira, ayuda);

  const lineas = [];
  const ui = {
    carga,
    ruido: 0,
    log(texto) {
      lineas.unshift(texto);
      lineas.length = Math.min(lineas.length, 8);
      registro.textContent = lineas.join('\n');
    },
    actualizar(ctx) {
      const p = ctx.player;
      ui.ruido = Math.max(0, ui.ruido - 0.05);
      const inv = p.inventario.espacios.map((e, i) => `${i === p.inventario.activo ? '>' : ' '}${i + 1}:${e ? e.nombre : '---'}`).join('  ');
      estado.textContent =
        `zona: ${ctx.world.zonas.actual}   ${p.movimiento}${p.isHidden ? '   [ESCONDIDO]' : ''}\n` +
        `linterna: ${p.linterna.encendida ? 'ON ' : 'off'} ${Math.round(p.linterna.bateria)} %   ruido: ${'█'.repeat(Math.round(ui.ruido))}\n` +
        inv;
    },
  };
  return ui;
}
