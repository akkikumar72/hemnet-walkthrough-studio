#!/bin/bash

set -u

DESTINATION=""
NAME="MyHome"
ENGINE_VERSION="5.8"

usage() {
    printf '%s\n' 'Usage: new-home-project-macos.sh --destination DIRECTORY [--name MyHome] [--engine-version 5.8]'
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --destination) DESTINATION="${2:-}"; shift 2 ;;
        --name) NAME="${2:-}"; shift 2 ;;
        --engine-version) ENGINE_VERSION="${2:-}"; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 64 ;;
    esac
done

[ -n "$DESTINATION" ] || { usage >&2; exit 64; }
[[ "$NAME" =~ ^[A-Za-z][A-Za-z0-9_]{1,39}$ ]] || {
    printf 'Name must start with a letter and contain 2-40 letters, numbers, or underscores.\n' >&2
    exit 65
}

if [ -e "$DESTINATION" ] && [ -n "$(/bin/ls -A "$DESTINATION" 2>/dev/null)" ]; then
    printf 'Destination is not empty: %s\n' "$DESTINATION" >&2
    exit 73
fi

/bin/mkdir -p "$DESTINATION"
ROOT="$(cd "$DESTINATION" && pwd -P)"
for directory in Config Content PrivateInput Results Scripts; do
    /bin/mkdir -p "$ROOT/$directory"
done

PROJECT_PATH="$ROOT/$NAME.uproject"
/bin/cat >"$PROJECT_PATH" <<EOF
{
  "FileVersion": 3,
  "EngineAssociation": "$ENGINE_VERSION",
  "Category": "Architecture",
  "Description": "Photo-based home reconstruction created with Unreal Home Wizard.",
  "Plugins": [
    { "Name": "PythonScriptPlugin", "Enabled": true },
    { "Name": "EditorScriptingUtilities", "Enabled": true },
    { "Name": "ArchVisCharacter", "Enabled": true },
    { "Name": "MovieRenderPipeline", "Enabled": true }
  ]
}
EOF

/bin/cat >"$ROOT/.gitignore" <<'EOF'
Binaries/
Build/
DerivedDataCache/
Intermediate/
Saved/
.vs/
.DS_Store
PrivateInput/
Results/
.env
.env.*
!.env.example
EOF

/bin/cat >"$ROOT/HOME_PROJECT_BRIEF.md" <<'EOF'
# Home project brief

Status: setup
Scope: unanswered
References: unanswered
Output: unanswered
Rights and privacy: unanswered
Known dimensions: none recorded
Inferred areas: none recorded
Current stage: technical preflight
Next decision: supply references
EOF

printf 'Created project: %s\nPrivateInput and Results are ignored by Git.\n' "$PROJECT_PATH"
