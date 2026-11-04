# generar_finca.py · Jacobo · Etapa 1
# Genera el BLOCKOUT de la finca con todos los prefijos del punto 11 de PROYECTO_ESPANTOS.md.
# Uso: pegar en la pestaña Scripting de Blender y darle Run (o: blender -b -P generar_finca.py).
# 1 unidad = 1 metro. Z arriba en Blender (al exportar con +Y Up queda Y arriba en Three.js).
#
# Distribución (vista de arriba, el frente de la casa mira hacia -Y, al patio y al portón):
#
#   y= 7 +---------+-----------------+---------+
#        | cuarto1 |  zaguan (rampa  | cuarto2 |
#        | (spawn) |  al atico arriba)+---------+
#        |         |                 |  bano   |
#   y= 0 +---------+--+-----------+--+---------+
#        |   sala     |  pasillo  |   cocina   |  (bajo la cocina: sotano, rampa en el lado este)
#        |   (TV)     |           |            |
#   y=-7 +------------+--puerta---+------------+
#        |               corredor              |
#   y=-9 +-------------------------------------+
#                 patio con pozo
#   y=-26 ------------- porton ----------------
#
#  x=-10      x=-4  x=-1  x=1  x=4             x=10

import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix, Euler

# ---------------------------------------------------------------- parametros
H = 3.2            # altura del primer piso (alto para que el Silbon de 2.8 m quepa)
G = 0.2            # grosor de muros y losas
PUERTA_ALTO = 2.6  # hueco de puertas (el Silbon roza, pero pasa)
VENT_Z = (1.0, 2.2)
Z_ATICO = H + G    # piso del atico (z = 3.4)
H_ATICO = 2.2      # muros del atico
Z_SOTANO = -3.0    # piso del sotano

# ---------------------------------------------------------------- limpiar escena
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for col in list(bpy.data.collections):
    bpy.data.collections.remove(col)
for bloque in (bpy.data.meshes, bpy.data.materials):
    for d in list(bloque):
        if d.users == 0:
            bloque.remove(d)

escena = bpy.context.scene
escena.unit_settings.system = 'METRIC'
escena.unit_settings.scale_length = 1.0


def coleccion(nombre):
    c = bpy.data.collections.new(nombre)
    escena.collection.children.link(c)
    return c


C_VISIBLE = coleccion('Visible')
C_COL = coleccion('Colliders')
C_PUERTAS = coleccion('Puertas')
C_VOL = coleccion('Volumenes')
C_EMPTIES = coleccion('Empties')
C_FISICOS = coleccion('Fisicos')

# ---------------------------------------------------------------- materiales (colores solidos)
def material(nombre, color, alpha=1.0, emision=0.0):
    m = bpy.data.materials.new(nombre)
    try:
        m.use_nodes = True  # en Blender 5 ya viene siempre con nodos
    except Exception:
        pass
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.9
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        for prop, valor in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
            try:
                setattr(m, prop, valor)
            except Exception:
                pass
    if emision > 0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emision
    m.diffuse_color = (*color, alpha)  # color en el viewport
    return m


MAT = {
    'muro':    material('mat_muro_encalado', (0.86, 0.84, 0.78)),
    'piso':    material('mat_piso_madera', (0.33, 0.21, 0.12)),
    'terreno': material('mat_terreno', (0.13, 0.22, 0.09)),
    'mueble':  material('mat_mueble', (0.42, 0.28, 0.16)),
    'puerta':  material('mat_puerta', (0.48, 0.24, 0.10)),
    'techo':   material('mat_teja', (0.50, 0.14, 0.07)),
    'cerca':   material('mat_cerca', (0.30, 0.25, 0.20)),
    'piedra':  material('mat_piedra', (0.40, 0.40, 0.42)),
    'rampa':   material('mat_rampa', (0.55, 0.35, 0.18)),
    'tv':      material('mat_tv_pantalla', (0.02, 0.02, 0.02)),
    'tv_caja': material('mat_tv_caja', (0.20, 0.13, 0.08)),
    'fisico':  material('mat_fisico', (0.85, 0.45, 0.10)),
    # volumenes (en el juego quedan invisibles, aqui se ven de colores para entender)
    'COL':     material('mat_COL', (1.0, 0.1, 0.1), alpha=0.25),
    'HIDE':    material('mat_HIDE', (0.1, 0.3, 1.0), alpha=0.35),
    'WIN':     material('mat_WIN', (0.1, 0.9, 0.9), alpha=0.35),
    'ZONE':    material('mat_ZONE', (1.0, 0.9, 0.1), alpha=0.08),
    'PORTAL':  material('mat_PORTAL', (0.7, 0.1, 1.0), alpha=0.4),
    'EXIT':    material('mat_EXIT', (0.1, 1.0, 0.2), alpha=0.4),
}

# ---------------------------------------------------------------- geometria visible combinada
# La geometria visible se junta en una malla por material (menos draw calls en Three.js).
_visibles = {}


def _bm(clave):
    if clave not in _visibles:
        _visibles[clave] = bmesh.new()
    return _visibles[clave]


def visible_caja(clave, centro, dims, rot=(0, 0, 0)):
    m = Matrix.LocRotScale(Vector(centro), Euler(rot).to_quaternion(), Vector(dims))
    bmesh.ops.create_cube(_bm(clave), size=1.0, matrix=m)


def visible_cilindro(clave, centro, radio, alto, segmentos=12, radio_arriba=None, tapas=True):
    m = Matrix.Translation(Vector(centro))
    bmesh.ops.create_cone(_bm(clave), cap_ends=tapas, segments=segmentos, radius1=radio,
                          radius2=radio if radio_arriba is None else radio_arriba,
                          depth=alto, matrix=m)


def visible_poligono(clave, puntos):
    bm = _bm(clave)
    vs = [bm.verts.new(p) for p in puntos]
    bm.faces.new(vs)


def malla_caja(nombre, dims, desplazamiento=(0, 0, 0)):
    me = bpy.data.meshes.new(nombre)
    bm = bmesh.new()
    m = Matrix.LocRotScale(Vector(desplazamiento), None, Vector(dims))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    bm.to_mesh(me)
    bm.free()
    return me


def objeto(nombre, me, loc, coleccion_destino, mat=None, rot=(0, 0, 0)):
    o = bpy.data.objects.new(nombre, me)
    o.location = loc
    o.rotation_euler = rot
    if mat:
        me.materials.append(mat)
    coleccion_destino.objects.link(o)
    return o


# ---------------------------------------------------------------- colliders y volumenes
_cuenta = {}


