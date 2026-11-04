# generar_objetos.py · Jacobo · Etapa 1 (Fase 7)
# Modela con primitivas los objetos del juego (punto 11.1): escala real, origen en el centro, < 500 poligonos.
# llave, pilas, aji, radio, latigo, tijeras, sal, panela, olla, botella, caja
# Uso: pegar en Scripting y Run, o: blender -b -P tools/blender/generar_objetos.py
# Si se conoce la ruta del proyecto exporta cada uno a public/models/objetos/<nombre>.glb
# y guarda tools/blender/fuentes/objetos.blend

import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix, Euler

# ---------------------------------------------------------------- limpiar
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for bloque in (bpy.data.meshes, bpy.data.materials):
    for d in list(bloque):
        bloque.remove(d)


def material(nombre, color, metal=0.0, rugoso=0.7):
    m = bpy.data.materials.new(nombre)
    try:
        m.use_nodes = True
    except Exception:
        pass
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rugoso
    m.diffuse_color = (*color, 1.0)
    return m


MAT = {
    'laton': material('obj_laton', (0.75, 0.58, 0.25), metal=1.0, rugoso=0.35),
    'metal': material('obj_metal', (0.6, 0.6, 0.62), metal=1.0, rugoso=0.3),
    'negro': material('obj_negro', (0.04, 0.04, 0.04)),
    'cobre': material('obj_pila_cobre', (0.85, 0.45, 0.1), metal=0.6, rugoso=0.4),
    'rojo': material('obj_rojo_aji', (0.75, 0.05, 0.03), rugoso=0.3),
    'verde': material('obj_verde', (0.15, 0.45, 0.1)),
    'radio': material('obj_radio_madera', (0.40, 0.22, 0.10)),
    'rejilla': material('obj_rejilla', (0.75, 0.70, 0.55)),
    'cuero': material('obj_cuero', (0.30, 0.17, 0.08)),
    'blanco': material('obj_sal', (0.92, 0.92, 0.9)),
    'tapa': material('obj_tapa_roja', (0.6, 0.08, 0.05)),
    'panela': material('obj_panela', (0.45, 0.25, 0.07), rugoso=0.9),
    'hoja': material('obj_hoja_platano', (0.35, 0.40, 0.15)),
    'barro': material('obj_olla_barro', (0.50, 0.25, 0.12), rugoso=0.9),
    'vidrio': material('obj_vidrio_botella', (0.10, 0.30, 0.12), rugoso=0.15),
    'corcho': material('obj_corcho', (0.62, 0.45, 0.28)),
    'madera': material('obj_madera_caja', (0.55, 0.38, 0.20), rugoso=0.9),
}


class Pieza:
    def __init__(self, nombre):
        self.nombre = nombre
        self.bm = bmesh.new()
        self.mats = []

    def _mat(self, verts, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        mi = self.mats.index(mat)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = mi

    def caja(self, c, d, mat, rot=(0, 0, 0)):
        r = bmesh.ops.create_cube(self.bm, size=1, matrix=Matrix.LocRotScale(Vector(c), Euler(rot).to_quaternion(), Vector(d)))
        self._mat(r['verts'], mat)

    def cil(self, c, r1, alto, mat, seg=8, r2=None, rot=(0, 0, 0), tapas=True):
        m = Matrix.LocRotScale(Vector(c), Euler(rot).to_quaternion(), None)
        r = bmesh.ops.create_cone(self.bm, cap_ends=tapas, segments=seg, radius1=r1,
                                  radius2=r1 if r2 is None else r2, depth=alto, matrix=m)
        self._mat(r['verts'], mat)

    def esfera(self, c, radio, mat, escala=(1, 1, 1), sub=1):
        r = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1,
                                       matrix=Matrix.LocRotScale(Vector(c), None, Vector(escala) * radio))
        self._mat(r['verts'], mat)

    def toro(self, c, R, r, mat, seg=12, seg_menor=5, rot=(0, 0, 0), arco=1.0):
        """Toro (anillo) en el plano XY. arco<1 deja un anillo abierto."""
        m = Matrix.LocRotScale(Vector(c), Euler(rot).to_quaternion(), None)
        cerrado = arco >= 1.0
        n = seg if cerrado else seg + 1
        anillos = []
        for i in range(n):
            a = 2 * math.pi * arco * i / seg
            centro = Vector((R * math.cos(a), R * math.sin(a), 0))
            radial = Vector((math.cos(a), math.sin(a), 0))
            anillos.append([self.bm.verts.new(m @ (centro + radial * r * math.cos(b) + Vector((0, 0, r * math.sin(b)))))
                            for b in (2 * math.pi * j / seg_menor for j in range(seg_menor))])
        vs = [v for a in anillos for v in a]
        for i in range(n if cerrado else n - 1):
            a1, a2 = anillos[i], anillos[(i + 1) % n]
            for j in range(seg_menor):
                k = (j + 1) % seg_menor
                self.bm.faces.new((a1[j], a2[j], a2[k], a1[k]))
        if not cerrado:
            for anillo in (anillos[0], anillos[-1]):
                self.bm.faces.new(anillo)
        self._mat(vs, mat)

    def objeto(self):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(self.nombre)
        self.bm.to_mesh(me)
        self.bm.free()
        for k in self.mats:
            me.materials.append(MAT[k])
        o = bpy.data.objects.new(self.nombre, me)
        bpy.context.scene.collection.objects.link(o)
        return o


