# Prompt · Jacobo · Etapa 1: El Mundo y el Jugador

> Cómo usarlo: abre la carpeta del proyecto en VS Code, pon `PROYECTO_ESPANTOS.md` en la raíz, abre Claude Code en la terminal y pega todo lo que está debajo de la línea. Si la sesión se corta, vuelve a pegarlo y dile en qué fase vas.

---

Eres mi compañero de desarrollo en un proyecto universitario de la materia Programación de Entornos Multimedia. Somos 3 desarrolladores haciendo un juego de terror en primera persona para navegador llamado **"Espantos: La Noche en la Vereda"** (Three.js + Cannon-es + Vite), con espantos de la tradición colombiana (Duende, Bruja, Silbón).

Yo soy **Jacobo** y me toca la **Etapa 1: el mundo y el jugador**, y además **todo lo que se modela en Blender** (finca, objetos y los 3 espantos). Jerónimo hace los espantos (Etapa 2) y Yuly hace la experiencia de juego, modos y UI (Etapa 3). Trabajamos en paralelo.

## Antes de escribir código

1. Lee **completo** el archivo `PROYECTO_ESPANTOS.md`. Es la fuente de verdad. Pon atención especial a: punto 6 (stack y versiones), 7 (arquitectura, `ctx`, orden del bucle), 8 (carpetas), 9 (contratos), 10 (eventos), 11 y 11.1 (convenciones de Blender y especificación de los modelos de espantos), 13 (rendimiento) y 16 (mi etapa).
2. Resúmeme en 10 líneas lo que entendiste de mi etapa y qué contratos debo cumplir. Espera mi confirmación antes de seguir.

## Reglas

- Usa **exactamente** los nombres de archivos, clases, métodos, propiedades y eventos del documento. Otros dos compañeros programan contra esos contratos.
- Solo creas o editas archivos dentro de: `src/core/`, `src/world/`, `src/player/`, `src/audio/audioSistema.js`, `src/data/objetos.js`, `src/data/puertas.js`, `tools/blender/`, `public/models/finca.glb`, `public/models/objetos/`, `public/models/espantos/`, `src/dev/verModelos.js`, `public/textures/noche.hdr`, `public/sounds/jugador/`, `public/sounds/mundo/`. La única excepción es la Fase 0, donde armas el esqueleto completo.
- Si necesitas cambiar un contrato, **no lo cambies**: dime qué cambio propones y por qué, para avisarle al equipo.
- three fijo en **0.160.0**. Imports de addons con `three/examples/jsm/...`. Nada de CDN.
- Archivos en minúsculas, sin espacios ni tildes.
- Código en español (nombres de variables y comentarios) como en clase, comentarios cortos que expliquen el porqué.
- Después de cada fase: verifica que `npm run build` funcione, dime cómo probarlo en el navegador y propón el mensaje de commit. Espera mi OK antes de la siguiente fase.

## Fase 0 · Esqueleto del repo (el equipo depende de esto el primer día)

1. Proyecto Vite vanilla, `npm install three@0.160.0 cannon-es lil-gui`, `.gitignore` con `node_modules` y `dist`.
2. Toda la estructura de carpetas del punto 8, con archivos vacíos o con la **firma de las clases del punto 9** (métodos vacíos que no rompen), incluyendo las de Jerónimo y Yuly, para que todos puedan importar desde el día 1.
3. `core/` funcional: `bus.js`, `engine.js` (con `onUpdate(fn, prioridad)`, dt limitado a 0.05, sombras PCFSoft, `setCalidad`, resize), `physics.js` (gravedad -9.82, SAPBroadphase, allowSleep, materiales y ContactMaterials: piso, muro, jugador, objeto, espanto), `loader.js` (con LoadingManager y progreso, caché de audios), `debug.js` (lil-gui y Stats solo si la URL tiene `?debug`), `utils.js`.
4. Un `main.js` mínimo provisional que muestre un cubo girando para comprobar que todo arranca (Yuly lo reemplaza después).

## Fase 1 · Script de Blender del blockout (urgente, día 2)