def nombre_unico(base):
    _cuenta[base] = _cuenta.get(base, 0) + 1
    return f'{base}_{_cuenta[base]:02d}'


def solido(base, centro, dims, clave_visible='muro', rot=(0, 0, 0)):
    """Caja solida: un COL_ (collider) + la misma caja en la malla visible.
    La escala va dentro de la malla (scale = 1) y la rotacion queda en el objeto,
    asi el codigo arma el CANNON.Box rotado."""
    nombre = nombre_unico('COL_' + base)
    objeto(nombre, malla_caja(nombre, dims), centro, C_COL, MAT['COL'], rot)
    bpy.data.objects[nombre].display_type = 'WIRE'
    if clave_visible:
        visible_caja(clave_visible, centro, dims, rot)


def solido_rango(base, x0, x1, y0, y1, z0, z1, clave_visible='muro'):
    solido(base, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
           (x1 - x0, y1 - y0, z1 - z0), clave_visible)


def volumen(nombre, x0, x1, y0, y1, z0, z1, tipo):
    dims = (x1 - x0, y1 - y0, z1 - z0)
    centro = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    o = objeto(nombre, malla_caja(nombre, dims), centro, C_VOL, MAT[tipo])
    o.display_type = 'WIRE'
    return o


def vacio(nombre, loc, tipo='PLAIN_AXES', tam=0.3):
    o = bpy.data.objects.new(nombre, None)
    o.empty_display_type = tipo
    o.empty_display_size = tam
    o.location = loc
    C_EMPTIES.objects.link(o)
    return o


def muro(base, eje, fijo, desde, hasta, z0, z1, aberturas=(), grosor=G, clave='muro'):
    """Muro recto con huecos. eje='x': corre a lo largo de X en y=fijo; eje='y': a lo largo de Y en x=fijo.
    aberturas: [(a, b, z_abajo, z_arriba)] sobre el eje del muro."""
    def caja(a, b, za, zb):
        if b - a < 0.01 or zb - za < 0.01:
            return
        if eje == 'x':
            solido_rango(base, a, b, fijo - grosor / 2, fijo + grosor / 2, za, zb, clave)
        else:
            solido_rango(base, fijo - grosor / 2, fijo + grosor / 2, a, b, za, zb, clave)

    cursor = desde
    for (a, b, za, zb) in sorted(aberturas):
        caja(cursor, a, z0, z1)        # tramo lleno antes del hueco
        caja(a, b, z0, za)             # antepecho (ventanas)
        caja(a, b, zb, z1)             # dintel
        cursor = b
    caja(cursor, hasta, z0, z1)


def puerta(pid, bisagra, eje, ancho, alto=PUERTA_ALTO - 0.05, grosor=0.08):
    """DOOR_<id> con el ORIGEN EN LA BISAGRA. eje='x' la hoja se extiende hacia +X desde la bisagra,
    eje='y' hacia +Y. (ancho negativo = hacia el lado contrario)."""
    if eje == 'x':
        dims, desp = (abs(ancho), grosor, alto), (ancho / 2, 0, alto / 2)
    else:
        dims, desp = (grosor, abs(ancho), alto), (0, ancho / 2, alto / 2)
    nombre = 'DOOR_' + pid
    return objeto(nombre, malla_caja(nombre, dims, desp), bisagra, C_PUERTAS, MAT['puerta'])


def fisico(tipo, loc):
    """PHYS_<tipo>: objeto tumbable/lanzable con escala real y origen en el centro."""
    nombre = nombre_unico('PHYS_' + tipo)
    me = bpy.data.meshes.new(nombre)
    bm = bmesh.new()
    if tipo == 'olla':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.13, radius2=0.13, depth=0.18)
    elif tipo == 'botella':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.04, radius2=0.04, depth=0.22,
                              matrix=Matrix.Translation((0, 0, -0.04)))
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.04, radius2=0.015, depth=0.08,
                              matrix=Matrix.Translation((0, 0, 0.11)))
    else:  # caja
        bmesh.ops.create_cube(bm, size=0.4)
    bm.to_mesh(me)
    bm.free()
    return objeto(nombre, me, loc, C_FISICOS, MAT['fisico'])


# ================================================================ TERRENO Y CERCA
# El terreno rodea la casa sin pasar por encima del sotano.
solido('terreno', (0, -17.5, -0.1), (40, 17, G), 'terreno')        # sur (patio y corredor)
solido('terreno', (0, 11.5, -0.1), (40, 9, G), 'terreno')          # norte
solido('terreno', (-15.1, -1, -0.1), (9.8, 16, G), 'terreno')      # oeste (incluye el lado del corredor)
solido('terreno', (15.1, -1, -0.1), (9.8, 16, G), 'terreno')       # este

muro('cerca', 'x', 16, -20, 20, 0, 2.5, clave=None)
muro('cerca', 'y', -20, -26, 16, 0, 2.5, clave=None)
muro('cerca', 'y', 20, -26, 16, 0, 2.5, clave=None)
muro('cerca', 'x', -26, -20, -2, 0, 2.5, clave=None)
muro('cerca', 'x', -26, 2, 20, 0, 2.5, clave=None)
solido('porton', (0, -26, 1.1), (4, 0.15, 2.2), 'puerta')             # el porton cerrado
volumen('EXIT_porton', -2, 2, -25.8, -24.2, 0, 2.5, 'EXIT')

# Pozo
visible_cilindro('piedra', (8, -17, 0.45), 0.9, 0.9, 12)
visible_caja('mueble', (8, -17.85, 1.4), (0.12, 0.12, 1.9))
visible_caja('mueble', (8, -16.15, 1.4), (0.12, 0.12, 1.9))
visible_caja('techo', (8, -17, 2.4), (1.6, 2.2, 0.08))
solido('pozo', (8, -17, 0.45), (1.8, 1.8, 0.9), None)
vacio('POZO_agua', (8, -17, 0.75), 'SPHERE', 0.5)

# ================================================================ CASA · PISOS
# Primer piso con hueco para la rampa del sotano (cocina, lado este)
solido('piso', (-0.75, 0, -0.1), (18.5, 14, G), 'piso')                   # x[-10, 8.5]
solido('piso', (9.25, 2.9, -0.1), (1.5, 8.2, G), 'piso')                  # x[8.5,10] y[-1.2,7]
solido('piso', (9.25, -6.9, -0.1), (1.5, 0.2, G), 'piso')
solido('piso', (0, -8, -0.1), (20.4, 2, G), 'piso')                       # corredor

