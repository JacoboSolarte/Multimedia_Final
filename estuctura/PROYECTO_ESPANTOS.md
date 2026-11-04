# ESPANTOS: La Noche en la Vereda

**Proyecto Integrador · Programación de Entornos Multimedia**
Universidad Cooperativa de Colombia · Docente: Mg. Gabriel Guerrero Arellano
Equipo: **Jacobo** · **Jerónimo** · **Yuly**

> Este documento es la fuente de verdad del proyecto. Si algo no está aquí, se discute en el grupo y se agrega aquí antes de programarlo.

---

## 0. Índice

1. Concepto del juego
2. Alcance (qué SÍ y qué NO)
3. Mecánicas de juego
4. Los espantos
5. Modalidades
6. Stack tecnológico y versiones
7. Arquitectura del código
8. Estructura de carpetas
9. Contratos entre módulos (lo más importante para trabajar en paralelo)
10. Bus de eventos
11. Convenciones de Blender (nombres de objetos)
12. Assets: lista completa
13. Presupuesto de rendimiento
14. Modo debug
15. Flujo de trabajo con Git
16. Las 3 etapas y quién hace qué
17. Cronograma
18. Mapa de temas de la materia
19. Criterios de terminado (checklist final)
20. Entregables y sustentación
21. Riesgos y plan B

---

## 1. Concepto del juego

Juego de terror en **primera persona** en el navegador (Three.js + Cannon-es), inspirado en la mecánica de juegos de escape como Granny pero con identidad propia: **espantos de la tradición colombiana**.

El jugador despierta encerrado en una **finca vieja de vereda**. Cada noche un espanto distinto ronda la finca. Para ganar la noche hay que **encontrar la llave del portón y escapar antes de las 6:00 a.m.** sin que el espanto lo atrape. Cada espanto se comporta diferente y se combate con su **contra** tradicional, así que no basta con correr: hay que entender la leyenda.

Al inicio de cada noche, un **televisor/radio viejo** de la sala reproduce un video con la leyenda del espanto narrada (video textura). Funciona como ambientación y como tutorial.

**Lo que lo hace original:**
- **El Silbón con audio invertido**: cerca suena lejos, lejos suena cerca (como dice la leyenda).
- **Sistema de contras**: cada espanto tiene su debilidad tomada del folclor.
- **Bestiario desbloqueable** con el modelo 3D y la leyenda de cada espanto (valor cultural).
- **Sistema de ruido**: los espantos escuchan; lo que hagas (correr, tumbar cosas, abrir puertas) los atrae.

---

## 2. Alcance

### 2.1 MVP (obligatorio, sin esto no se entrega)

| # | Funcionalidad |
|---|---|
| 1 | Finca modelada en Blender (low poly), exportada en un `.glb`, con colisiones sólidas |
| 2 | Jugador en primera persona: caminar, correr, agacharse, saltar, interactuar, linterna con batería |
| 3 | Inventario (4 espacios), recoger/soltar/lanzar objetos |
| 4 | Puertas (algunas con llave), escondites (armario, debajo de la cama), pasadizo secreto (portal) |
| 5 | Sistema de ruido |
| 6 | 3 espantos completos: **Duende**, **Bruja** y **Silbón**, cada uno con IA de estados, audio y contra |
| 7 | Captura con susto (jumpscare), vidas y reaparición |
| 8 | Modos: **Historia (5 noches)**, **Supervivencia**, **Apagón**, **Noche libre**, **Museo de espantos** |
| 9 | Menú principal, pausa, opciones (volumen, sensibilidad, calidad), HUD, pantallas de victoria/derrota |
| 10 | Video de leyenda por noche en el televisor |
| 11 | Partículas: lluvia, polvo, fuego de velas, agua del pozo |
| 12 | Iluminación nocturna con sombras, HDRI de cielo nocturno, niebla |
| 13 | Guardado local: récords, bestiario desbloqueado, opciones |
| 14 | Modo debug con lil-gui |
| 15 | 60 FPS en un portátil normal del salón |

### 2.2 Bonus (solo si el MVP está terminado y estable)

- Espantos extra: La Patasola, La Candileja, La Llorona, La Madremonte (noche en el monte).
- Cámara en tercera persona con avatar animado (tecla V).
- Relámpagos dinámicos (también se puede meter en la noche 5 si sobra tiempo).
- Tabla de récords con nombre del jugador.

### 2.3 Fuera de alcance (NO se hace)

- Multijugador, backend o base de datos.
- Soporte móvil táctil (solo se pide que no se rompa al abrir; no se hacen controles táctiles).
- Pathfinding avanzado tipo navmesh (usamos waypoints).
- Modelar espantos desde cero en alta calidad (se usan modelos low poly propios o con licencia libre).

---

## 3. Mecánicas de juego

### 3.1 Controles

| Tecla | Acción | Ruido |
|---|---|---|
| W A S D | Moverse | Caminar: 2 |
| Shift | Correr | 6 |
| C | Agacharse (más lento, cámara más baja) | 0.5 |
| Espacio | Saltar | 3 al caer |
| Mouse | Mirar (PointerLock) | — |
| E | Interactuar: recoger, abrir puerta, esconderse/salir, usar contra en zona | Puerta: 4 |
| Q | Soltar el objeto en mano | 2 |
| Clic izquierdo | Lanzar el objeto en mano (proyectil físico) | depende del impacto |
| 1 2 3 4 | Seleccionar espacio del inventario | — |
| F | Prender/apagar linterna | — |
| Esc | Pausa | — |
| V | (Bonus) cambiar a tercera persona | — |

### 3.2 Objetivo de una noche (modo Historia)

- La noche dura **6 minutos reales** = de 12:00 a.m. a 6:00 a.m. en el reloj del HUD.
- La **llave del portón** aparece en un punto aleatorio de la finca (entre los `SPAWN_ITEM_*`).
- Algunas puertas internas necesitan **llaves de cuarto**.
- **Ganas la noche** si llegas al portón (`EXIT_porton`) con la llave del portón y lo abres.
- **Si amanece** sin escapar: pierdes una vida y se repite la noche.
- **Si te atrapan**: jumpscare, pierdes una vida, despiertas en el cuarto (`SPAWN_PLAYER`) y el objeto que tenías en la mano queda tirado donde te atraparon (como Granny). El resto de la finca no se reinicia.
- **3 vidas** por partida. 0 vidas = Game Over.

### 3.3 Linterna

- SpotLight hija de la cámara, con sombras.
- Batería de 100%. Gasta 1% cada 3 s encendida. Las **pilas** (objeto) recargan 50%.
- Con la linterna encendida el jugador ve mucho mejor, pero **atrae a la Bruja** si está cerca de una ventana sin sellar.
- En modo Apagón la linterna no existe.

### 3.4 Inventario y objetos

4 espacios. Un objeto activo "en mano" (se ve en el HUD).

| Objeto | Uso |
|---|---|
| Llave del portón | Abrir la salida |
| Llaves de cuarto (cocina, ático, sótano) | Abrir puertas internas |
| Pilas | Recargar linterna |
| Ají | Contra del Silbón: se lanza y lo aturde 5 s |
| Radio con ladridos | Contra del Silbón: se deja en el piso y crea una zona de 6 m donde no entra durante 30 s |
| Látigo | Contra del Silbón: si te atrapa teniéndolo, te salvas una vez (se gasta) |
| Tijeras | Contra de la Bruja: abiertas en cruz en una ventana la sellan toda la noche |
| Sal | Contra de la Bruja: igual que las tijeras |
| Dulce de panela | Contra del Duende: lo distrae 20 s |
| Objetos de ambiente (ollas, botellas, cajas) | Se pueden lanzar para hacer ruido y distraer |

> Nota sobre el folclor: que el Silbón le teme a los perros, al ají y al látigo, y que las tijeras abiertas y la sal protegen de las brujas, son creencias populares conocidas. El dulce para el Duende es invento nuestro para el juego; si en la sustentación lo preguntan, lo decimos así.