R90 = math.pi / 2
objetos = []

# ---- llave (~8 cm, acostada a lo largo de X)
p = Pieza('llave')
p.toro((-0.026, 0, 0), 0.012, 0.003, 'laton', seg=12, seg_menor=5)
p.cil((0.012, 0, 0), 0.0028, 0.064, 'laton', seg=6, rot=(0, R90, 0))
p.caja((0.034, -0.005, 0), (0.004, 0.009, 0.003), 'laton')
p.caja((0.040, -0.004, 0), (0.004, 0.007, 0.003), 'laton')
objetos.append(p.objeto())

# ---- pilas (2 pilas AA de 5 cm)
p = Pieza('pilas')
for x in (-0.0075, 0.0075):
    p.cil((x, 0, 0), 0.007, 0.046, 'negro', seg=10)
    p.cil((x, 0, 0.018), 0.0071, 0.01, 'cobre', seg=10)
    p.cil((x, 0, 0.0245), 0.0025, 0.003, 'metal', seg=6)
objetos.append(p.objeto())

# ---- aji (~9 cm, rojo y curvo)
p = Pieza('aji')
puntos = [(0, 0, 0.04), (0.006, 0, 0.012), (0.016, 0, -0.016), (0.032, 0, -0.04)]
radios = [0.011, 0.01, 0.007, 0.0005]
for i in range(3):
    a, b = Vector(puntos[i]), Vector(puntos[i + 1])
    q = Vector((0, 0, 1)).rotation_difference((a - b).normalized())
    m = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
    r = bmesh.ops.create_cone(p.bm, cap_ends=True, segments=8, radius1=radios[i + 1], radius2=radios[i],
                              depth=(a - b).length, matrix=m)
    p._mat(r['verts'], 'rojo')
p.cil((0, 0, 0.044), 0.011, 0.006, 'verde', seg=8, r2=0.006)
p.cil((-0.002, 0, 0.053), 0.0018, 0.014, 'verde', seg=5, rot=(0, -0.3, 0))
objetos.append(p.objeto())

# ---- radio (25 x 9 x 15 cm, parlante al frente -Y)
p = Pieza('radio')
p.caja((0, 0, 0), (0.25, 0.09, 0.15), 'radio')
p.cil((-0.045, -0.046, -0.005), 0.05, 0.004, 'rejilla', seg=14, rot=(R90, 0, 0))
p.caja((0.075, -0.046, 0.03), (0.07, 0.004, 0.03), 'rejilla')                    # dial
for x in (0.055, 0.095):
    p.cil((x, -0.05, -0.03), 0.01, 0.01, 'negro', seg=8, rot=(R90, 0, 0))       # perillas
p.cil((0.1, 0.02, 0.165), 0.002, 0.18, 'metal', seg=4, rot=(0, -0.35, 0))       # antena
p.toro((0, 0, 0.075), 0.06, 0.006, 'cuero', seg=8, seg_menor=4, rot=(R90, 0, 0), arco=0.5)  # manija
objetos.append(p.objeto())

# ---- latigo (cabo de 25 cm + rejo enrollado)
p = Pieza('latigo')
p.cil((0, 0, 0), 0.012, 0.22, 'cuero', seg=8, r2=0.009, rot=(0, R90, 0))
p.cil((-0.112, 0, 0), 0.014, 0.012, 'metal', seg=8, rot=(0, R90, 0))
p.toro((0.13, 0, -0.01), 0.07, 0.005, 'cuero', seg=14, seg_menor=4)
p.toro((0.135, 0.008, 0.0), 0.062, 0.005, 'cuero', seg=14, seg_menor=4)
p.toro((0.128, -0.005, 0.01), 0.055, 0.005, 'cuero', seg=14, seg_menor=4)
objetos.append(p.objeto())

# ---- tijeras (~18 cm, entreabiertas)
p = Pieza('tijeras')
for s in (1, -1):
    ang = s * 0.18
    p.caja((0.05 * math.cos(ang), 0.05 * math.sin(ang), s * 0.001), (0.1, 0.012, 0.002), 'metal', rot=(0, 0, ang))
    p.toro((-0.05, s * 0.022, 0), 0.016, 0.0035, 'negro', seg=10, seg_menor=4)
    p.caja((-0.022, s * 0.011, 0), (0.03, 0.007, 0.004), 'negro', rot=(0, 0, -s * 0.5))
