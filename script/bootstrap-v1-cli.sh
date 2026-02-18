#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOCAL_BIN_DIR="${HOME}/.local/bin"
TARGET_LINK="${LOCAL_BIN_DIR}/opencontext"
PERSIST_DIR="${HOME}/.local/share/opencontext/bootstrap-v1-cli"
PERSIST_BINARY="${PERSIST_DIR}/opencontext"
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

if ! command -v jq >/dev/null 2>&1; then
  error "jq is required but was not found in PATH."
  exit 1
fi

VERSION="$(jq -r '.version' "${REPO_ROOT}/packages/opencode/package.json")"
if [[ -z "${VERSION}" || "${VERSION}" == "null" ]]; then
  error "Could not read version from packages/opencode/package.json"
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/opencontext-cli-bootstrap.XXXXXX")"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

info "Bootstrapping OpenContext v1 (lean CLI) from ${REPO_ROOT}"

info "1/6 Creating isolated CLI-only workspace..."
mkdir -p "${TMP_DIR}/packages" "${TMP_DIR}/packages/sdk"

jq '
  .scripts = {} |
  .dependencies = {} |
  .devDependencies = {} |
  .workspaces.packages = [
    "packages/opencode",
    "packages/plugin",
    "packages/script",
    "packages/util",
    "packages/sdk/js"
  ]
' "${REPO_ROOT}/package.json" > "${TMP_DIR}/package.json"

cp "${REPO_ROOT}/bun.lock" "${TMP_DIR}/bun.lock"
cp "${REPO_ROOT}/bunfig.toml" "${TMP_DIR}/bunfig.toml"
cp -R "${REPO_ROOT}/patches" "${TMP_DIR}/patches"
cp -R "${REPO_ROOT}/packages/opencode" "${TMP_DIR}/packages/"
cp -R "${REPO_ROOT}/packages/plugin" "${TMP_DIR}/packages/"
cp -R "${REPO_ROOT}/packages/script" "${TMP_DIR}/packages/"
cp -R "${REPO_ROOT}/packages/util" "${TMP_DIR}/packages/"
cp -R "${REPO_ROOT}/packages/sdk/js" "${TMP_DIR}/packages/sdk/"

rm -rf "${TMP_DIR}/packages/opencode/dist"
find "${TMP_DIR}/packages/opencode" -maxdepth 1 -type f -name '.*.bun-build' -delete 2>/dev/null || true

info "2/6 Installing lean dependencies..."
(
  cd "${TMP_DIR}"
  bun install --ignore-scripts --omit=optional --no-summary
)

info "3/6 Building local OpenContext binary..."
(
  cd "${TMP_DIR}"
  OPENCODE_CHANNEL="latest" OPENCODE_VERSION="${VERSION}" bun run --cwd packages/opencode script/build.ts --single
)

binary_path="$(
  find "${TMP_DIR}/packages/opencode/dist" \
    -type f \
    -path '*/bin/opencontext' \
    -print 2>/dev/null | LC_ALL=C sort | head -n 1
)"

if [[ -z "${binary_path}" ]]; then
  error "Could not find built binary under isolated dist/*/bin/opencontext"
  exit 1
fi

info "4/6 Installing persistent binary into ${PERSIST_DIR}..."
mkdir -p "${PERSIST_DIR}"
cp "${binary_path}" "${PERSIST_BINARY}"
chmod +x "${PERSIST_BINARY}"

info "5/6 Linking command into ${LOCAL_BIN_DIR}..."
mkdir -p "${LOCAL_BIN_DIR}"
ln -sf "${PERSIST_BINARY}" "${TARGET_LINK}"

if [[ "${OPENCONTEXT_BOOTSTRAP_SKIP_PATH:-0}" != "1" ]]; then
  info "6/6 Ensuring shell PATH includes ${LOCAL_BIN_DIR}..."
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

  info "PATH: updated ${path_updates} file(s), already configured in ${path_already} file(s)"
else
  info "6/6 Skipping PATH update because OPENCONTEXT_BOOTSTRAP_SKIP_PATH=1"
fi

hash -r 2>/dev/null || true

# After the binary is copied to a persistent location, trim build outputs so
# the reported lean footprint reflects retained workspace dependencies.
rm -rf "${TMP_DIR}/packages/opencode/dist"
find "${TMP_DIR}/packages/opencode" -maxdepth 1 -type f -name '.*.bun-build' -delete 2>/dev/null || true

lean_kb="$(du -sk "${TMP_DIR}" | awk '{print $1}')"
if [[ -n "${OPENCONTEXT_LEAN_SIZE_OUTPUT:-}" ]]; then
  printf '%s\n' "${lean_kb}" > "${OPENCONTEXT_LEAN_SIZE_OUTPUT}"
fi

info ""
info "Lean bootstrap complete."
info "Binary source: ${binary_path}"
info "Binary installed: ${PERSIST_BINARY}"
info "Link: ${TARGET_LINK}"
info "isolated_workspace_kb=${lean_kb}"
info ""
info "Next:"
info "  opencontext --version"
info "  opencontext"
