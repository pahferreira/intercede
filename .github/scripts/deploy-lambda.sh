#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <function-name> <bundle> [ENV_VAR...]" >&2
  exit 2
fi

function_name=$1
bundle=$2
shift 2

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

(cd apps/api/dist && zip -q "$work/code.zip" "$bundle.mjs" "$bundle.mjs.map")

named_args=()
for name in "$@"; do
  if [ -z "${!name:-}" ]; then
    echo "$name is not set" >&2
    exit 1
  fi
  named_args+=(--arg "$name" "${!name}")
done
jq -n '{Variables: $ARGS.named}' "${named_args[@]}" > "$work/environment.json"

aws lambda update-function-configuration --function-name "$function_name" --environment "file://$work/environment.json" > /dev/null
aws lambda wait function-updated --function-name "$function_name"
aws lambda update-function-code --function-name "$function_name" --zip-file "fileb://$work/code.zip" > /dev/null
aws lambda wait function-updated --function-name "$function_name"
