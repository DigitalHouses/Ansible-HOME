#!/bin/sh
# Runs in existing HAOS QEMU Guest Agent. No packages installed, no SQLite changes.
set -eu
umask 077
cd /mnt/data/supervisor/homeassistant
backup=.dh-recorder-37-rollback
config=configuration.yaml
if [ "${1:-}" = rollback ]; then
  test -d "$backup"
  target=$(cat "$backup/target")
  cp -p "$backup/recorder" "$target"
  if [ -f "$backup/secrets" ]; then
    cp -p "$backup/secrets" secrets.yaml
  else
    rm -f secrets.yaml
  fi
  rm -rf "$backup"
  exit 0
fi
IFS= read -r secret
test -n "$secret"
# Support an ordinary mapping or a single relative include. Never replace an opaque YAML construct.
count=$(grep -c '^recorder:' "$config" || :)
test "$count" -le 1
mode=direct
target=$config
if grep -Eq '^recorder:[[:space:]]*!include[[:space:]]+' "$config"; then
  target=$(sed -n 's/^recorder:[[:space:]]*!include[[:space:]]*\([A-Za-z0-9_./-]*\.yaml\)[[:space:]]*$/\1/p' "$config")
  case "$target" in ''|/*|*..*) exit 2;; esac
  test -f "$target"
  mode=include
elif [ "$count" -eq 1 ]; then
  grep -Eq '^recorder:[[:space:]]*(#.*)?$' "$config"
fi
# Replacing the db_url scalar is safe only when it is a simple one-line value.
if [ "$mode" = direct ]; then
  if [ "$count" -eq 0 ]; then
    # Append new ordinary recorder mapping.
    :
  fi
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
awk -v mode="$mode" '
  function add() { if (!done) { print (mode=="direct" ? "  " : "") "db_url: !secret dh_recorder_db_url"; done=1 } }
  mode=="include" {
    if ($0 ~ /^db_url[[:space:]]*:/) { if ($0 ~ /:[[:space:]]*[|>]/) exit 2; add(); next }
    print; next
  }
  /^recorder:[[:space:]]*(#.*)?$/ { inside=1; found=1; print; add(); next }
  inside && /^[^[:space:]#]/ { inside=0 }
  inside && /^  db_url[[:space:]]*:/ { if ($0 ~ /:[[:space:]]*[|>]/) exit 2; next }
  { print }
  END {
    if (mode=="include") add()
    else if (!found) { print ""; print "recorder:"; add() }
  }
' "$target" > "$tmp/recorder"
# Secret is JSON-quoted YAML-compatible scalar. Do not expose it in process arguments.
if [ -e secrets.yaml ]; then
  awk '!/^dh_recorder_db_url[[:space:]]*:/' secrets.yaml > "$tmp/secrets"
else
  : > "$tmp/secrets"
fi
printf 'dh_recorder_db_url: %s\n' "$secret" >> "$tmp/secrets"
if cmp -s "$tmp/recorder" "$target" && cmp -s "$tmp/secrets" secrets.yaml; then
  echo UNCHANGED
  exit 0
fi
# Save the original files locally for this operation only; leave old SQLite intact.
rm -rf "$backup"
mkdir -m 700 "$backup"
printf '%s\n' "$target" > "$backup/target"
cp -p "$target" "$backup/recorder"
[ ! -f secrets.yaml ] || cp -p secrets.yaml "$backup/secrets"
cp -p "$target" "$target.dh37-new"
cat "$tmp/recorder" > "$target.dh37-new"
cat "$tmp/secrets" > secrets.yaml.dh37-new
chmod 600 secrets.yaml.dh37-new
mv secrets.yaml.dh37-new secrets.yaml
mv "$target.dh37-new" "$target"
echo CHANGED
