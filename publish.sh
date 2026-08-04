#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "El clon tiene cambios sin confirmar. Publicación cancelada."
  git status --short
  exit 1
fi

echo "Actualizando main desde GitHub…"
git fetch origin main

echo "Integrando el release sin sobrescribir trabajo publicado…"
if ! git rebase origin/main; then
  echo
  echo "Hay conflictos. Archivos que requieren revisión:"
  git diff --name-only --diff-filter=U || true
  echo
  echo "Resuelve los archivos, ejecuta: git add <archivo> && git rebase --continue"
  echo "Después vuelve a ejecutar: bash publish.sh"
  exit 1
fi

echo "Publicando main…"
git push origin HEAD:main
echo "Publicado correctamente: $(git rev-parse HEAD)"
