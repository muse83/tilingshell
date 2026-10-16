#!/usr/bin/env bash
docker rm -f tilingshell-gnome51 >/dev/null 2>&1 && echo "stack removed" || echo "no stack running"
