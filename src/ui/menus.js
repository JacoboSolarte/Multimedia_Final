import { LEYENDAS } from '../data/leyendas.js';
import { guardado } from '../game/guardado.js';
const nombres = { MENU: 'La noche te espera', PAUSA: 'Un momento de silencio', INTRO_NOCHE: 'Antes de salir del cuarto', ATRAPADO: 'Te encontraron', NOCHE_SUPERADA: 'Escapaste de la finca', AMANECIO: 'Cantó el gallo', GAME_OVER: 'La noche se quedó contigo', VICTORIA: 'Volviste a ver el día', MUSEO: 'Los relatos de la vereda' };
const boton = (accion, texto, extra = '') => `<button type="button" data-accion="${accion}" ${extra}>${texto}<span aria-hidden="true">↗</span></button>`;
export class Menus {
  constructor(ctx) {
    this.ctx = ctx;
    this.panel = document.getElementById('contenido');
    this.pantalla = document.getElementById('pantalla');
    ctx.bus.on('juego:estado', () => { this.vista = ''; this.mostrar(); });
    ctx.bus.on('noche:inicio', () => this.mostrar());
    this.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      ctx.audio.desbloquear();
      const accion = b.dataset.accion;
      const game = ctx.game;
      if (accion === 'modo') game.iniciarModo(b.dataset.modo);
      else if (accion === 'libre') { this.vista = 'libre'; this.mostrar(); }
      else if (accion === 'iniciar-libre') {
        const espantos = [...this.panel.querySelectorAll('[name=espanto]:checked')].map((e) => e.value);
        game.iniciarModo('nocheLibre', { espantos, dificultad: this.panel.querySelector('[name=dificultad]').value });
      } else if (accion === 'comenzar') game.comenzarNoche();
      else if (accion === 'continuar') game.continuar();
      else if (accion === 'reanudar') { game.mensaje = ''; game.reanudar(); }
      else if (accion === 'menu') game.menu();
      else if (accion === 'opciones' || accion === 'creditos') { this.vista = accion; this.mostrar(); }
      else if (accion === 'volver') { this.vista = ''; this.mostrar(); }
      else if (accion === 'guardar') this.guardarOpciones();
      else if (accion === 'relato') this.ctx.bestiario.seleccionar(b.dataset.tipo);
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target?.tagName)) return;
      if (e.code === 'Space' && ctx.game.estado === 'INTRO_NOCHE') { e.preventDefault(); ctx.audio.desbloquear(); ctx.game.comenzarNoche(); }
      if (e.code === 'Escape') {
        if (this.vista) { this.vista = ''; this.mostrar(); }
        else if (ctx.game.estado === 'JUGANDO') ctx.game.pausar();
        else if (ctx.game.estado === 'MUSEO') ctx.game.menu();
      }
    });
  }
  mostrar() {
    this.panel.querySelectorAll('video').forEach((video) => video.pause());
    const g = this.ctx.game;
    const estado = g.estado;
    this.pantalla.hidden = estado === 'JUGANDO' || estado === 'ATRAPADO' || estado === 'CARGANDO';
    if (this.pantalla.hidden) return;
    document.getElementById('subtitulo').textContent = this.vista === 'opciones' ? 'A tu manera' : this.vista === 'creditos' ? 'Hecho entre compañeros' : nombres[estado] ?? '';
    let html = '';
    if (this.vista === 'opciones') {
      const o = g.datos.opciones;
      html = '<h2>Opciones</h2><div class="ajustes">';
      for (const [id, texto, min, max, paso] of [['volumen', 'Volumen general', 0, 1, 0.05], ['ambiente', 'Ambiente', 0, 1, 0.05], ['sensibilidad', 'Sensibilidad del mouse', 0.2, 2, 0.1]]) {
        html += `<label>${texto}<input name="${id}" type="range" min="${min}" max="${max}" step="${paso}" value="${o[id]}"></label>`;
      }
      html += `<label>Calidad<select name="calidad">${['baja', 'media', 'alta'].map((v) => `<option ${o.calidad === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>${boton('guardar', 'Guardar opciones')}${boton('volver', 'Volver')}`;
    } else if (this.vista === 'creditos') {
      html = '<h2>Un juego, tres miradas</h2><p>Jacobo · mundo, física, jugador y modelos.<br>Jerónimo · espantos, inteligencia y contras.<br>Yuly · flujo, interfaz, ambiente y museo.</p><p>Programación de Entornos Multimedia · Universidad Cooperativa de Colombia.</p><p>HDRI: Moonlit Golf, Poly Haven (CC0). Modelos y síntesis sonora propios del equipo. Videos: relatos originales ilustrados con los modelos del proyecto y voz sintética local. El dulce de panela es una mecánica inventada para el Duende.</p>' + boton('volver', 'Volver');
    } else if (this.vista === 'libre') {
      html = '<h2>Tu propia noche</h2><p>Escoge quién ronda la finca. Puedes dejarla vacía para explorar.</p><div class="seleccion">';
      for (const [tipo, leyenda] of Object.entries(LEYENDAS)) html += `<label><input type="checkbox" name="espanto" value="${tipo}" checked> ${leyenda.nombre}</label>`;
      html += '</div><label>Dificultad<select name="dificultad"><option value="facil">Fácil</option><option value="normal" selected>Normal</option><option value="pesadilla">Pesadilla</option></select></label>' + boton('iniciar-libre', 'Entrar a la noche') + boton('volver', 'Volver');
    } else if (estado === 'MENU') {
      html = '<p class="descripcion">Una finca cerrada. Tres relatos que nunca debiste olvidar.<br>Encuentra la llave del portón y escapa antes de las seis.</p><nav aria-label="Modos">';
      for (const [modo, texto] of [['historia', 'Historia · cinco noches'], ['supervivencia', 'Supervivencia'], ['apagon', 'Apagón']]) html += boton('modo', texto, `data-modo="${modo}"`);
      html += boton('libre', 'Noche libre') + boton('modo', 'Museo de espantos', 'data-modo="museo"') + '</nav><div class="secundarios">' + boton('opciones', 'Opciones') + boton('creditos', 'Créditos') + '</div>';
      html += `<p class="nota">Récord de supervivencia: ${Math.floor(g.datos.record)} s · Mejor con audífonos</p>`;
    } else if (estado === 'INTRO_NOCHE') {
      const tipos = g.noche?.espantos ?? [];
      html = `<p class="etiqueta">Noche ${g.nocheActual} / ${this.ctx.modo.noches?.length ?? 1} · ${this.ctx.modo.nombre}</p><h2>${tipos.map((t) => LEYENDAS[t].nombre).join(' · ') || 'La finca en silencio'}</h2><p>Escucha el televisor y aprende a protegerte.</p><div class="consejos">${tipos.map((t) => `<p>${LEYENDAS[t].contra}</p>`).join('')}</div><p>WASD mover · E interactuar · F linterna · Q soltar · clic lanzar · 1–4 inventario · Esc pausa</p><p class="nota">Busca la llave del portón. Corre con cuidado: los espantos oyen el ruido.</p>` + boton('comenzar', 'Saltar relato y comenzar · Espacio') + boton('menu', 'Volver al menú');
    } else if (estado === 'PAUSA') {
      html = `<h2>Pausa</h2><p>${g.mensaje || 'La finca espera. La física, los espantos y el reloj están detenidos.'}</p>` + boton('reanudar', 'Continuar') + boton('opciones', 'Opciones') + boton('menu', 'Volver al menú');
    } else if (estado === 'NOCHE_SUPERADA') {
      html = `<h2>Noche ${g.nocheActual} superada</h2><p>El portón quedó atrás. Te quedan ${g.vidas} vidas.</p>` + boton('continuar', 'Continuar') + boton('menu', 'Volver al menú');
    } else if (estado === 'AMANECIO') {
      html = `<h2>Las seis de la mañana</h2><p>No alcanzaste el portón. Perdiste una vida. Quedan ${g.vidas}.</p>` + boton('continuar', g.vidas > 0 ? 'Repetir la noche' : 'Ver resultado');
    } else if (estado === 'GAME_OVER' || estado === 'VICTORIA') {
      html = `<h2>${estado === 'VICTORIA' ? 'Sobreviviste al relato' : 'Fin de la partida'}</h2><p>${this.ctx.modo.id === 'supervivencia' ? `Sobreviviste ${Math.floor(g.puntaje)} s. Récord: ${Math.floor(g.datos.record)} s.` : estado === 'VICTORIA' ? 'El amanecer te encontró del otro lado del portón.' : 'Los relatos siguen en la finca. Puedes volver a intentarlo.'}</p>` + boton('menu', 'Volver al menú');
    } else if (estado === 'MUSEO') {
      html = '<h2>Museo de espantos</h2><p>Una colección de relatos. Supera sus noches en Historia para revelar cada figura.</p><div class="secundarios">';
      for (const [tipo, l] of Object.entries(LEYENDAS)) html += boton('relato', l.nombre, `data-tipo="${tipo}"`);
      html += '</div><article id="leyenda"></article>' + boton('menu', 'Volver al menú');
    }
    this.panel.innerHTML = html;
    this.pantalla.classList.toggle('museo', estado === 'MUSEO');
    if (estado === 'MUSEO') this.ctx.bestiario?.seleccionar('duende');
  }
  guardarOpciones() {
    const o = this.ctx.game.datos.opciones;
    for (const id of ['volumen', 'ambiente', 'sensibilidad']) o[id] = Number(this.panel.querySelector(`[name=${id}]`).value);
    o.calidad = this.panel.querySelector('[name=calidad]').value;
    const guardo = guardado.guardar(this.ctx.game.datos);
    this.ctx.aplicarOpciones();
    this.vista = ''; this.mostrar();
    if (!guardo) this.ctx.hud?.mensaje('Opciones aplicadas. El navegador no permite guardarlas.');
  }
  update() {}
}