### 3.5 Escondites

- Volúmenes `HIDE_*` (armarios, debajo de camas).
- Con E dentro del volumen: la cámara se mueve al punto del escondite, el jugador queda quieto, `player.isHidden = true`.
- Si el espanto **no te vio entrar**, pierde el rastro y vuelve a patrullar.
- Si el espanto estaba persiguiéndote y te **vio esconderte**, te saca (captura).

### 3.6 Sistema de ruido

Toda acción que suena emite un evento `ruido` con posición e intensidad. Cada espanto escucha si:

```
distancia(espanto, ruido) <= intensidad * 3 * modo.multEscucha
```

Fuentes de ruido:
- Jugador: caminar 2, correr 6, agachado 0.5, caer de un salto 3, abrir puerta 4, soltar objeto 2.
- Física: cuando un objeto choca, `intensidad = velocidadImpacto * 1.2` (con `contact.getImpactVelocityAlongNormal()`), solo si pasa de 1.5.
- El Duende también genera ruido al tumbar cosas (y eso atrae a los otros espantos en las noches 4 y 5).

El HUD muestra un **medidor de ruido** con el último valor del jugador, que baja poco a poco.

### 3.7 Pasadizo secreto (portal)

- Pares de volúmenes `PORTAL_<nombre>_A` y `PORTAL_<nombre>_B` (por ejemplo, una trampilla del sótano que sale detrás de un cuadro del ático).
- Al entrar al volumen A apareces en B y viceversa, con **cooldown de 3 s** (como en la semana 9), sonido de teletransporte y un efecto visual (anillo con TorusGeometry y partículas).
- Los espantos NO usan los portales: es la ruta de escape del jugador.

### 3.8 Captura (jumpscare)

1. El espanto entra al radio de captura y emite `jugador:atrapado`.
2. Se bloquea el control, la cámara gira hacia el espanto en 0.3 s, suena el grito, se ve un destello rojo (overlay CSS) y se hace un fundido a negro.
3. Se resta una vida y aparece la pantalla "Despiertas en el cuarto..." o Game Over.

---

## 4. Los espantos

Todos heredan de la clase base `Espanto` (máquina de estados, movimiento por waypoints, visión, oído y captura). Cada uno sobreescribe lo que lo hace único.

### 4.1 Comportamiento base (clase `Espanto`)

- **Movimiento**: cuerpo físico de Cannon (esfera con `fixedRotation`) al que se le asigna velocidad horizontal hacia el siguiente punto. Así los muros lo frenan de verdad.
- **Ruta**: grafo de waypoints (`WP_*`). Para ir a un punto busca el waypoint más cercano al destino y recorre el grafo con BFS. En el último tramo camina directo al objetivo.
- **Visión**: ve al jugador si está a menos de `radioVision`, dentro de un cono de 90° al frente y sin muro en medio (Raycaster contra los colliders). Un jugador escondido no se ve.
- **Oído**: se suscribe a `ruido` (fórmula del punto 3.6).
- **Captura**: si la distancia al jugador es menor que `radioCaptura` y el jugador no está escondido (o lo vio esconderse), emite `jugador:atrapado`.
- **Animación**: si el `.glb` trae animaciones (idle, caminar, correr), las maneja con `AnimationMixer`.
- **Audio**: cada uno tiene sus sonidos posicionales pegados al modelo.

Estados comunes:

```
PATRULLA ──(oye ruido)──> ALERTA ──(llega al punto y no ve nada)──> PATRULLA
    │                        │
    └──(ve al jugador)──> PERSECUCION ──(lo pierde 5 s)──> ALERTA
                             │
                             └──(radio de captura)──> CAPTURA
Cualquier estado ──(contra)──> ATURDIDO / DISTRAIDO / BLOQUEADO
```

### 4.2 El Duende (noche 1) · Tema estrella: FÍSICA

- Casi siempre **invisible**. Se ve un instante si la linterna lo alumbra (está dentro del cono de la SpotLight y a menos de 8 m), y ahí sale corriendo.
- **ACECHO**: cada 15 a 25 s aplica un impulso de Cannon a un objeto físico cerca del jugador (lo tumba, lo hace rodar). El choque del objeto genera el ruido solo (lo emite el sistema de objetos de Jacobo).
- **ROBO**: si hay un objeto del jugador tirado en el piso, se lo lleva y lo esconde en otro `SPAWN_ITEM_*`. El objeto robado emite **risitas posicionales muy suaves**, así que se puede encontrar siguiendo el oído.
- **PERSECUCION**: si lo alumbras más de 2 s seguidos se enoja y te persigue rápido durante 8 s. Si te alcanza, te atrapa.
- **DISTRAIDO**: con el dulce de panela en el piso se queda ahí 20 s.
- Sonidos: risa (3 variantes), pasitos rápidos.

### 4.3 La Bruja (noche 2) · Tema estrella: LUZ Y SOMBRAS

- Empieza **afuera**, volando en círculos alrededor de la finca por los puntos `BRUJA_PATH_*`.
- Proyecta **sombra con la luz de la luna** (DirectionalLight), así que se ve su sombra pasar por el piso a través de las ventanas.
- **ATRAIDA**: si la linterna está prendida y el jugador está a menos de 6 m de una ventana `WIN_*` que no esté sellada, la Bruja va a esa ventana.
- **DENTRO**: entra por esa ventana y busca adentro (patrulla) durante 40 s. Si te ve, **PERSECUCION**.
- **SALIR**: si no te encontró, vuelve a volar.
- Contra: tijeras o sal en una ventana (E dentro de la zona `WIN_*` con el objeto en mano) la sellan toda la noche. Se ve el objeto puesto en la ventana.
- Sonidos: carcajada, aleteo, viento cuando pasa cerca.

### 4.4 El Silbón (noche 3) · Tema estrella: AUDIO ESPACIAL INVERTIDO

- Patrulla adentro de la finca. Lento al patrullar, rapidísimo al perseguir.
- **Silbido invertido**: se usa un `THREE.Audio` normal (no posicional) y el volumen se calcula a mano:
  ```
  volumen = clamp(distancia / 25, 0.05, 1)   // lejos = fuerte, cerca = suave
  ```
  Para que sea justo, cuando está a menos de 6 m se oyen sus **pasos y huesos** con PositionalAudio normal (pista real de que está encima).
- Contras: **ají** lanzado lo aturde 5 s; **radio con ladridos** crea una zona de 6 m donde no entra durante 30 s; **látigo** te salva de una captura.
- Sonidos: silbido, pasos, costal de huesos.

### 4.5 Valores de dificultad (en `src/data/espantos.js`)

| Espanto | velPatrulla | velPersecucion | radioVision | radioCaptura |
|---|---|---|---|---|
| Duende | 2.5 | 6 | 8 | 1.0 |
| Bruja | 3 | 5.5 | 12 | 1.2 |
| Silbón | 1.8 | 7 | 14 | 1.3 |

Los modos los multiplican (ver punto 5). Se ajustan jugando, en el modo debug.

### 4.6 Bonus (solo si sobra tiempo)

- **La Patasola**: avanza a saltos en un pie, cada salto suena y sacude la cámara.
- **La Candileja**: bolas de fuego en el patio (partículas + PointLight) que queman.
- **La Llorona**: llanto que te llama hacia el pozo, es una trampa.
- **La Madremonte**: noche extra en el monte, afuera de la finca, con tormenta.

---

## 5. Modalidades

Todos los modos son **la misma partida con distinta configuración**. Esto vive en `src/game/modos.js` y es un punto fuerte para la sustentación (configuración en vez de código repetido).

