#!/bin/bash

set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=macos-common.sh
. "$SCRIPT_DIR/macos-common.sh"

PROJECT_FILE=""
PYTHON_SCRIPT=""
UNREAL_EDITOR=""
LOG_FILE=""
VERBOSE=0

usage() {
    printf '%s\n' 'Usage: invoke-unreal-python-macos.sh --project FILE --python-script FILE [--unreal-editor PATH] [--log FILE] [--verbose]'
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --project) PROJECT_FILE="${2:-}"; shift 2 ;;
        --python-script) PYTHON_SCRIPT="${2:-}"; shift 2 ;;
        --unreal-editor) UNREAL_EDITOR="${2:-}"; shift 2 ;;
        --log) LOG_FILE="${2:-}"; shift 2 ;;
        --verbose) VERBOSE=1; shift ;;
        --help|-h) usage; exit 0 ;;
        *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 64 ;;
    esac
done

[ -n "$PROJECT_FILE" ] && [ -n "$PYTHON_SCRIPT" ] || { usage >&2; exit 64; }
[ -f "$PROJECT_FILE" ] || { printf 'Project not found: %s\n' "$PROJECT_FILE" >&2; exit 66; }
[ -f "$PYTHON_SCRIPT" ] || { printf 'Python script not found: %s\n' "$PYTHON_SCRIPT" >&2; exit 66; }

PROJECT_FILE="$(uhw_abs_path "$PROJECT_FILE")"
PYTHON_SCRIPT="$(uhw_abs_path "$PYTHON_SCRIPT")"
[[ "$PROJECT_FILE" == *.uproject ]] || { printf 'Project must be a .uproject file.\n' >&2; exit 65; }
[[ "$PYTHON_SCRIPT" == *.py ]] || { printf 'Python script must be a .py file.\n' >&2; exit 65; }

if ! uhw_find_unreal "$UNREAL_EDITOR" "$PROJECT_FILE"; then
    printf 'UnrealEditor.app was not detected.\n' >&2
    exit 69
fi

if [ -z "$LOG_FILE" ]; then
    LOG_DIR="$(dirname "$PROJECT_FILE")/Saved/UnrealHomeWizard"
    /bin/mkdir -p "$LOG_DIR"
    LOG_FILE="$LOG_DIR/python-$(/bin/date +%Y%m%d-%H%M%S).log"
else
    LOG_FILE="$(uhw_abs_path "$LOG_FILE" 2>/dev/null || printf '%s' "$LOG_FILE")"
    /bin/mkdir -p "$(dirname "$LOG_FILE")"
fi

ARGS=(
    "$PROJECT_FILE"
    "-ExecutePythonScript=$PYTHON_SCRIPT"
    -unattended
    -NoSplash
    -NoSound
    -ddc=InstalledNoZenLocalFallback
    -stdout
    -FullStdOutLogOutput
)

printf 'Unreal command: %s\nProject: %s\nPython: %s\nLog: %s\n' "$UHW_COMMAND" "$PROJECT_FILE" "$PYTHON_SCRIPT" "$LOG_FILE"

if [ "$VERBOSE" -eq 1 ]; then
    "$UHW_COMMAND" "${ARGS[@]}" 2>&1 | /usr/bin/tee "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
else
    "$UHW_COMMAND" "${ARGS[@]}" >"$LOG_FILE" 2>&1
    EXIT_CODE=$?
fi

if [ "$EXIT_CODE" -ne 0 ]; then
    printf 'Unreal Python execution failed with exit code %s. Review: %s\n' "$EXIT_CODE" "$LOG_FILE" >&2
    exit "$EXIT_CODE"
fi

printf 'Unreal Python execution completed.\n'
