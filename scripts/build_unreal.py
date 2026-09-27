"""Build a new editable map from the shared primitive manifest. Run inside Unreal."""
import json
import math
from pathlib import Path
from datetime import datetime
import unreal

ROOT = Path(__file__).resolve().parent
scene = json.loads((ROOT / 'scene.json').read_text())
geometry = json.loads((ROOT / 'geometry.json').read_text())
asset_root = '/Game/WalkthroughStudio/' + datetime.now().strftime('%Y%m%d_%H%M%S_%f')
editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assets = unreal.AssetToolsHelpers.get_asset_tools()
if not editor.new_level(asset_root + '/Home'):
    raise RuntimeError('Could not create a new map. Existing maps were not overwritten.')
meshes = {kind: unreal.load_asset('/Engine/BasicShapes/' + name) for kind, name in [('box', 'Cube'), ('sphere', 'Sphere'), ('cylinder', 'Cylinder')]}
materials = {}

def material(color, glass=False):
    key = color + ('glass' if glass else '')
    if key in materials:
        return materials[key]
    mat = assets.create_asset('M_' + key.replace('#', ''), asset_root + '/Materials', unreal.Material, unreal.MaterialFactoryNew())
    expr = unreal.MaterialEditingLibrary.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector)
    rgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    expr.set_editor_property('constant', unreal.LinearColor(*rgb, 1))
    unreal.MaterialEditingLibrary.connect_material_property(expr, '', unreal.MaterialProperty.MP_BASE_COLOR)
    rough = unreal.MaterialEditingLibrary.create_material_expression(mat, unreal.MaterialExpressionConstant)
    rough.set_editor_property('r', .2 if glass else .7)
    unreal.MaterialEditingLibrary.connect_material_property(rough, '', unreal.MaterialProperty.MP_ROUGHNESS)
    if glass:
        mat.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT)
        opacity = unreal.MaterialEditingLibrary.create_material_expression(mat, unreal.MaterialExpressionConstant)
        opacity.set_editor_property('r', .15)
        unreal.MaterialEditingLibrary.connect_material_property(opacity, '', unreal.MaterialProperty.MP_OPACITY)
    unreal.MaterialEditingLibrary.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    materials[key] = mat
    return mat

for item in geometry:
    x, y, z = item['position']
    sx, sy, sz = item['size']
    actor = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x*100, z*100, y*100), unreal.Rotator(0, -item['rotation'], 0))
    actor.set_actor_label(item['id'])
    actor.set_folder_path(item['room'])
    component = actor.static_mesh_component
    component.set_static_mesh(meshes[item['kind']])
    component.set_material(0, material(item['color'], item['glass']))
    actor.set_actor_scale3d(unreal.Vector(sx, sz, sy))

for i, point in enumerate(scene['route']):
    x, y, z = point['position']; tx, ty, tz = point['target']
    pos, target = unreal.Vector(x*100, z*100, y*100), unreal.Vector(tx*100, tz*100, ty*100)
    camera = actors.spawn_actor_from_class(unreal.CineCameraActor, pos, unreal.MathLibrary.find_look_at_rotation(pos, target))
    camera.set_actor_label('Route_%03d_%s' % (i, point['room']))
    camera.get_cine_camera_component().set_editor_property('current_focal_length', 20)