```js
// src/game/modos.js
export const NOCHES = [
  { numero: 1, espantos: ['duende'],                  lluvia: 0.2, tormenta: false },
  { numero: 2, espantos: ['bruja'],                   lluvia: 0.4, tormenta: false },
  { numero: 3, espantos: ['silbon'],                  lluvia: 0.3, tormenta: false },
  { numero: 4, espantos: ['duende', 'bruja'],         lluvia: 0.6, tormenta: false },
  { numero: 5, espantos: ['duende', 'bruja', 'silbon'], lluvia: 1.0, tormenta: true },
];

export const MODOS = {
  historia: {
    id: 'historia', nombre: 'Historia',
    noches: NOCHES, vidas: 3, duracionNoche: 360,
    linterna: true, bateria: true, salida: true,
    multVelocidad: 1, multEscucha: 1, luzAmbiente: 0.08,
  },
  supervivencia: {
    id: 'supervivencia', nombre: 'Supervivencia',
    noches: null, vidas: 1, duracionNoche: Infinity,
    linterna: true, bateria: true, salida: false,
    oleadas: { cadaSegundos: 90, orden: ['duende', 'bruja', 'silbon'], subirDificultad: 0.1 },
    multVelocidad: 1, multEscucha: 1, luzAmbiente: 0.08,
  },
  apagon: {
    id: 'apagon', nombre: 'Apagón',
    noches: NOCHES, vidas: 3, duracionNoche: 360,
    linterna: false, bateria: false, salida: true,
    multVelocidad: 0.9, multEscucha: 1.3, luzAmbiente: 0.02,
  },
  nocheLibre: {
    id: 'nocheLibre', nombre: 'Noche libre',
    noches: null, // el jugador escoge espantos y dificultad en el menú
    vidas: 3, duracionNoche: 360, linterna: true, bateria: true, salida: true,
    multVelocidad: 1, multEscucha: 1, luzAmbiente: 0.08,
  },
  museo: {
    id: 'museo', nombre: 'Museo de espantos',
    noches: null, vidas: Infinity, duracionNoche: Infinity,
    linterna: true, bateria: false, salida: false, sinEspantos: true,
    multVelocidad: 0, multEscucha: 0, luzAmbiente: 0.25,
  },
};
```

| Modo | Descripción |
|---|---|
| **Historia** | 5 noches. Noche 1 Duende, 2 Bruja, 3 Silbón, 4 Duende + Bruja, 5 los tres con tormenta. |
| **Supervivencia** | No hay salida. Cada 90 s entra otro espanto o sube la dificultad un 10%. Puntaje = tiempo sobrevivido. Récord guardado. |
| **Apagón** | Historia sin linterna, más oscuro, los espantos oyen más. Se juega con el oído. |
| **Noche libre** | Escoges qué espantos y la dificultad (fácil 0.8, normal 1, pesadilla 1.3). |
| **Museo de espantos** | Sin peligro. Recorres la finca y el bestiario: cada espanto girando en un pedestal (MatCap/PBR) con su leyenda en video. Ideal para la demo. |

**Bestiario**: un espanto se desbloquea al superar su noche. En el Museo, los bloqueados se ven como silueta negra.

---

## 6. Stack tecnológico y versiones

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 18 o 20 LTS | Entorno |
| Vite | la que instale `npm create vite@latest` | Servidor de desarrollo y build |
| three | **0.160.0 fija** | Motor gráfico (la misma versión que usó el profe en clase, para que el código de las diapositivas funcione igual) |
| cannon-es | ^0.20.0 | Física |
| lil-gui | ^0.19 | Panel de debug |
| Blender | 3.x o 4.x | Todo el modelado: finca, objetos y espantos (Jacobo) |
| Git + GitHub | — | Repositorio del equipo |

Instalación:

```bash
npm create vite@latest espantos -- --template vanilla
cd espantos
npm install three@0.160.0 cannon-es lil-gui
npm run dev
```

Addons de Three que usamos (vienen con el paquete `three`):
- `three/examples/jsm/loaders/GLTFLoader.js`
- `three/examples/jsm/loaders/RGBELoader.js`
- `three/examples/jsm/controls/PointerLockControls.js`
- `three/examples/jsm/libs/stats.module.js` (solo debug)
- `three/examples/jsm/utils/SkeletonUtils.js` (si se clona un modelo animado)

**No se usa CDN**: todo por npm, para que el build funcione sin internet.

---

## 7. Arquitectura del código

### 7.1 Idea general

Tres capas, una por integrante, que solo se comunican por **contratos** (punto 9) y por el **bus de eventos** (punto 10). Nadie llama funciones internas del módulo de otro.

```
┌──────────────────────────────────────────────────────────────┐
│  ETAPA 3 · EXPERIENCIA (Yuly)                                │
│  main.js · GameManager · modos · noches · UI · HUD · menús   │
│  video TV · partículas ambientales · audio ambiente · guardado│
└──────────────┬──────────────────────────────▲────────────────┘
               │ crea y orquesta               │ eventos
┌──────────────▼───────────────┐  ┌───────────┴────────────────┐
│ ETAPA 1 · MUNDO (Jacobo)     │  │ ETAPA 2 · ESPANTOS (Jerónimo)│
│ core: Engine, Physics,        │◄─┤ Espanto base (FSM, BFS,     │
│ Loader, EventBus, Debug       │  │ visión, oído) · Duende ·    │
│ world: finca, colliders,      │  │ Bruja · Silbón · contras ·  │
│ puertas, escondites, portales │  │ RuidoSistema · audio de     │
│ luces, linterna, HDRI         │  │ espantos · EspantoManager   │
│ player: control, inventario   │  │                             │
└──────────────────────────────┘  └─────────────────────────────┘
```

### 7.2 El objeto `ctx` (contexto compartido)

Todos los módulos reciben un único objeto con las piezas que necesitan. Lo arma `main.js`.

```js
const ctx = {
  engine,   // escena, cámara, renderer, bucle
  physics,  // mundo de Cannon
  loader,   // carga de assets con progreso
  bus,      // eventos
  world,    // la finca y sus datos (Jacobo)
  player,   // el jugador (Jacobo)
  espantos, // EspantoManager (Jerónimo)
  audio,    // AudioSistema (listener + helpers) (Jacobo crea el listener, Yuly el ambiente)
  modo,     // configuración del modo actual (Yuly)
  debug,    // panel lil-gui o null
};
```

### 7.3 Orden del bucle por frame

El `Engine` tiene el `requestAnimationFrame` y llama a los suscritos en orden de prioridad:

| Prioridad | Qué se actualiza | Dueño |
|---|---|---|
| 10 | Input y jugador (`player.update(dt)`) | Jacobo |
| 20 | Física (`physics.step(dt)`) + sincronizar mallas | Jacobo |
| 30 | Triggers del mundo (puertas, escondites, portales, zonas) | Jacobo |
| 40 | Espantos (`espantos.update(dt)`) | Jerónimo |
| 50 | Sistemas: ruido, batería, reloj de la noche | Jerónimo / Yuly |
| 60 | Efectos: partículas, velas, relámpagos | Yuly |
| 70 | HUD | Yuly |
| 100 | `renderer.render(scene, camera)` | Jacobo (Engine) |

`dt` se limita a máximo 0.05 s para que si la pestaña se congela la física no explote.

### 7.4 Estados del juego (GameManager, Yuly)

```
CARGANDO → MENU → INTRO_NOCHE (video en la TV) → JUGANDO ⇄ PAUSA
JUGANDO → ATRAPADO (jumpscare) → JUGANDO | GAME_OVER
JUGANDO → NOCHE_SUPERADA → INTRO_NOCHE (siguiente) | VICTORIA
JUGANDO → AMANECIO → JUGANDO (repite noche, -1 vida) | GAME_OVER
MENU → MUSEO
```

El primer clic en el menú desbloquea el audio del navegador (restricción de autoplay vista en semanas 3 y 9).

---

## 8. Estructura de carpetas

Regla de la semana 9: **todo en minúsculas, sin espacios ni tildes** en nombres de archivos y carpetas.

