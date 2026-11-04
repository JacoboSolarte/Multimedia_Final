# generar_espantos.py · Jacobo · Etapa 1 (Fase 7)
# Arma con primitivas los 3 espantos low poly, con esqueleto y animaciones, segun el punto 11.1:
#   - 1 unidad = 1 metro. Duende ~0.9 m, Bruja ~1.7 m, Silbon ~2.8 m
#   - Origen en los PIES, centrado. Frente mirando hacia -Y en Blender (+Z en Three.js)
#   - < 5.000 poligonos cada uno
#   - Actions: idle, caminar, correr (bruja: idle, volar) + atrapar (opcional, para el jumpscare)
#   - El Silbon lleva su costal como objeto aparte: silbon_costal (pegado al hueso del torso)
#
# Uso en Blender: pestaña Scripting > Open este archivo > cambiar ESPANTO abajo > Run Script.
# Uso en consola: blender -b -P tools/blender/generar_espantos.py -- silbon   (o duende, bruja, todos)
# Si se conoce la ruta del proyecto, guarda el .blend en tools/blender/fuentes/ y exporta el .glb
# a public/models/espantos/.
#
# Piel rigida: cada pieza se pega al 100 % a un hueso (grupo de vertices con el nombre del hueso).
# Es lo mas estable para low poly y no falla como los "automatic weights" con piezas sueltas.

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix, Quaternion

ESPANTO = 'todos'   # 'silbon' | 'duende' | 'bruja' | 'todos'
FPS = 24

if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 1:
    ESPANTO = sys.argv[sys.argv.index('--') + 1]


# ================================================================ utilidades
def limpiar():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for bloque in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.actions):
        for d in list(bloque):
            bloque.remove(d)
    bpy.context.scene.render.fps = FPS


def material(nombre, color, emision=0.0):
    m = bpy.data.materials.new(nombre)
    try:
        m.use_nodes = True
    except Exception:
        pass
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.85
    if emision:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emision
    m.diffuse_color = (*color, 1.0)
    return m


