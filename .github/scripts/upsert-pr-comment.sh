#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <pr-number> <marker> <body-file>" >&2
  exit 2
fi

pr=$1
marker=$2
body_file=$3

payload=$(mktemp)
trap 'rm -f "$payload"' EXIT
{
  printf '%s\n\n' "$marker"
  cat "$body_file"
} > "$payload"

comment_id=$(
  gh api --paginate "repos/{owner}/{repo}/issues/$pr/comments" |
    jq -r --arg marker "$marker" \
      '.[] | select(.user.login == "github-actions[bot]" and (.body | startswith($marker))) | .id' |
    head -n1
)

if [ -n "$comment_id" ]; then
  gh api -X PATCH "repos/{owner}/{repo}/issues/comments/$comment_id" -F "body=@$payload" > /dev/null
else
  gh api -X POST "repos/{owner}/{repo}/issues/$pr/comments" -F "body=@$payload" > /dev/null
fi
