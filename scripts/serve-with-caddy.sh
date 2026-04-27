#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
caddy_version="2.10.0"
tools_directory="${project_root}/.tools"
caddy_archive="${tools_directory}/caddy_${caddy_version}_linux_amd64.tar.gz"
caddy_binary="${tools_directory}/caddy"

if [[ ! -d "${project_root}/dist" ]]; then
    echo "Error: dist/ does not exist. Run 'npm run build' before starting Caddy." >&2
    exit 1
fi

if [[ ! -f "${project_root}/dist/index.html" ]]; then
    echo "Error: dist/index.html does not exist. Run 'npm run build' before starting Caddy." >&2
    exit 1
fi

mkdir -p "${tools_directory}"

if [[ ! -x "${caddy_binary}" ]]; then
    if [[ ! -f "${caddy_archive}" ]]; then
        echo "Downloading Caddy ${caddy_version}..."
        curl -fsSL --output "${caddy_archive}" "https://github.com/caddyserver/caddy/releases/download/v${caddy_version}/caddy_${caddy_version}_linux_amd64.tar.gz"
    fi

    tar -xzf "${caddy_archive}" -C "${tools_directory}" caddy
    chmod +x "${caddy_binary}"
fi

exec "${caddy_binary}" run --config "${project_root}/Caddyfile" --adapter caddyfile