# Sotano (bajo la cocina)
solido('piso_sotano', (5.5, -3.5, Z_SOTANO - G / 2), (9, 7, G), 'piedra')
for args in (('x', -7, 1, 10), ('x', 0, 1, 10), ('y', 1, -7, 0), ('y', 10, -7, 0)):
    muro('muro_sotano', args[0], args[1], args[2], args[3], Z_SOTANO, -G, clave='piedra')

# Rampa al sotano: de (y=-1.2, z=0) a (y=-6.8, z=-3)
largo = math.hypot(5.6, 3.0)
ang = math.atan2(3.0, 5.6)
n = Vector((0, -math.sin(ang), math.cos(ang)))  # normal de la rampa, para bajar la caja medio grosor
solido('rampa_sotano', Vector((9.25, -4.0, -1.5)) - n * (G / 2), (1.5, largo, G), 'rampa', (ang, 0, 0))
solido_rango('baranda_sotano', 8.4, 8.5, -6.8, -1.2, 0, 1.0, 'mueble')

# Piso del atico con hueco para la rampa (zaguan, lado norte)
solido('piso_atico', (0, -0.75, H + G / 2), (20, 12.5, G), 'piso')        # y[-7, 5.5]
solido('piso_atico', (-6.8, 6.25, H + G / 2), (6.4, 1.5, G), 'piso')      # x[-10,-3.6]
solido('piso_atico', (6.3, 6.25, H + G / 2), (7.4, 1.5, G), 'piso')       # x[2.6,10]

# Rampa al atico: de (x=-3.6, z=0) a (x=2.6, z=3.4)
largo = math.hypot(6.2, Z_ATICO)
ang = math.atan2(Z_ATICO, 6.2)
n = Vector((-math.sin(ang), 0, math.cos(ang)))
solido('rampa_atico', Vector((-0.5, 6.25, Z_ATICO / 2)) - n * (G / 2), (largo, 1.4, G), 'rampa', (0, -ang, 0))
solido_rango('baranda_atico', -3.6, 2.6, 5.35, 5.45, Z_ATICO, Z_ATICO + 1.0, 'mueble')
solido_rango('baranda_atico', -3.7, -3.6, 5.45, 7, Z_ATICO, Z_ATICO + 1.0, 'mueble')
# Muro bajo la rampa (alli no cabe nadie de pie)
muro('muro', 'x', 5.4, -1.5, 4, 0, H)

# ================================================================ CASA · MUROS PRIMER PISO
P = lambda a, b: (a, b, 0, PUERTA_ALTO)       # hueco de puerta
V = lambda a, b: (a, b, VENT_Z[0], VENT_Z[1])  # hueco de ventana

# Exteriores
muro('muro', 'x', -7, -10.1, 10.1, 0, H, [P(-0.5, 0.5), V(-7, -5.5), V(5, 6.5)])
muro('muro', 'x', 7, -10.1, 10.1, 0, H)
muro('muro', 'y', -10, -7, 7, 0, H, [V(-4, -2.5), V(3, 4.5)])
muro('muro', 'y', 10, -7, 7, 0, H, [V(0.7, 1.8), V(4, 5.5)])
# Interiores
muro('muro', 'y', -1, -7, 0, 0, H, [P(-3.5, -2.5)])     # sala | pasillo
muro('muro', 'y', 1, -7, 0, 0, H, [P(-3.5, -2.5)])      # pasillo | cocina
muro('muro', 'x', 0, -10, -1, 0, H)                     # sala | cuarto1 y zaguan
muro('muro', 'x', 0, 1, 10, 0, H)                       # cocina | zaguan y bano
muro('muro', 'y', -4, 0, 7, 0, H, [P(1.5, 2.5)])        # cuarto1 | zaguan
muro('muro', 'y', 4, 0, 2.5, 0, H, [P(0.8, 1.8)])       # bano | zaguan
muro('muro', 'y', 4, 2.5, 7, 0, H, [P(3.5, 4.5)])       # cuarto2 | zaguan
muro('muro', 'x', 2.5, 4, 10, 0, H)                     # bano | cuarto2

# Atico (muros perimetrales bajos y techo a dos aguas solo visible)
muro('muro_atico', 'x', -7, -10.1, 10.1, Z_ATICO, Z_ATICO + H_ATICO)
muro('muro_atico', 'x', 7, -10.1, 10.1, Z_ATICO, Z_ATICO + H_ATICO)
muro('muro_atico', 'y', -10, -7, 7, Z_ATICO, Z_ATICO + H_ATICO)
muro('muro_atico', 'y', 10, -7, 7, Z_ATICO, Z_ATICO + H_ATICO, [(-0.6, 0.6, Z_ATICO + 0.8, Z_ATICO + 1.6)])
z_alero = Z_ATICO + H_ATICO
cumbrera = 2.3
ang = math.atan2(cumbrera, 7.6)
largo = math.hypot(7.6, cumbrera)
visible_caja('techo', (0, -3.8, z_alero + cumbrera / 2), (21, largo, 0.15), (ang, 0, 0))
visible_caja('techo', (0, 3.8, z_alero + cumbrera / 2), (21, largo, 0.15), (-ang, 0, 0))
for x in (-10, 10):
    visible_poligono('muro', [(x, -7.1, z_alero), (x, 7.1, z_alero), (x, 0, z_alero + cumbrera)])
    visible_poligono('muro', [(x, 7.1, z_alero), (x, -7.1, z_alero), (x, 0, z_alero + cumbrera)])

# Corredor: techo y postes
visible_caja('techo', (0, -8.2, 3.0), (20.6, 2.6, 0.1))
for x in (-9.8, -5, 5, 9.8):
    solido('poste', (x, -8.8, 1.5), (0.15, 0.15, 3.0), 'mueble')

# ================================================================ PUERTAS (origen en la bisagra)
puerta('principal', (-0.5, -7, 0), 'x', 1.0)
puerta('sala', (-1, -3.5, 0), 'y', 1.0)
puerta('cocina', (1, -3.5, 0), 'y', 1.0)
puerta('cuarto1', (-4, 1.5, 0), 'y', 1.0)
puerta('bano', (4, 0.8, 0), 'y', 1.0)
puerta('cuarto2', (4, 3.5, 0), 'y', 1.0)
puerta('sotano', (8.5, -1.1, 0), 'x', 1.5)
puerta('atico', (2.7, 5.5, Z_ATICO), 'y', 1.5)

