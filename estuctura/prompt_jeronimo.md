# Prompt · Jerónimo · Etapa 2: Los Espantos

> Cómo usarlo: abre la carpeta del proyecto (el repo que creó Jacobo) en VS Code, verifica que `PROYECTO_ESPANTOS.md` esté en la raíz, abre Claude Code en la terminal y pega todo lo que está debajo de la línea. Si la sesión se corta, vuelve a pegarlo y dile en qué fase vas.

---

Eres mi compañero de desarrollo en un proyecto universitario de la materia Programación de Entornos Multimedia. Somos 3 desarrolladores haciendo un juego de terror en primera persona para navegador llamado **"Espantos: La Noche en la Vereda"** (Three.js + Cannon-es + Vite), con espantos de la tradición colombiana.

Yo soy **Jerónimo** y me toca la **Etapa 2: los espantos** (Duende, Bruja y Silbón), su inteligencia, su audio, el sistema de ruido y las contras. Jacobo hace el mundo y el jugador (Etapa 1) y Yuly hace la experiencia de juego, modos y UI (Etapa 3). Trabajamos en paralelo.

## Antes de escribir código

1. Lee **completo** el archivo `PROYECTO_ESPANTOS.md`. Es la fuente de verdad. Pon atención especial a: punto 3.4 a 3.6 (contras, escondites, ruido), 4 completo (los espantos), 11.1 (cómo vienen los modelos que te entrega Jacobo), 5 (multiplicadores de los modos), 7 (`ctx` y orden del bucle), 9.5 a 9.7 (contratos de World, Player y Espantos), 10 (eventos), 13 (rendimiento) y 16 (mi etapa).
2. Revisa qué hay ya en el repo (el esqueleto de Jacobo).
3. Resúmeme en 10 líneas lo que entendiste de mi etapa y qué contratos debo cumplir y consumir. Espera mi confirmación antes de seguir.

## Reglas

- Usa **exactamente** los nombres de archivos, clases, métodos, propiedades, estados y eventos del documento.
- Solo creas o editas archivos dentro de: `src/espantos/`, `src/data/espantos.js`, `src/dev/sandboxEspantos.js`, `public/sounds/espantos/`.
- **No modelas nada en Blender**: los modelos de los espantos los hace Jacobo siguiendo el punto 11.1 del documento. Tú los cargas desde `public/models/espantos/` y los animas con AnimationMixer.
- De `world` y `player` solo **lees** las propiedades del contrato (`world.waypoints`, `world.obstaculos`, `world.ventanas`, `world.rutaBruja`, `world.spawns`, `world.objetosFisicos`, `player.posicion`, `player.isHidden`, `player.linterna`, etc.). No tocas su código. Si te falta algo, dime qué propondrías agregar al contrato para avisarle a Jacobo.
- Solo emites los eventos que el punto 10 dice que emito yo (`espanto:estado` y `jugador:atrapado`). El evento `ruido` lo emite Jacobo (jugador y choques de objetos); yo solo lo escucho.
- three fijo en **0.160.0**, imports con `three/examples/jsm/...`, nada de CDN. Archivos en minúsculas sin tildes. Código y comentarios en español.
- Después de cada fase: verifica que `npm run build` funcione, dime cómo probarlo en el navegador y propón el mensaje de commit. Espera mi OK antes de la siguiente fase.

## Fase 1 · Sandbox (para no depender de la finca)

`src/dev/sandboxEspantos.js`, que se abre con `?escena=espantos`:
- Un piso, varios cuartos hechos con cubos (con body de Cannon y malla con `material.visible` controlable), 3 o 4 "armarios" de escondite, 2 ventanas, ~12 waypoints y una ruta circular exterior para la bruja.
- Un jugador simple (puede ser OrbitControls o un WASD básico) que cumpla la **misma forma** del contrato de `Player` (`posicion`, `isHidden`, `linterna.encendida`, `linterna.luz`) y que emita `ruido` al presionar R.
- Un objeto `world` falso con la **misma forma** del contrato de `World`.
- Panel lil-gui para ver estados, mostrar waypoints y conexiones, y forzar contras.

