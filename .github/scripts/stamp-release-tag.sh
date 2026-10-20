#!/usr/bin/env bash
set -euo pipefail

release_tag=$1
asset=$2
original_tag=$(git rev-parse "refs/tags/$release_tag")

# The workflow checks for an already-published release before running this.
# Keep main untouched: this commit belongs only to the release tag.
git diff --cached --quiet
cp "$asset" tma-downloader.user.js
if git diff --quiet -- tma-downloader.user.js; then
  echo 'Tagged source already has the release version.'
  exit 0
fi

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add tma-downloader.user.js
git -c commit.gpgsign=false commit -m "Stamp userscript version for $release_tag"
git -c tag.gpgSign=false tag --force --annotate "$release_tag" --message "Release $release_tag"

# Fail if somebody has moved the remote tag since checkout. GitHub's built-in
# token prevents this tag update from starting another Actions run.
git -c 'credential.helper=!gh auth git-credential' push \
  --force-with-lease="refs/tags/$release_tag:$original_tag" \
  origin "refs/tags/$release_tag"
