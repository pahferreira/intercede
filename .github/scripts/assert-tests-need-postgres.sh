#!/usr/bin/env bash
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <test command>..." >&2
  exit 2
fi

instruction="run \`docker compose up -d --wait\`"

output=$("$@" 2>&1)
status=$?
printf '%s\n' "$output"

if [ "$status" -eq 0 ]; then
  echo "::error::the tests passed without Postgres; they must fail with the docker instruction" >&2
  exit 1
fi

count=$(grep -cF "$instruction" <<<"$output")
if [ "$count" -ne 1 ]; then
  echo "::error::expected the docker instruction once, found it $count times" >&2
  exit 1
fi