Así todo lo que programes funciona igual cuando lo conectemos al mundo real.

## Fase 2 · Grafo de waypoints

`grafoWaypoints.js`:
- Conecta automáticamente cada par de waypoints si están a menos de 7 m y no hay muro en medio (THREE.Raycaster contra `world.obstaculos`).
- `ruta(desde: Vector3, hasta: Vector3)` → arreglo de posiciones usando BFS desde el waypoint más cercano al origen hasta el más cercano al destino.
- `waypointAleatorio()` y `siguienteDePatrulla(actual)`.
- Dibujo de líneas en debug.

## Fase 3 · Clase base `Espanto`

`espanto.js` según el punto 4.1 y el contrato 9.7:
- Cuerpo `CANNON.Sphere` con `fixedRotation`, material `espanto` de `physics.materiales`; se mueve asignando velocidad horizontal hacia el siguiente punto de la ruta. El modelo (THREE.Group) sigue al body y rota suavemente hacia donde camina.
- Máquina de estados con `PATRULLA`, `ALERTA`, `PERSECUCION`, `ATURDIDO` y los que cada hijo agregue. Cada cambio emite `espanto:estado`.
- **Visión**: distancia < radioVision, ángulo < 45° a cada lado del frente, raycast sin obstáculos, jugador no escondido.
- **Oído**: `oirRuido()` con la fórmula del punto 3.6 usando `modo.multEscucha`.
- **Perder rastro**: si no ve al jugador por 5 s pasa a ALERTA en la última posición conocida.
- **Escondites**: guarda si vio al jugador justo cuando entró al escondite (escuchando `jugador:escondido`). Si lo vio, al llegar lo captura; si no, pierde el rastro.
- **Captura**: distancia < radioCaptura → emite `jugador:atrapado` una sola vez y se detiene hasta que el juego lo reinicie.
- **Anti-atasco**: si no avanza en 2 s, salta al siguiente waypoint de la ruta.
- **Modelos**: el `EspantoManager` intenta cargar `/models/espantos/<tipo>.glb`; si todavía no existe, usa un **modelo temporal** hecho con primitivas (cápsula + cono, con la altura del punto 11.1) para que todo funcione desde el día 1. Cuando Jacobo suba el `.glb` real, debe funcionar sin cambiar código.
- AnimationMixer buscando las animaciones por nombre (`idle`, `caminar`, `correr`, y `volar` para la bruja) según la velocidad, con crossfade. Si el glb no trae alguna, animación en código (balanceo o flotar con seno).
- Velocidades multiplicadas por `modo.multVelocidad`. Valores base en `data/espantos.js` (tabla 4.5).
- `setActivo`, `destruir` (quita body, malla y sonidos, sin fugas de memoria).

## Fase 4 · El Silbón (el más importante para la sustentación)

`silbon.js` según el punto 4.4:
- Silbido con `THREE.Audio` **no posicional** en loop, volumen calculado cada frame: `clamp(distancia / 25, 0.05, 1)` (lejos fuerte, cerca suave). Suavizar el cambio con lerp para que no salte.
- Pasos y huesos con `PositionalAudio` que solo se oyen de cerca (refDistance pequeño, maxDistance ~6, modelo de distancia linear).
- Contras: `ají` lanzado (escucha `item:lanzado`, si el body del ají choca con el Silbón o cae a menos de 1.5 m → ATURDIDO 5 s), `radio` (escucha `contra:colocada`, crea una zona de 6 m que no puede pisar por 30 s: si su ruta pasa por ahí, busca otro waypoint; suenan ladridos posicionales en la radio), `latigo` (antes de emitir `jugador:atrapado`, si `player.tieneObjeto('latigo')` → `player.quitarObjeto('latigo')`, sonido de látigo y huye 4 s en vez de capturar).

