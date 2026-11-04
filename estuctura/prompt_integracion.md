# Prompt · Integración final del equipo

> Cómo usarlo: lo corre Yuly (con Jacobo y Jerónimo presentes o disponibles) en las fechas de integración del cronograma: domingo 8 (integración 1), domingo 15 (integración 2 / feature freeze) y lunes 16 a martes 17 (cierre). Abre el repo en la rama `develop` con las ramas de los tres ya fusionadas, abre Claude Code y pega todo lo que está debajo de la línea, indicando cuál integración es.

---

Eres el responsable técnico de integrar un proyecto universitario hecho por 3 desarrolladores en paralelo: el juego de terror para navegador **"Espantos: La Noche en la Vereda"** (Three.js 0.160.0 + Cannon-es + Vite). Jacobo hizo el mundo y el jugador (Etapa 1), Jerónimo los espantos (Etapa 2) y Yuly la experiencia de juego, modos y UI (Etapa 3).

Esta es la **integración número: [1 / 2 / final]**.

## Paso 1 · Contexto

Lee completo `PROYECTO_ESPANTOS.md`, que es la fuente de verdad. Luego revisa el estado real del repo.

## Paso 2 · Auditoría de contratos (no cambies nada todavía)

Revisa el código contra el documento y dame un informe con tres listas:

1. **Contratos (punto 9)**: para cada clase (`Bus`, `Engine`, `Physics`, `Loader`, `World`, `Player`, `Espanto`, `EspantoManager`, `GameManager`), qué métodos y propiedades existen, cuáles faltan y cuáles tienen otro nombre o forma.
2. **Eventos (punto 10)**: para cada evento, quién lo emite realmente, quién lo escucha, y si los datos coinciden con la tabla. Señala eventos emitidos que nadie escucha y escuchados que nadie emite.
3. **Convenciones de Blender (punto 11 y 11.1)**: carga `finca.glb` y cuenta los objetos por prefijo; dime cuáles faltan o están por debajo del mínimo. Carga también `duende.glb`, `bruja.glb` y `silbon.glb` y revisa escala, origen, orientación, polígonos y nombres de animaciones contra el 11.1 (todo el modelado es de Jacobo).

Clasifica cada problema como **bloqueante**, **importante** o **menor**, y dime de qué integrante es cada uno.

## Paso 3 · Correcciones

- Corrige los problemas de **integración** (pegamento entre módulos, `main.js`, nombres que no coinciden), explicando cada cambio.
- Si un problema está dentro del módulo de un integrante y no es de pegamento, **no lo reescribas**: déjame el texto listo para que yo se lo mande a esa persona (archivo, problema, cómo reproducirlo y sugerencia).
- Si un contrato del documento resultó mal diseñado, propón el cambio en `PROYECTO_ESPANTOS.md` y espera mi aprobación.

## Paso 4 · Prueba de humo

Guíame paso a paso para probar en el navegador, y revisa la consola conmigo:

- Integración 1: menú → Historia → noche 1 en la finca → caminar sin atravesar muros → un espanto patrulla, oye ruido, persigue → captura → jumpscare → respawn.
- Integración 2: además las 5 noches, los 5 modos, las contras, puertas con llave, escondites, portal, TV con video, guardado.
- Final: el checklist completo del punto 19.

## Paso 5 · Rendimiento (integración 2 y final)

Con `?debug`, medir FPS, `renderer.info.render.calls` y `triangles` en la sala, el patio y con los 3 espantos activos en la noche 5. Comparar con el presupuesto del punto 13 y proponer optimizaciones concretas ordenadas por impacto (sombras, partículas, colliders, raycasts de visión, pixelRatio, texturas). Verificar que el selector de calidad realmente cambie algo.

## Paso 6 · Build y entrega (solo en la final)

- `npm run build` y `npm run preview` sin errores, probar el build (no solo el dev server).
- Revisar que ningún archivo de `public/` tenga mayúsculas, espacios o tildes y que no haya assets sin usar que pesen.
- Revisar que `CREDITOS.md` tenga todos los assets y que `README.md` explique instalación, controles, modos y equipo.
- Dejar `main` con la versión final y un tag `v1.0`.

## Paso 7 · Resumen

Al final dame:
- Estado general (qué funciona, qué no).
- Lista de pendientes por integrante, en orden de prioridad.
- Qué recortar si no alcanza el tiempo (siempre bonus antes que MVP, según el punto 2).
