#!/usr/bin/env bash
# Runs SQL on the Clientele Supabase project through Supabase's Management API
# and prints the result as JSON. The access token is added by the cloud
# environment's network proxy (it is never stored here).
#   scripts/sb-sql.sh "select 1"        or        scripts/sb-sql.sh < file.sql
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-sjtmiutdvofoqynkwnoa}"
if [ $# -gt 0 ]; then SQL="$1"; else SQL="$(cat)"; fi
BODY="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<<"$SQL")"
curl -sS --fail-with-body -X POST \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:-proxy-injected}" \
  -H "Content-Type: application/json" \
  --data "$BODY" \
  "https://api.supabase.com/v1/projects/${REF}/database/query"
echo
