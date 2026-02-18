#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

before_kb="$(du -sk . | awk '{print $1}')"

echo "Cleaning regenerable footprint artifacts..."
rm -rf node_modules
rm -rf packages/opencode/dist
find packages/opencode -maxdepth 1 -type f -name '.*.bun-build' -delete 2>/dev/null || true

after_kb="$(du -sk . | awk '{print $1}')"
freed_kb="$((before_kb - after_kb))"

echo "Cleanup complete."
echo "repo_total_kb_before=${before_kb}"
echo "repo_total_kb_after=${after_kb}"
echo "freed_kb=${freed_kb}"

echo ""
echo "Post-clean size audit:"
bun ./script/size-audit.ts