```
espantos/
├── index.html                    (Yuly)
├── package.json
├── vite.config.js                (opcional)
├── README.md                     (Yuly, al final)
├── CREDITOS.md                   (todos: licencia y autor de cada asset)
├── PROYECTO_ESPANTOS.md          (este documento)
├── tools/
│   └── blender/
│       ├── generar_finca.py      (Jacobo: script que arma el blockout)
│       └── fuentes/              (Jacobo: los .blend originales de la finca, objetos y espantos)
├── public/
│   ├── models/
│   │   ├── finca.glb             (Jacobo)
│   │   ├── objetos/              (Jacobo: llave.glb, pilas.glb, aji.glb, radio.glb, tijeras.glb, sal.glb, panela.glb, olla.glb...)
│   │   └── espantos/             (Jacobo: duende.glb, bruja.glb, silbon.glb)
│   ├── textures/
│   │   ├── noche.hdr             (Jacobo, 1k)
│   │   └── matcaps/              (Yuly: para el museo y los objetos)
│   ├── sounds/
│   │   ├── jugador/              (Jacobo: pasos_madera.mp3, pasos_tierra.mp3, salto.mp3, linterna_click.mp3)
│   │   ├── mundo/                (Jacobo: puerta_abrir.mp3, puerta_cerrada.mp3, portal.mp3, recoger.mp3, golpe_objeto.mp3)
│   │   ├── espantos/             (Jerónimo: ver punto 12)
│   │   ├── ambiente/             (Yuly: grillos.mp3, lluvia.mp3, viento.mp3, trueno.mp3, latido.mp3)
│   │   └── ui/                   (Yuly: grito_captura.mp3, menu_hover.mp3, victoria.mp3, game_over.mp3)
│   └── video/                    (Yuly: intro.mp4, leyenda_duende.mp4, leyenda_bruja.mp4, leyenda_silbon.mp4)
└── src/
    ├── main.js                   (Yuly: arma el ctx y arranca)
    ├── style.css                 (Yuly)
    ├── core/                     (Jacobo)
    │   ├── engine.js
    │   ├── physics.js
    │   ├── loader.js
    │   ├── bus.js
    │   ├── debug.js
    │   └── utils.js              (clamp, lerp, distancia en XZ, etc.)
    ├── world/                    (Jacobo)
    │   ├── world.js
    │   ├── colliders.js
    │   ├── puertas.js
    │   ├── escondites.js
    │   ├── portales.js
    │   ├── zonas.js
    │   ├── objetos.js            (spawn de items y objetos físicos)
    │   └── iluminacion.js        (luna, ambiente, velas, HDRI, niebla)
    ├── player/                   (Jacobo)
    │   ├── player.js
    │   ├── controles.js
    │   ├── linterna.js
    │   └── inventario.js
    ├── espantos/                 (Jerónimo)
    │   ├── espanto.js            (clase base)
    │   ├── duende.js
    │   ├── bruja.js
    │   ├── silbon.js
    │   ├── espantoManager.js
    │   ├── grafoWaypoints.js
    │   ├── contras.js
    │   └── ruido.js              (RuidoSistema)
    ├── game/                     (Yuly)
    │   ├── gameManager.js
    │   ├── modos.js
    │   ├── reloj.js
    │   ├── guardado.js
    │   └── bestiario.js
    ├── fx/                       (Yuly)
    │   ├── lluvia.js
    │   ├── polvo.js
    │   ├── fuego.js
    │   ├── aguaPozo.js
    │   └── relampagos.js
    ├── audio/
    │   ├── audioSistema.js       (Jacobo: listener y helpers)
    │   └── ambiente.js           (Yuly: zonas sonoras, latido, lluvia)
    ├── ui/                       (Yuly)
    │   ├── hud.js
    │   ├── menus.js
    │   ├── jumpscare.js
    │   └── tv.js                 (video textura del televisor)
    ├── data/
    │   ├── espantos.js           (Jerónimo: valores de dificultad)
    │   ├── objetos.js            (Jacobo: definición de items)
    │   ├── puertas.js            (Jacobo: qué llave abre qué puerta)
    │   └── leyendas.js           (Yuly: textos del bestiario)
    └── dev/
        ├── sandboxEspantos.js    (Jerónimo: cuarto de prueba con cubos y waypoints)
        ├── mocks.js              (Yuly: mundo y jugador falsos para probar el flujo)
        └── verModelos.js         (Jacobo: revisa los .glb, polígonos y animaciones, con ?escena=modelos)
```

Las sandboxes se abren con `http://localhost:5173/?escena=espantos` y `?escena=flujo`. `main.js` revisa ese parámetro.

---

## 9. Contratos entre módulos

**Regla de oro**: si alguien necesita cambiar un contrato, lo avisa en el grupo, se actualiza este documento y luego se programa. Los nombres de aquí son exactos.

### 9.1 `core/bus.js` (Jacobo)

```js
export class Bus {
  on(evento, fn)      // devuelve una función para desuscribirse
  off(evento, fn)
  emit(evento, datos)
}
```

### 9.2 `core/engine.js` (Jacobo)

```js
export class Engine {
  scene        // THREE.Scene
  camera       // THREE.PerspectiveCamera (ya agregada a la escena)
  renderer     // THREE.WebGLRenderer con sombras PCFSoft activadas
  clock
  onUpdate(fn, prioridad = 50)  // fn(dt, tiempoTotal); devuelve función para quitarla
  start()
  stop()
  setCalidad('baja' | 'media' | 'alta')  // pixelRatio y tamaño de shadow maps
}
```

### 9.3 `core/physics.js` (Jacobo)

```js
export class Physics {
  world                         // CANNON.World con gravedad -9.82, SAPBroadphase, allowSleep
  materiales                    // { piso, muro, jugador, objeto, espanto }
  agregar(body, mesh = null)    // si hay mesh, se sincroniza cada frame
  quitar(body)
  step(dt)
}
```

### 9.4 `core/loader.js` (Jacobo)

```js
export class Loader {
  cargarGLB(ruta)      // Promise<gltf>
  cargarHDR(ruta)      // Promise<texture>
  cargarTextura(ruta)  // Promise<texture>
  cargarAudio(ruta)    // Promise<AudioBuffer>, con caché
  onProgreso(fn)       // fn(0..1) para la barra de carga de Yuly
}
```

### 9.5 `world/world.js` (Jacobo)

```js
export class World {
  async cargar()   // carga finca.glb, crea colliders, puertas, escondites, portales, zonas y luces

  // Datos que leen los espantos y el juego:
  waypoints        // [{ id: 'WP_01', posicion: THREE.Vector3, vecinos: ['WP_02', ...] }]
  rutaBruja        // [THREE.Vector3, ...]  (BRUJA_PATH_* en orden)
  spawns           // { jugador: Vector3, items: [Vector3...], espantos: { duende, bruja, silbon } }
  ventanas         // [{ id, caja: THREE.Box3, sellada: false, posicion }]
  escondites       // [{ id, caja: THREE.Box3, puntoCamara: Vector3 }]
  salida           // { caja: THREE.Box3 }
  obstaculos       // [THREE.Mesh] colliders invisibles para el Raycaster (material.visible = false)
  objetosFisicos   // [{ body, mesh, tipo }] cosas que se pueden tumbar/lanzar
  tvPantalla       // THREE.Mesh de TV_pantalla (Yuly le pone la VideoTexture)
  velas            // [THREE.Vector3] posiciones de los VELA_ (Yuly pone el fuego)
  pozo             // THREE.Vector3 de POZO_agua (Yuly pone el agua)
  luces            // { ambiente, luna } para relámpagos y debug

  zonaDe(posicion)             // nombre de la ZONE_* donde está un punto, o 'exterior'
  sellarVentana(id)
  generarItems(listaTipos)     // pone los items de la noche en spawns aleatorios
  reiniciarNoche()             // devuelve puertas cerradas, items nuevos, ventanas sin sellar
  setLuzAmbiente(valor)        // la llama el GameManager con modo.luzAmbiente
}
```

### 9.6 `player/player.js` (Jacobo)

