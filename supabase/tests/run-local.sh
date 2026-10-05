#!/usr/bin/env bash
# Draait de migraties en databasetests tegen een tijdelijke lokale Postgres.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -n "$bin" ] || { echo "Geen lokale Postgres gevonden."; exit 1; }

work="$(mktemp -d)"
port=55433
run_as=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$work"
  run_as=(runuser -u postgres --)
fi

cleanup() {
  "${run_as[@]}" "$bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

"${run_as[@]}" "$bin/initdb" -D "$work/data" -U postgres -A trust >/dev/null
"${run_as[@]}" "$bin/pg_ctl" -D "$work/data" -o "-p $port -k $work -c listen_addresses=''" -l "$work/log" -w start >/dev/null

export PGOPTIONS="-c client_min_messages=warning"

psql_run() {
  "${run_as[@]}" psql -h "$work" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

psql_run -f "$root/supabase/tests/stub_supabase.sql"
psql_run -f "$root/supabase/migrations/001_marketing_app.sql"
psql_run -f "$root/supabase/migrations/002_spraakmemos.sql"
sed -e 's/daan@VERVANG.nl/daan@test.nl/; s/mila@VERVANG.nl/mila@test.nl/; s/beau@VERVANG.nl/beau@test.nl/' \
  "$root/supabase/seed.sql" | psql_run
# Migraties moeten twee keer achter elkaar kunnen draaien.
psql_run -f "$root/supabase/migrations/001_marketing_app.sql"
psql_run -f "$root/supabase/migrations/002_spraakmemos.sql"
psql_run -o /dev/null -f "$root/supabase/tests/rls_test.sql"
