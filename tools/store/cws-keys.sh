#!/usr/bin/env bash
# Chrome Web Store upload keys -> 1Password (personal) + GitHub repo secrets.
# Run in your own terminal, never inside an agent session: bash tools/store/cws-keys.sh
set -euo pipefail

REPO="jeanluciradukunda/contribution-lands"
TITLE="Chrome Web Store upload (contribution-lands)"

# The AnyVan service account is read-only and scoped to the AnyVan vault; use the desktop app instead.
unset OP_SERVICE_ACCOUNT_TOKEN

echo "1Password vaults you can write to:"
op vault list --format=json | python3 -c 'import json,sys; [print("  -", v["name"]) for v in json.load(sys.stdin)]'
read -r -p "Vault to store in [Personal]: " VAULT
VAULT="${VAULT:-Personal}"

read -r -p "Client ID: " CLIENT_ID
read -r -s -p "Client secret (hidden): " CLIENT_SECRET; echo

echo
echo "Now getting the refresh token. Paste the same client ID and secret when asked,"
echo "sign in as your personal Gmail, then Advanced -> Go to chrome-webstore-upload -> Allow."
echo
npx --yes --registry=https://registry.npmjs.org/ chrome-webstore-upload-keys
echo
read -r -s -p "Paste the refresh token it printed (hidden): " REFRESH_TOKEN; echo
clear

[[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" && -n "$REFRESH_TOKEN" ]] || { echo "A value is empty, nothing stored."; exit 1; }

op item create --category="API Credential" --vault="$VAULT" --title="$TITLE" \
  "client_id[text]=$CLIENT_ID" \
  "client_secret[password]=$CLIENT_SECRET" \
  "refresh_token[password]=$REFRESH_TOKEN" \
  "google_cloud_project[text]=chrome-webstore-upload-510808" \
  "notes[text]=OAuth Desktop client for chrome-webstore-upload-cli; consent screen must stay In production or the refresh token expires after 7 days." \
  >/dev/null
echo "Stored in 1Password: $VAULT / $TITLE"

printf '%s' "$CLIENT_ID"     | gh secret set CWS_CLIENT_ID     -R "$REPO"
printf '%s' "$CLIENT_SECRET" | gh secret set CWS_CLIENT_SECRET -R "$REPO"
printf '%s' "$REFRESH_TOKEN" | gh secret set CWS_REFRESH_TOKEN -R "$REPO"
unset CLIENT_ID CLIENT_SECRET REFRESH_TOKEN

gh secret list -R "$REPO"