Crea `tools/blender/generar_finca.py`, un script para pegar en la pestaña Scripting de Blender (como en la semana 8) que:
- Limpia la escena y genera el **blockout** de la finca con cubos: sala, cocina, 2 cuartos, baño, sótano, ático, corredor, patio con pozo y portón. Dos niveles (sótano/primer piso/ático) conectados con escaleras o rampas.
- Crea **todos** los objetos con los prefijos del punto 11: `COL_` (muros, pisos, muebles grandes), `WP_` (mínimo 20, cubriendo todos los cuartos y pasillos), `BRUJA_PATH_` (mínimo 8 alrededor de la casa), `SPAWN_PLAYER`, `SPAWN_ITEM_` (mínimo 15), `SPAWN_DUENDE/BRUJA/SILBON`, `DOOR_<id>` con origen en la bisagra, `HIDE_` + `HIDECAM_` (mínimo 4), `WIN_` (mínimo 6), `PORTAL_sotano_A` y `PORTAL_sotano_B`, `ZONE_` por cuarto, `EXIT_porton`, `VELA_` (mínimo 6), `TV_pantalla`, `POZO_agua`, `PHYS_` (mínimo 10 objetos tumbables).
- Asigna materiales de color sólido distintos por tipo para que se entienda visualmente.
- Aplica Scale (no rotación en los `COL_`) y deja instrucciones al final del script en un comentario: cómo exportar a `.glb` con la configuración del punto 11.
- Imprime en la consola de Blender un resumen: cuántos objetos de cada prefijo creó y el total de polígonos.

Explícame cómo correrlo y cómo exportar. Yo exporto y pongo `finca.glb` en `public/models/`.

## Fase 2 · World

- `world.js` carga `finca.glb` y recorre la escena por prefijos.
- `colliders.js`: cada `COL_` se vuelve `CANNON.Box` usando el bounding box **local** de la geometría por la escala, con la posición y el cuaternión **del mundo** del objeto (así sirven colliders rotados). La malla queda en la escena con `material.visible = false` para que el Raycaster de Jerónimo la use, y se guarda en `world.obstaculos`.
- `puertas.js`: puerta = malla + body kinemático; con E gira 90° en Y de forma animada; `data/puertas.js` define qué llave pide cada una; emite `puerta:abierta` o `puerta:bloqueada`; abrir emite `ruido` de 4.
- `escondites.js`: llena `world.escondites` desde `HIDE_`/`HIDECAM_`.
- `portales.js`: pares A/B, teletransporte del jugador con cooldown de 3 s, sonido, anillo con TorusGeometry y emisión de `jugador:portal`.
- `zonas.js`: `zonaDe(posicion)` y emisión de `jugador:zona` cuando cambia.
- Ventanas: `world.ventanas` desde `WIN_` y `sellarVentana(id)` que pone el objeto visible en la ventana.
- `objetos.js`: los `PHYS_` se vuelven cuerpos dinámicos; `generarItems(listaTipos)` pone los items en `SPAWN_ITEM_` aleatorios sin repetir; cada choque de objeto emite `ruido` con intensidad `velocidadImpacto * 1.2` si pasa de 1.5.
- `reiniciarNoche()`.
- Exponer también `tvPantalla`, `velas`, `pozo` y `luces` como dice el contrato 9.5 (Yuly los usa para la TV, el fuego, el agua y los relámpagos), y `setLuzAmbiente(valor)`.
- `waypoints` y `rutaBruja` como arreglos de datos (las conexiones entre waypoints las calcula Jerónimo; tú solo das id y posición, `vecinos` vacío).
- Panel de debug: mostrar colliders en wireframe y volúmenes de triggers.

## Fase 3 · Iluminación

`iluminacion.js`: AmbientLight baja (el valor viene de `modo.luzAmbiente`), luna DirectionalLight azulada **con sombra** (shadow map 1024, cámara de sombra ajustada al tamaño de la finca), velas en cada `VELA_` con PointLight cálida **sin sombra** que parpadea con seno + random (semana 4), HDRI `noche.hdr` como `scene.background` y `scene.environment` con intensidad baja, `FogExp2` oscura. Controles en debug.

## Fase 4 · Jugador

