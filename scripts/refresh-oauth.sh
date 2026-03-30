#!/bin/bash
# Refresh OAuth token for credential proxy using direct API call.
# Run via cron every 4 hours.
#
# Uses the Anthropic OAuth refresh endpoint directly (no Claude CLI needed).
# The credential proxy re-reads .env on each request, so updating
# the file is sufficient — no service restart needed.

set -euo pipefail

CREDS_FILE="$HOME/.claude/.credentials.json"
ENV_FILE="$HOME/shoggoth/.env"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
OAUTH_ENDPOINT="https://api.anthropic.com/v1/oauth/token"
CLIENT_ID="9d1c250a-e61b-44d9-88ed-5944d1962f5e"

# WhatsApp notification via IPC (main group can send to any JID)
IPC_DIR="$HOME/shoggoth/data/ipc/whatsapp_main/messages"
NOTIFY_JID="41774105412@s.whatsapp.net"

log() { echo "$LOG_PREFIX $*"; }
log_error() { echo "$LOG_PREFIX ERROR: $*" >&2; }

notify_whatsapp() {
  local msg="$1"
  if [ -d "$HOME/shoggoth/data/ipc/whatsapp_main" ]; then
    mkdir -p "$IPC_DIR"
    local ts
    ts=$(date +%s%N)
    cat > "$IPC_DIR/message_${ts}.json" <<EOF
{
  "type": "message",
  "chatJid": "$NOTIFY_JID",
  "text": "[OAuth Refresh] $msg"
}
EOF
    log "WhatsApp notification queued"
  else
    log "WhatsApp IPC directory not found, skipping notification"
  fi
}

# Check if credentials file exists
if [ ! -f "$CREDS_FILE" ]; then
  log_error "No credentials file at $CREDS_FILE — run 'claude /login'"
  notify_whatsapp "FAILED: No credentials file. Run 'claude /login' on the server."
  exit 1
fi

# Check if jq is available
if ! command -v jq &>/dev/null; then
  log_error "jq is required but not installed"
  exit 1
fi

# Read current token state
EXPIRES_AT=$(jq -r '.claudeAiOauth.expiresAt' "$CREDS_FILE")
REFRESH_TOKEN=$(jq -r '.claudeAiOauth.refreshToken' "$CREDS_FILE")
NOW_MS=$(date +%s%3N)

if [ -z "$REFRESH_TOKEN" ] || [ "$REFRESH_TOKEN" = "null" ]; then
  log_error "No refresh token in credentials file"
  notify_whatsapp "FAILED: No refresh token. Run 'claude /login' on the server."
  exit 1
fi

# Refresh if expiring within 6 hours (21600000 ms)
# Wider buffer than before — better to refresh early than miss the window
BUFFER=21600000
REMAINING=$((EXPIRES_AT - NOW_MS))

if [ "$REMAINING" -gt "$BUFFER" ]; then
  REMAINING_HOURS=$(( REMAINING / 3600000 ))
  log "Token still valid for ~${REMAINING_HOURS}h, no refresh needed"
  # Still sync current token to .env in case they diverged
  NEW_TOKEN=$(jq -r '.claudeAiOauth.accessToken' "$CREDS_FILE")
  sed -i '/^CLAUDE_CODE_OAUTH_TOKEN=/d' "$ENV_FILE"
  echo "CLAUDE_CODE_OAUTH_TOKEN=${NEW_TOKEN}" >> "$ENV_FILE"
  log "Token synced to .env"
  exit 0
fi

log "Token expires in ~$(( REMAINING / 3600000 ))h ($(( REMAINING / 60000 ))m), refreshing..."

# Call OAuth refresh endpoint directly
RESPONSE=$(curl -sS -X POST "$OAUTH_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"${REFRESH_TOKEN}\",\"client_id\":\"${CLIENT_ID}\"}" \
  --max-time 30 2>&1) || {
  log_error "curl failed: $RESPONSE"
  notify_whatsapp "FAILED: Could not reach OAuth endpoint. curl error."
  exit 1
}

# Check for error in response
if echo "$RESPONSE" | jq -e '.error' &>/dev/null; then
  ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // .error.message // "unknown error"')
  log_error "OAuth refresh failed: $ERROR_MSG"
  log_error "Full response: $RESPONSE"
  notify_whatsapp "FAILED: OAuth refresh returned error: $ERROR_MSG. May need 'claude /login'."
  exit 1
fi

# Extract new tokens from response
NEW_ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token // empty')
NEW_REFRESH_TOKEN=$(echo "$RESPONSE" | jq -r '.refresh_token // empty')
EXPIRES_IN=$(echo "$RESPONSE" | jq -r '.expires_in // empty')

if [ -z "$NEW_ACCESS_TOKEN" ]; then
  log_error "No access_token in response"
  log_error "Full response: $RESPONSE"
  notify_whatsapp "FAILED: OAuth response missing access_token. May need 'claude /login'."
  exit 1
fi

# Calculate new expiresAt (current time + expires_in seconds, in ms)
if [ -n "$EXPIRES_IN" ]; then
  NEW_EXPIRES_AT=$(( $(date +%s) * 1000 + EXPIRES_IN * 1000 ))
else
  # Default to 8 hours if expires_in not provided
  NEW_EXPIRES_AT=$(( $(date +%s) * 1000 + 28800000 ))
fi

# Update credentials.json with new tokens
# Use a temp file + mv for atomicity
TEMP_CREDS=$(mktemp)
jq --arg at "$NEW_ACCESS_TOKEN" \
   --arg rt "${NEW_REFRESH_TOKEN:-$(jq -r '.claudeAiOauth.refreshToken' "$CREDS_FILE")}" \
   --argjson exp "$NEW_EXPIRES_AT" \
   '.claudeAiOauth.accessToken = $at | .claudeAiOauth.refreshToken = $rt | .claudeAiOauth.expiresAt = $exp' \
   "$CREDS_FILE" > "$TEMP_CREDS" && mv "$TEMP_CREDS" "$CREDS_FILE"

log "credentials.json updated (expires in ${EXPIRES_IN:-28800}s)"

# Update .env — proxy re-reads on each request, no restart needed
sed -i '/^CLAUDE_CODE_OAUTH_TOKEN=/d' "$ENV_FILE"
echo "CLAUDE_CODE_OAUTH_TOKEN=${NEW_ACCESS_TOKEN}" >> "$ENV_FILE"

log "OAuth token refreshed and synced to .env"
