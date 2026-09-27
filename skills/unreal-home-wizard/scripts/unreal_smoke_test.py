"""Read-only Unreal Editor Python bridge smoke test."""
import json
from pathlib import Path

import unreal


required = [
    "AssetToolsHelpers",
    "EditorAssetLibrary",
    "LevelEditorSubsystem",
    "EditorActorSubsystem",
    "AutomationLibrary",
    "StaticMeshEditorSubsystem",
]

availability = {name: hasattr(unreal, name) for name in required}
report = {
    "ok": all(availability.values()),
    "engine_version": unreal.SystemLibrary.get_engine_version(),
    "project_directory": unreal.Paths.project_dir(),
    "python_api": availability,
}

output = Path(unreal.Paths.project_saved_dir()) / "UnrealHomeWizard" / "smoke-test.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2), encoding="utf-8")

if not report["ok"]:
    missing = [name for name, present in availability.items() if not present]
    raise RuntimeError("Missing Unreal Python APIs: " + ", ".join(missing))

unreal.log("UNREAL_HOME_WIZARD_SMOKE_TEST_OK")
