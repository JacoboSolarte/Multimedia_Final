# Créditos y licencias de los assets

Cada asset descargado se anota aquí con autor, link y licencia (punto 12 de `PROYECTO_ESPANTOS.md`).

## Jacobo · mundo, jugador y modelos

| Asset | Archivo | Autor | Licencia | Link |
|---|---|---|---|---|
| HDRI nocturno "Moonlit Golf" (1k) | `public/textures/noche.hdr` | Poly Haven | CC0 | https://polyhaven.com/a/moonlit_golf |
| Finca (blockout + arte low poly) | `public/models/finca.glb` | Equipo (Jacobo), generado con `tools/blender/generar_finca.py` | Propio | — |
| Duende, Bruja, Silbón | `public/models/espantos/*.glb` | Equipo (Jacobo), `tools/blender/generar_espantos.py` | Propio | — |
| Objetos (llave, pilas, ají, radio, látigo, tijeras, sal, panela, olla, botella, caja) | `public/models/objetos/*.glb` | Equipo (Jacobo), `tools/blender/generar_objetos.py` | Propio | — |
| Sonidos de jugador y mundo (pasos, salto, linterna, puertas, portal, recoger, golpe) | `public/sounds/jugador/`, `public/sounds/mundo/` | Equipo (Jacobo), sintetizados por código | Propio | — |

> Los sonidos de jugador y mundo son **provisionales** (síntesis simple). Si se cambian por sonidos
> descargados (Pixabay, Mixkit, Freesound), hay que anotarlos aquí y conservar los mismos nombres de archivo.

## Jerónimo · espantos

| Asset | Archivo | Autor | Licencia | Link |
|---|---|---|---|---|

## Yuly · ambiente, UI y videos

| Asset | Archivo | Autor | Licencia | Link |
|---|---|---|---|---|

### Assets de la integración de Yuly

| Asset | Archivo | Autor / procedencia | Licencia / uso |
|---|---|---|---|
| Grillos, viento, lluvia, trueno y latido | `public/sounds/ambiente/*.wav` (sin prefijo provisional) | Síntesis original realizada para el equipo | Propio |
| Grito estilizado, menú, victoria y derrota | `public/sounds/ui/*.wav` | Síntesis original realizada para el equipo | Propio |
| Sustitutos temporales de sonidos de espantos | `public/sounds/ambiente/provisional_*.wav` | Síntesis original de la integración; se sustituyen automáticamente al existir los MP3 de Jerónimo | Propio |
| Tres videos de leyendas | `public/video/leyenda_duende.mp4`, `leyenda_bruja.mp4`, `leyenda_silbon.mp4` | Imágenes de los modelos de Jacobo, cartelas y guiones originales; voz sintética local Microsoft Sabina, español de México (Windows SAPI) | Recursos visuales y textos propios del equipo; no se redistribuye el motor de voz |
| Guiones de narración | `public/video/guiones.json`, `src/data/leyendas.js` | Adaptaciones originales para el juego; la panela contra el Duende es una mecánica inventada | Propio |
| MatCap del museo | Generada en `src/game/bestiario.js` (DataTexture de 128 × 128) | Generación matemática original; sin textura externa descargada | Propio |

No se han recibido los MP3 definitivos de Jerónimo; la tabla de su etapa queda pendiente de que registre sus fuentes reales. Los sonidos provisionales no se atribuyen a bancos externos. Los videos son una primera versión completa con narración sintética; el equipo puede reemplazar la voz por una grabación propia conservando los nombres de archivo.
