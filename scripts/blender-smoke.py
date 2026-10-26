"""Headless smoke test for the 0-credit local Blender engine.

Run through `npm run qa:blender` (recommended) or directly:

    blender --background --factory-startup \
      --python scripts/blender-smoke.py -- <outdir> <addon.py>

It loads the CineBlock AI add-on, builds a camera rig with the deterministic
operator, renders three frames of a small blockout, exports a Draco-compressed
GLB, and prints a single `SMOKE_OK` or `SMOKE_FAIL` line plus a JSON report.

Nothing here talks to the credits proxy or Renderful: the local engine is
supposed to cost zero credits, and this test proves it stays offline.
"""

import importlib.util
import json
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.expanduser("~"), "cineblock-smoke")
ADDON = argv[1] if len(argv) > 1 else None

frames_dir = os.path.join(OUT, "frames")
os.makedirs(frames_dir, exist_ok=True)

report = {"blender": bpy.app.version_string, "python": sys.version.split()[0]}

# ---------------------------------------------------------------- add-on load
if ADDON and os.path.exists(ADDON):
    spec = importlib.util.spec_from_file_location("cineblock_ai_blender_addon", ADDON)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["cineblock_ai_blender_addon"] = mod
    spec.loader.exec_module(mod)
    mod.register()
    report["addon_registered"] = hasattr(bpy.context.scene, "cineblock")
    report["addon_version"] = ".".join(str(v) for v in mod.bl_info["version"])
else:
    report["addon_registered"] = False
    report["addon_error"] = "add-on not found: %s" % ADDON

# -------------------------------------------------------------- scene blockout
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
hero = bpy.context.active_object
hero.name = "CineBlock_Hero"
hero.scale = (1.0, 1.0, 1.5)

bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
bpy.context.active_object.name = "CineBlock_Floor"

bpy.ops.object.light_add(type="AREA", location=(3, -3, 6))
bpy.context.active_object.data.energy = 800

mat = bpy.data.materials.new("CineBlock_Mat")
mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.9, 0.55, 0.15, 1)
hero.data.materials.append(mat)

if report.get("addon_registered"):
    props = bpy.context.scene.cineblock
    props.camera_preset = "ORBIT_180"
    props.focal_length = 35.0
    props.duration_frames = 24
    props.fps = 24
    props.hud_enabled = False  # 2D draw handlers never run in background mode
    bpy.context.scene.cursor.location = (0, 0, 0.5)
    report["rig_operator"] = sorted(bpy.ops.cineblock.build_camera_rig())
    cam = bpy.context.scene.camera
    report["camera_created"] = bool(cam)
    report["camera_name"] = cam.name if cam else None
    report["camera_lens"] = cam.data.lens if cam else None
    report["camera_constraints"] = [c.type for c in cam.constraints] if cam else []
    report["camera_dof_focus"] = bool(cam.data.dof.focus_object) if cam else False
    report["actions"] = [a.name for a in bpy.data.actions]

    def all_fcurves(action):
        """Blender >= 4.4 uses slotted actions (layers/strips/channelbags)."""
        legacy = getattr(action, "fcurves", None)
        if legacy is not None:
            return list(legacy)
        out = []
        for layer in getattr(action, "layers", []):
            for strip in getattr(layer, "strips", []):
                for bag in getattr(strip, "channelbags", []):
                    out.extend(bag.fcurves)
        return out

    report["keyframes"] = 0
    report["fcurve_paths"] = []
    action = cam.animation_data.action if cam and cam.animation_data else None
    if action:
        fcurves = all_fcurves(action)
        report["keyframes"] = sum(len(fc.keyframe_points) for fc in fcurves)
        report["fcurve_paths"] = sorted({fc.data_path for fc in fcurves})

# ---------------------------------------------------------------- render frames
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 8
scene.cycles.use_denoising = False
scene.render.resolution_x = 320
scene.render.resolution_y = 180
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(frames_dir, "frame_")
scene.frame_start = 1
scene.frame_end = 3
bpy.ops.render.render(animation=True)

rendered = sorted(f for f in os.listdir(frames_dir) if f.endswith(".png"))
report["rendered_frames"] = rendered
report["rendered_bytes"] = [os.path.getsize(os.path.join(frames_dir, f)) for f in rendered]

# ------------------------------------------------------------------- GLB export
glb = os.path.join(OUT, "cineblock.glb")
bpy.ops.export_scene.gltf(
    filepath=glb,
    export_format="GLB",
    export_draco_mesh_compression_enable=True,
    export_apply=True,
    use_selection=False,
)
report["glb"] = glb
report["glb_bytes"] = os.path.getsize(glb) if os.path.exists(glb) else 0

# A GLB must start with the glTF binary magic and declare version 2.
if report["glb_bytes"]:
    with open(glb, "rb") as fh:
        head = fh.read(12)
    report["glb_magic"] = head[:4].decode("ascii", "replace")
    report["glb_version"] = int.from_bytes(head[4:8], "little")

ok = (
    report.get("addon_registered")
    and report.get("camera_created")
    and report["keyframes"] > 0
    and len(rendered) == 3
    and report["glb_bytes"] > 0
    and report.get("glb_magic") == "glTF"
)
report["ok"] = bool(ok)
print("CINEBLOCK_SMOKE " + json.dumps(report, sort_keys=True))
print("SMOKE_OK" if ok else "SMOKE_FAIL")
