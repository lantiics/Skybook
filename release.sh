#!/bin/bash

arg="${1:-}"; push=false; [[ "${2:-}" == "--push" ]] && push=true

if [[ ! $(git branch --show-current) == "master" ]]; then

echo "Releases may only be made from the MASTER branch; exiting"
exit 1
fi

# if [ ! -z "$(git status --porcelain)" ]; then
# echo "Working branch is not clean; exiting"
# exit 1
# fi


LAST_TAG=$(git tag --list 'v[0-9]*' --sort=-v:refname | grep -v -- '-' | head -1 || true)

IFS=. read -r MA MI PA <<<"${LAST_TAG#v}"

case "$1" in
    major) v="$((MA+1)).0.0" ;;
    minor) v="$MA.$((MI+1)).0" ;;
    patch) v="$MA.$MI.$((PA+1))" ;;
    *) echo "bad patch version: $1"; exit 1; ;;
esac

TAG="v$v"

echo "Releasing $TAG"
read -rp "Continue? [y/N] " ok; [[ "$ok" == y ]] || { echo aborted; exit 1; }
NOTES=$(git cliff --unreleased --tag "$TAG" --strip all)
if $push; then
#
# Docker currently incomplete
#
# docker buildx build -t lanticss/skybook:latest -t lanticss/skybook:$TAG --push .
bun git-cliff --tag "$TAG" -o CHANGELOG.md
git add CHANGELOG.md
git commit -q -m "chore(release): $TAG"
git tag -a "$TAG" -m "$TAG"$'\n\n'"$NOTES"
git push --atomic origin "$TAG"
echo "Released $TAG"
else
bun git-cliff -o CHANGELOG.md
# docker buildx build -t lanticss/skybook:latest -t lanticss/skybook:$TAG --load .
echo "Dry run OK. Tried with tag: $TAG"
fi