# ================================================================ MUEBLES GRANDES (COL_, la forma visible va en ARTE)
# Sala
solido_rango('sofa', -9.6, -6.6, -1.2, -0.3, 0, 0.8, None)
solido_rango('mesa_sala', -7, -5.5, -3.5, -2.5, 0, 0.45, None)
solido_rango('mueble_tv', -5, -3, -6.9, -6.3, 0, 0.7, None)
visible_caja('tv_caja', (-4, -6.6, 1.05), (1.1, 0.5, 0.7))  # televisor viejo
tv = bpy.data.meshes.new('TV_pantalla')
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5, calc_uvs=True)
bm.to_mesh(tv)
bm.free()
# Rotacion (90, 0, 180): la cara mira hacia +Y (hacia la sala) y la textura queda derecha
o = objeto('TV_pantalla', tv, (-4, -6.34, 1.05), C_VISIBLE, MAT['tv'], (math.radians(90), 0, math.radians(180)))
o.scale = (0.9, 0.55, 1)
# Cocina
solido_rango('fogon', 1.3, 4, -6.9, -6.1, 0, 0.9, None)
solido_rango('mesa_cocina', 4, 6.5, -4, -2.5, 0, 0.8, None)
# Cuarto 1 (spawn)
solido_rango('cama1', -9.7, -7.7, 4.5, 6.8, 0, 0.5, None)
solido_rango('mesita1', -9.8, -9.2, 3.6, 4.2, 0, 0.55, None)
solido_rango('armario1', -6.2, -4.3, 6.2, 6.85, 0, 2.0, None)
# Cuarto 2
solido_rango('cama2', 8, 9.8, 2.8, 4.5, 0, 0.5, None)
solido_rango('mesita2', 7.3, 7.9, 2.7, 3.3, 0, 0.55, None)
solido_rango('armario2', 5, 7, 6.2, 6.85, 0, 2.0, None)
# Bano
solido_rango('lavadero', 4.3, 5.5, 2.0, 2.35, 0, 0.9, None)
# Sotano
solido_rango('cajas_sotano', 1.3, 2.6, -6.8, -5.6, Z_SOTANO, Z_SOTANO + 1.2, None)
solido_rango('mesa_sotano', 2.5, 4, -3.5, -2.5, Z_SOTANO, Z_SOTANO + 0.9, None)
solido_rango('barriles', 5.8, 7.4, -0.9, -0.3, Z_SOTANO, Z_SOTANO + 1.1, None)
# Atico
solido_rango('baul', 6, 7.5, -6.6, -5.8, Z_ATICO, Z_ATICO + 0.6, None)
solido_rango('trastos_atico', -9.6, -8, 0, 2, Z_ATICO, Z_ATICO + 1.0, None)

# ================================================================ ESCONDITES (HIDE_ + HIDECAM_)
escondites = [
    ('cama1',    (-9.7, -7.7, 3.7, 4.5, 0, 1.6),     (-8.7, 5.6, 0.25)),   # debajo de la cama
    ('armario1', (-6.2, -4.3, 5.4, 6.2, 0, 2.0),     (-5.25, 6.5, 1.3)),
    ('armario2', (5, 7, 5.4, 6.2, 0, 2.0),           (6, 6.5, 1.3)),
    ('ducha',    (8.6, 9.9, 0.1, 1.3, 0, 2.0),       (9.5, 0.4, 1.3)),
    ('sotano',   (5.8, 7.4, -1.9, -1.0, Z_SOTANO, Z_SOTANO + 1.8), (6.6, -0.6, Z_SOTANO + 0.7)),
    ('baul',     (6, 7.5, -5.8, -5.0, Z_ATICO, Z_ATICO + 1.6), (6.75, -6.2, Z_ATICO + 0.4)),
]
for hid, (x0, x1, y0, y1, z0, z1), cam in escondites:
    volumen('HIDE_' + hid, x0, x1, y0, y1, z0, z1, 'HIDE')
    vacio('HIDECAM_' + hid, cam, 'CONE', 0.25)

# ================================================================ VENTANAS (WIN_): volumen adentro, frente a cada hueco
ventanas = [
    ('sala_1',    (-7.1, -5.4, -6.9, -5.9)),
    ('sala_2',    (-9.9, -8.9, -4.1, -2.4)),
    ('cocina_1',  (4.9, 6.6, -6.9, -5.9)),
    ('cuarto1',   (-9.9, -8.9, 2.9, 4.6)),
    ('cuarto2_1', (8.9, 9.9, 3.9, 5.6)),
    ('bano',      (8.9, 9.9, 0.6, 1.9)),
    ('atico_e',   (8.9, 9.9, -1, 1)),     # ventanita del atico (hueco abajo)
]
for wid, (x0, x1, y0, y1) in ventanas:
    z0 = Z_ATICO if wid.startswith('atico') else 0
    volumen('WIN_' + wid, x0, x1, y0, y1, z0, z0 + 2.4, 'WIN')

# ================================================================ PORTAL (pasadizo sotano <-> atico)
volumen('PORTAL_sotano_A', 1.3, 2.6, -1.5, -0.3, Z_SOTANO, Z_SOTANO + 2.0, 'PORTAL')
volumen('PORTAL_sotano_B', -9.6, -8.3, -6.6, -5.3, Z_ATICO, Z_ATICO + 2.0, 'PORTAL')

# ================================================================ ZONAS
zonas = {
    'sala':     (-10, -1, -7, 0, 0, H),
    'pasillo':  (-1, 1, -7, 0, 0, H),
    'cocina':   (1, 10, -7, 0, 0, H),
    'cuarto1':  (-10, -4, 0, 7, 0, H),
    'zaguan':   (-4, 4, 0, 7, 0, H),
    'bano':     (4, 10, 0, 2.5, 0, H),
    'cuarto2':  (4, 10, 2.5, 7, 0, H),
    'sotano':   (1, 10, -7, 0, Z_SOTANO - 0.2, -0.01),
    'atico':    (-10, 10, -7, 7, H, H + 5),
    'corredor': (-10.5, 10.5, -9.5, -7, 0, 3),
    'patio':    (-20, 20, -26, -9.5, 0, 5),
}
for zid, r in zonas.items():
    volumen('ZONE_' + zid, *r, 'ZONE')

# ================================================================ EMPTIES: spawns
vacio('SPAWN_PLAYER', (-6.5, 3.5, 0), 'SINGLE_ARROW', 1.0)
vacio('SPAWN_DUENDE', (6, -1.5, 0), 'ARROWS', 0.6)
vacio('SPAWN_SILBON', (-6, -5, 0), 'ARROWS', 1.0)
vacio('SPAWN_BRUJA', (0, -18, 6), 'ARROWS', 1.0)

