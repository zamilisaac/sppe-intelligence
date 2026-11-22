#!/usr/bin/env bash
# Run every SPPE Intelligence test suite with one command and write a Markdown summary.
#   bash tests/run-all.sh                 summary -> ops/qa/run-latest.md
#   bash tests/run-all.sh path/to/out.md  summary -> that file
# Needs: python3, node with Playwright + Chromium, network (Radar test and live check read DOSM/GitHub/the live site).
# Exit code: 0 when every check passes (known failures listed in tests/known-failures.txt excepted), 1 otherwise.
set -u
cd "$(dirname "$0")/.."
OUT=${1:-ops/qa/run-latest.md}; mkdir -p "$(dirname "$OUT")"
LIVE=${LIVE_URL:-https://sppeintelligence.pages.dev}
LOG=$(mktemp -d); KNOWN=tests/known-failures.txt
python3 -m http.server 8811 --bind 127.0.0.1 -d website >"$LOG/static.log" 2>&1 & P1=$!
NODE_USE_ENV_PROXY=1 node tests/dev-server.mjs 8822 >"$LOG/dev.log" 2>&1 & P2=$!
trap 'kill $P1 $P2 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:8811/ && curl -s -o /dev/null http://127.0.0.1:8822/ && break; sleep 0.5; done

ROWS=""; DETAIL=""; BAD=0; TP=0; TF=0; TK=0
is_known() { [ -f "$KNOWN" ] && grep -v '^#' "$KNOWN" | grep -v '^\s*$' | while read -r k; do case "$1" in *"$k"*) echo y; break;; esac; done; }
record() { # name pass fail known seconds exitcode logfile
  local st="✅ LULUS"; if [ "$3" -gt 0 ] || [ "$6" -ne 0 ]; then st="❌ GAGAL"; BAD=1; fi
  [ "$3" -eq 0 ] && [ "$4" -gt 0 ] && st="✅ LULUS (gagal diketahui: $4)"
  ROWS+="| $1 | $2 | $3 | $4 | ${5}s | $st |"$'\n'; TP=$((TP+$2)); TF=$((TF+$3)); TK=$((TK+$4))
  if [ "$3" -gt 0 ] || [ "$6" -ne 0 ]; then DETAIL+=$'\n'"### $1 (kod keluar $6)"$'\n```\n'"$(tail -n 60 "$7")"$'\n```\n'; fi
}
run_node() { # suite file
  local f=$1 n; n=$(basename "$f" .js); local t0=$SECONDS
  timeout 900 node "$f" >"$LOG/$n.out" 2>&1; local rc=$?
  local p f2=0 k=0; p=$(grep -c '^PASS' "$LOG/$n.out")
  while IFS= read -r line; do if [ -n "$(is_known "$line")" ]; then k=$((k+1)); else f2=$((f2+1)); fi; done < <(grep '^FAIL' "$LOG/$n.out")
  [ "$rc" -eq 124 ] && echo "TIMEOUT after 900s" >>"$LOG/$n.out"
  [ "$rc" -eq 0 ] && [ "$f2" -gt 0 ] && rc=1
  record "$n" "$p" "$f2" "$k" $((SECONDS-t0)) "$rc" "$LOG/$n.out"
}
for f in tests/engine-lab.js tests/k2-e2e.js tests/mega-menu.js tests/profil.js tests/radar.js; do [ -f "$f" ] && run_node "$f"; done

# DOSM pipeline (Python unittest)
t0=$SECONDS; timeout 600 python3 scripts/test_dosm_pipeline.py -v >"$LOG/py.out" 2>&1; rc=$?
p=$(grep -cE '\.\.\. ok$' "$LOG/py.out"); f=$(grep -cE '\.\.\. (FAIL|ERROR)$' "$LOG/py.out")
record "dosm-pipeline (python)" "$p" "$f" 0 $((SECONDS-t0)) "$rc" "$LOG/py.out"

# Live site: must answer, and every page must sit behind the Microsoft login
t0=$SECONDS; L="$LOG/live.out"; lp=0; lf=0
chk() { if [ "$2" = "$3" ]; then echo "PASS $1 ($3)" >>"$L"; lp=$((lp+1)); else echo "FAIL $1 (dijangka $2, dapat $3)" >>"$L"; lf=$((lf+1)); fi; }
code=$(curl -s -o "$LOG/live.html" -w '%{http_code} %{time_total}' -A 'Mozilla/5.0' -H 'Accept: text/html' "$LIVE/"); echo "masa muat halaman log masuk: ${code#* }s" >>"$L"
chk "halaman utama dikunci log masuk" 401 "${code%% *}"
chk "halaman log masuk dipaparkan" yes "$(grep -q 'Log masuk' "$LOG/live.html" && echo yes || echo no)"
chk "data tidak terdedah tanpa log masuk" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$LIVE/data/data-manifest.json")"
chk "API Radar tidak terdedah tanpa log masuk" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$LIVE/api/radar")"
chk "aset awam (logo) boleh dimuat" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$LIVE/assets/mpc-logo.png")"
chk "butang log masuk ke Microsoft" 302 "$(curl -s -o /dev/null -w '%{http_code}' "$LIVE/auth/login")"
record "laman live (pintu log masuk)" "$lp" "$lf" 0 $((SECONDS-t0)) "$lf" "$L"

COMMIT=$(git rev-parse --short HEAD 2>/dev/null); BR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
{
  echo "# Hasil ujian: $( [ $BAD -eq 0 ] && echo '🟢 semua lulus' || echo '🔴 ada kegagalan')"
  echo; echo "- Masa: $(TZ=Asia/Kuala_Lumpur date '+%Y-%m-%d %H:%M') MYT"
  echo "- Kod: \`$BR\` @ \`$COMMIT\` · Laman live: $LIVE"
  echo "- Jumlah: $TP lulus · $TF gagal · $TK gagal diketahui"
  echo; echo "| Suite | Lulus | Gagal | Gagal diketahui | Masa | Status |"; echo "|---|---|---|---|---|---|"; printf '%s' "$ROWS"
  if [ -n "$DETAIL" ]; then echo; echo "## Output kegagalan (60 baris terakhir setiap suite)"; printf '%s\n' "$DETAIL"; fi
  if [ -f "$KNOWN" ]; then echo; echo "Gagal diketahui (tidak dikira sebagai gagal, senarai dalam \`$KNOWN\`):"; grep -v '^#' "$KNOWN" | grep -v '^\s*$' | sed 's/^/- /'; fi
} >"$OUT"
cat "$OUT"
exit $BAD
