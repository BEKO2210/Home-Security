#!/usr/bin/env bash
# HeimGeist Smoke-Test — prüft alle Kernfunktionen gegen eine laufende Instanz.
#   ./scripts/smoke.sh [BASE_URL]        (Default: http://localhost:3100)
set -u
BASE="${1:-http://localhost:3100}"
PASS=0; FAIL=0

check() { # name, condition-result
  if [ "$2" = "0" ]; then echo "  OK   $1"; PASS=$((PASS+1));
  else echo "  FAIL $1"; FAIL=$((FAIL+1)); fi
}

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1"; }

echo "HeimGeist Smoke-Test gegen $BASE"

[ "$(code "$BASE/")" = "200" ]; check "Landing Page" $?
[ "$(code "$BASE/app")" = "200" ]; check "App-Shell" $?
[ "$(code "$BASE/manifest.webmanifest")" = "200" ]; check "PWA-Manifest" $?
[ "$(code "$BASE/sw.js")" = "200" ]; check "Service Worker" $?
[ "$(code "$BASE/icon-512.png")" = "200" ]; check "PWA-Icon" $?

MODELS=$(curl -s --max-time 10 "$BASE/api/models")
echo "$MODELS" | grep -q '"online":true'; check "Ollama verbunden" $?

CHAT=$(curl -s -N -X POST "$BASE/api/chat" -H 'Content-Type: application/json' \
  -d '{"model":"llama3.1:8b","system":"Antworte mit genau einem Wort: PONG","messages":[{"role":"user","content":"ping"}],"tools":false}' \
  --max-time 90)
echo "$CHAT" | grep -qi "pong"; check "Chat-Streaming (llama3.1)" $?

SEARCH=$(curl -s -N -X POST "$BASE/api/chat" -H 'Content-Type: application/json' \
  -d '{"model":"llama3.1:8b","system":"Du bist HeimGeist. Deutsch, kurz.","messages":[{"role":"user","content":"Such im Web: Hauptstadt von Australien?"}],"profileId":"smoketest"}' \
  --max-time 180)
echo "$SEARCH" | grep -q "Suche im Web"; check "Websuche-Tool ausgelöst" $?
echo "$SEARCH" | grep -qi "canberra"; check "Websuche-Ergebnis korrekt" $?

MEM=$(curl -s -N -X POST "$BASE/api/chat" -H 'Content-Type: application/json' \
  -d '{"model":"llama3.1:8b","system":"Du bist HeimGeist. Deutsch, kurz.","messages":[{"role":"user","content":"Merk dir: Mein Lieblingstier ist der Pinguin."}],"profileId":"smoketest"}' \
  --max-time 120)
curl -s --max-time 10 "$BASE/api/memory?profileId=smoketest" | grep -qi "pinguin"; check "Langzeitgedächtnis speichern" $?

RECALL=$(curl -s -N -X POST "$BASE/api/chat" -H 'Content-Type: application/json' \
  -d '{"model":"llama3.1:8b","system":"Du bist HeimGeist. Deutsch, ein Satz.","messages":[{"role":"user","content":"Was ist mein Lieblingstier?"}],"profileId":"smoketest"}' \
  --max-time 120)
echo "$RECALL" | grep -qi "pinguin"; check "Langzeitgedächtnis abrufen" $?

# Aufräumen: Smoke-Test-Erinnerungen löschen
for id in $(curl -s "$BASE/api/memory?profileId=smoketest" | grep -o '"id":"[^"]*"' | cut -d'"' -f4); do
  curl -s -X DELETE "$BASE/api/memory?profileId=smoketest&factId=$id" -o /dev/null
done

WHISPER=$(curl -s --max-time 5 "$BASE/api/transcribe")
if echo "$WHISPER" | grep -q '"online":true'; then
  echo "  OK   Whisper-Server erreichbar"; PASS=$((PASS+1))
else
  echo "  SKIP Whisper-Server (nicht gestartet — deploy/docker-compose.yml)"
fi

echo
echo "Ergebnis: $PASS bestanden, $FAIL fehlgeschlagen"
[ "$FAIL" = "0" ]
