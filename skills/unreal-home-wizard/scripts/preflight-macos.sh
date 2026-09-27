#!/bin/bash

set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=macos-common.sh
. "$SCRIPT_DIR/macos-common.sh"

PROJECT_FILE=""
UNREAL_EDITOR=""
JSON_PATH=""
RUN_SMOKE=0
CHECK_NAMES=()
CHECK_STATUSES=()
CHECK_DETAILS=()

usage() {
    printf '%s\n' 'Usage: preflight-macos.sh [--project FILE] [--unreal-editor PATH] [--json FILE] [--run-unreal-smoke]'
}

add_check() {
    CHECK_NAMES+=("$1")
    CHECK_STATUSES+=("$2")
    CHECK_DETAILS+=("$3")
}

version_at_least() {
    local current="$1"
    local required="$2"
    local current_major current_minor required_major required_minor
    current_major="${current%%.*}"
    current_minor="${current#*.}"; current_minor="${current_minor%%.*}"
    required_major="${required%%.*}"
    required_minor="${required#*.}"; required_minor="${required_minor%%.*}"
    [ "${current_major:-0}" -gt "${required_major:-0}" ] || {
        [ "${current_major:-0}" -eq "${required_major:-0}" ] &&
        [ "${current_minor:-0}" -ge "${required_minor:-0}" ]
    }
}

json_escape() {
    printf '%s' "$1" | /usr/bin/sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | /usr/bin/tr '\n' ' '
}

write_json_report() {
    local output="$1"
    local overall="$2"
    local i comma
    /bin/mkdir -p "$(dirname "$output")"
    {
        printf '{\n  "generatedAt": "%s",\n  "status": "%s",\n  "checks": [\n' "$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)" "$overall"
        for ((i=0; i<${#CHECK_NAMES[@]}; i++)); do
            comma=','
            [ "$i" -eq "$((${#CHECK_NAMES[@]} - 1))" ] && comma=''
            printf '    {"name":"%s","status":"%s","detail":"%s"}%s\n' \
                "$(json_escape "${CHECK_NAMES[$i]}")" \
                "$(json_escape "${CHECK_STATUSES[$i]}")" \
                "$(json_escape "${CHECK_DETAILS[$i]}")" "$comma"
        done
        printf '  ]\n}\n'
    } >"$output"
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --project) PROJECT_FILE="${2:-}"; shift 2 ;;
        --unreal-editor) UNREAL_EDITOR="${2:-}"; shift 2 ;;
        --json) JSON_PATH="${2:-}"; shift 2 ;;
        --run-unreal-smoke) RUN_SMOKE=1; shift ;;
        --help|-h) usage; exit 0 ;;
        *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 64 ;;
    esac
done

if [ "$(/usr/bin/uname -s 2>/dev/null || true)" = "Darwin" ]; then
    OS_VERSION="$(/usr/bin/sw_vers -productVersion 2>/dev/null || printf 'unknown')"
    if [ "$OS_VERSION" != "unknown" ] && version_at_least "$OS_VERSION" "14.0"; then
        add_check 'macOS' 'pass' "$OS_VERSION; UE 5.8 requires macOS Sonoma 14.0 or newer."
    else
        add_check 'macOS' 'fail' "$OS_VERSION; UE 5.8 requires macOS Sonoma 14.0 or newer."
    fi
else
    add_check 'macOS' 'fail' 'This script must run on macOS.'
fi

ARCH="$(/usr/bin/uname -m 2>/dev/null || printf 'unknown')"
if [ "$ARCH" = "arm64" ]; then
    add_check 'Apple Silicon' 'pass' "$ARCH"
else
    add_check 'Apple Silicon' 'fail' "$ARCH; UE 5.8 removed rendered-editor support for Intel Macs."
fi

MEMORY_BYTES="$(/usr/sbin/sysctl -n hw.memsize 2>/dev/null || printf '0')"
if [[ "$MEMORY_BYTES" =~ ^[0-9]+$ ]] && [ "$MEMORY_BYTES" -gt 0 ]; then
    MEMORY_GB=$((MEMORY_BYTES / 1073741824))
    if [ "$MEMORY_GB" -ge 32 ]; then
        add_check 'System memory' 'pass' "$MEMORY_GB GB unified memory."
    else
        add_check 'System memory' 'warn' "$MEMORY_GB GB unified memory; 32 GB is recommended for high-fidelity scenes."
    fi
else
    add_check 'System memory' 'warn' 'Could not read unified memory.'
fi

GPU="$(/usr/sbin/system_profiler SPDisplaysDataType 2>/dev/null | /usr/bin/awk -F': ' '/Chipset Model|Chip/ {print $2; exit}')"
if [ -n "$GPU" ]; then
    add_check 'GPU' 'pass' "$GPU"
else
    add_check 'GPU' 'warn' 'Could not identify the Apple GPU.'
fi

PROBE_PATH="$SCRIPT_DIR"
if [ -n "$PROJECT_FILE" ] && [ -e "$PROJECT_FILE" ]; then PROBE_PATH="$PROJECT_FILE"; fi
FREE_KB="$(/bin/df -Pk "$PROBE_PATH" 2>/dev/null | /usr/bin/awk 'NR==2 {print $4}')"
if [[ "${FREE_KB:-}" =~ ^[0-9]+$ ]]; then
    FREE_GB=$((FREE_KB / 1048576))
    if [ "$FREE_GB" -ge 50 ]; then
        add_check 'Free disk space' 'pass' "$FREE_GB GB free; 100 GB working headroom is recommended for larger projects."
    else
        add_check 'Free disk space' 'warn' "$FREE_GB GB free; 100 GB working headroom is recommended for larger projects."
    fi