items = [
    (-6.25, -3, 0.5), (-9, -6, 0.05), (-4.5, -6.6, 0.75),          # sala
    (2.6, -6.5, 0.95), (5.2, -3.2, 0.85), (7.5, -6.3, 0.05),        # cocina
    (0, -1, 0.05), (3.5, 2, 0.05), (-3.5, 0.5, 0.05),               # pasillo y zaguan
    (-8.6, 5.6, 0.55), (-5, 0.6, 0.05),                             # cuarto1
    (8.9, 3.6, 0.55), (5, 6.0, 0.05),                               # cuarto2
    (5, 0.5, 0.05),                                                 # bano
    (2, -6.2, Z_SOTANO + 1.25), (6, -2.0, Z_SOTANO + 0.05), (5, -5, Z_SOTANO + 0.05),  # sotano
    (8, 6.2, Z_ATICO + 0.05), (-8.8, 1, Z_ATICO + 1.05), (2, -5, Z_ATICO + 0.05),      # atico
    (8, -8.5, 0.05), (-10, -15, 0.05), (12, -22, 0.05),             # corredor y patio
]
for p in items:
    vacio(nombre_unico('SPAWN_ITEM'), p, 'CUBE', 0.1)

# ================================================================ WAYPOINTS (interior) · vecinos los calcula Jeronimo
wps = [
    (-7, -5, 0), (-3, -5, 0), (-7, -2, 0), (-3, -1.5, 0),           # sala
    (0, -6, 0), (0, -3, 0), (0, -0.5, 0),                           # pasillo
    (3, -5, 0), (6, -5, 0), (3, -1.5, 0), (7.5, -1.5, 0),           # cocina
    (-2.5, 1.5, 0), (2.5, 1.5, 0), (-2.5, 4, 0), (2.5, 4, 0),       # zaguan
    (-6, 2, 0), (-7, 5, 0),                                         # cuarto1
    (6, 4, 0), (8, 6, 0), (6, 1.2, 0),                              # cuarto2 y bano
    (-6, -8, 0), (0, -8, 0), (6, -8, 0),                            # corredor
    (9.25, -0.6, 0), (9.25, -4, -1.5), (7.5, -6.2, Z_SOTANO),       # rampa sotano
    (6, -4, Z_SOTANO), (3, -1.8, Z_SOTANO), (4.5, -5.5, Z_SOTANO),  # sotano
    (-3.2, 6.25, 0), (-0.5, 6.25, 1.6), (3.6, 6.25, Z_ATICO),       # rampa atico
    (6, 3, Z_ATICO), (-6, 3, Z_ATICO), (-6, -4, Z_ATICO), (4, -3, Z_ATICO),  # atico
]
for i, p in enumerate(wps, 1):
    vacio(f'WP_{i:02d}', p, 'PLAIN_AXES', 0.4)

# Ruta de vuelo de la bruja: circulo alrededor de la casa, en orden
for i in range(12):
    a = 2 * math.pi * i / 12
    vacio(f'BRUJA_PATH_{i + 1:02d}', (16 * math.cos(a), 16 * math.sin(a) - 3, 6 + math.sin(3 * a)), 'SPHERE', 0.5)

# Velas
velas = [(-6.25, -2.7, 0.45), (5.8, -2.9, 0.8), (-9.5, 3.9, 0.55), (7.6, 3, 0.55),
         (3.25, -3, Z_SOTANO + 0.9), (0, -3, Z_ATICO), (0, -8.9, 0)]
for p in velas:
    vacio(nombre_unico('VELA'), p, 'SINGLE_ARROW', 0.2)

# ================================================================ OBJETOS FISICOS (PHYS_)
for tipo, p in [
    ('olla', (2.0, -6.5, 0.99)), ('olla', (3.2, -6.5, 0.99)), ('olla', (-8, -8.5, 0.09)),
    ('olla', (-2, 3, 0.09)),
    ('botella', (4.6, -3.0, 0.95)), ('botella', (6.0, -3.5, 0.95)), ('botella', (-6.8, -3.2, 0.6)),
    ('botella', (3.4, -2.8, Z_SOTANO + 1.05)), ('botella', (5.5, 5, 0.15)),
    ('caja', (7.5, -5.5, 0.2)), ('caja', (-9.3, -6.4, 0.2)), ('caja', (3.3, 6.0, 0.2)),
    ('caja', (4.5, -6.3, Z_SOTANO + 0.2)), ('caja', (-5, 3, Z_ATICO + 0.2)),
]:
    fisico(tipo, p)

# ================================================================ ARTE LOW POLY (Fase 6)
# Solo geometria visible (sin prefijo): los COL_ y todos los prefijos de arriba no cambian,
# asi el codigo del juego sigue funcionando igual. Estilo: finca paisa encalada con zocalo verde,
# carpinteria de madera, techo de teja, chambrana en el corredor, cerca de madera y arboles.
MAT.update({
    'zocalo':  material('mat_zocalo', (0.10, 0.32, 0.24)),
    'madera':  material('mat_madera_oscura', (0.26, 0.15, 0.08)),
    'tela':    material('mat_cobija', (0.50, 0.12, 0.10)),
    'blanco':  material('mat_almohada', (0.85, 0.82, 0.74)),
    'hierro':  material('mat_hierro', (0.08, 0.08, 0.08)),
    'teja2':   material('mat_teja_borde', (0.40, 0.11, 0.06)),
    'tronco':  material('mat_tronco', (0.28, 0.19, 0.11)),
    'hoja':    material('mat_hojas', (0.10, 0.26, 0.08)),
    'platano': material('mat_hoja_platano', (0.20, 0.38, 0.10)),
    'tierra':  material('mat_camino_tierra', (0.30, 0.22, 0.13)),
    'tinaja':  material('mat_barro', (0.50, 0.25, 0.12)),
})


def vr(clave, x0, x1, y0, y1, z0, z1, rot=(0, 0, 0)):
    """caja visible por rangos"""
    visible_caja(clave, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), rot)


def patas(x0, x1, y0, y1, z0, alto, g=0.06, clave='mueble'):
    for x in (x0 + g / 2, x1 - g / 2):
        for y in (y0 + g / 2, y1 - g / 2):
            vr(clave, x - g / 2, x + g / 2, y - g / 2, y + g / 2, z0, z0 + alto)


def mesa(x0, x1, y0, y1, z0, alto, clave='mueble'):
    vr(clave, x0, x1, y0, y1, z0 + alto - 0.05, z0 + alto)
    patas(x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04, z0, alto - 0.05, clave=clave)


