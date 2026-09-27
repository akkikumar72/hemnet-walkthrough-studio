#!/bin/bash

# Shared macOS discovery helpers for Unreal Home Wizard.

uhw_abs_path() {
    local target="$1"
    local parent
    parent="$(cd "$(dirname "$target")" 2>/dev/null && pwd -P)" || return 1
    printf '%s/%s\n' "$parent" "$(basename "$target")"
}

uhw_project_association() {
    /usr/bin/sed -n 's/.*"EngineAssociation"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | /usr/bin/head -n 1
}

uhw_set_editor_from_root() {
    local root="$1"
    local version="$2"
    local app="$root/Engine/Binaries/Mac/UnrealEditor.app"
    local command="$app/Contents/MacOS/UnrealEditor"
    [ -x "$command" ] || return 1
    UHW_VERSION="$version"
    UHW_INSTALL_ROOT="$root"
    UHW_EDITOR_APP="$app"
    UHW_COMMAND="$command"
    return 0
}

uhw_set_explicit_editor() {
    local explicit="$1"
    local command=""
    local app=""
    local root=""

    if [ -d "$explicit" ] && [[ "$explicit" == *.app ]]; then
        app="$(uhw_abs_path "$explicit")" || return 1
        command="$app/Contents/MacOS/UnrealEditor"
    elif [ -d "$explicit/Engine/Binaries/Mac/UnrealEditor.app" ]; then
        root="$(uhw_abs_path "$explicit")" || return 1
        app="$root/Engine/Binaries/Mac/UnrealEditor.app"
        command="$app/Contents/MacOS/UnrealEditor"
    elif [ -f "$explicit" ]; then
        command="$(uhw_abs_path "$explicit")" || return 1
        app="$(cd "$(dirname "$command")/../.." 2>/dev/null && pwd -P)"
    fi

    [ -x "$command" ] || return 1
    if [ -z "$root" ]; then
        root="$(cd "$(dirname "$command")/../../../../../.." 2>/dev/null && pwd -P)"
    fi
    UHW_VERSION="explicit"
    UHW_INSTALL_ROOT="$root"
    UHW_EDITOR_APP="$app"
    UHW_COMMAND="$command"
    return 0
}

uhw_find_unreal() {
    local explicit="${1:-}"
    local project="${2:-}"
    local association=""
    local candidate root base version
    local best_root=""
    local best_version=""

    UHW_VERSION=""
    UHW_INSTALL_ROOT=""
    UHW_EDITOR_APP=""
    UHW_COMMAND=""

    if [ -n "$explicit" ]; then
        uhw_set_explicit_editor "$explicit"
        return $?
    fi

    if [ -n "$project" ] && [ -f "$project" ]; then
        association="$(uhw_project_association "$project")"
    fi

    for candidate in \
        "/Users/Shared/Epic Games"/UE_* \
        "/Applications/Epic Games"/UE_* \
        "$HOME/Applications/Epic Games"/UE_*; do
        [ -d "$candidate" ] || continue
        root="$(uhw_abs_path "$candidate")" || continue
        [ -x "$root/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor" ] || continue
        base="$(basename "$root")"
        version="${base#UE_}"
        version="${version%_SI}"

        if [ -n "$association" ] && { [ "$version" = "$association" ] || [[ "$version" == "$association".* ]]; }; then
            uhw_set_editor_from_root "$root" "$version"
            return 0
        fi
        if [ -z "$best_version" ] || [[ "$version" > "$best_version" ]]; then
            best_version="$version"
            best_root="$root"
        fi
    done

    [ -n "$best_root" ] || return 1
    uhw_set_editor_from_root "$best_root" "$best_version"
}

uhw_find_epic_launcher() {
    local candidate
    for candidate in \
        "/Applications/Epic Games Launcher.app" \
        "$HOME/Applications/Epic Games Launcher.app"; do
        if [ -d "$candidate" ]; then
            uhw_abs_path "$candidate"
            return 0
        fi
    done
    return 1
}

uhw_project_plugin_enabled() {
    local project="$1"
    local plugin="$2"

    if [ -x /usr/bin/plutil ]; then
        /usr/bin/plutil -convert xml1 -o - "$project" 2>/dev/null | /usr/bin/awk -v plugin="$plugin" '
            /<dict>/ { depth++; if (depth >= 2) { target=0; enabled=0 } }
            depth >= 2 && /<key>Name<\/key>/ {
                getline
                if (index($0, "<string>" plugin "</string>")) target=1
            }
            depth >= 2 && /<key>Enabled<\/key>/ {
                getline
                if ($0 ~ /<true\/>/) enabled=1
            }
            /<\/dict>/ {
                if (depth >= 2 && target) { found=1; exit enabled ? 0 : 1 }
                depth--
            }
            END { if (!found) exit 1 }
        '
        return $?
    fi

    # Portable fallback used by local syntax tests outside macOS.
    /usr/bin/awk -v plugin="$plugin" '
        $0 ~ /"Name"[[:space:]]*:/ && index($0, "\"" plugin "\"") { in_plugin=1; found=1 }
        in_plugin && $0 ~ /"Enabled"[[:space:]]*:[[:space:]]*true/ { enabled=1 }
        in_plugin && /}/ { exit enabled ? 0 : 1 }
        END { if (!found) exit 1 }
    ' "$project"
}
