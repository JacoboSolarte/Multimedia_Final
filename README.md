# Espantos: La Noche en la Vereda

Juego universitario de terror en primera persona para navegador, realizado con Three.js **0.160.0**, Cannon-es y Vite. Busca la llave del portón y escapa antes de las seis. Equipo: **Jacobo** (mundo y jugador), **Jerónimo** (espantos) y **Yuly** (experiencia e integración).

## Instalación y ejecución

Requiere Node.js compatible con Vite 5 y npm. Desde la raíz:

```sh
npm ci
npm run dev
```

Abre la dirección que muestra Vite. Para comprobar la versión compilada:

```sh
node --test src/game/integracion.test.js
npm run build
npm run preview
```

El proyecto funciona en un navegador de escritorio con WebGL. El primer clic del menú habilita el audio. En el inicio de cada noche se reproduce un relato; pulsa el botón o Espacio para comenzar. Si el navegador rechaza la captura del mouse, espera un momento y pulsa Continuar. No hay backend, cuentas ni instalación de base de datos.

## Modos y objetivo

- **Historia:** cinco noches, tres vidas por partida. Escapa con la llave antes de que termine cada noche (seis minutos reales). Superar la noche de un espanto desbloquea su figura en el museo.
- **Supervivencia:** una vida y sin salida. Duende al inicio, Bruja a los 90 s y Silbón a los 180 s. Desde los 270 s la velocidad y la escucha aumentan un 10 % por oleada. El récord es el tiempo sobrevivido.
- **Apagón:** las cinco noches sin linterna, con menos luz y mayor escucha.
- **Noche libre:** elige espantos y dificultad (0.8, 1 o 1.3). Puedes desmarcarlos todos para explorar sin enemigos.
- **Museo:** relatos, videos y modelos giratorios con MatCap y MeshPhysicalMaterial. Los espantos sin desbloquear se muestran como siluetas.

La captura resta una vida y deja el objeto activo donde estabas; el resto de la finca se conserva. El amanecer resta una vida y prepara la misma noche de nuevo. Cero vidas termina la partida. La pausa congela física, IA, batería, reloj y efectos, y silencia el audio del juego. El menú continúa renderizándose.

## Controles

| Acción | Control |
|---|---|
| Mover / mirar | WASD / mouse |
| Correr / agacharse / saltar | Shift / C / Espacio |
| Interactuar, recoger, abrir o esconderse | E |
| Seleccionar inventario | 1-4 o rueda |
| Soltar / lanzar objeto lanzable | Q / clic izquierdo |
| Linterna | F |
| Pausar y liberar mouse | Esc |
| Saltar el relato de inicio | Espacio o botón |

Las pilas recargan la linterna. La panela distrae al Duende (mecánica inventada para el juego). Sal o tijeras, con E junto a una ventana, la sellan contra la Bruja. El ají lanzado aturde al Silbón; la radio con ladridos y el látigo son sus otras contras. Su silbido suena más fuerte lejos y más suave cerca; sus pasos y huesos revelan la cercanía real.

## Opciones y guardado

Opciones permite cambiar volumen general, volumen de ambiente, sensibilidad y calidad. Calidad baja reduce partículas, pixel ratio y shadow maps, y desactiva la sombra de la linterna. Los récords, desbloqueos y opciones se guardan en localStorage (`espantos:v1`). Si el navegador bloquea o corrompe el almacenamiento, el juego continúa con valores válidos; no se guarda una partida a mitad de noche.

## Escenas y depuración

- `/`: juego completo con la finca y los espantos reales.
- `/?escena=flujo`: laboratorio del flujo sin depender de la finca; desde el menú inicia un modo. T emite captura, U recoge la llave del portón, Y emite salida con/sin llave e I emite ruido.
- `/?escena=espantos`: sandbox de Jerónimo, conservada con sus controles.
- `/?escena=modelos`: visor de Jacobo, conservado con sus controles.
- Añade `?debug` o `&debug` para lil-gui, FPS, llamadas y triángulos. La carpeta Juego permite preparar una noche y adelantar el reloj. En desarrollo existe `window.ctx` para inspección.

El arranque respeta las prioridades: jugador 10, física 20, mundo 30, espantos 40, reloj 50, ambiente y efectos 60, HUD 70 y render 100. Mundo y EspantoManager ya registran su propio update, por lo que no se duplica. El adaptador de arranque congela las prioridades de simulación durante menús, pausa e introducciones. Para reiniciar enemigos y multiplicadores usa la limpieza pública `EspantoManager.destruir()` ya existente; no modifica las clases de las otras etapas ni sus contratos. Los modelos y audios usan la caché del Loader.