def cama(x0, x1, y0, y1, cabecera_y):
    """cabecera_y: 'max' o 'min' (lado de la cabecera en Y)"""
    vr('mueble', x0, x1, y0, y1, 0.12, 0.3)
    patas(x0, x1, y0, y1, 0, 0.12, 0.08)
    vr('blanco', x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04, 0.3, 0.44)
    largo = y1 - y0
    if cabecera_y == 'max':
        vr('tela', x0 + 0.02, x1 - 0.02, y0 + 0.02, y0 + largo * 0.68, 0.44, 0.48)
        vr('blanco', x0 + 0.2, x1 - 0.2, y1 - 0.45, y1 - 0.1, 0.44, 0.54)
        vr('madera', x0, x1, y1, y1 + 0.06, 0, 1.0)
    else:
        vr('tela', x0 + 0.02, x1 - 0.02, y1 - largo * 0.68, y1 - 0.02, 0.44, 0.48)
        vr('blanco', x0 + 0.2, x1 - 0.2, y0 + 0.1, y0 + 0.45, 0.44, 0.54)
        vr('madera', x0, x1, y0 - 0.06, y0, 0, 1.0)


def armario(x0, x1, y0, y1):
    """las puertas miran a -Y (hacia el cuarto)"""
    vr('mueble', x0, x1, y0, y1, 0.08, 2.0)
    patas(x0, x1, y0, y1, 0, 0.08, 0.08)
    xm = (x0 + x1) / 2
    for a, b in ((x0 + 0.05, xm - 0.02), (xm + 0.02, x1 - 0.05)):
        vr('madera', a, b, y0 - 0.03, y0 - 0.01, 0.15, 1.92)
    for x in (xm - 0.07, xm + 0.05):
        vr('hierro', x, x + 0.02, y0 - 0.05, y0 - 0.03, 0.95, 1.1)
    vr('madera', x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03, 2.0, 2.06)


# ---- muebles (mismas medidas que sus COL_)
# sala: sofa contra el muro norte, mesa de centro, mueble del televisor
vr('tela', -9.6, -6.6, -1.2, -0.3, 0.12, 0.45)
vr('mueble', -9.6, -6.6, -0.5, -0.3, 0.12, 0.85)
for x in (-9.6, -6.75):
    vr('mueble', x, x + 0.15, -1.2, -0.3, 0.12, 0.65)
patas(-9.6, -6.6, -1.2, -0.3, 0, 0.12)
mesa(-7, -5.5, -3.5, -2.5, 0, 0.45)
vr('mueble', -5, -3, -6.9, -6.3, 0.1, 0.7)
patas(-5, -3, -6.9, -6.3, 0, 0.1)
for x in (-4.95, -4.0):
    vr('madera', x, x + 0.9, -6.33, -6.29, 0.18, 0.62)
vr('hierro', -3.65, -3.6, -6.45, -6.4, 1.4, 1.9, (0, 0.4, 0))   # antenas del televisor
vr('hierro', -4.4, -4.35, -6.45, -6.4, 1.4, 1.9, (0, -0.4, 0))
# cocina: fogon de lena con campana, mesa y repisa con tinajas
vr('piedra', 1.3, 4, -6.9, -6.1, 0, 0.75)
vr('madera', 1.25, 4.05, -6.95, -6.05, 0.75, 0.9)
for x in (2.0, 3.2):
    visible_cilindro('hierro', (x, -6.5, 0.91), 0.17, 0.02, 10)
vr('muro', 1.4, 3.9, -6.9, -6.3, 2.0, 2.3)
vr('muro', 2.3, 3.0, -6.9, -6.6, 2.3, H)
mesa(4, 6.5, -4, -2.5, 0, 0.8)
vr('madera', 4.5, 7.5, -6.9, -6.6, 1.6, 1.64)
for x in (5.0, 5.6, 6.3, 6.9):
    visible_cilindro('tinaja', (x, -6.75, 1.72), 0.09, 0.16, 8)
# cuartos
cama(-9.7, -7.7, 4.5, 6.8, 'max')
mesa(-9.8, -9.2, 3.6, 4.2, 0, 0.55)
armario(-6.2, -4.3, 6.2, 6.85)
cama(8, 9.8, 2.8, 4.5, 'min')
mesa(7.3, 7.9, 2.7, 3.3, 0, 0.55)
armario(5, 7, 6.2, 6.85)
# bano: lavadero de piedra, cortina de la ducha y tinaja
vr('piedra', 4.3, 5.5, 2.0, 2.35, 0, 0.75)
vr('piedra', 4.3, 5.5, 1.95, 2.35, 0.75, 0.9)
vr('hierro', 8.6, 9.9, 1.3, 1.33, 2.05, 2.08)
vr('tela', 8.6, 9.9, 1.3, 1.32, 0.3, 2.05)
visible_cilindro('tinaja', (6.5, 2.1, 0.3), 0.22, 0.6, 10)
# sotano: guacales apilados, mesa y barriles
for (x, y, z) in ((1.6, -6.5, 0), (2.25, -6.5, 0), (1.6, -5.9, 0), (2.25, -5.9, 0), (1.9, -6.2, 0.6)):
    vr('mueble', x - 0.29, x + 0.29, y - 0.29, y + 0.29, Z_SOTANO + z, Z_SOTANO + z + 0.58)
mesa(2.5, 4, -3.5, -2.5, Z_SOTANO, 0.9)
for x in (6.1, 6.6, 7.1):
    visible_cilindro('madera', (x, -0.6, Z_SOTANO + 0.55), 0.25, 1.1, 10)
    visible_cilindro('hierro', (x, -0.6, Z_SOTANO + 0.3), 0.255, 0.04, 10)
    visible_cilindro('hierro', (x, -0.6, Z_SOTANO + 0.8), 0.255, 0.04, 10)
# atico: baul con tapa, trastos, costales y vigas del techo
vr('madera', 6, 7.5, -6.6, -5.8, Z_ATICO, Z_ATICO + 0.5)
vr('mueble', 5.97, 7.53, -6.63, -5.77, Z_ATICO + 0.5, Z_ATICO + 0.6)
vr('hierro', 6.7, 6.8, -5.79, -5.76, Z_ATICO + 0.35, Z_ATICO + 0.5)
vr('mueble', -9.6, -8.8, 0, 0.8, Z_ATICO, Z_ATICO + 0.8)
vr('mueble', -8.8, -8.0, 0.2, 1.2, Z_ATICO, Z_ATICO + 0.5)
for (x, y) in ((-9.2, 1.4), (-8.5, 1.6)):
    visible_cilindro('rampa', (x, y, Z_ATICO + 0.4), 0.28, 0.8, 8, radio_arriba=0.18)
for x in (-8, -4, 0, 4, 8):
    vr('madera', x - 0.08, x + 0.08, -7, 7, z_alero - 0.15, z_alero)          # tirantes
    vr('madera', x - 0.06, x + 0.06, -0.06, 0.06, z_alero, z_alero + cumbrera)  # pendolon
