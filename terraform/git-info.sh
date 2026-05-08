#!/usr/bin/env bash
set -euo pipefail
# Emits {"commit_sha":"...","repository_url":"github.com/owner/repo"}
# Consumed by data "external" "git" in main.tf so Lambda env carries
# Datadog source-code-integration tags on every terraform apply.

cd "$(dirname "$0")/.."
sha=$(git rev-parse HEAD)
url=$(git config --get remote.origin.url)
# Normalize https://github.com/owner/repo.git or git@github.com:owner/repo.git
# to github.com/owner/repo (the form Datadog expects).
url=${url#https://}
url=${url#git@}
url=${url%.git}
url=${url/://}

printf '{"commit_sha":"%s","repository_url":"%s"}\n' "$sha" "$url"