## Videos y audio entregados

Los tres MP4 de `public/video/` tienen video H.264, audio AAC y resolución 1280 × 720; duran entre 38 y 41 segundos y pesan menos de 0.4 MB cada uno. Usan imágenes de los modelos de Jacobo, textos originales del equipo y voz sintética local Microsoft Sabina (español de México). `public/video/guiones.json` conserva las narraciones para reemplazarlas por una grabación humana si el equipo lo prefiere. La TV usa VideoTexture con SRGBColorSpace; también se muestra un reproductor durante la introducción.

Los WAV de ambiente y UI son síntesis original mono a 16 kHz. No se han entregado los MP3 de `public/sounds/espantos/` de Jerónimo: el adaptador usa los WAV `provisional_*` de la carpeta de ambiente mientras tanto. En cuanto existan los MP3 con los nombres del contrato, tendrán prioridad automáticamente. No se inventaron autores ni licencias de archivos ausentes. La ausencia de un asset de audio devuelve silencio sin repetir solicitudes fallidas.

## Verificación y límites

Las pruebas de `src/game/integracion.test.js` cubren las cinco noches y desbloqueos, pausa, captura duplicada, respawn sin reiniciar la finca, amanecer y derrota, oleadas, noche libre, museo, reloj y almacenamiento bloqueado/corrupto.

La prueba automatizada en Chrome recorre los modos, reproduce el video, comprueba física/IA/reloj congelados en pausa, captura/respawn, museo con ambos materiales y persistencia al recargar. Usa eventos controlados para avanzar noches; no equivale a completar las cinco noches caminando. Para automatizar clics se desactiva la captura del mouse y se adelanta el temporizador del jumpscare. Revisar manualmente la captura del mouse, el equilibrio de dificultad, cada contra y el recorrido completo sigue siendo necesario.

La revisión de modelos encontró finca con 36 waypoints, 23 spawns de items, 7 ventanas, 6 escondites, 7 velas y ruta de Bruja con 12 puntos. Hay unas 10 138 caras triangulares en la finca y menos de 1 000 por espanto; los tres modelos incluyen animaciones con los nombres esperados. Los efectos respetan lluvia <= 4 000, polvo <= 500, fuego 72 por vela y agua <= 250, con reducción por calidad. `public/` permanece por debajo de 40 MB.

Pendientes de revisión conjunta:

1. **Jerónimo:** reemplazar los sonidos provisionales por los MP3 definitivos, revisar el silbido invertido con audífonos y probar todas las contras.
2. **Jacobo y equipo:** comprobar con partidas manuales que las llaves de cuarto y del portón no queden inaccesibles por una cadena de puertas cerradas. El contrato actual de generarItems aleatoriza posiciones, sin garantizar accesibilidad.
3. **Todos:** medir 60 FPS en el portátil de la sustentación. Chrome automatizado usa renderizado por software y no sirve para certificar rendimiento de la GPU real. También falta la prueba cruzada en Linux.
4. El build avisa de un bundle principal mayor de 500 kB. Las herramientas de desarrollo se cargan por separado; el motor Three.js conserva la versión fija del contrato. No se modifican dependencias del equipo con actualizaciones forzadas.

## Checklist manual antes del merge

1. Completar Historia caminando desde la noche 1 a la 5; probar salida sin llave, captura, amanecer y derrota.
2. Caminar sin atravesar muros; usar cada puerta, escondite y ambos extremos del portal.
3. Probar las contras: panela, sal, tijeras, ají, radio y látigo; revisar los sonidos cerca/lejos.
4. Probar linterna y pilas, inventario lleno, soltar al capturarse, pausa y opciones.
5. Comprobar lluvia exterior, velas, pozo y tormenta de la noche 5 en las tres calidades.
6. Abrir la versión compilada con npm run preview; verificar consola, video con sonido y guardado al recargar.

## Git y entrega

Trabajar en `yuly`, sin push directo a `main`. La base de esta implementación incluye los PR de Jacobo y Jerónimo. Seguir el acuerdo del equipo: commits pequeños y PR de `yuly` hacia `main`, revisado por otro integrante antes del merge. Los requisitos están en `PROYECTO_ESPANTOS.md`; los prompts están en `estuctura/`.

Guion sugerido de demo (90-120 s): 0-15 s menú y objetivo; 15-40 s caminar, linterna, objetos, puerta y portal; 40-65 s cada espanto y su contra; 65-85 s pausa, opciones y modos; 85-110 s museo, dos materiales, video y guardado. Cerrar con los integrantes. El documento PDF corto se entrega aparte con concepto, mitos adaptados, reparto y mapa de temas de la materia.