# Bake the same eased route used in the browser, with a single continuous camera.
fps = 30
total_frames = math.ceil(sum(p['seconds'] for p in scene['route']) * fps)
sequence = assets.create_asset('HomeTour', asset_root, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
sequence.set_display_rate(unreal.FrameRate(fps, 1))
sequence.set_playback_start(0)
sequence.set_playback_end(total_frames)
camera = actors.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(0, 0, 160))
component = camera.get_cine_camera_component()
filmback = component.get_editor_property('filmback')
filmback.sensor_width, filmback.sensor_height = 36, 20.25
component.set_editor_property('filmback', filmback)
component.set_editor_property('current_focal_length', 20.25 / (2 * math.tan(math.radians(24))))
focus = component.get_editor_property('focus_settings')
focus.focus_method = unreal.CameraFocusMethod.DISABLE
component.set_editor_property('focus_settings', focus)
binding = sequence.add_spawnable_from_instance(camera)
binding.set_name('Continuous home tour')
actors.destroy_actor(camera)
section = binding.add_track(unreal.MovieScene3DTransformTrack).add_section()
section.set_range(0, total_frames)
channels = section.get_all_channels()
previous_yaw = None
for frame in range(total_frames + 1):
    time, elapsed = frame / fps, 0
    for i, end in enumerate(scene['route']):
        start = scene['route'][max(0, i - 1)]
        if time <= elapsed + end['seconds'] or i == len(scene['route']) - 1:
            t = max(0, min(1, (time - elapsed) / end['seconds']))
            t = t * t * (3 - 2 * t)
            xyz = [a + (b - a) * t for a, b in zip(start['position'], end['position'])]
            aim = [a + (b - a) * t for a, b in zip(start['target'], end['target'])]
            break
        elapsed += end['seconds']
    pos = unreal.Vector(xyz[0]*100, xyz[2]*100, xyz[1]*100)
    target = unreal.Vector(aim[0]*100, aim[2]*100, aim[1]*100)
    rotation = unreal.MathLibrary.find_look_at_rotation(pos, target)
    yaw = rotation.yaw
    if previous_yaw is not None:
        yaw = previous_yaw + (yaw - previous_yaw + 180) % 360 - 180
    previous_yaw = yaw
    values = [pos.x, pos.y, pos.z, rotation.roll, rotation.pitch, yaw, 1, 1, 1]
    for k, value in enumerate(values):
        if frame == 0:
            channels[k].set_default(value)
        if k < 6:
            channels[k].add_key(unreal.FrameNumber(frame), value, interpolation=unreal.MovieSceneKeyInterpolation.LINEAR)
cut = sequence.add_track(unreal.MovieSceneCameraCutTrack).add_section()
cut.set_range(0, total_frames)
cut.set_camera_binding_id(sequence.get_binding_id(binding))
unreal.EditorAssetLibrary.save_loaded_asset(sequence)
config = assets.create_asset('Render4K', asset_root, unreal.MoviePipelinePrimaryConfig, unreal.MoviePipelinePrimaryConfigFactory())
output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
output.output_resolution = unreal.IntPoint(3840, 2160)
output.output_directory = unreal.DirectoryPath(str(ROOT / 'Results' / asset_root.rsplit('/', 1)[-1]))
output.file_name_format = 'frame_{frame_number}'
output.zero_pad_frame_numbers = 6
output.use_custom_frame_rate = True
output.output_frame_rate = unreal.FrameRate(fps, 1)
output.override_existing_output = False
config.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
aa = config.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
aa.spatial_sample_count = 4
aa.temporal_sample_count = 1
aa.engine_warm_up_count = 32
unreal.EditorAssetLibrary.save_loaded_asset(config)

sun = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 900), unreal.Rotator(-42, -25, 0))
sun.set_actor_label('Daylight')
sun.light_component.set_editor_property('intensity', 3)
sky = actors.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 500))
sky.light_component.set_editor_property('intensity', .8)
actors.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
actors.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(*[v*100 for v in [scene['route'][0]['position'][0], scene['route'][0]['position'][2], scene['route'][0]['position'][1]]]))
editor.save_current_level()
(ROOT / 'build-report.json').write_text(json.dumps({'map': asset_root + '/Home', 'sequence': sequence.get_path_name(), 'renderConfig': config.get_path_name(), 'primitives': len(geometry), 'frames': total_frames, 'fps': fps, 'rendered': False}, indent=2))
unreal.log('STUDIO_BUILD_OK: Walkthrough Studio saved ' + asset_root + '/Home. Draft geometry requires visual review.')
