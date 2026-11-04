# tools/blender · Jacobo

Scripts de Blender (probados en Blender 5.2) que generan todo lo que se modela en el proyecto.

| Script | Genera | Salida |
|---|---|---|
| `generar_finca.py` | Finca con todos los prefijos del punto 11: blockout + arte low poly (Fase 6) | `public/models/finca.glb`, `fuentes/finca_blockout.blend` |
| `generar_espantos.py` | Silbón, Duende y Bruja con rig y animaciones (punto 11.1) | `public/models/espantos/*.glb`, `fuentes/<espanto>.blend` |
| `generar_objetos.py` | llave, pilas, aji, radio, latigo, tijeras, sal, panela, olla, botella, caja | `public/models/objetos/*.glb`, `fuentes/objetos.blend` |

## Cómo correrlos

**Desde Blender:** pestaña *Scripting* > *Open* > el script > *Run Script*. Si el script se abre desde el disco,
exporta solo; si se pega a mano, arma la escena y se exporta con *File > Export > glTF 2.0* (instrucciones al final de cada script).

**Desde la consola** (exporta y guarda el .blend automáticamente):

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P tools/blender/generar_finca.py
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P tools/blender/generar_espantos.py -- todos
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P tools/blender/generar_objetos.py
```

## Finca blockout: lo que trae

| Prefijo | Cantidad | | Prefijo | Cantidad |
|---|---|---|---|---|
| `COL_` | 118 | | `WIN_` | 7 |
| `WP_` | 36 | | `PORTAL_sotano_A/B` | 2 |
| `BRUJA_PATH_` | 12 | | `ZONE_` | 11 |
| `SPAWN_ITEM_` | 23 | | `VELA_` | 7 |
| `DOOR_` | 8 | | `PHYS_` | 14 |
| `HIDE_` / `HIDECAM_` | 6 / 6 | | `SPAWN_PLAYER/DUENDE/BRUJA/SILBON`, `EXIT_porton`, `TV_pantalla`, `POZO_agua` | 1 c/u |

~8.400 triángulos visibles (presupuesto 35.000). La geometría visible va combinada en una malla por material
(`finca_muro`, `finca_piso`, ...) para tener pocos draw calls; los `COL_` son cajas aparte.

- Arte low poly (sección `ARTE LOW POLY` del script): muros encalados con zócalo verde, marcos, barrotes y postigos,
  techo de teja, chambrana del corredor, muebles con forma, cerca de madera, portón, pozo con balde, mangos y plataneras.
  Los muebles conservan su `COL_` en caja; lo que se ve va aparte, sin prefijo.
- Primer piso de 3.2 m (para que el Silbón de 2.8 m quepa), huecos de puerta de 2.6 m.
- Sótano bajo la cocina (rampa por el lado este, puerta `DOOR_sotano`), ático encima de toda la casa
  (rampa en el zaguán, puerta `DOOR_atico` arriba de la rampa). Rampas de ~28°: son `COL_rampa_*` **rotados**.
- Puertas: `principal, sala, cocina, cuarto1, bano, cuarto2, sotano, atico` (origen en la bisagra).
- Zonas: `sala, pasillo, cocina, cuarto1, zaguan, bano, cuarto2, sotano, atico, corredor, patio`.

## Espantos (para Jerónimo)

| | Alto | Triángulos | Animaciones |
|---|---|---|---|
| `silbon.glb` | 2.78 m | 852 + costal | `idle`, `caminar`, `correr`, `atrapar` |
| `duende.glb` | 0.90 m | 904 | `idle`, `caminar`, `correr`, `atrapar` |
| `bruja.glb` | 1.70 m | 704 | `idle`, `volar`, `atrapar` |

- Origen en los pies, frente a -Y en Blender = **+Z en Three.js**. Malla con skin (un esqueleto por espanto).
- `gltf.scene.getObjectByName('silbon_costal')`: el costal es un objeto aparte, pegado al hueso `torso`.
- Las animaciones son ciclos (`idle`, `caminar`, `correr`, `volar`); `atrapar` es de una sola vez (usar `LoopOnce` + `clampWhenFinished`).
- Si se clonan, usar `SkeletonUtils.clone()` (el modelo tiene skin).

## Objetos

Escala real, origen en el centro, todos < 400 triángulos. La llave sirve para `llave_porton` y las llaves de cuarto.

Todo está modelado por nosotros con primitivas; no hay assets descargados que anotar en `CREDITOS.md`.
