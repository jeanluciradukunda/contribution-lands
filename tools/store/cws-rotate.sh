#!/usr/bin/env bash
# Rotate the Chrome Web Store OAuth client secret: test the new one, then update GitHub and 1Password.
# Run in your own terminal, never inside an agent session: bash tools/store/cws-rotate.sh
set -euo pipefail

REPO="jeanluciradukunda/contribution-lands"
ITEM="Chrome Web Store upload (contribution-lands)"
PUBLISHER_ID="ab79ce2e-b00f-42d1-a89c-c65794943dab"
EXTENSION_ID="bbapichgjbdkehhdgaonahkjicihdhih"

unset OP_SERVICE_ACCOUNT_TOKEN

CLIENT_ID=$(op item get "$ITEM" --fields label=client_id)
REFRESH_TOKEN=$(op item get "$ITEM" --fields label=refresh_token --reveal)
read -r -s -p "New client secret (hidden): " NEW_SECRET; echo
[[ -n "$NEW_SECRET" ]] || { echo "Empty secret, nothing changed."; exit 1; }

echo "1/2 Exchanging the refresh token with the new secret..."
RESP=$(printf 'client_id=%s&client_secret=%s&refresh_token=%s&grant_type=refresh_token' \
  "$CLIENT_ID" "$NEW_SECRET" "$REFRESH_TOKEN" |
  curl -s https://oauth2.googleapis.com/token -H 'Content-Type: application/x-www-form-urlencoded' --data-binary @-)
ACCESS=$(printf '%s' "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
if [[ -z "$ACCESS" ]]; then
  echo "FAILED: Google rejected the new secret:"
  printf '%s' "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(" ", d.get("error"), "-", d.get("error_description",""))'
  echo "Nothing was changed. Check you copied the new secret from the right client."
  exit 1
fi
echo "    OK: Google issued an access token."

echo "2/2 Calling the Chrome Web Store API with it..."
OUT=$(mktemp)
CODE=$(curl -s -o "$OUT" -w '%{http_code}' -H "Authorization: Bearer $ACCESS" \
  "https://chromewebstore.googleapis.com/v2/publishers/$PUBLISHER_ID/items/$EXTENSION_ID:fetchStatus")
echo "    HTTP $CODE"
head -c 400 "$OUT"; echo
rm -f "$OUT"
[[ "$CODE" == "200" ]] || echo "    (The token works; the status call returned $CODE. Not blocking, carrying on.)"

printf '%s' "$NEW_SECRET" | gh secret set CWS_CLIENT_SECRET -R "$REPO"
echo "Updated GitHub secret CWS_CLIENT_SECRET."
op item edit "$ITEM" "client_secret[password]=$NEW_SECRET" >/dev/null
echo "Updated 1Password: $ITEM"
unset NEW_SECRET REFRESH_TOKEN ACCESS RESP

echo
echo "Now delete the old secret on the client in Google Cloud."