```js
export class Player {
  body             // CANNON.Body
  posicion         // THREE.Vector3 (se actualiza cada frame, solo lectura para los demás)
  direccion        // THREE.Vector3 hacia donde mira
  isHidden         // boolean
  esconditeActual  // id o null
  linterna         // { encendida, bateria (0-100), luz: THREE.SpotLight }
  inventario       // { espacios: [item|null x4], activo: 0..3 }
  bloqueado        // true durante jumpscare, menús y pausa

  update(dt)
  respawn()                    // al SPAWN_PLAYER, suelta el objeto en mano donde estaba
  bloquear(bool)
  tieneObjeto(tipo)
  quitarObjeto(tipo)           // para contras que se gastan (látigo)
  configurar(modo)             // linterna sí/no, batería sí/no
}
```

### 9.7 `espantos/espanto.js` y `espantoManager.js` (Jerónimo)

```js
export class Espanto {
  constructor(ctx, tipo, config)
  tipo             // 'duende' | 'bruja' | 'silbon'
  estado           // 'PATRULLA' | 'ALERTA' | 'PERSECUCION' | 'ATURDIDO' | ... (ver punto 4)
  modelo           // THREE.Group
  body             // CANNON.Body
  activo
  update(dt)
  oirRuido({ posicion, intensidad })
  aplicarContra(tipoContra, datos)
  setActivo(bool)
  destruir()
}

export class EspantoManager {
  constructor(ctx)
  async precargar()                    // carga los 3 glb y sus sonidos una sola vez
  iniciar(listaTipos, multiplicadores) // { multVelocidad, multEscucha }
  agregar(tipo)                        // para supervivencia
  detenerTodos()
  update(dt)
  lista                                // espantos activos
  masCercano(posicion)                 // { espanto, distancia } para el latido del HUD
}
```

### 9.8 `game/gameManager.js` (Yuly)

```js
export class GameManager {
  constructor(ctx)
  estado                   // ver punto 7.4
  iniciarModo(idModo, opciones = {})
  pausar() / reanudar()
  vidas
  nocheActual
  horaJuego                // '12:00 a.m.' ... '6:00 a.m.'
}
```

### 9.9 Datos de items (`data/objetos.js`, Jacobo)

```js
export const OBJETOS = {
  llave_porton: { nombre: 'Llave del portón', modelo: '/models/objetos/llave.glb', lanzable: false },
  llave_cocina: { nombre: 'Llave de la cocina', modelo: '/models/objetos/llave.glb', lanzable: false },
  pilas:        { nombre: 'Pilas', modelo: '/models/objetos/pilas.glb', lanzable: true },
  aji:          { nombre: 'Ají', modelo: '/models/objetos/aji.glb', lanzable: true, contra: 'silbon' },
  radio:        { nombre: 'Radio', modelo: '/models/objetos/radio.glb', lanzable: false, contra: 'silbon' },
  latigo:       { nombre: 'Látigo', modelo: '/models/objetos/latigo.glb', lanzable: false, contra: 'silbon' },
  tijeras:      { nombre: 'Tijeras', modelo: '/models/objetos/tijeras.glb', lanzable: false, contra: 'bruja' },
  sal:          { nombre: 'Sal', modelo: '/models/objetos/sal.glb', lanzable: false, contra: 'bruja' },
  panela:       { nombre: 'Dulce de panela', modelo: '/models/objetos/panela.glb', lanzable: false, contra: 'duende' },
};
```

Qué items aparecen cada noche lo decide el GameManager según los espantos de la noche: siempre `llave_porton` y `pilas`, más las contras de los espantos activos, más 1 o 2 llaves de cuarto.

---

## 10. Bus de eventos

Nombres exactos. Quien emite es el único que puede emitir ese evento.

| Evento | Datos | Emite | Escuchan |
|---|---|---|---|
| `ruido` | `{ posicion, intensidad, fuente: 'jugador' \| 'objeto' }` | Jacobo (jugador y choques de objetos, incluidos los que tumba el Duende) | Jerónimo (espantos), Yuly (HUD) |
| `item:recogido` | `{ tipo }` | Jacobo | Yuly (HUD, sonido) |
| `item:soltado` | `{ tipo, posicion, body }` | Jacobo | Jerónimo (duende roba) |
| `item:lanzado` | `{ tipo, body }` | Jacobo | Jerónimo (ají contra Silbón) |
| `contra:colocada` | `{ tipo, posicion, ventanaId? }` | Jacobo | Jerónimo |
| `puerta:abierta` | `{ id }` | Jacobo | Yuly |
| `puerta:bloqueada` | `{ id, llaveRequerida }` | Jacobo | Yuly (mensaje HUD) |
| `jugador:escondido` | `{ id }` | Jacobo | Jerónimo |
| `jugador:salioEscondite` | `{ id }` | Jacobo | Jerónimo |
| `jugador:zona` | `{ zona }` | Jacobo | Yuly (HUD, audio ambiente) |
| `jugador:portal` | `{ desde, hasta }` | Jacobo | Yuly (efecto) |
| `linterna:cambio` | `{ encendida, bateria }` | Jacobo | Jerónimo (bruja), Yuly (HUD) |
| `jugador:salida` | `{ conLlave }` | Jacobo | Yuly (ganar noche) |
| `espanto:estado` | `{ tipo, estado }` | Jerónimo | Yuly (música de tensión), debug |
| `jugador:atrapado` | `{ tipo, posicion }` | Jerónimo | Yuly (jumpscare, vidas), Jacobo (respawn lo llama Yuly) |
| `juego:estado` | `{ estado }` | Yuly | todos |
| `noche:inicio` | `{ numero, espantos }` | Yuly | todos |
| `noche:fin` | `{ resultado: 'escapo' \| 'amanecio' }` | Yuly | todos |

---

## 11. Convenciones de Blender (contrato entre Blender y el código)

El código encuentra todo por el **prefijo del nombre del objeto** en Blender. Si el nombre está mal, no funciona. (GLTFLoader quita los puntos de los nombres, `COL_pared.001` llega como `COL_pared001`; por eso solo se revisa el prefijo).

| Prefijo | Tipo en Blender | Qué hace en el juego |
|---|---|---|
| (sin prefijo) | Mesh | Geometría visible normal |
| `COL_` | Mesh cubo | Collider sólido invisible (muros, muebles grandes, piso). En el código se vuelve `CANNON.Box` y se oculta |
| `WP_` | Empty | Waypoint de patrulla interior (`WP_01`, `WP_02`...) |
| `BRUJA_PATH_` | Empty | Ruta de vuelo exterior de la bruja, en orden (`BRUJA_PATH_01`...) |
| `SPAWN_PLAYER` | Empty | Donde despierta el jugador (el cuarto) |
| `SPAWN_ITEM_` | Empty | Posibles lugares de objetos (mínimo 15) |
| `SPAWN_DUENDE`, `SPAWN_BRUJA`, `SPAWN_SILBON` | Empty | Donde aparece cada espanto |
| `DOOR_<id>` | Mesh | Puerta. **El origen (punto naranja) va en la bisagra** para que gire bien |
| `HIDE_<id>` | Mesh cubo | Volumen de escondite (invisible) |
| `HIDECAM_<id>` | Empty | Dónde queda la cámara al esconderse en `HIDE_<id>` |
| `WIN_<id>` | Mesh cubo | Volumen frente a una ventana (bruja + contras) |
| `PORTAL_<nombre>_A` / `_B` | Mesh cubo | Par de volúmenes del pasadizo secreto |
| `ZONE_<nombre>` | Mesh cubo | Zona para HUD y audio ambiente (`ZONE_sala`, `ZONE_cocina`, `ZONE_sotano`, `ZONE_atico`, `ZONE_patio`) |
| `EXIT_porton` | Mesh cubo | Volumen de la salida |
| `VELA_` | Empty | Donde va una vela (PointLight + partículas de fuego en código) |
| `TV_pantalla` | Mesh plano | Pantalla del televisor donde va la video textura |
| `POZO_agua` | Empty | Donde salen las partículas de agua del pozo |
| `PHYS_<tipo>` | Mesh | Objeto que se puede tumbar/lanzar (`PHYS_olla`, `PHYS_botella`, `PHYS_caja`) |