p.cil((0, 0, 0), 0.004, 0.007, 'metal', seg=6)
objetos.append(p.objeto())

# ---- sal (frasco de 11 cm con tapa roja)
p = Pieza('sal')
p.cil((0, 0, -0.008), 0.035, 0.09, 'blanco', seg=12)
p.cil((0, 0, 0.044), 0.037, 0.016, 'tapa', seg=12)
objetos.append(p.objeto())

# ---- panela (bloque de 10 x 10 x 4 cm envuelto en hoja)
p = Pieza('panela')
r = bmesh.ops.create_cone(p.bm, cap_ends=True, segments=4, radius1=0.072, radius2=0.062, depth=0.04,
                          matrix=Matrix.Rotation(math.pi / 4, 4, 'Z'))
p._mat(r['verts'], 'panela')
p.caja((0, 0, -0.021), (0.13, 0.13, 0.003), 'hoja', rot=(0, 0, 0.3))
objetos.append(p.objeto())

# ---- olla (25 cm de diametro, de barro, con orejas)
p = Pieza('olla')
p.cil((0, 0, 0), 0.125, 0.16, 'barro', seg=14, r2=0.13, tapas=False)
p.cil((0, 0, -0.08), 0.125, 0.004, 'barro', seg=14)
p.cil((0, 0, 0.004), 0.118, 0.152, 'negro', seg=14, r2=0.123, tapas=False)      # interior oscuro
for s in (1, -1):
    p.toro((s * 0.135, 0, 0.05), 0.02, 0.005, 'barro', seg=8, seg_menor=4, rot=(R90, 0, 0), arco=0.5)
p.toro((0, 0, 0.08), 0.13, 0.006, 'barro', seg=14, seg_menor=4)                # borde
objetos.append(p.objeto())

# ---- botella (30 cm, verde)
p = Pieza('botella')
p.cil((0, 0, -0.04), 0.04, 0.22, 'vidrio', seg=10)
p.cil((0, 0, 0.09), 0.04, 0.04, 'vidrio', seg=10, r2=0.015)
p.cil((0, 0, 0.13), 0.014, 0.04, 'vidrio', seg=8)
p.cil((0, 0, 0.155), 0.012, 0.015, 'corcho', seg=8)
objetos.append(p.objeto())

# ---- caja (guacal de madera de 40 cm)
p = Pieza('caja')
L = 0.4
for z in (-0.13, 0.0, 0.13):
    for s in (1, -1):
        p.caja((0, s * 0.19, z), (L, 0.02, 0.1), 'madera')
        p.caja((s * 0.19, 0, z), (0.02, L - 0.04, 0.1), 'madera')
p.caja((0, 0, -0.19), (L, L, 0.02), 'madera')
for sx in (1, -1):
    for sy in (1, -1):
        p.caja((sx * 0.185, sy * 0.185, 0), (0.03, 0.03, L), 'madera')
objetos.append(p.objeto())

# ---------------------------------------------------------------- origen al centro, en fila para verlos
bpy.ops.object.select_all(action='DESELECT')
for o in objetos:
    o.select_set(True)
bpy.context.view_layer.objects.active = objetos[0]
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
bpy.ops.object.select_all(action='DESELECT')
x = 0
for i, o in enumerate(objetos):
    if i:
        x += (objetos[i - 1].dimensions.x + o.dimensions.x) / 2 + 0.12
    o.location = (x, 0, 0)

print('\n===== OBJETOS =====')
for o in objetos:
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    d = o.dimensions
    print(f'{o.name:<8} caras {len(o.data.polygons):>4}  tris {tris:>4}  medidas {d.x * 100:5.1f} x {d.y * 100:5.1f} x {d.z * 100:5.1f} cm')

# ---------------------------------------------------------------- exportar cada uno
RAIZ = os.environ.get('ESPANTOS_ROOT')
if not RAIZ and '__file__' in globals() and os.path.isfile(__file__):
    RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if RAIZ:
    carpeta = os.path.join(RAIZ, 'public', 'models', 'objetos')
    os.makedirs(carpeta, exist_ok=True)
    for o in objetos:
        pos = o.location.copy()
        o.location = (0, 0, 0)          # en el .glb el objeto queda en el origen
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(carpeta, o.name + '.glb'), export_format='GLB',
                                  use_selection=True, export_yup=True, export_lights=False,
                                  export_cameras=False, export_animations=False, export_materials='EXPORT')
        o.location = pos
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RAIZ, 'tools', 'blender', 'fuentes', 'objetos.blend'))
    print('Exportados en', carpeta)

# A mano: seleccionar UN objeto, ponerlo en (0,0,0), File > Export > glTF 2.0, glTF Binary,
# marcar "Selected Objects", +Y Up, y guardarlo como public/models/objetos/<nombre>.glb
