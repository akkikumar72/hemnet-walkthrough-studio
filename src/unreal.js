import { readFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import { unrealMeshes } from "./unreal-meshes.js";
import { compileGeometry } from "../public/geometry.js";
export async function unrealBundle(scene) {
  const script = await readFile(
    new URL("../scripts/build_unreal.py", import.meta.url),
  );
  const project = {
    FileVersion: 3,
    EngineAssociation: "5.8",
    Category: "Architecture",
    Description: "Local photo-based reconstruction study",
    Plugins: [
      { Name: "PythonScriptPlugin", Enabled: true },
      { Name: "EditorScriptingUtilities", Enabled: true },
      { Name: "MovieRenderPipeline", Enabled: true },
    ],
  };
  const geometry = compileGeometry(scene);
  const meshFiles = unrealMeshes(scene, geometry);
  return zipSync(
    {
      ...meshFiles,
      "Config/DefaultEngine.ini": strToU8(
        "[/Script/Engine.RendererSettings]\nr.DynamicGlobalIlluminationMethod=1\nr.ReflectionMethod=1\nr.GenerateMeshDistanceFields=True\nr.AllowStaticLighting=False\nr.DefaultFeature.MotionBlur=False\nr.Shadow.Virtual.Enable=1\n",
      ),
      "StudioHome.uproject": strToU8(JSON.stringify(project, null, 2)),
      "scene.json": strToU8(JSON.stringify(scene, null, 2)),
      "geometry.json": strToU8(JSON.stringify(geometry)),
      "build_unreal.py": script,
      "README.txt": strToU8(
        "Open StudioHome.uproject in Unreal Engine 5.8 (or select your compatible installed engine). Open Tools > Execute Python Script and select build_unreal.py. It creates a new timestamped map, continuous HomeTour sequence, camera actors, and Render4K Movie Render Queue preset. Open HomeTour and use the Render4K preset to render an image sequence. The script does not install software, overwrite previous maps, publish, or run generated code. Review scale, collision, lighting and furniture against your private photographs. This export is editable draft geometry. Use the included Codex skill for refinement and Sequencer/Movie Render Queue delivery.\n",
      ),
    },
    { level: 6 },
  );
}