**Reglas de exportación (semana 8):**
1. `Set Origin > Origin to Geometry` en todo, **excepto puertas** (origen en la bisagra).
2. `Ctrl + A > Scale` en todo. **En los `COL_` aplicar solo Scale, NO rotación**: el código lee la rotación del objeto y arma el collider rotado.
3. Colores sólidos; si hay textura, JPG de máximo 1024 px y `File > External Data > Pack Resources`.
4. No exportar luces ni cámaras (las luces se crean en código).
5. `File > Export > glTF 2.0 (.glb)`, formato glTF Binary, `+Y Up`, incluir los Empties.
6. Mínimo 2 pisos o un sótano + ático para que el portal tenga sentido.

**Distribución sugerida de la finca:** sala (con TV), cocina, 2 cuartos (uno es el spawn), baño, sótano, ático, corredor exterior, patio con pozo y portón. Ventanas en sala, cocina y cuartos (mínimo 6 `WIN_`).

### 11.1 Modelos de espantos y objetos (contrato entre Jacobo y Jerónimo)

**Todo lo que se modela en Blender lo hace Jacobo**: la finca, los objetos y los 3 espantos. Jerónimo programa contra esta especificación y usa modelos temporales (cápsulas y conos) en su sandbox mientras llegan los `.glb` reales.

| Regla | Valor |
|---|---|
| Archivos | `public/models/espantos/duende.glb`, `bruja.glb`, `silbon.glb` |
| Escala | 1 unidad = 1 metro. Duende ≈ 0.9 m, Bruja ≈ 1.7 m, Silbón ≈ 2.8 m (es alto y flaco, como dice la leyenda) |
| Origen | En los **pies**, centrado (la bruja también, aunque vuele: la altura la pone el código) |
| Frente | Mirando hacia **-Y en Blender**, que al exportar con +Y Up queda mirando hacia **+Z en Three.js** |
| Polígonos | < 5.000 cada uno |
| Animaciones (Actions) | Nombres exactos en minúscula: `idle`, `caminar`, `correr`. La bruja: `volar` en vez de `caminar`/`correr`. Opcional: `atrapar` (para el jumpscare) |
| Si no hay rig | Se entrega el modelo quieto y Jerónimo lo anima en código (flotar con seno, balanceo). Avisarle |
| Materiales | Colores sólidos o una textura JPG ≤ 1024 px empacada. `castShadow` lo activa el código |
| Detalles | El Silbón lleva su **costal** como objeto aparte llamado `silbon_costal` (para que se pueda mover en código). El Duende lleva sombrero grande |

Objetos (`public/models/objetos/`): origen en el centro, escala real (una llave ≈ 8 cm, una olla ≈ 25 cm), < 500 polígonos cada uno.

Los `.blend` originales se guardan en `tools/blender/fuentes/` para poder corregirlos.

---

## 12. Assets: lista completa

Fuentes recomendadas (las mismas de clase): Poly Pizza, Poly Haven, Pixabay Sound Effects, Mixkit, Freesound. **Cada asset descargado se anota en `CREDITOS.md`** con autor, link y licencia.

| Asset | Dueño | Notas |
|---|---|---|
| `finca.glb` | Jacobo | Blockout primero (cubos grises con todos los prefijos), arte final después |
| Objetos (`llave`, `pilas`, `aji`, `radio`, `latigo`, `tijeras`, `sal`, `panela`) | Jacobo | Low poly. Pueden ser primitivas de Blender bien hechas |
| `noche.hdr` | Jacobo | Poly Haven, cielo nocturno, **1k** |
| `duende.glb`, `bruja.glb`, `silbon.glb` | Jacobo | Modelados en Blender según el punto 11.1 (o descargados con licencia libre y ajustados en Blender a esas reglas). Animaciones `idle`, `caminar`, `correr` / `volar` si es posible |
| Sonidos de espantos | Jerónimo | `duende_risa_1/2/3.mp3`, `duende_pasos.mp3`, `bruja_carcajada.mp3`, `bruja_aleteo.mp3`, `bruja_viento.mp3`, `silbon_silbido.mp3`, `silbon_pasos.mp3`, `silbon_huesos.mp3`, `ladridos.mp3` |
| Sonidos de jugador y mundo | Jacobo | ver carpeta en el punto 8 |
| Sonidos de ambiente y UI | Yuly | ver carpeta en el punto 8 |
| Videos de leyendas | Yuly | 30 a 60 s cada uno, **720p máx, MP4 H.264, menos de 5 MB**. Hechos por el equipo: imágenes + narración grabada con voz de abuela. Nada de videos con derechos de autor |
| MatCaps | Yuly | 2 o 3 PNG de 256 px |

---

## 13. Presupuesto de rendimiento

| Recurso | Límite |
|---|---|
| Polígonos de toda la escena | **< 50.000** (finca < 35.000, espantos < 5.000 c/u) |
| Texturas | máximo 1024 × 1024, JPG |
| HDRI | 1k |
| Luces con sombra | **solo 2**: la luna (DirectionalLight) y la linterna (SpotLight). Las velas son PointLight **sin sombra** (una PointLight con sombra son 6 renders por frame) |
| Shadow maps | 1024 (calidad alta), 512 (baja) |
| Partículas | lluvia ≤ 4000, polvo ≤ 500, cada vela ≤ 150, pozo ≤ 250. Siempre `THREE.Points` con `BufferGeometry` (1 draw call), nunca mallas sueltas |
| Pixel ratio | `Math.min(window.devicePixelRatio, 2)`, en baja calidad 1 |
| Física | `world.allowSleep = true`, `SAPBroadphase`, colliders siempre cajas/esferas, nunca mallas complejas |
| Peso total de `public/` | < 40 MB |
| Meta | **60 FPS** en un portátil del salón con calidad media |

En el modo debug se muestra FPS (Stats) y `renderer.info.render.calls` y `triangles`.

---

## 14. Modo debug

Se activa con `?debug` en la URL (`http://localhost:5173/?debug`). Solo existe en desarrollo, no estorba en la demo.

- Panel lil-gui (semana 2):
  - Luces: intensidad de luna, ambiente, linterna.
  - Espantos: multiplicadores de velocidad y escucha, estado actual de cada uno, botón "congelar espantos".
  - Jugador: modo dios (no lo atrapan), teletransportarse a cada zona, batería infinita.
  - Juego: saltar a la noche X, adelantar el reloj.
  - Visual: mostrar colliders en wireframe, mostrar waypoints y sus conexiones, mostrar volúmenes de triggers.
- Stats de FPS.
- Cada módulo agrega su propia carpeta al panel con `ctx.debug?.addFolder('...')`.

---

## 15. Flujo de trabajo con Git

- Repo en GitHub, público al final (lo piden en las entregas).
- Ramas:
  - `main`: solo versiones que funcionan (se actualiza en cada integración).
  - `develop`: integración.
  - `jacobo/<tarea>`, `jeronimo/<tarea>`, `yuly/<tarea>`: trabajo de cada uno.
- Pull Request hacia `develop`, revisado por al menos otro integrante.
- Cada quien toca **solo sus carpetas**. Archivos compartidos (`main.js`, `index.html`, este documento) se cambian avisando en el grupo.
- Commits pequeños y en español: `feat(espantos): silbido invertido del silbon`, `fix(world): collider de la cocina`.
- `node_modules/` y `dist/` en `.gitignore`.
- Antes de cada PR: `npm run build` sin errores y la consola del navegador sin errores rojos.

---

## 16. Las 3 etapas y quién hace qué

Las etapas avanzan **en paralelo** gracias a los contratos y las sandboxes. Cada etapa es una capa del juego con un dueño.