vr('madera', -10, 10, -0.08, 0.08, z_alero + cumbrera - 0.15, z_alero + cumbrera - 0.02)  # cumbrera

# ---- zocalo verde por fuera de los muros del primer piso
Z0 = 0.9
e = G / 2 + 0.012
vr('zocalo', -10.1, -0.5, -7 - e - 0.012, -7 - e, 0, Z0)
vr('zocalo', 0.5, 10.1, -7 - e - 0.012, -7 - e, 0, Z0)
vr('zocalo', -10.1, 10.1, 7 + e, 7 + e + 0.012, 0, Z0)
vr('zocalo', -10 - e - 0.012, -10 - e, -7.1, 7.1, 0, Z0)
vr('zocalo', 10 + e, 10 + e + 0.012, -7.1, 7.1, 0, Z0)
# franja verde entre el primer piso y el atico
vr('zocalo', -10.15, 10.15, -7.14, -7.11, H - 0.1, H + 0.15)
vr('zocalo', -10.15, 10.15, 7.11, 7.14, H - 0.1, H + 0.15)

# ---- marcos de puertas
for eje, fijo, a, b in (('x', -7, -0.5, 0.5), ('y', -1, -3.5, -2.5), ('y', 1, -3.5, -2.5),
                        ('y', -4, 1.5, 2.5), ('y', 4, 0.8, 1.8), ('y', 4, 3.5, 4.5)):
    g = G / 2 + 0.03
    for (u0, u1, z0, z1) in ((a - 0.08, a, 0, PUERTA_ALTO + 0.08), (b, b + 0.08, 0, PUERTA_ALTO + 0.08),
                             (a - 0.08, b + 0.08, PUERTA_ALTO, PUERTA_ALTO + 0.08)):
        if eje == 'x':
            vr('madera', u0, u1, fijo - g, fijo + g, z0, z1)
        else:
            vr('madera', fijo - g, fijo + g, u0, u1, z0, z1)


# ---- ventanas: marco, barrotes y postigos abiertos por fuera
def ventana(eje, fijo, a, b, lado, z0=VENT_Z[0], z1=VENT_Z[1]):
    g = G / 2 + 0.03
    piezas = [(a - 0.07, a, z0 - 0.07, z1 + 0.07), (b, b + 0.07, z0 - 0.07, z1 + 0.07),
              (a, b, z0 - 0.07, z0), (a, b, z1, z1 + 0.07)]
    for k in range(1, 4):
        u = a + (b - a) * k / 4
        piezas.append((u - 0.012, u + 0.012, z0, z1))     # barrotes
    for (u0, u1, w0, w1) in piezas:
        if eje == 'x':
            vr('madera', u0, u1, fijo - g, fijo + g, w0, w1)
        else:
            vr('madera', fijo - g, fijo + g, u0, u1, w0, w1)
    ancho = (b - a) / 2
    f0 = fijo + lado * (G / 2 + 0.01)
    f1 = f0 + lado * 0.04
    f0, f1 = min(f0, f1), max(f0, f1)
    for (u0, u1) in ((a - 0.07 - ancho, a - 0.07), (b + 0.07, b + 0.07 + ancho)):
        if eje == 'x':
            vr('zocalo', u0, u1, f0, f1, z0, z1)
        else:
            vr('zocalo', f0, f1, u0, u1, z0, z1)


for v in (('x', -7, -7, -5.5, -1), ('x', -7, 5, 6.5, -1), ('y', -10, -4, -2.5, -1), ('y', -10, 3, 4.5, -1),
          ('y', 10, 0.7, 1.8, 1), ('y', 10, 4, 5.5, 1)):
    ventana(*v)
ventana('y', 10, -0.6, 0.6, 1, Z_ATICO + 0.8, Z_ATICO + 1.6)

# ---- techo de teja: hileras sobre cada agua y caballete
ang_t = math.atan2(cumbrera, 7.6)
for lado in (-1, 1):
    for k in range(14):
        d = 0.25 + k * 0.54                     # distancia desde el alero subiendo
        y = lado * (7.6 - d * math.cos(ang_t))
        z = z_alero + d * math.sin(ang_t) + 0.09
        visible_caja('teja2', (0, y, z), (21, 0.1, 0.05), (-lado * ang_t, 0, 0))
visible_caja('teja2', (0, 0, z_alero + cumbrera + 0.06), (21.2, 0.3, 0.12))

# ---- corredor: chambrana entre postes, banca y camino de tierra
for (xa, xb) in ((-9.8, -5), (5, 9.8)):
    solido_rango('chambrana', xa, xb, -8.86, -8.74, 0, 0.9, None)
    vr('madera', xa, xb, -8.86, -8.74, 0.84, 0.92)
    vr('madera', xa, xb, -8.84, -8.76, 0.08, 0.14)
    n = int((xb - xa) / 0.22)
    for k in range(1, n):
        x = xa + (xb - xa) * k / n
        vr('madera', x - 0.02, x + 0.02, -8.83, -8.77, 0.14, 0.84)
vr('madera', -10.3, 10.3, -9.45, -9.3, 2.82, 2.95)   # viga del alero del corredor
solido_rango('banca', -8.4, -6.4, -7.55, -7.15, 0, 0.45, None)
vr('mueble', -8.4, -6.4, -7.55, -7.15, 0.38, 0.45)
patas(-8.35, -6.45, -7.5, -7.2, 0, 0.38)
vr('tierra', -1.4, 1.4, -24.2, -9, 0.0, 0.012)


# ---- cerca de madera (el collider solido de 2.5 m ya existe; esto es lo que se ve)
def cerca_visible(eje, fijo, desde, hasta):
    n = max(1, int(abs(hasta - desde) / 2.0))
    for k in range(n + 1):
        u = desde + (hasta - desde) * k / n
        if eje == 'x':
            vr('tronco', u - 0.07, u + 0.07, fijo - 0.07, fijo + 0.07, 0, 1.7)
        else:
            vr('tronco', fijo - 0.07, fijo + 0.07, u - 0.07, u + 0.07, 0, 1.7)
    for z in (0.45, 0.95, 1.45):
        if eje == 'x':
            vr('cerca', desde, hasta, fijo - 0.03, fijo + 0.03, z, z + 0.08)
        else:
            vr('cerca', fijo - 0.03, fijo + 0.03, desde, hasta, z, z + 0.08)


