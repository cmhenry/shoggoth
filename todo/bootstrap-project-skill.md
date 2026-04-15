# Full project-bootstrap skill

**Goal:** replace `container/skills/create-project-channel` with a single `bootstrap-project` flow that takes a project name and does everything: GH repo from template, project dir, group folder, Obsidian vault folder + `PROJECT.md`, `_index.md` row, Discord channel under the `projects` category, DB registration, service refresh.

Most of the host-side primitives already exist (`src/scaffold-project.ts`, `scaffold_project` IPC handler in `src/ipc.ts:543`). The work below closes the gaps.

## Gaps to close

### 1. Category placement for Discord channels
`src/channels/discord.ts:261` — `createChannel(name)` takes only a name. Extend to accept an optional parent category id or name:

```ts
async createChannel(name: string, opts?: { parent?: string }): Promise<{ id: string; name: string }>
```

Look up the category by name (`projects`) in `guild.channels.cache`, pass its id as `parent`. Surface a config key (e.g. `DISCORD_PROJECT_CATEGORY=projects`) with a sensible default. The ad-hoc bootstrap script for `constitutional-ai` demonstrates the lookup pattern (see git history around 2026-04-15 if needed — the script was removed after use).

### 2. Vault-side scaffolding
`src/scaffold-project.ts` currently covers GH + Discord + DB but doesn't touch Obsidian. Add a step that:

- Creates `<vault>/projects/<name>/PROJECT.md` from a template with frontmatter (`phase`, `priority`, `last_updated`) plus empty `Status` / `Context` / `Key Decisions` sections. Match the `sae-regulatory` / `gravity-misinfo` format in the vault.
- Appends a row to `<vault>/projects/_index.md` under the new-projects table block.
- Seeds `PROJECT.md` body from an optional `contextFile` param if provided (used by idea-triage handoff — see gap 3).

Vault path should come from a new config entry (`OBSIDIAN_VAULT_ROOT`); default `~/obsidian-notes` to match current setup.

### 3. Idea-triage → bootstrap handoff
The idea-triage container skill promotes an idea into a project. Today it presumably writes notes somewhere; it should also emit a `scaffold_project` IPC task with:

- `projectName`: the promoted idea's slug
- `contextFile`: path to the triage note/framework doc, so the new `PROJECT.md` seeds from it rather than a blank template
- `requestedBy`: originating chat JID

Wire the new `scaffold-project` vault step to read `contextFile` and embed (or link to) its content in the `Context` section of `PROJECT.md`.

### 4. Retire `create-project-channel` container skill
Replace `container/skills/create-project-channel/SKILL.md` with a new `bootstrap-project` skill that writes a single `scaffold_project` IPC task and reads the result. Drop the multi-step `create-project-channel` instructions. Update the main-only check marker (currently `/workspace/project/src/container-runner.ts`) to match whatever Shoggoth-specific file is most stable.

### 5. Validation and idempotence
`scaffold-project.ts` already guards against overwriting a non-git existing dir. Add matching guards for:

- Vault folder / `PROJECT.md` already exists → skip, don't overwrite
- `_index.md` already has a row for this project → skip the append
- Discord channel already exists under the category → reuse the id rather than creating a duplicate

Report each step's `alreadyExisted: true/false` in the result so re-running is safe.

## Acceptance

Running `/bootstrap-project constitutional-ai` (hypothetically, from fresh) produces the same end state as the manual work on 2026-04-15:
- `cmhenry/constitutional-ai` private GH repo from template
- `~/projects/constitutional-ai/` cloned with any seeded context file committed
- `groups/project_constitutional-ai/{CLAUDE.md,logs}`
- Vault `projects/constitutional-ai/PROJECT.md` + `_index.md` row
- Discord `#constitutional-ai` under `projects` category
- DB row with `project_path`, `requires_trigger=1`, `is_main=0`
- nanoclaw restarted