fi

LAUNCHER="$(uhw_find_epic_launcher 2>/dev/null || true)"
if [ -n "$LAUNCHER" ]; then
    add_check 'Epic Games Launcher' 'pass' "$LAUNCHER"
else
    add_check 'Epic Games Launcher' 'warn' 'Not detected in /Applications or ~/Applications.'
fi

if command -v codex >/dev/null 2>&1; then
    add_check 'Codex CLI' 'pass' "$(command -v codex)"
else
    add_check 'Codex CLI' 'warn' 'CLI not found on PATH. Codex desktop may still be available.'
fi

RESOLVED_PROJECT=""
if [ -n "$PROJECT_FILE" ]; then
    if [ ! -f "$PROJECT_FILE" ]; then
        printf 'Project not found: %s\n' "$PROJECT_FILE" >&2
        exit 66
    fi
    RESOLVED_PROJECT="$(uhw_abs_path "$PROJECT_FILE")"
    [[ "$RESOLVED_PROJECT" == *.uproject ]] || { printf 'Project must be a .uproject file.\n' >&2; exit 65; }
    ASSOCIATION="$(uhw_project_association "$RESOLVED_PROJECT")"
    add_check 'Unreal project' 'pass' "$RESOLVED_PROJECT (engine ${ASSOCIATION:-unspecified})"
else
    add_check 'Unreal project' 'warn' 'No project supplied. This is sufficient for machine discovery only.'
fi

if uhw_find_unreal "$UNREAL_EDITOR" "$RESOLVED_PROJECT"; then
    add_check 'Unreal Engine' 'pass' "$UHW_VERSION at $UHW_INSTALL_ROOT"
else
    add_check 'Unreal Engine' 'fail' 'No UnrealEditor.app installation was detected.'
fi

if [ -n "$RESOLVED_PROJECT" ]; then
    for plugin in PythonScriptPlugin EditorScriptingUtilities; do
        if uhw_project_plugin_enabled "$RESOLVED_PROJECT" "$plugin"; then
            add_check "Project plugin: $plugin" 'pass' 'Enabled in the .uproject file.'
        else
            add_check "Project plugin: $plugin" 'fail' 'Required for the built-in editor Python bridge.'
        fi
    done
    if uhw_project_plugin_enabled "$RESOLVED_PROJECT" ArchVisCharacter; then
        add_check 'Project plugin: ArchVisCharacter' 'pass' 'Available for a gravity-bound no-C++ walkthrough.'
    else
        add_check 'Project plugin: ArchVisCharacter' 'warn' 'Recommended for the default no-C++ walkthrough.'
    fi
fi

if [ "$RUN_SMOKE" -eq 1 ]; then
    [ -n "$RESOLVED_PROJECT" ] || { printf '%s\n' '--run-unreal-smoke requires --project.' >&2; exit 64; }
    [ -n "${UHW_COMMAND:-}" ] || { printf '%s\n' '--run-unreal-smoke requires a detected Unreal installation.' >&2; exit 69; }
    "$SCRIPT_DIR/invoke-unreal-python-macos.sh" \
        --project "$RESOLVED_PROJECT" \
        --python-script "$SCRIPT_DIR/unreal_smoke_test.py" \
        --unreal-editor "$UHW_COMMAND"
    SMOKE_REPORT="$(dirname "$RESOLVED_PROJECT")/Saved/UnrealHomeWizard/smoke-test.json"
    if [ -f "$SMOKE_REPORT" ]; then
        add_check 'Unreal Python smoke test' 'pass' "$SMOKE_REPORT"
    else
        add_check 'Unreal Python smoke test' 'fail' 'Unreal did not produce the expected JSON report.'
    fi
fi

FAILED=0
WARNINGS=0
for status in "${CHECK_STATUSES[@]}"; do
    [ "$status" = 'fail' ] && FAILED=$((FAILED + 1))
    [ "$status" = 'warn' ] && WARNINGS=$((WARNINGS + 1))
done
if [ "$FAILED" -gt 0 ]; then OVERALL='blocked';
elif [ "$WARNINGS" -gt 0 ]; then OVERALL='needs-user-action';
else OVERALL='ready'; fi

for ((i=0; i<${#CHECK_NAMES[@]}; i++)); do
    case "${CHECK_STATUSES[$i]}" in
        pass) MARK='[PASS]' ;;
        warn) MARK='[WARN]' ;;
        *) MARK='[FAIL]' ;;
    esac
    printf '%s %s: %s\n' "$MARK" "${CHECK_NAMES[$i]}" "${CHECK_DETAILS[$i]}"
done
printf 'Overall: %s\n' "$OVERALL"

if [ -n "$JSON_PATH" ]; then
    if [[ "$JSON_PATH" != /* ]]; then JSON_PATH="$PWD/$JSON_PATH"; fi
    write_json_report "$JSON_PATH" "$OVERALL"
    printf 'Report: %s\n' "$JSON_PATH"
fi

[ "$FAILED" -eq 0 ] || exit 2