### Fase 0 (todos, primer día)

- Todos leen este documento completo.
- **Jacobo** crea el repo con el esqueleto: Vite, dependencias, `core/` funcionando (engine, physics, loader, bus, debug) y archivos vacíos con las firmas de los contratos del punto 9 para que nadie quede bloqueado.
- Cada uno crea su rama.

### ETAPA 1 · EL MUNDO Y EL JUGADOR · **Jacobo**

**Responsabilidad:** que exista una finca sólida, iluminada y recorrible, con un jugador que se mueve, interactúa y hace ruido.

Entregables:
1. `core/` completo (Engine, Physics, Loader, Bus, Debug, utils).
2. Script `tools/blender/generar_finca.py` que genera el **blockout** de la finca con todos los prefijos del punto 11 (semana 8: automatización con Python). **Este blockout debe estar en el repo el día 2** porque Jerónimo y Yuly lo necesitan.
3. `finca.glb` final low poly con materiales (después del blockout).
   - Además, **todo el modelado en Blender**: los objetos (`llave`, `pilas`, `aji`, `radio`, `latigo`, `tijeras`, `sal`, `panela`, ollas, botellas, cajas) y los **3 espantos** (`duende.glb`, `bruja.glb`, `silbon.glb`) con sus animaciones, siguiendo el punto 11.1.
4. `world/`: lectura de prefijos, colliders, puertas con llave, escondites, portales con cooldown, zonas, objetos físicos, spawn de items.
5. `iluminacion.js`: luna con sombra, ambiente bajo, velas (PointLight parpadeante sin sombra), HDRI nocturno, niebla `FogExp2`.
6. `player/`: PointerLock, WASD, correr, agacharse, saltar con impulso y detección de suelo (semana 6), interacción con E, inventario, lanzar objetos como proyectil físico (semana 6), linterna con batería, emisión de `ruido`.
7. `audioSistema.js`: AudioListener en la cámara y helper `crearPositional(buffer, opciones)`.
8. Sonidos de jugador y mundo.
9. (Bonus) tercera persona con avatar animado (semana 10).

Criterios de terminado:
- Se recorre toda la finca sin atravesar muros ni caer al vacío.
- Las puertas con llave no abren sin la llave y muestran el evento `puerta:bloqueada`.
- Esconderse y salir funciona; el portal teletransporta con cooldown.
- La linterna proyecta sombras y gasta batería.
- Lanzar un objeto lo hace volar con física y al chocar emite `ruido`.
- Los 3 espantos y todos los objetos están en `.glb` cumpliendo el punto 11.1 (escala, origen, frente, nombres de animaciones, polígonos).
- Todos los eventos de la tabla del punto 10 que le tocan se emiten con los datos exactos.

### ETAPA 2 · LOS ESPANTOS · **Jerónimo**

**Responsabilidad:** que los espantos se sientan vivos, inteligentes y distintos entre sí.

Entregables:
1. `sandboxEspantos.js`: cuarto de prueba con cubos, waypoints y un jugador simple, para trabajar sin depender de la finca.
2. `grafoWaypoints.js`: conexión automática de waypoints (distancia < 7 y sin muro en medio con Raycaster) y búsqueda BFS.
3. `espanto.js`: clase base con máquina de estados, movimiento físico, visión con cono y raycast, oído, captura, AnimationMixer.
4. `duende.js`, `bruja.js`, `silbon.js` con todo lo del punto 4.
5. `contras.js`: ají aturde, radio crea zona prohibida, látigo salva, tijeras/sal sellan ventana, panela distrae.
6. `ruido.js`: recibe `ruido` y lo reparte a los espantos activos. (El ruido de los choques físicos lo emite Jacobo desde `world/objetos.js`; aquí no se duplica.)
7. `espantoManager.js`: precarga, iniciar lista, agregar en supervivencia, `masCercano()`.
8. Audio de los espantos: PositionalAudio (semana 3/9) y el **silbido invertido** del Silbón.
9. Sonidos de los espantos y `data/espantos.js` con los valores de dificultad. (Los modelos los hace Jacobo; Jerónimo los carga, los anima con AnimationMixer y mientras tanto usa modelos temporales.)
10. Panel de debug de espantos.

Criterios de terminado:
- Cada espanto patrulla, oye, ve, persigue, pierde el rastro y captura según el punto 4.
- Esconderse funciona contra todos (y falla si te vieron entrar).
- Cada contra tiene efecto visible y audible.
- El silbido del Silbón suena más fuerte entre más lejos está.
- Con los 3 espantos activos el juego se mantiene a 60 FPS.

### ETAPA 3 · LA EXPERIENCIA DE JUEGO · **Yuly**

**Responsabilidad:** convertir las piezas en un juego completo: flujo, modos, interfaz, ambiente y presentación.

Entregables:
1. `index.html`, `main.js` (arma el `ctx`, revisa `?escena=` y `?debug`), `style.css`.
2. `mocks.js` y sandbox `?escena=flujo` para probar el flujo sin el mundo real.
3. `gameManager.js` con la máquina de estados del punto 7.4, vidas, reloj de la noche, condiciones de victoria y derrota.
4. `modos.js` exactamente como el punto 5, incluyendo oleadas de supervivencia y selección de noche libre.
5. UI: pantalla de carga con barra de progreso, menú principal, selector de modos, opciones (volumen general, música/ambiente, sensibilidad del mouse, calidad), pausa, HUD (hora, vidas, batería, inventario, medidor de ruido, zona actual, mensajes), pantallas de victoria/derrota/noche superada.
6. `jumpscare.js`: giro de cámara, grito, destello rojo, fundido.
7. `tv.js`: video textura en `TV_pantalla` con la leyenda de cada noche (semana 3), con audio.
8. `fx/`: lluvia (más intensa según la noche), polvo, fuego de velas en los `VELA_`, agua del pozo (como la fuente de la semana 9), relámpagos en la noche 5.
9. `ambiente.js`: grillos, viento, lluvia, sonido por zona (semana 9) y **latido** que sube según `espantos.masCercano()`.
10. `guardado.js`: localStorage (con try/catch) para récords, bestiario desbloqueado y opciones.
11. `bestiario.js` y modo **Museo**: pedestales con cada espanto girando (MatCap y PBR, semana 2 y 7) y su leyenda.
12. Videos de las leyendas, `leyendas.js`, `README.md`, `CREDITOS.md` consolidado.
13. Coordina la integración final y la optimización (semana 11).

Criterios de terminado:
- Se puede jugar de principio a fin cada modo sin recargar la página.
- El primer clic desbloquea el audio, el video de la TV suena.
- El HUD refleja en tiempo real todo lo que pasa.
- Récords y bestiario sobreviven a recargar la página.

---

## 17. Cronograma

> Supuesto: las clases siguen siendo los miércoles, en la semana 11 (miércoles 11 de noviembre) se muestra avance y la entrega final es la semana 12 (miércoles 18 de noviembre). Si el profe cambia fechas, se corre todo igual.