def entre(a, b):
    """Matriz y largo para un cilindro que va del punto a al punto b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), d.length


class Cuerpo:
    """Junta todas las piezas en una sola malla. Cada pieza va a un hueso y a un material."""

    def __init__(self, nombre, materiales):
        self.nombre = nombre
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.verify()
        self.mats = list(materiales.keys())
        self.materiales = materiales
        self.grupos = []

    def _marcar(self, verts, hueso, mat):
        if hueso not in self.grupos:
            self.grupos.append(hueso)
        gi = self.grupos.index(hueso)
        mi = self.mats.index(mat)
        for v in verts:
            v[self.dl][gi] = 1.0
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = mi

    def cilindro(self, a, b, r1, r2, hueso, mat, seg=8, escala_y=1.0):
        m, largo = entre(a, b)
        if escala_y != 1.0:
            m = m @ Matrix.Diagonal((1, escala_y, 1, 1))
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2,
                                    depth=largo, matrix=m)
        self._marcar(res['verts'], hueso, mat)

    def esfera(self, centro, radio, hueso, mat, escala=(1, 1, 1), sub=2):
        m = Matrix.LocRotScale(Vector(centro), None, Vector(escala) * radio)
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0, matrix=m)
        self._marcar(res['verts'], hueso, mat)

    def caja(self, centro, dims, hueso, mat, rot=None):
        m = Matrix.LocRotScale(Vector(centro), rot, Vector(dims))
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._marcar(res['verts'], hueso, mat)

    def objeto(self):
        me = bpy.data.meshes.new(self.nombre)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for k in self.mats:
            me.materials.append(self.materiales[k])
        for p in me.polygons:
            p.use_smooth = False
        o = bpy.data.objects.new(self.nombre, me)
        bpy.context.scene.collection.objects.link(o)
        for g in self.grupos:
            o.vertex_groups.new(name=g)
        # pasar los pesos del bmesh a los grupos (bm.to_mesh ya los copia en la capa deform)
        return o


def crear_rig(nombre, huesos):
    """huesos: {nombre: (cabeza, cola, padre)}"""
    arm_data = bpy.data.armatures.new(nombre)
    arm = bpy.data.objects.new(nombre, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    arm.show_in_front = True
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for n, (h, t, padre) in huesos.items():
        b = arm_data.edit_bones.new(n)
        b.head, b.tail = Vector(h), Vector(t)
        b.roll = 0
    for n, (h, t, padre) in huesos.items():
        if padre:
            arm_data.edit_bones[n].parent = arm_data.edit_bones[padre]
            arm_data.edit_bones[n].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return arm


def pegar_al_rig(malla, arm):
    malla.parent = arm
    mod = malla.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm


def pegar_a_hueso(obj, arm, hueso):
    """Parent a un hueso sin que el objeto se mueva de donde esta."""
    bpy.context.view_layer.update()
    pb = arm.pose.bones[hueso]
    padre = arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    mundo = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = hueso
    obj.matrix_parent_inverse = padre.inverted()
    obj.matrix_world = mundo


# ---------------------------------------------------------------- animacion
# Los angulos se escriben en ejes del MUNDO (grados) y se convierten al espacio del hueso.
# Convenciones (el espanto mira a -Y):
#   hueso que apunta hacia abajo (piernas, brazos):  x negativo = la punta va hacia adelante
#   hueso que apunta hacia arriba (torso, cabeza):    x positivo = se inclina hacia adelante
#   z = girar a los lados.   y = inclinar hacia un costado / abrir brazos
def quat_mundo(pb, x=0.0, y=0.0, z=0.0):
    rest = pb.bone.matrix_local.to_3x3()
    inv = rest.inverted()
    q = Quaternion()
    for eje, ang in (((0, 0, 1), z), ((1, 0, 0), x), ((0, 1, 0), y)):
        if ang:
            q = q @ Quaternion(inv @ Vector(eje), math.radians(ang))
    return q


def accion(arm, nombre, duracion, claves, subir=None):
    """claves: {hueso: [(frame, (x, y, z)), ...]}. subir: [(frame, dz)] mueve el hueso raiz en altura.
    Todos los huesos quedan con clave en el primer y ultimo frame para que una accion no 'herede' la pose de otra."""
    act = bpy.data.actions.new(nombre)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    raiz = arm.pose.bones[0]
    for pb in arm.pose.bones:
        lista = claves.get(pb.name) or [(0, (0, 0, 0)), (duracion, (0, 0, 0))]
        for f, (x, y, z) in lista:
            pb.rotation_quaternion = quat_mundo(pb, x, y, z)
            pb.keyframe_insert('rotation_quaternion', frame=f)
        pb.location = (0, 0, 0)
        if pb is not raiz:
            pb.keyframe_insert('location', frame=0)
    for f, dz in (subir or [(0, 0), (duracion, 0)]):
        # el hueso raiz apunta hacia arriba: su eje Y local es la altura del mundo
        raiz.location = (0, dz, 0)
        raiz.keyframe_insert('location', frame=f)
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, duracion
    act.use_cyclic = nombre != 'atrapar'
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = (0, 0, 0)
    return act


def ciclo(valores, duracion):
    """[(fraccion, valor)] -> [(frame, valor)]"""
    return [(round(f * duracion), v) for f, v in valores]


def anim_caminar(duracion, piernas=25, rodilla=40, brazos=18, codo=-10, torso=0, bob=0.03, prefijo_brazo='brazo'):
    """Ciclo de caminar generico: pierna y brazo contrarios, rodilla doblada cuando la pierna avanza."""
    P, R, B, T = piernas, rodilla, brazos, torso
    k = {
        'muslo_L': ciclo([(0, (-P, 0, 0)), (0.5, (P, 0, 0)), (1, (-P, 0, 0))], duracion),
        'muslo_R': ciclo([(0, (P, 0, 0)), (0.5, (-P, 0, 0)), (1, (P, 0, 0))], duracion),
        'pierna_L': ciclo([(0, (5, 0, 0)), (0.25, (12, 0, 0)), (0.5, (5, 0, 0)), (0.75, (R, 0, 0)), (1, (5, 0, 0))], duracion),
        'pierna_R': ciclo([(0, (5, 0, 0)), (0.25, (R, 0, 0)), (0.5, (5, 0, 0)), (0.75, (12, 0, 0)), (1, (5, 0, 0))], duracion),
        prefijo_brazo + '_L': ciclo([(0, (B, 0, 0)), (0.5, (-B, 0, 0)), (1, (B, 0, 0))], duracion),
        prefijo_brazo + '_R': ciclo([(0, (-B, 0, 0)), (0.5, (B, 0, 0)), (1, (-B, 0, 0))], duracion),
        'antebrazo_L': [(0, (codo, 0, 0)), (duracion, (codo, 0, 0))],
        'antebrazo_R': [(0, (codo, 0, 0)), (duracion, (codo, 0, 0))],
        'torso': ciclo([(0, (T, 0, -4)), (0.5, (T, 0, 4)), (1, (T, 0, -4))], duracion),
    }
    subir = ciclo([(0, -bob), (0.25, 0), (0.5, -bob), (0.75, 0), (1, -bob)], duracion)
    return k, subir


def anim_atrapar(duracion=20):
    return {
        'torso': [(0, (0, 0, 0)), (8, (22, 0, 0)), (duracion, (18, 0, 0))],
        'cabeza': [(0, (0, 0, 0)), (8, (-15, 0, 0)), (duracion, (-10, 0, 0))],
        'brazo_L': [(0, (0, 0, 0)), (8, (-85, -15, 0)), (duracion, (-80, -10, 0))],
        'brazo_R': [(0, (0, 0, 0)), (8, (-85, 15, 0)), (duracion, (-80, 10, 0))],
        'antebrazo_L': [(0, (0, 0, 0)), (8, (-10, 0, 0)), (duracion, (-25, 0, 0))],
        'antebrazo_R': [(0, (0, 0, 0)), (8, (-10, 0, 0)), (duracion, (-25, 0, 0))],
    }


def huesos_humanoide(cadera_z, torso_z, cabeza_z, tope_z, hombro_x, hombro_z, codo_z, mano_z,
                     cadera_x, rodilla_z, pie_z, piernas=True, cabeza_y=0.0):
    h = {
        'cadera': ((0, 0, cadera_z), (0, 0, torso_z), None),
        'torso': ((0, 0, torso_z), (0, cabeza_y, cabeza_z), 'cadera'),
        'cabeza': ((0, cabeza_y, cabeza_z), (0, cabeza_y, tope_z), 'torso'),
    }
    for lado, s in (('L', 1), ('R', -1)):
        h['brazo_' + lado] = ((s * hombro_x, 0, hombro_z), (s * (hombro_x + 0.03), 0, codo_z), 'torso')
        h['antebrazo_' + lado] = ((s * (hombro_x + 0.03), 0, codo_z), (s * (hombro_x + 0.05), 0, mano_z), 'brazo_' + lado)
        if piernas:
            h['muslo_' + lado] = ((s * cadera_x, 0, cadera_z), (s * cadera_x, 0, rodilla_z), 'cadera')
            h['pierna_' + lado] = ((s * cadera_x, 0, rodilla_z), (s * cadera_x, 0, pie_z), 'muslo_' + lado)
    return h


# ================================================================ EL SILBON (~2.8 m, alto y flaco)
def silbon():
    M = {
        'piel': material('silbon_piel', (0.55, 0.55, 0.50)),
        'camisa': material('silbon_camisa', (0.24, 0.19, 0.13)),
        'pantalon': material('silbon_pantalon', (0.12, 0.10, 0.08)),
        'botas': material('silbon_botas', (0.07, 0.05, 0.04)),
        'sombrero': material('silbon_sombrero', (0.06, 0.05, 0.04)),
        'cinta': material('silbon_cinta', (0.35, 0.05, 0.03)),
        'ojos': material('silbon_ojos', (1.0, 0.15, 0.05), emision=4.0),
    }
    c = Cuerpo('silbon', M)
    # piernas larguisimas
    for s, L in ((1, 'L'), (-1, 'R')):
        x = 0.11 * s
        c.cilindro((x, 0, 1.47), (x, 0, 0.72), 0.06, 0.05, 'muslo_' + L, 'pantalon')
        c.esfera((x, 0, 0.72), 0.05, 'muslo_' + L, 'pantalon', sub=1)
        c.cilindro((x, 0, 0.72), (x, 0, 0.07), 0.045, 0.04, 'pierna_' + L, 'pantalon')
        c.caja((x, -0.06, 0.045), (0.1, 0.28, 0.09), 'pierna_' + L, 'botas')
    c.caja((0, 0, 1.47), (0.34, 0.18, 0.18), 'cadera', 'pantalon')
    # torso flaco, un poco jorobado
    c.cilindro((0, 0, 1.47), (0, 0.02, 2.28), 0.12, 0.17, 'torso', 'camisa', seg=8, escala_y=0.65)
    c.caja((0, 0.015, 2.25), (0.46, 0.14, 0.07), 'torso', 'camisa')            # hombros huesudos
    c.cilindro((0, 0.02, 2.26), (0, 0.0, 2.38), 0.035, 0.035, 'cabeza', 'piel', seg=6)
    # cabeza alargada, ojos rojos
    c.esfera((0, -0.01, 2.47), 0.115, 'cabeza', 'piel', escala=(0.8, 0.9, 1.2))
    c.esfera((0.04, -0.095, 2.48), 0.018, 'cabeza', 'ojos', sub=1)
    c.esfera((-0.04, -0.095, 2.48), 0.018, 'cabeza', 'ojos', sub=1)
    c.cilindro((0, -0.1, 2.45), (0, -0.14, 2.42), 0.018, 0.005, 'cabeza', 'piel', seg=5)  # nariz
    # sombrero de ala ancha (llanero)
    c.cilindro((0, -0.01, 2.56), (0, -0.01, 2.585), 0.33, 0.33, 'cabeza', 'sombrero', seg=14)
    c.cilindro((0, -0.01, 2.585), (0, -0.01, 2.78), 0.14, 0.11, 'cabeza', 'sombrero', seg=10)
    c.cilindro((0, -0.01, 2.585), (0, -0.01, 2.62), 0.145, 0.145, 'cabeza', 'cinta', seg=10)
    # brazos largos hasta las rodillas
    for s, L in ((1, 'L'), (-1, 'R')):
        c.esfera((s * 0.23, 0.01, 2.22), 0.05, 'brazo_' + L, 'camisa', sub=1)
        c.cilindro((s * 0.23, 0, 2.22), (s * 0.26, 0, 1.62), 0.042, 0.035, 'brazo_' + L, 'camisa', seg=6)
        c.cilindro((s * 0.26, 0, 1.62), (s * 0.28, 0, 1.02), 0.033, 0.028, 'antebrazo_' + L, 'piel', seg=6)
        c.esfera((s * 0.285, -0.01, 0.95), 0.05, 'antebrazo_' + L, 'piel', escala=(0.45, 0.6, 1.5), sub=1)
    cuerpo = c.objeto()

    huesos = huesos_humanoide(cadera_z=1.45, torso_z=1.6, cabeza_z=2.3, tope_z=2.62,
                              hombro_x=0.23, hombro_z=2.22, codo_z=1.62, mano_z=1.0,
                              cadera_x=0.11, rodilla_z=0.72, pie_z=0.07)
    arm = crear_rig('silbon_rig', huesos)
    pegar_al_rig(cuerpo, arm)

    # costal: objeto aparte, colgado a la espalda sobre el hombro derecho
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0,
                               matrix=Matrix.LocRotScale((0, 0, 0), None, (0.24, 0.2, 0.32)))
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.06, radius2=0.1, depth=0.14,
                          matrix=Matrix.Translation((0, 0, 0.36)))
    for i, (x, z) in enumerate(((0.12, 0.1), (-0.1, -0.05), (0.05, -0.2))):   # bultos de huesos
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0,
                                   matrix=Matrix.LocRotScale((x, 0.09, z), None, (0.09, 0.08, 0.07)))
    m, largo = entre((0.08, -0.05, 0.42), (0.28, -0.26, 0.18))   # correa sobre el hombro
    bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.015, radius2=0.015, depth=largo, matrix=m)
    me = bpy.data.meshes.new('silbon_costal')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material('silbon_costal', (0.52, 0.42, 0.28)))
    costal = bpy.data.objects.new('silbon_costal', me)
    bpy.context.scene.collection.objects.link(costal)
    costal.location = (-0.16, 0.26, 1.98)
    costal.rotation_euler = (math.radians(-10), math.radians(12), 0)
    pegar_a_hueso(costal, arm, 'torso')

    # animaciones
    accion(arm, 'idle', 48, {
        'torso': [(0, (6, 0, 0)), (24, (9, 0, 0)), (48, (6, 0, 0))],
        'cabeza': [(0, (5, 0, -12)), (24, (8, 0, 12)), (48, (5, 0, -12))],
        'brazo_L': [(0, (2, 0, 0)), (24, (-3, 0, 0)), (48, (2, 0, 0))],
        'brazo_R': [(0, (-2, 0, 0)), (24, (3, 0, 0)), (48, (-2, 0, 0))],
    }, subir=[(0, 0), (24, -0.015), (48, 0)])
    k, sub = anim_caminar(36, piernas=22, rodilla=38, brazos=14, codo=-8, torso=10, bob=0.04)
    k['cabeza'] = [(0, (-6, 0, 0)), (36, (-6, 0, 0))]
    accion(arm, 'caminar', 36, k, sub)
    k, sub = anim_caminar(16, piernas=45, rodilla=75, brazos=40, codo=-45, torso=22, bob=0.08)
    k['cabeza'] = [(0, (-15, 0, 0)), (16, (-15, 0, 0))]
    accion(arm, 'correr', 16, k, sub)
    accion(arm, 'atrapar', 20, anim_atrapar(20))
    return arm, [cuerpo, costal]


# ================================================================ EL DUENDE (~0.9 m, sombrero enorme, pies al reves)
def duende():
    M = {
        'piel': material('duende_piel', (0.58, 0.42, 0.30)),
        'ruana': material('duende_ruana', (0.50, 0.10, 0.07)),
        'pantalon': material('duende_pantalon', (0.14, 0.24, 0.11)),
        'pies': material('duende_pies', (0.45, 0.32, 0.22)),
        'sombrero': material('duende_sombrero', (0.62, 0.50, 0.28)),
        'cinta': material('duende_cinta', (0.08, 0.06, 0.04)),
        'barba': material('duende_barba', (0.70, 0.68, 0.62)),
        'ojos': material('duende_ojos', (1.0, 0.85, 0.1), emision=4.0),
    }
    c = Cuerpo('duende', M)
    for s, L in ((1, 'L'), (-1, 'R')):
        x = 0.07 * s
        c.cilindro((x, 0, 0.31), (x, 0, 0.17), 0.038, 0.034, 'muslo_' + L, 'pantalon', seg=6)
        c.cilindro((x, 0, 0.17), (x, 0, 0.04), 0.032, 0.028, 'pierna_' + L, 'pantalon', seg=6)
        # PIES AL REVES: los dedos apuntan hacia atras (+Y)
        c.caja((x, 0.045, 0.022), (0.065, 0.13, 0.045), 'pierna_' + L, 'pies')
        for d in (-0.018, 0.0, 0.018):
            c.esfera((x + d, 0.11, 0.02), 0.013, 'pierna_' + L, 'pies', sub=1)
    c.esfera((0, 0, 0.32), 0.1, 'cadera', 'pantalon', escala=(1.15, 0.9, 0.7))
    c.esfera((0, 0, 0.44), 0.15, 'torso', 'ruana', escala=(1, 0.85, 1.0))           # barrigon con ruana
    c.cilindro((0, 0, 0.56), (0, 0, 0.47), 0.09, 0.19, 'torso', 'ruana', seg=10)   # la ruana cae de los hombros
    # cabeza con narizota, orejas puntiagudas y barba
    c.esfera((0, -0.01, 0.64), 0.105, 'cabeza', 'piel', escala=(1, 0.95, 1.05))
    c.cilindro((0, -0.09, 0.64), (0, -0.16, 0.615), 0.028, 0.008, 'cabeza', 'piel', seg=6)
    for s in (1, -1):
        c.cilindro((s * 0.09, 0, 0.65), (s * 0.17, 0.02, 0.7), 0.025, 0.002, 'cabeza', 'piel', seg=4)
        c.esfera((s * 0.04, -0.09, 0.665), 0.016, 'cabeza', 'ojos', sub=1)
    c.cilindro((0, -0.06, 0.6), (0, -0.09, 0.47), 0.075, 0.01, 'cabeza', 'barba', seg=8)
    # sombrero GRANDE de ala ancha (mas ancho que todo el cuerpo)
    c.cilindro((0, -0.01, 0.715), (0, -0.01, 0.735), 0.37, 0.37, 'cabeza', 'sombrero', seg=16)
    c.cilindro((0, -0.01, 0.735), (0, 0.0, 0.9), 0.12, 0.05, 'cabeza', 'sombrero', seg=10)
    c.cilindro((0, -0.01, 0.735), (0, -0.01, 0.765), 0.122, 0.115, 'cabeza', 'cinta', seg=10)
    for s, L in ((1, 'L'), (-1, 'R')):
        c.esfera((s * 0.14, 0, 0.53), 0.04, 'brazo_' + L, 'ruana', sub=1)
        c.cilindro((s * 0.14, 0, 0.53), (s * 0.17, 0, 0.4), 0.03, 0.027, 'brazo_' + L, 'ruana', seg=6)
        c.cilindro((s * 0.17, 0, 0.4), (s * 0.19, 0, 0.29), 0.024, 0.022, 'antebrazo_' + L, 'piel', seg=6)
        c.esfera((s * 0.19, -0.005, 0.265), 0.032, 'antebrazo_' + L, 'piel', sub=1)
    cuerpo = c.objeto()

    huesos = huesos_humanoide(cadera_z=0.3, torso_z=0.36, cabeza_z=0.57, tope_z=0.78,
                              hombro_x=0.14, hombro_z=0.53, codo_z=0.4, mano_z=0.28,
                              cadera_x=0.07, rodilla_z=0.17, pie_z=0.04)
    arm = crear_rig('duende_rig', huesos)
    pegar_al_rig(cuerpo, arm)

    accion(arm, 'idle', 36, {
        'torso': [(0, (0, -5, 0)), (18, (3, 5, 0)), (36, (0, -5, 0))],
        'cabeza': [(0, (0, 8, -15)), (18, (-5, -8, 15)), (36, (0, 8, -15))],
        'brazo_L': [(0, (-10, -8, 0)), (18, (5, -12, 0)), (36, (-10, -8, 0))],
        'brazo_R': [(0, (5, 12, 0)), (18, (-10, 8, 0)), (36, (5, 12, 0))],
    }, subir=[(0, 0), (9, 0.02), (18, 0), (27, 0.02), (36, 0)])
    k, sub = anim_caminar(20, piernas=30, rodilla=45, brazos=30, codo=-20, torso=5, bob=0.02)
    accion(arm, 'caminar', 20, k, sub)
    k, sub = anim_caminar(12, piernas=50, rodilla=80, brazos=55, codo=-60, torso=25, bob=0.04)
    k['cabeza'] = [(0, (-20, 0, 0)), (12, (-20, 0, 0))]
    accion(arm, 'correr', 12, k, sub)
    accion(arm, 'atrapar', 20, anim_atrapar(20))
    return arm, [cuerpo]


# ================================================================ LA BRUJA (~1.7 m, ropa vieja de campo, pelo largo, sin escoba)
def bruja():
    M = {
        'piel': material('bruja_piel', (0.42, 0.47, 0.38)),
        'falda': material('bruja_falda', (0.20, 0.09, 0.10)),
        'blusa': material('bruja_blusa', (0.46, 0.42, 0.35)),
        'panolon': material('bruja_panolon', (0.07, 0.09, 0.07)),
        'pelo': material('bruja_pelo', (0.03, 0.03, 0.035)),
        'ojos': material('bruja_ojos', (0.75, 1.0, 0.15), emision=4.0),
        'unas': material('bruja_unas', (0.15, 0.12, 0.08)),
    }
    c = Cuerpo('bruja', M)
    # falda larga hasta el piso (no tiene piernas: flota y vuela)
    c.cilindro((0, 0.0, 0.03), (0, 0, 1.02), 0.32, 0.15, 'cadera', 'falda', seg=12)
    c.cilindro((0, 0.0, 0.0), (0, 0, 0.06), 0.33, 0.32, 'cadera', 'falda', seg=12)
    for s in (1, -1):
        c.caja((s * 0.07, -0.2, 0.025), (0.07, 0.14, 0.05), 'cadera', 'unas')       # pies descalzos asomando
    # torso un poco jorobado
    c.cilindro((0, 0, 1.0), (0, -0.04, 1.42), 0.15, 0.13, 'torso', 'blusa', seg=8, escala_y=0.75)
    c.cilindro((0, -0.02, 1.24), (0, -0.04, 1.44), 0.25, 0.1, 'torso', 'panolon', seg=10)   # panolon
    c.cilindro((0, -0.04, 1.42), (0, -0.06, 1.5), 0.035, 0.035, 'cabeza', 'piel', seg=6)
    # cabeza, nariz ganchuda, ojos verdes
    c.esfera((0, -0.06, 1.56), 0.1, 'cabeza', 'piel', escala=(0.82, 0.95, 1.12))
    c.cilindro((0, -0.14, 1.57), (0, -0.2, 1.53), 0.022, 0.004, 'cabeza', 'piel', seg=5)
    for s in (1, -1):
        c.esfera((s * 0.035, -0.135, 1.585), 0.015, 'cabeza', 'ojos', sub=1)
    # pelo largo: casquete en la cabeza + mechon largo por la espalda (con su propio hueso)
    c.esfera((0, -0.04, 1.6), 0.107, 'cabeza', 'pelo', escala=(0.88, 0.98, 0.95))
    c.cilindro((0, 0.02, 1.62), (0, 0.1, 1.0), 0.13, 0.07, 'pelo', 'pelo', seg=8, escala_y=0.45)
    for s in (1, -1):
        c.cilindro((s * 0.08, -0.06, 1.58), (s * 0.12, -0.04, 1.25), 0.03, 0.012, 'cabeza', 'pelo', seg=5)
    # brazos flacos con dedos largos
    for s, L in ((1, 'L'), (-1, 'R')):
        c.esfera((s * 0.17, 0, 1.39), 0.045, 'brazo_' + L, 'panolon', sub=1)
        c.cilindro((s * 0.17, 0, 1.39), (s * 0.2, 0, 1.12), 0.036, 0.03, 'brazo_' + L, 'blusa', seg=6)
        c.cilindro((s * 0.2, 0, 1.12), (s * 0.22, 0, 0.88), 0.028, 0.024, 'antebrazo_' + L, 'piel', seg=6)
        c.esfera((s * 0.222, -0.005, 0.85), 0.035, 'antebrazo_' + L, 'piel', escala=(0.5, 0.8, 1.1), sub=1)
        for d in (-0.02, 0.0, 0.02):
            c.cilindro((s * 0.222, -0.005 + d, 0.82), (s * 0.225, -0.01 + d * 1.5, 0.74), 0.007, 0.002,
                       'antebrazo_' + L, 'unas', seg=4)
    cuerpo = c.objeto()

    huesos = huesos_humanoide(cadera_z=0.95, torso_z=1.05, cabeza_z=1.45, tope_z=1.68,
                              hombro_x=0.17, hombro_z=1.39, codo_z=1.12, mano_z=0.86,
                              cadera_x=0, rodilla_z=0, pie_z=0, piernas=False, cabeza_y=-0.05)
    huesos['pelo'] = ((0, 0.03, 1.6), (0, 0.1, 1.02), 'cabeza')
    arm = crear_rig('bruja_rig', huesos)
    pegar_al_rig(cuerpo, arm)

    accion(arm, 'idle', 48, {
        'torso': [(0, (8, 0, 0)), (24, (12, 0, 0)), (48, (8, 0, 0))],
        'cabeza': [(0, (-5, 6, -10)), (24, (-2, -6, 10)), (48, (-5, 6, -10))],
        'pelo': [(0, (4, 0, 0)), (24, (10, 0, 3)), (48, (4, 0, 0))],
        'brazo_L': [(0, (-15, -10, 0)), (24, (-25, -14, 0)), (48, (-15, -10, 0))],
        'brazo_R': [(0, (-15, 10, 0)), (24, (-25, 14, 0)), (48, (-15, 10, 0))],
        'antebrazo_L': [(0, (-35, 0, 0)), (24, (-45, 0, 0)), (48, (-35, 0, 0))],
        'antebrazo_R': [(0, (-35, 0, 0)), (24, (-45, 0, 0)), (48, (-35, 0, 0))],
    }, subir=[(0, 0), (24, 0.04), (48, 0)])
    # volar: cuerpo casi horizontal hacia adelante, brazos abiertos como alas que aletean, pelo atras
    accion(arm, 'volar', 24, {
        'cadera': [(0, (62, 0, 0)), (12, (66, 0, 0)), (24, (62, 0, 0))],
        'torso': [(0, (5, 0, 0)), (24, (5, 0, 0))],
        'cabeza': [(0, (-62, 0, 0)), (12, (-58, 0, 0)), (24, (-62, 0, 0))],
        # el pelo se va hacia atras con el viento (x positivo = la punta hacia +Y)
        'pelo': [(0, (80, 0, 0)), (6, (70, 0, 6)), (12, (85, 0, 0)), (18, (70, 0, -6)), (24, (80, 0, 0))],
        'brazo_L': [(0, (-10, -110, 0)), (12, (-10, -65, 0)), (24, (-10, -110, 0))],
        'brazo_R': [(0, (-10, 110, 0)), (12, (-10, 65, 0)), (24, (-10, 110, 0))],
        'antebrazo_L': [(0, (0, 15, 0)), (12, (0, -20, 0)), (24, (0, 15, 0))],
        'antebrazo_R': [(0, (0, -15, 0)), (12, (0, 20, 0)), (24, (0, -15, 0))],
    }, subir=[(0, 0), (12, 0.06), (24, 0)])
    accion(arm, 'atrapar', 20, anim_atrapar(20))
    return arm, [cuerpo]


# ================================================================ armar, revisar y exportar
CONSTRUCTORES = {'silbon': silbon, 'duende': duende, 'bruja': bruja}

RAIZ = os.environ.get('ESPANTOS_ROOT')
if not RAIZ and '__file__' in globals() and os.path.isfile(__file__):
    RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def resumen(nombre, arm, mallas):
    bpy.context.view_layer.update()
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in mallas)
    zs = [(o.matrix_world @ v.co).z for o in mallas for v in o.data.vertices]
    xs = [(o.matrix_world @ v.co).x for o in mallas for v in o.data.vertices]
    ys = [(o.matrix_world @ v.co).y for o in mallas for v in o.data.vertices]
    acciones = [a.name for a in bpy.data.actions]
    print(f'\n===== {nombre.upper()} =====')
    print(f'Triangulos: {tris}  (limite 5.000)')
    print(f'Alto: {max(zs):.2f} m   piso en z={min(zs):.3f}   centro x={(max(xs) + min(xs)) / 2:.3f} y={(max(ys) + min(ys)) / 2:.3f}')
    print(f'Huesos: {len(arm.data.bones)}   Acciones: {acciones}')


def construir(nombre):
    limpiar()
    arm, mallas = CONSTRUCTORES[nombre]()
    # pose de reposo visible y accion idle activa para verla en el viewport
    arm.animation_data.action = bpy.data.actions['idle']
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 0, 48
    resumen(nombre, arm, mallas)
    if RAIZ:
        arm.animation_data.action = None
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RAIZ, 'tools', 'blender', 'fuentes', nombre + '.blend'))
        destino = os.path.join(RAIZ, 'public', 'models', 'espantos', nombre + '.glb')
        bpy.ops.export_scene.gltf(
            filepath=destino, export_format='GLB', export_yup=True, export_apply=False,
            export_lights=False, export_cameras=False, export_materials='EXPORT',
            export_animations=True, export_animation_mode='ACTIONS',
            export_anim_slide_to_zero=True, export_optimize_animation_size=True,
        )
        arm.animation_data.action = bpy.data.actions['idle']
        print('Exportado:', destino)


for n in (CONSTRUCTORES if ESPANTO == 'todos' else [ESPANTO]):
    construir(n)

# ================================================================ COMO EXPORTAR A MANO
# File > Export > glTF 2.0: glTF Binary (.glb), +Y Up, sin luces ni camaras,
# Animation > Mode: "Actions" (exporta idle, caminar, correr / volar y atrapar como clips separados).
# Guardar en public/models/espantos/<nombre>.glb y el .blend en tools/blender/fuentes/<nombre>.blend
# En Three.js:  gltf.animations -> [AnimationClip 'idle', 'caminar', ...]
#               THREE.AnimationClip.findByName(gltf.animations, 'caminar')
#               gltf.scene.getObjectByName('silbon_costal')
