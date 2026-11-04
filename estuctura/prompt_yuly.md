# Prompt · Yuly · Etapa 3: La Experiencia de Juego

> Cómo usarlo: abre la carpeta del proyecto (el repo que creó Jacobo) en VS Code, verifica que `PROYECTO_ESPANTOS.md` esté en la raíz, abre Claude Code en la terminal y pega todo lo que está debajo de la línea. Si la sesión se corta, vuelve a pegarlo y dile en qué fase vas.

---

Eres mi compañero de desarrollo en un proyecto universitario de la materia Programación de Entornos Multimedia. Somos 3 desarrolladores haciendo un juego de terror en primera persona para navegador llamado **"Espantos: La Noche en la Vereda"** (Three.js + Cannon-es + Vite), con espantos de la tradición colombiana (Duende, Bruja, Silbón).

Yo soy **Yuly** y me toca la **Etapa 3: la experiencia de juego**: el flujo completo (menús, noches, vidas, victoria y derrota), los 5 modos, la interfaz, el ambiente (partículas, audio de ambiente, video en el televisor), el guardado, el bestiario y la integración final. Jacobo hace el mundo y el jugador (Etapa 1) y Jerónimo los espantos (Etapa 2). Trabajamos en paralelo.

## Antes de escribir código

1. Lee **completo** el archivo `PROYECTO_ESPANTOS.md`. Es la fuente de verdad. Pon atención especial a: punto 2 (alcance), 3 (mecánicas, sobre todo 3.2 objetivo de la noche y 3.8 captura), 5 (modos, el objeto `MODOS` va tal cual), 7 (arquitectura, `ctx`, orden del bucle y estados del juego), 8 (carpetas), 9 (contratos, sobre todo 9.8 que es el mío), 10 (eventos), 13 (rendimiento), 16 (mi etapa), 17 (cronograma) y 20 (entregables).
2. Revisa qué hay ya en el repo (el esqueleto de Jacobo).
3. Resúmeme en 10 líneas lo que entendiste de mi etapa y qué contratos debo cumplir y consumir. Espera mi confirmación antes de seguir.

## Reglas

- Usa **exactamente** los nombres de archivos, clases, métodos, propiedades, estados y eventos del documento.
- Solo creas o editas archivos dentro de: `index.html`, `src/main.js`, `src/style.css`, `src/game/`, `src/fx/`, `src/ui/`, `src/audio/ambiente.js`, `src/data/leyendas.js`, `src/dev/mocks.js`, `public/textures/matcaps/`, `public/sounds/ambiente/`, `public/sounds/ui/`, `public/video/`, `README.md`, `CREDITOS.md`.
- De `world`, `player` y `espantos` solo usas lo que dice el contrato. Si te falta algo, dime qué propondrías agregar para avisarle a Jacobo o Jerónimo.
- La UI va en HTML/CSS encima del canvas (como el HUD de la semana 9), no dentro de Three.js.
- three fijo en **0.160.0**, imports con `three/examples/jsm/...`, nada de CDN. Archivos en minúsculas sin tildes. Código y comentarios en español.
- Después de cada fase: verifica que `npm run build` funcione, dime cómo probarlo en el navegador y propón el mensaje de commit. Espera mi OK antes de la siguiente fase.

## Fase 1 · Arranque y mocks (para no depender de los demás)

- `src/dev/mocks.js`: un `world`, un `player` y un `espantos` falsos con **la misma forma** de los contratos, que emitan eventos de prueba con teclas (por ejemplo: T = `jugador:atrapado`, Y = `jugador:salida` con llave, U = `item:recogido`, I = `ruido`).
- `main.js`: arma el `ctx` del punto 7.2. Lee `?escena=` (`flujo` usa mocks, `espantos` carga la sandbox de Jerónimo, sin parámetro carga el juego real) y `?debug`. El juego real crea Engine, Physics, Loader, Bus, Debug, World, Player, EspantoManager, AudioSistema y GameManager, y registra los `update` con las prioridades del punto 7.3.
- `index.html` limpio con el contenedor del canvas y las capas de UI. `style.css` base (fondo oscuro, sin márgenes, tipografía con estilo de terror pero legible).

## Fase 2 · GameManager y modos

- `modos.js` con `NOCHES` y `MODOS` tal cual el punto 5.
- `gameManager.js` con la máquina de estados del punto 7.4: `CARGANDO`, `MENU`, `INTRO_NOCHE`, `JUGANDO`, `PAUSA`, `ATRAPADO`, `NOCHE_SUPERADA`, `AMANECIO`, `GAME_OVER`, `VICTORIA`, `MUSEO`. Cada cambio emite `juego:estado`.
- `iniciarModo(idModo, opciones)`: configura `ctx.modo`, `player.configurar(modo)`, `world.setLuzAmbiente(modo.luzAmbiente)`, y arranca la noche.
- Inicio de noche: `world.reiniciarNoche()`, `world.generarItems(...)` (siempre `llave_porton` y `pilas`, más las contras de los espantos de la noche, más 1 o 2 llaves de cuarto), `player.respawn()`, `espantos.iniciar(lista, { multVelocidad, multEscucha })`, emite `noche:inicio`.
- `reloj.js`: la noche dura `modo.duracionNoche` segundos y se muestra de 12:00 a.m. a 6:00 a.m.
- Reglas de victoria/derrota del punto 3.2: `jugador:salida` con llave → `NOCHE_SUPERADA`; amanece → `AMANECIO` (-1 vida, repite noche); `jugador:atrapado` → `ATRAPADO` (jumpscare, -1 vida, `player.respawn()`); 0 vidas → `GAME_OVER`; noche 5 superada → `VICTORIA`.
- Supervivencia: sin salida, `espantos.agregar(tipo)` cada `oleadas.cadaSegundos` siguiendo `oleadas.orden` y luego subir dificultad 10%; puntaje = tiempo.
- Noche libre: el menú deja escoger espantos y dificultad (fácil 0.8, normal 1, pesadilla 1.3).
- Museo: sin espantos (`sinEspantos`), sin reloj, entra directo al bestiario.
- Pausa con Esc: congela el bucle de juego (no el render del menú) y libera el puntero.