| Fecha | Jacobo | Jerónimo | Yuly | Hito |
|---|---|---|---|---|
| **Mié 4 nov** | Repo + esqueleto core + contratos vacíos | Leer doc, buscar sonidos de espantos | Leer doc, guion de los videos, maqueta del menú | **Fase 0 lista** |
| Jue 5 | Script Python del blockout | Sandbox + grafo de waypoints | `main.js`, mocks, GameManager | |
| **Vie 6** | **Blockout `finca.glb` en el repo** + colliders | Clase base Espanto (patrulla, oído) | Menú, carga, HUD base | |
| Sáb 7 | Jugador completo + linterna | Visión, persecución, captura | Modos + reloj + vidas + jumpscare | |
| **Dom 8** | Integración 1 | Integración 1 | Integración 1 | **Jugable: finca blockout + jugador + 1 espanto + menú → jugar → atrapado** |
| Lun 9 | Puertas, escondites, portal, items | Silbón completo + silbido invertido | TV con video, lluvia, velas | |
| Mar 10 | Iluminación final, objetos físicos, **modelos de Silbón y Duende** | Duende completo (conecta los modelos de Jacobo) | Audio ambiente, latido, pozo | |
| **Mié 11** | Demo en clase | Demo en clase | Demo en clase | **Avance: noches 1 y 3 jugables** |
| Jue 12 | Arte final de la finca + **modelo de la Bruja** | Bruja completa + sombra con la luna | Bestiario + Museo + guardado | |
| Vie 13 | Sonidos de mundo, pulir controles | Contras completas | Noches 4 y 5, supervivencia, apagón, noche libre | |
| Sáb 14 | Objetos finales en Blender, animaciones que falten; (bonus) tercera persona | Ajuste de dificultad | Relámpagos, pantallas finales | |
| **Dom 15** | Integración 2 | Integración 2 | Integración 2 | **Feature freeze: todo el MVP adentro** |
| Lun 16 | Optimización (polígonos, colliders) | Optimización IA y audio | Optimización general, calidad baja/media/alta | Solo arreglar bugs desde aquí |
| Mar 17 | Pruebas cruzadas | Pruebas cruzadas | Video demo, documento, README | **Versión final en `main`** |
| **Mié 18** | Sustentación | Sustentación | Sustentación | **ENTREGA** |

**Pruebas cruzadas**: cada uno juega lo que hicieron los otros dos y reporta bugs en Issues de GitHub.

---

## 18. Mapa de temas de la materia

Para que en la sustentación se muestre que **no faltó ningún tema**.

| Semana | Tema | Dónde está en el juego | Dueño |
|---|---|---|---|
| 1 | Escena, cámara, renderer, bucle | `core/engine.js` | Jacobo |
| 2 | Geometrías primitivas | Portal (TorusGeometry), pedestales del museo, blockout | Jacobo / Yuly |
| 2 | BufferGeometry | Todos los sistemas de partículas | Yuly |
| 2 | Materiales PBR (metalness, roughness) | Finca, objetos, piso mojado del patio | Jacobo |
| 2 | Transformaciones y THREE.Group | Puertas que giran en la bisagra, espantos como Group | Jacobo / Jerónimo |
| 2 | lil-gui | Modo debug | Todos |
| 3 | Bucle a 60 FPS | Engine | Jacobo |
| 3 | Video como textura | Televisor con la leyenda | Yuly |
| 3 | Audio posicional y autoplay | Espantos, desbloqueo con el primer clic | Jerónimo / Yuly |
| 4 | Luces (Ambient, Directional, Point, Spot) | Ambiente bajo, luna, velas, linterna | Jacobo |
| 4 | Sombras PCFSoft | Luna y linterna, sombra de la bruja | Jacobo / Jerónimo |
| 4 | MeshPhysicalMaterial | Objetos del museo (barniz), botellas (transmisión) | Yuly |
| 4 | Partículas con AdditiveBlending | Fuego de velas, efecto del portal | Yuly |
| 5 | Cannon-es, cuerpos dinámicos/estáticos | Colliders, objetos tumbables | Jacobo |
| 5 | ContactMaterial (fricción, rebote) | Piso de madera vs. tierra del patio, objetos que rebotan | Jacobo |
| 5 | Evento `collide` | Choques generan ruido (y los espantos lo oyen) | Jacobo / Jerónimo |
| 6 | Control WASD, salto por impulso | Jugador | Jacobo |
| 6 | Proyectiles | Lanzar ají y objetos | Jacobo |
| 6 | Cámara seguidora | (Bonus) tercera persona | Jacobo |
| 6 | Sleep / broadphase SAP | Physics | Jacobo |
| 7 | GLTFLoader (.glb) | Finca, objetos, espantos | Todos |
| 7 | HDRI / IBL | Cielo nocturno | Jacobo |
| 7 | MatCaps | Bestiario y objetos del museo | Yuly |
| 8 | Blender + Python + exportar .glb | Finca, objetos, los 3 espantos y el script del blockout | Jacobo |
| 8 | Origin to Geometry, Ctrl+A | Reglas del punto 11 | Jacobo |
| 9 | Trigger radial (distanceTo) | Visión/captura de espantos, latido | Jerónimo / Yuly |
| 9 | Trigger AABB (Box3) | Escondites, ventanas, zonas, salida | Jacobo |
| 9 | Portal con cooldown | Pasadizo secreto | Jacobo |
| 9 | Zonas sonoras y HUD | Audio por zona, HUD | Yuly |
| 10 | Avatar animado y colisiones con muros | Animaciones de los espantos (las hace Jacobo en Blender, las reproduce Jerónimo en código), colliders, (bonus) avatar | Jacobo / Jerónimo |
| 11 | Optimización y render final | Punto 13, selector de calidad | Todos |
| 12 | Proyecto integrador | Todo | Todos |

---

## 19. Criterios de terminado (checklist final)

Antes de entregar, todo esto debe estar en ✅:

**Funcional**
- [ ] Se completa el modo Historia de la noche 1 a la 5.
- [ ] Supervivencia, Apagón, Noche libre y Museo funcionan.
- [ ] Los 3 espantos patrullan, oyen, ven, persiguen y atrapan.
- [ ] Todas las contras funcionan.
- [ ] Puertas, llaves, escondites, portal y salida funcionan.
- [ ] La linterna gasta batería, las pilas recargan.
- [ ] El video de la TV se ve y se oye.
- [ ] Récords, bestiario y opciones se guardan.

**Técnico**
- [ ] `npm run build` sin errores y `npm run preview` funciona.
- [ ] Consola sin errores rojos en toda una partida.
- [ ] 60 FPS en calidad media en un portátil del salón.
- [ ] Ningún archivo con mayúsculas o espacios en `public/`.
- [ ] `CREDITOS.md` completo.

**Experiencia**
- [ ] Da miedo: oscuridad, sonidos, jumpscare.
- [ ] Un compañero que nunca lo ha jugado entiende qué hacer en la noche 1 sin que le expliquen.

---

## 20. Entregables y sustentación

Confirmar con el profe el formato exacto. Por lo que ha pedido en talleres anteriores, preparar:

1. **Repositorio público** en GitHub con el código y el README.
2. **Video demo** (1 a 2 min) mostrando cada espanto, las contras y los modos, con audio.
3. **Documento PDF corto** con el concepto, los mitos usados y el mapa de temas (punto 18), con los nombres del equipo al final.

**Guion de sustentación (10 min aprox.):**
1. Yuly: el concepto, por qué mitos colombianos, los modos (2 min).
2. Jacobo: de Blender a la web (finca, objetos y espantos), el script de Python, colliders por prefijo, física y jugador (3 min).
3. Jerónimo: la IA de estados, el silbido invertido, contras y ruido (3 min).
4. Yuly: demo en vivo en modo Museo y luego noche 3 (2 min).
5. Preguntas.

Cada uno debe poder explicar **su código y cómo se conecta con el de los otros** (los contratos y el bus de eventos).

---

## 21. Riesgos y plan B

| Riesgo | Plan B |
|---|---|
| La finca final no está a tiempo | Se juega con el blockout bien iluminado (con niebla y oscuridad casi no se nota) |
| Jacobo no alcanza a animar los espantos en Blender | Entrega los modelos quietos y Jerónimo los anima en código: flotar con seno, balanceo, escala; la bruja puede ser un modelo sin animación volando |
| La IA se traba en esquinas | Más waypoints, y si un espanto no avanza en 2 s, salta al siguiente waypoint |
| Bajan los FPS | Calidad baja: sin sombra de linterna, menos partículas, pixelRatio 1 |
| Un integrante se atrasa | Su sandbox y mocks permiten que los otros sigan; en la integración se recorta un bonus, nunca el MVP |
| Conflictos de Git | Cada quien en sus carpetas; `main.js` solo lo edita Yuly |
| El navegador bloquea audio o video | Todo arranca después del clic del menú |