cerca_visible('x', 16, -20, 20)
cerca_visible('y', -20, -26, 16)
cerca_visible('y', 20, -26, 16)
cerca_visible('x', -26, -20, -2.2)
cerca_visible('x', -26, 2.2, 20)
# porton: estantillos grandes, travesano y tablas en Z
for x in (-2.25, 2.25):
    vr('tronco', x - 0.15, x + 0.15, -26.15, -25.85, 0, 2.7)
vr('tronco', -2.4, 2.4, -26.12, -25.88, 2.55, 2.75)
for z in (0.3, 1.9):
    vr('madera', -2, 2, -26.12, -26.06, z, z + 0.14)
vr('madera', -1.9, 1.9, -26.13, -26.07, 1.05, 1.19, (0, -0.4, 0))

# ---- pozo: travesano, lazo y balde
vr('madera', 7.95, 8.05, -17.85, -16.15, 1.95, 2.05)
visible_cilindro('cerca', (8, -17, 1.4), 0.008, 1.1, 4)
visible_cilindro('hierro', (8, -17, 0.75), 0.12, 0.22, 8, radio_arriba=0.14)


# ---- arboles: mangos (copa redonda) y plataneras, con collider en el tronco
def mango(x, y, alto=3.2, copa=1.8):
    visible_cilindro('tronco', (x, y, alto / 2), 0.2, alto, 7, radio_arriba=0.14)
    bm = _bm('hoja')
    for (dx, dy, dz, r) in ((0, 0, 0, 1.0), (0.7, 0.3, -0.3, 0.7), (-0.6, -0.4, -0.2, 0.75), (0.1, -0.6, 0.4, 0.6)):
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0,
                                   matrix=Matrix.LocRotScale((x + dx * copa, y + dy * copa, alto + dz * copa),
                                                             None, (copa * r, copa * r, copa * r * 0.8)))
    solido_rango('arbol', x - 0.22, x + 0.22, y - 0.22, y + 0.22, 0, alto, None)


def platanera(x, y, alto=2.6):
    visible_cilindro('platano', (x, y, alto / 2), 0.13, alto, 6, radio_arriba=0.09)
    for k in range(6):
        a = k * math.pi / 3 + 0.3
        largo = 1.5
        cx, cy = x + math.cos(a) * largo * 0.45, y + math.sin(a) * largo * 0.45
        visible_caja('platano', (cx, cy, alto + 0.15), (largo, 0.35, 0.02), (0, -0.45, a))
    solido_rango('arbol', x - 0.15, x + 0.15, y - 0.15, y + 0.15, 0, alto, None)


for (x, y) in ((-15, -19), (14, -11), (-16, 9), (15, 10), (-3, 12), (-17, -3), (17, 0)):
    mango(x, y)
for (x, y) in ((-12, -24), (-6.5, -24.5), (6.5, -24.5), (12.5, -23.5), (18, -18), (-18, -12), (-9, 13.5), (8, 13.5), (18, 5)):
    platanera(x, y)

# ================================================================ volcar la geometria visible
for clave, bm in _visibles.items():
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    me = bpy.data.meshes.new('finca_' + clave)
    bm.to_mesh(me)
    bm.free()
    objeto('finca_' + clave, me, (0, 0, 0), C_VISIBLE, MAT[clave])

# Origen al centro de la geometria en todo menos puertas (regla 1 del punto 11).
# Los volumenes y colliders ya nacen con el origen en su centro.
bpy.ops.object.select_all(action='DESELECT')
for o in list(C_VISIBLE.objects) + list(C_FISICOS.objects):
    if o.name != 'TV_pantalla':
        o.select_set(True)
bpy.context.view_layer.objects.active = C_VISIBLE.objects[0]
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
# Aplicar escala (no rotacion) a la pantalla de la TV
bpy.ops.object.select_all(action='DESELECT')
tvo = bpy.data.objects['TV_pantalla']
tvo.select_set(True)
bpy.context.view_layer.objects.active = tvo
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.object.select_all(action='DESELECT')

# ================================================================ resumen en consola
prefijos = ['COL_', 'WP_', 'BRUJA_PATH_', 'SPAWN_PLAYER', 'SPAWN_ITEM_', 'SPAWN_DUENDE', 'SPAWN_BRUJA',
            'SPAWN_SILBON', 'DOOR_', 'HIDE_', 'HIDECAM_', 'WIN_', 'PORTAL_', 'ZONE_', 'EXIT_', 'VELA_',
            'TV_', 'POZO_', 'PHYS_']
print('\n========== FINCA BLOCKOUT ==========')
for pre in prefijos:
    print(f'{pre:<14} {sum(1 for o in bpy.data.objects if o.name.startswith(pre)):>4}')
tris_vis = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects
               if o.type == 'MESH' and not o.name.split('_')[0] in ('COL', 'HIDE', 'WIN', 'PORTAL', 'ZONE', 'EXIT'))
tris_tot = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print(f'Triangulos visibles: {tris_vis}   (presupuesto finca < 35.000)')
print(f'Triangulos totales (con colliders y volumenes): {tris_tot}')
print(f'Objetos totales: {len(bpy.data.objects)}')
print('====================================\n')

# ================================================================ exportar (opcional, automatico si se conoce la ruta)
# Si se corre desde consola: blender -b -P tools/blender/generar_finca.py  -> exporta solo.
RAIZ = os.environ.get('ESPANTOS_ROOT')
if not RAIZ and '__file__' in globals() and os.path.isfile(__file__):
    RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if RAIZ:
    destino = os.path.join(RAIZ, 'public', 'models', 'finca.glb')
    bpy.ops.export_scene.gltf(filepath=destino, export_format='GLB', export_yup=True,
                              export_apply=False, export_lights=False, export_cameras=False,
                              export_materials='EXPORT', export_animations=False)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RAIZ, 'tools', 'blender', 'fuentes', 'finca_blockout.blend'))
    print('Exportado:', destino)

# ================================================================ COMO EXPORTAR A MANO (punto 11)
# 1. (Ya hecho por el script) origen al centro en todo menos DOOR_ (origen en la bisagra) y escala aplicada.
#    En los COL_ NO se aplica la rotacion: las rampas COL_rampa_* van rotadas a proposito.
# 2. File > Export > glTF 2.0 (.glb/.gltf)
#      Format: glTF Binary (.glb)
#      Include: sin marcar "Selected Objects" (exporta todo, incluidos los Empties)
#               desmarcar Punctual Lights y Cameras
#      Transform: +Y Up marcado
#      Data > Mesh: Apply Modifiers marcado
#      Material: Export
#      Animation: desmarcado (la finca no tiene animaciones)
# 3. Guardar como public/models/finca.glb
# 4. Guardar el .blend en tools/blender/fuentes/finca_blockout.blend