- `controles.js`: PointerLockControls, teclas del punto 3.1 del documento.
- `player.js`: cuerpo `CANNON.Sphere` con `fixedRotation` y damping; cámara a la altura de los ojos (más baja agachado); velocidad según caminar/correr/agachado relativa a hacia dónde mira; salto con impulso solo si toca el piso (detección por normal de contacto como en la semana 6); emite `ruido` según el punto 3.6 cada cierto tiempo mientras se mueve; `respawn()`, `bloquear()`, `configurar(modo)`.
- Interacción con E por cercanía o Raycaster desde la cámara: recoger items, abrir puertas, esconderse/salir (cámara al `HIDECAM`, emite `jugador:escondido`/`jugador:salioEscondite`), usar tijeras o sal dentro de una `WIN_` (emite `contra:colocada` con `ventanaId`), colocar radio o panela en el piso (emite `contra:colocada`).
- `inventario.js`: 4 espacios, teclas 1 a 4, Q suelta (emite `item:soltado` con el body), clic lanza como proyectil físico en la dirección de la cámara (semana 6, emite `item:lanzado`).
- `linterna.js`: SpotLight hija de la cámara con target al frente y **sombra**; F prende/apaga; batería según el punto 3.3; pilas recargan; emite `linterna:cambio`. Recuerda que la cámara debe estar agregada a la escena.
- Detecta la entrada a `EXIT_porton` y emite `jugador:salida` con `conLlave`.
- Sonidos de pasos (madera adentro, tierra afuera según la zona).

## Fase 5 · Audio base

`audioSistema.js`: crea el `AudioListener` pegado a la cámara y expone helpers para crear `Audio` y `PositionalAudio` con buffer, volumen, refDistance, maxDistance y loop.

## Fase 6 · Arte final y optimización

Ayúdame a pasar del blockout a la finca final low poly (qué modelar, qué descargar, cómo mantener los prefijos) respetando el presupuesto del punto 13. Revisa conmigo polígonos, cantidad de colliders y FPS con el panel de debug.

## Fase 7 · Modelos de los espantos y objetos en Blender

Jerónimo programa los espantos contra la especificación del punto **11.1** y usa cápsulas temporales hasta que yo le entregue los `.glb`, así que hay que cumplirla al pie de la letra (escala en metros, origen en los pies, frente hacia -Y en Blender, nombres de animaciones `idle`, `caminar`, `correr` y `volar` para la bruja).

Orden de entrega: **Silbón y Duende para el martes 10** (la demo del miércoles 11 muestra las noches 1 y 3), **Bruja para el jueves 12**, objetos finales para el sábado 14.

Ayúdame con:
1. **Diseño de cada espanto en low poly** (< 5.000 polígonos), fiel a la leyenda pero con estilo propio:
   - **Duende**: bajito (≈ 0.9 m), sombrero grande de ala ancha, pies al revés si se puede.
   - **Bruja**: ≈ 1.7 m, ropa vieja de campo, pelo largo, sin escoba de cuento gringo (aquí vuela sola o en forma de pájaro grande).
   - **Silbón**: muy alto y flaco (≈ 2.8 m), sombrero, con el **costal** al hombro como objeto aparte llamado `silbon_costal`.
2. Un **script de Python para Blender** por espanto (en `tools/blender/`, por ejemplo `generar_silbon.py`) que arme la base con primitivas (cuerpo, cabeza, extremidades, sombrero, costal) ya con el origen, la escala y la orientación correctos, para que yo lo refine a mano después.
3. **Rig y animación sencilla**: cómo poner un esqueleto básico (o usar Rigify/auto weights), y cómo crear las Actions `idle`, `caminar`, `correr` / `volar` con pocos keyframes y que se exporten todas en el `.glb` (NLA o "Export all actions"). Si se complica, alternativa: entregar el modelo quieto y avisarle a Jerónimo para que lo anime en código.
4. Si conviene más **descargar** un modelo con licencia libre y adaptarlo (Poly Pizza, Sketchfab CC), cómo ajustarlo en Blender a las reglas del 11.1 y anotarlo en `CREDITOS.md`.
5. **Objetos**: script o guía para modelar con primitivas `llave`, `pilas`, `aji`, `radio`, `latigo`, `tijeras`, `sal`, `panela`, `olla`, `botella`, `caja` (< 500 polígonos, escala real, origen en el centro).
6. Una **página de verificación** rápida (`src/dev/verModelos.js`, que se abre con `?escena=modelos`; avísale a Yuly para que lo conecte en `main.js`) que cargue cada `.glb`, muestre los polígonos, liste las animaciones que trae y las reproduzca, para comprobar antes de pasárselos a Jerónimo.

Guarda los `.blend` originales en `tools/blender/fuentes/`.

## Bonus (solo con el MVP terminado)

Tecla V: cámara en tercera persona con avatar `.glb` animado (idle/caminar/correr con AnimationMixer) y cámara seguidora con lerp (semana 6 y 10).

## Al terminar cada sesión

Dame un resumen corto: qué quedó hecho, qué falta, qué eventos y contratos ya funcionan y si hay algo que Jerónimo o Yuly necesiten saber.