## Fase 3 · Interfaz

- **Carga**: barra de progreso con `loader.onProgreso`.
- **Menú principal**: Jugar (Historia), Supervivencia, Apagón, Noche libre, Museo de espantos, Opciones, Créditos. El primer clic desbloquea el audio y el video (restricción de autoplay de las semanas 3 y 9).
- **Opciones**: volumen general, volumen de ambiente, sensibilidad del mouse, calidad (baja/media/alta → `engine.setCalidad`). Se guardan.
- **HUD**: hora, vidas, batería de la linterna, inventario de 4 espacios con el activo resaltado, medidor de ruido que sube con los `ruido` del jugador y baja poco a poco, zona actual (`jugador:zona`), mensajes temporales (`puerta:bloqueada` → "Necesitas la llave de la cocina", `item:recogido` → "Recogiste el ají"). Se oculta en menús.
- **Pantallas**: intro de noche (número y nombre del espanto), noche superada, amaneció, game over, victoria, récord de supervivencia.
- `jumpscare.js` según el punto 3.8: `player.bloquear(true)`, la cámara gira hacia el espanto en 0.3 s, grito, destello rojo con CSS, fundido a negro, siguiente pantalla.

## Fase 4 · Televisor con la leyenda

`tv.js`: toma la malla `world.tvPantalla`, le pone `VideoTexture` (con `colorSpace = THREE.SRGBColorSpace`) y reproduce `leyenda_<espanto>.mp4` durante `INTRO_NOCHE` (semana 3). Con audio, porque ya hubo clic. La pantalla brilla con un poco de emisión y se puede saltar con Espacio. Cuando no hay video, estática.

Ayúdame también con el **guion corto de cada video** (30 a 60 s, voz de abuela contando la leyenda y cómo protegerse) y con cómo armarlos fácil (imágenes propias o generadas + narración grabada), exportados a 720p MP4 H.264 de menos de 5 MB.

## Fase 5 · Ambiente

- `fx/lluvia.js`: `THREE.Points` con BufferGeometry, cae y se reinicia (como la lluvia neón de la semana 4 pero realista), cantidad según `noche.lluvia`, solo afuera.
- `fx/polvo.js`: partículas flotando lento adentro.
- `fx/fuego.js`: llama de partículas con AdditiveBlending y `depthWrite: false` en cada posición de `world.velas` (semana 4).
- `fx/aguaPozo.js`: agua con gravedad en `world.pozo` (como la fuente de la semana 9).
- `fx/relampagos.js`: en la noche 5 (`tormenta: true`) cada 20 a 40 s sube un instante `world.luces.ambiente` y suena el trueno con retraso.
- `audio/ambiente.js`: grillos y viento afuera, lluvia, sonido distinto por zona (semana 9, con `jugador:zona`) y **latido** cuyo volumen y velocidad dependen de `espantos.masCercano(player.posicion).distancia`.
- Respetar el presupuesto de partículas del punto 13.

## Fase 6 · Guardado, bestiario y museo

- `guardado.js`: localStorage con try/catch (si falla, el juego sigue sin guardar): récord de supervivencia, espantos desbloqueados, opciones.
- `bestiario.js` y modo Museo: pedestales (geometrías primitivas) con cada espanto girando, uno con MatCap y otro con MeshPhysicalMaterial para mostrar la diferencia (semanas 2, 4 y 7), su leyenda desde `data/leyendas.js` y su video. Los bloqueados se ven como silueta negra.
- Un espanto se desbloquea al superar su noche en Historia.

## Fase 7 · Integración final y entregables (yo coordino)

- Conectar todo con el mundo real de Jacobo y los espantos de Jerónimo; revisar que cada evento del punto 10 llegue con los datos correctos.
- Optimización (semana 11): medir FPS y draw calls con `?debug`, aplicar el selector de calidad, revisar el presupuesto del punto 13.
- Correr el checklist del punto 19 y ayudarme a armar la lista de bugs para el equipo.
- `README.md` (qué es, cómo instalar, cómo jugar, controles, equipo) y `CREDITOS.md` consolidado.
- Ayudarme con el guion del video demo (1 a 2 min) y el documento PDF corto del punto 20.

## Al terminar cada sesión

Dame un resumen corto: qué quedó hecho, qué falta, qué eventos y contratos ya funcionan y si hay algo que Jacobo o Jerónimo necesiten saber.