## Fase 5 · El Duende

`duende.js` según el punto 4.2:
- Invisible por defecto (`modelo.visible = false`). Visible si está dentro del cono de la linterna (`player.linterna.luz`: ángulo y distancia < 8) y la linterna encendida; en ese caso huye.
- ACECHO: cada 15 a 25 s elige un objeto de `world.objetosFisicos` a menos de 8 m del jugador y le aplica `applyImpulse` lo bastante fuerte para que caiga o choque. El ruido sale solo del choque (lo emite el sistema de objetos de Jacobo), no lo emitas tú.
- ROBO: escucha `item:soltado`; si llega al objeto, lo "esconde" moviéndolo a un `world.spawns.items` aleatorio lejos del jugador. El objeto robado lleva una risita PositionalAudio en loop muy suave.
- PERSECUCION: si lo alumbran más de 2 s seguidos, persigue rápido 8 s.
- DISTRAIDO: `contra:colocada` con `panela` → va a la panela y se queda 20 s.
- Sonidos: 3 risas aleatorias, pasitos.

## Fase 6 · La Bruja

`bruja.js` según el punto 4.3:
- VOLANDO: recorre `world.rutaBruja` en loop a cierta altura, `castShadow = true` en su modelo para que la luna proyecte su sombra por las ventanas.
- ATRAIDA: escucha `linterna:cambio` y revisa cada frame: si la linterna está encendida y el jugador está a menos de 6 m de una ventana de `world.ventanas` no sellada → vuela a esa ventana.
- DENTRO: entra por la ventana al waypoint más cercano y patrulla 40 s con la lógica base; si ve al jugador, PERSECUCION.
- SALIR: vuelve por la misma ventana a la ruta exterior.
- Contra: `contra:colocada` con `ventanaId` → esa ventana queda sellada (ya la marca `world.sellarVentana`); si estaba atraída por esa ventana, se rinde y sigue volando.
- Sonidos: carcajada al entrar, aleteo y viento posicionales.

## Fase 7 · Sistema de ruido, contras y manager

- `ruido.js`: se suscribe a `ruido` y llama `oirRuido()` de cada espanto activo. No registra listeners `collide` propios (eso ya lo hace Jacobo en `world/objetos.js`).
- `contras.js`: centraliza la lógica de qué contra afecta a qué espanto (tabla del punto 3.4), para que los espantos solo llamen `aplicarContra()`.
- `espantoManager.js` según el contrato: `precargar()` (glb y audios una sola vez, clonando con SkeletonUtils si hace falta), `iniciar(lista, multiplicadores)` usando `world.spawns.espantos`, `agregar(tipo)` para supervivencia, `detenerTodos()`, `masCercano(posicion)`, `update(dt)` registrado con prioridad 40.

## Fase 8 · Integración y ajuste

- Conectar con la finca real y el jugador real de Jacobo. Probar escondites, ventanas y waypoints de la finca.
- Probar las 5 noches con los modos de Yuly y ajustar `data/espantos.js` para que la noche 1 sea fácil y la 5 dura pero posible.
- Medir FPS con los 3 espantos activos (meta 60 FPS). Optimizar: raycasts de visión cada 0.1 s y no cada frame, audios que no se usan pausados.

## Assets que me tocan

Solo los **sonidos** de los espantos del punto 12 (con licencia libre, anotados en `CREDITOS.md`). Los modelos y sus animaciones los hace Jacobo en Blender: si al probarlos algo no cumple el punto 11.1 (escala, origen, frente, nombres de animaciones), dime qué está mal para pasárselo a él, no lo arregles en el código con parches.

## Al terminar cada sesión

Dame un resumen corto: qué quedó hecho, qué falta, qué eventos y contratos ya funcionan y si hay algo que Jacobo o Yuly necesiten saber.
