# Claude Code Prompt: OAuth Token Auto-Refresh

## Context

NanoClaw's credential proxy reads `CLAUDE_CODE_OAUTH_TOKEN` from `.env`
to authenticate API calls via the Max subscription. The OAuth token is
stored in `~/.claude/.credentials.json` by the Claude Code CLI and
expires after ~8 hours. When it expires, the credential proxy can't
authenticate and all agent calls fail.

## Refresh Mechanism

The script `scripts/refresh-oauth.sh` calls the Anthropic OAuth token
endpoint directly with the refresh token — no Claude CLI dependency.

**Endpoint:** `POST https://api.anthropic.com/v1/oauth/token`

**Request:**
```json
{
  "grant_type": "refresh_token",
  "refresh_token": "sk-ant-ort01-...",
  "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
}
```

**Response:** Returns `access_token`, `refresh_token`, `expires_in` (28800s = 8h).

The script:
1. Checks `~/.claude/.credentials.json` expiry
2. If expiring within 6 hours, calls the refresh endpoint via `curl`
3. Updates both `credentials.json` and `.env` with new tokens
4. On failure, sends a WhatsApp notification via IPC so the user knows
   to run `claude /login` manually

The credential proxy re-reads `.env` on each request, so no service
restart is needed.

## Cron Schedule

```
0 */4 * * * /home/square/shoggoth/scripts/refresh-oauth.sh >> /home/square/shoggoth/logs/oauth-refresh.log 2>&1
```

Runs every 4 hours. With 8-hour token lifetime and 6-hour refresh
buffer, every cron run will refresh the token.

## Failure Notifications

On any failure (missing credentials, bad refresh token, endpoint error),
the script sends a WhatsApp message to the owner via the IPC mechanism
(`data/ipc/whatsapp_main/messages/`). This requires NanoClaw to be
running and WhatsApp to be connected.

## When Manual Login Is Needed

The refresh token itself can expire or be revoked. When that happens:
1. You'll get a WhatsApp notification about the failure
2. SSH into the server and run `claude /login`
3. The next cron run will pick up the new tokens automatically
