#!/bin/sh
from="$1"
to="$2"
if [ "$from" = "0000000000000000000000000000000000000000" ] || ! git diff --quiet "$from" "$to" -- bun.lock 2>/dev/null; then
	echo "bun.lock changed, running bun install"
	bun install
fi
