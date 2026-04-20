---
name: create-project
description: Scaffold a new research project end-to-end — GitHub repo from template, Discord channel, Shoggoth registration, vault docs. Use when the user asks to create a new project, promote an idea to a project, or spin up full infrastructure for a research effort. For just adding a Discord channel to an existing project, use /create-project-channel instead.
---

# /create-project — Full project scaffold

Creates the full set of artifacts for a new research project:

1. **Vault docs** — `projects/{slug}/PROJECT.md`, writing-rubric, index update (you do this via `mcp__mcpvault__`)
2. **GitHub repo** — private repo from `cmhenry/research-project-template`, cloned to `~/projects/{slug}` (host does this via IPC)
3. **Discord channel** — `#{slug}` created and registered in Shoggoth with `projectPath` linked (host does this via the same IPC)

Credentials (`gh` auth, Discord bot token, guild ID) live on the host. You don't need them — you write one IPC task and the host does the privileged work.

**Main-channel only.** Detect main via the Shoggoth-specific file marker:

```bash
test -f /workspace/project/src/container-runner.ts && echo "MAIN" || echo "NOT_MAIN"
```

If `NOT_MAIN`, respond:
> This command is only available from the main channel.

Then stop.

## When NOT to use this skill

- **Just need a channel, project already exists** → use `/create-project-channel` (narrower, doesn't touch GitHub or vault).
- **Promoting an explored idea note from `feeds/inbox/`** → use `/idea-triage` with "upgrade to project". It handles the ORIGIN.md move + scratch cleanup that's specific to the idea pipeline, then calls the same scaffold IPC. Only use `/create-project` for projects that aren't coming from an idea note.

## Inputs

Gather from the user before doing anything:

| Input | Required | Notes |
|---|---|---|
| `project-name` | yes | Slug: lowercase alphanumeric + hyphens, 1–63 chars, starts alphanumeric, not in reserved list (`main`, `global`, `test`, `node-modules`, `dist`, `src`, `node`) |
| `title` | yes | Human-readable title for PROJECT.md heading |
| `one-line-summary` | yes | Seeds PROJECT.md and the index row |
| `context` | optional | Longer background — prior findings, motivation, papers |
| `template-repo` | optional | Defaults to `cmhenry/research-project-template`. Host forces the `cmhenry/` owner regardless of input |
| `skip-github` / `skip-discord` | optional | For the rare case only one side is wanted |

## Steps

### 1. Guard and dedup check

Check main-channel marker (above). Then list what already exists — running these in parallel is fine:

```bash
ls -1 /home/square/projects/
cat /workspace/ipc/available_groups.json
```

And via MCP: `mcp__mcpvault__list_directory` on `projects/`.

If the slug already exists in any of the three places, surface that and ask the user how to proceed (rename, abort, or reuse existing artifacts — the scaffold IPC is idempotent for repo+channel, but the vault writes will overwrite).

### 2. Confirm

State the full plan back to the user:

- Vault: `projects/{slug}/PROJECT.md`, `projects/{slug}/writing-rubric.md`, update `projects/_index.md`
- GitHub: `github.com/cmhenry/{slug}` (from template)
- Discord: `#{slug}`, registered with `projectPath: /home/square/projects/{slug}`

Wait for confirmation before proceeding.

### 3. Write vault docs

Do these first — they're the cheapest operations and give you something to report if the IPC step fails.

**`projects/{slug}/PROJECT.md`** via `mcp__mcpvault__write_note`:

```yaml
---
phase: research
priority: medium
last_updated: YYYY-MM-DD
---
```

Body:
- `# {Title}` — from user
- `## Status` — "Created YYYY-MM-DD. {one-line-summary}"
- `## Context` — user's context, if given
- `## Key Decisions` — "YYYY-MM-DD — Project created"

**`projects/{slug}/writing-rubric.md`** via `mcp__mcpvault__write_note`. Use the template structure from `idea-triage/SKILL.md` section "Generate writing rubric" — Venue, Audience, Framing Constraints, Citation Norms, Section-Specific Notes, Project-Specific Anti-Patterns. Seed from user context where available, `TBD` otherwise.

**Update `projects/_index.md`** via `mcp__mcpvault__patch_note` — append a row to the Active Projects table:

```
| [{slug}]({slug}/PROJECT.md) | research | medium | YYYY-MM-DD | New project; {one-line-summary} |
```

Insert before any section break or `## Project Clusters`.

### 4. Scaffold host resources via IPC

Write the task file:

```bash
cat > /workspace/ipc/tasks/scaffold_project_$(date +%s).json << 'IPCEOF'
{
  "type": "scaffold_project",
  "projectName": "{slug}",
  "requestedBy": "{chat-jid-of-requesting-channel}"
}
IPCEOF
```

Optional fields: `"templateRepo": "other-template"`, `"skipGithub": true`, `"skipDiscord": true`.

`requestedBy` is the JID of the chat where the user made the request.

### 5. Read result

Wait a few seconds (the `gh repo create` + clone can take 10–30s), then:

```bash
ls -t /workspace/ipc/input/scaffold_project_result_*.json 2>/dev/null | head -1 | xargs cat
```

The result shape is:

```json
{
  "action": "scaffold_project_result",
  "success": true,
  "github": { "repoUrl": "...", "clonedTo": "...", "alreadyExisted": false },
  "discord": { "channelId": "...", "channelName": "...", "folder": "...", "alreadyExisted": false }
}
```

On `success: false` the `error` field explains what failed. `github` and/or `discord` may still be populated if they succeeded before the failure.

### 6. Report

**Full success:**
> Project **{slug}** created.
> - Vault: `projects/{slug}/`
> - Repo: github.com/cmhenry/{slug}
> - Discord: #{slug}

**Partial success:** Enumerate what succeeded and what failed. Vault operations always succeed (they ran first, independently of the host). Point out that re-running the IPC is safe — the host checks for existing repos and channels and skips work already done.

**Failure:** Report the host error verbatim. Note that vault docs are already in place, so the user only needs to fix the infra side.

## What not to do

- **Don't try direct Discord API calls** (`curl` with `$DISCORD_BOT_TOKEN`) — the token isn't in the container environment by design. You'll get 401.
- **Don't try `gh`** — not installed in the container. The host has it authenticated.
- **Don't `mkdir ~/projects/{slug}`** — you don't have host filesystem write access. The host's scaffold step clones into the right place.
- **Don't modify the nanoclaw database** — there's no direct access. The `scaffold_project` IPC registers the Discord channel atomically on the host.
- **Don't proceed without confirmation.** Full scaffold creates a private repo, Discord channel, and vault files — all user-visible. Confirm the slug and title first.
