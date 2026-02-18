#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOCAL_BIN_DIR="${HOME}/.local/bin"
TARGET_LINK="${LOCAL_BIN_DIR}/opencontext"
PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'

PATH_FILES=(
  "${HOME}/.zshrc"
  "${HOME}/.zprofile"
  "${HOME}/.bashrc"
  "${HOME}/.bash_profile"
  "${HOME}/.profile"
)

info() {
  printf '%s\n' "$*"
}

error() {
  printf 'Error: %s\n' "$*" >&2
}

if ! command -v bun >/dev/null 2>&1; then
  error "Bun is required but was not found in PATH."
  error "Install Bun: https://bun.sh/docs/installation"
  exit 1
fi

info "Bootstrapping OpenContext v1 from ${REPO_ROOT}"

cd "${REPO_ROOT}"

info "1/5 Cleaning prior install/build artifacts..."
rm -rf node_modules
find "${REPO_ROOT}/packages/opencode" -maxdepth 1 -type f -name '.*.bun-build' -delete 2>/dev/null || true

info "2/5 Installing dependencies (bun install --frozen-lockfile --omit=optional)..."
bun install --frozen-lockfile --omit=optional

info "3/5 Building local OpenContext binary..."
bun run --cwd packages/opencode script/build.ts --single

info "4/5 Linking command into ${LOCAL_BIN_DIR}..."
binary_path="$(
  find "${REPO_ROOT}/packages/opencode/dist" \
    -type f \
    -path '*/bin/opencontext' \
    -print 2>/dev/null | LC_ALL=C sort | head -n 1
)"

if [[ -z "${binary_path}" ]]; then
  error "Could not find built binary under packages/opencode/dist/*/bin/opencontext"
  exit 1
fi

mkdir -p "${LOCAL_BIN_DIR}"
ln -sf "${binary_path}" "${TARGET_LINK}"

info "5/5 Ensuring shell PATH includes ${LOCAL_BIN_DIR}..."
path_updates=0
path_already=0

for rc_file in "${PATH_FILES[@]}"; do
  if [[ -f "${rc_file}" ]]; then
    if grep -Eq '^[[:space:]]*(export[[:space:]]+)?PATH=.*\.local/bin' "${rc_file}"; then
      path_already=$((path_already + 1))
      continue
    fi
  fi

  {
    printf '\n'
    printf '# opencontext v1 bootstrap\n'
    printf '%s\n' "${PATH_LINE}"
  } >>"${rc_file}"
  path_updates=$((path_updates + 1))
done

hash -r 2>/dev/null || true

info ""
info "Size audit:"
bun run size:audit

info ""
info "Bootstrap complete."
info "Binary: ${binary_path}"
info "Link:   ${TARGET_LINK}"
info "PATH:   updated ${path_updates} file(s), already configured in ${path_already} file(s)"
info ""
info "Next:"
info "  opencontext --version"
info "  opencontext"
