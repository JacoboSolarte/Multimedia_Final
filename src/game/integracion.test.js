import test from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from './gameManager.js';
import { Reloj } from './reloj.js';
import { guardado } from './guardado.js';
import { Bus } from '../core/bus.js';
import { MODOS } from './modos.js';
function preparar() {
  const ctx = { bus: new Bus(), modo: MODOS.historia, world: { reinicios: 0, reiniciarNoche() { this.reinicios++; }, generarItems(t) { this.items = t; }, setLuzAmbiente() {} }, player: { inventario: { espacios: [null, null, null, null] }, configurar() {}, bloquear(v) { this.bloqueado = v; }, respawn() { this.respawns = (this.respawns ?? 0) + 1; }, quitarObjeto() {} }, espantos: { lista: [], detenerTodos() { this.lista.forEach(e => e.activo = false); }, agregar(tipo) { this.lista.push({ tipo, activo: true }); } } };
  ctx.renovarEspantos = (tipos, modo) => { ctx.espantos.lista = tipos.map(tipo => ({ tipo, activo: true })); ctx.ultimaVelocidad = modo.multVelocidad; };
  const game = new GameManager(ctx); ctx.game = game;
  return { ctx, game };
}
test('Historia recorre las cinco noches y desbloquea los tres relatos', () => {
  const { ctx, game } = preparar(); game.datos.desbloqueados = [];
  game.iniciarModo('historia');
  for (let noche = 1; noche <= 5; noche++) {
    assert.equal(game.estado, 'INTRO_NOCHE'); assert.equal(game.nocheActual, noche);
    assert.ok(ctx.world.items.includes('llave_porton'));
    game.comenzarNoche(); ctx.bus.emit('jugador:salida', { conLlave: false }); assert.equal(game.estado, 'JUGANDO');
    ctx.bus.emit('jugador:salida', { conLlave: true }); assert.equal(game.estado, 'NOCHE_SUPERADA'); game.continuar();
  }
  assert.equal(game.estado, 'VICTORIA'); assert.deepEqual(game.datos.desbloqueados.sort(), ['bruja', 'duende', 'silbon']);
});
test('Pausa congela reloj y puntaje; reanudar conserva la noche', () => {
  const { game } = preparar(); game.iniciarModo('historia'); game.comenzarNoche(); game.update(10); game.pausar(); game.update(100);
  assert.equal(game.reloj.transcurrido, 10); assert.equal(game.puntaje, 10); game.reanudar(); game.update(1); assert.equal(game.reloj.transcurrido, 11);
});
test('Captura duplicada resta una sola vida y no reinicia la finca', () => {
  const { ctx, game } = preparar(); game.iniciarModo('historia'); game.comenzarNoche(); const reinicios = ctx.world.reinicios;
  ctx.bus.emit('jugador:atrapado', { tipo: 'duende' }); ctx.bus.emit('jugador:atrapado', { tipo: 'duende' });
  assert.equal(game.vidas, 2); game.finalizarCaptura(); assert.equal(game.estado, 'PAUSA'); assert.equal(ctx.world.reinicios, reinicios);
});
test('Tres amaneceres llevan a game over sin adelantar la noche', () => {
  const { game } = preparar(); game.iniciarModo('apagon');
  for (let i = 0; i < 3; i++) { game.comenzarNoche(); game.update(360); assert.equal(game.estado, 'AMANECIO'); game.continuar(); }
  assert.equal(game.estado, 'GAME_OVER'); assert.equal(game.vidas, 0); assert.equal(game.nocheActual, 1);
});
test('Supervivencia añade espantos y luego sube dificultad; ignora salida', () => {
  const { ctx, game } = preparar(); game.iniciarModo('supervivencia'); game.comenzarNoche();
  ctx.bus.emit('jugador:salida', { conLlave: true }); assert.equal(game.estado, 'JUGANDO');
  game.update(90); assert.deepEqual(game.tiposActivos(), ['duende', 'bruja']);
  game.update(90); assert.deepEqual(game.tiposActivos(), ['duende', 'bruja', 'silbon']);
  game.update(90); assert.equal(ctx.ultimaVelocidad, 1.1);
  ctx.bus.emit('jugador:atrapado', { tipo: 'bruja' }); game.finalizarCaptura(); assert.equal(game.estado, 'GAME_OVER'); assert.ok(game.datos.record >= 270);
});
test('Noche libre acepta selección vacía y dificultad; no muta MODOS', () => {
  const { ctx, game } = preparar(); game.iniciarModo('nocheLibre', { espantos: [], dificultad: 'pesadilla' });
  assert.deepEqual(game.noche.espantos, []); assert.equal(ctx.modo.multVelocidad, 1.3); assert.equal(MODOS.nocheLibre.multVelocidad, 1);
});
test('Museo no activa reloj ni espantos; eventos ajenos no restan vidas', () => {
  const { ctx, game } = preparar(); game.iniciarModo('museo'); game.update(500); ctx.bus.emit('jugador:atrapado', { tipo: 'duende' });
  assert.equal(game.estado, 'MUSEO'); assert.equal(game.vidas, Infinity); assert.equal(game.puntaje, 0);
});
test('Reloj muestra 12 a 6 y el guardado tolera JSON roto y almacenamiento denegado', () => {
  const r = new Reloj({}); assert.equal(r.hora, '12:00 a.m.'); r.update(180); assert.equal(r.hora, '3:00 a.m.'); r.update(180); assert.equal(r.hora, '6:00 a.m.');
  globalThis.localStorage = { getItem() { return '{roto'; }, setItem() { throw new Error('bloqueado'); } };
  assert.equal(guardado.cargar().record, 0); assert.equal(guardado.guardar({}), false);
  globalThis.localStorage = { getItem() { return '{"record":-2,"desbloqueados":["duende","x"],"opciones":{"volumen":6,"calidad":"ultra"}}'; } };
  const datos = guardado.cargar(); assert.equal(datos.record, 0); assert.equal(datos.opciones.volumen, 1); assert.equal(datos.opciones.calidad, 'media'); assert.deepEqual(datos.desbloqueados, ['duende']);
  delete globalThis.localStorage;
});
