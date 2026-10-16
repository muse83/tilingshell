#!/usr/bin/env bash
# Build image, run the stack in the background. Logs land in ./out on the host.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
cp ../package.json package.json
docker build -q -t tilingshell-gnome51 .
docker rm -f tilingshell-gnome51 >/dev/null 2>&1 || true
docker run -d --name tilingshell-gnome51 ${SECOND_MONITOR:+-e SECOND_MONITOR=1} \
  -v "$PWD/..:/src:ro" -v "$PWD/out:/out" \
  tilingshell-gnome51
echo "stack started; logs: $PWD/out/  (verify: ./status.sh)"
