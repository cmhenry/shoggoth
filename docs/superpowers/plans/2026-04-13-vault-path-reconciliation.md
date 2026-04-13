# Vault Path Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update all vault path references in the Shoggoth codebase to match the reorganized Obsidian vault, remove stale researcher context loading from mechanical skills, rewrite daily-briefing as an ephemeral standup, absorb preferences.md into CLAUDE.md, and move/delete vault files.

**Architecture:** Pure config/documentation migration — no source code changes to Node.js/TypeScript. All changes are in markdown skill files, group CLAUDE.md, and one bash script. The vault file moves are MCP-Vault operations or filesystem moves.

**Tech Stack:** Markdown, Bash, MCP-Vault tools

---

## File Structure

No new source files are created. Existing files are modified or renamed:

| File | Action |
|---|---|
| `container/skills/idea-capture/SKILL.md` | Modify: path updates, remove researcher context loading |
| `container/skills/idea-explore/SKILL.md` | Modify: path updates |
| `container/skills/idea-nudge/SKILL.md` | Modify: path updates |
| `container/skills/idea-triage/SKILL.md` | Modify: path updates |
| `container/skills/literature-monitoring/SKILL.md` | Modify: path updates, remove researcher context loading |
| `container/skills/reading-list/SKILL.md` | Modify: path updates, remove researcher context loading |
| `container/skills/paper-drafting/SKILL.md` | Modify: path updates |
| `container/skills/paper-critique/SKILL.md` | Modify: path updates |
| `container/skills/paper-revision/SKILL.md` | Modify: path updates |
| `container/skills/project-status/SKILL.md` | Modify: path updates |
| `container/skills/daily-briefing/SKILL.md` | Delete (replaced by standup) |
| `container/skills/standup/SKILL.md` | Create: new standup skill |
| `container/skills/capabilities/SKILL.md` | Modify: minor vault description update |
| `.claude/skills/shoggoth/idea-capture.md` | Modify: path updates, remove researcher context loading |
| `.claude/skills/shoggoth/reading-list.md` | Modify: path updates, remove researcher context loading |
| `.claude/skills/shoggoth/paper-drafting.md` | Modify: path updates |
| `.claude/skills/shoggoth/daily-briefing.md` | Delete (replaced by standup) |
| `.claude/skills/shoggoth/standup.md` | Create: new host standup skill |
| `.claude/skills/shoggoth/research-investigation.md` | Modify: path updates |
| `.claude/skills/shoggoth/literature-monitoring.md` | Modify: path updates, remove researcher context loading |
| `groups/global/CLAUDE.md` | Modify: update paths, absorb preferences, update skill table |
| `scripts/agent-draft.sh` | Modify: update vault paths |

---

### Task 1: Container skills — mechanical path updates

Update vault path references in container skill files that only need find-and-replace. No behavioral changes — just paths.

**Files:**
- Modify: `container/skills/idea-nudge/SKILL.md`
- Modify: `container/skills/idea-explore/SKILL.md`
- Modify: `container/skills/project-status/SKILL.md`
- Modify: `container/skills/paper-drafting/SKILL.md`
- Modify: `container/skills/paper-critique/SKILL.md`
- Modify: `container/skills/paper-revision/SKILL.md`
- Modify: `container/skills/capabilities/SKILL.md`

**Path substitution table** (apply to all files in this task):

| Old | New |
|---|---|
| `_meta/researcher-profile.md` | `reference/researcher-profile.md` |
| `_meta/top-of-mind.md` | **remove the line/reference entirely** |
| `_meta/preferences.md` | **remove the line/reference entirely** |
| `_meta/global-writing-rubric.md` | `reference/templates/global-writing-rubric.md` |
| `_meta/writing-rubric.md` | `reference/templates/global-writing-rubric.md` |
| `ideas/` (as a vault directory) | `feeds/inbox/` |
| `ideas/scratch.md` | `feeds/inbox/scratch.md` |
| `ideas/archive/` | `feeds/inbox/archive/` |
| `literature/` (as a vault directory) | `feeds/literature/` |
| `literature/weekly-` | `feeds/literature/weekly-` |
| `literature/queue.md` | `feeds/literature/queue.md` |
| `literature/notes/` | `feeds/literature/notes/` |
| `projects/_registry.md` | `projects/_index.md` |
| `briefings/` | **remove references** |

- [ ] **Step 1: Update `container/skills/idea-nudge/SKILL.md`**

Replace `ideas/` with `feeds/inbox/` and `scratch.md` with `feeds/inbox/scratch.md`:

Line 10, change:
```
When the researcher shares a substantive research thought — a hypothesis, a methodological angle, a connection between literatures — capture it as a note in `ideas/` and add a backlink to the scratch.
```
to:
```
When the researcher shares a substantive research thought — a hypothesis, a methodological angle, a connection between literatures — capture it as a note in `feeds/inbox/` and add a backlink to the scratch.
```

Line 18, change:
```
1. **Scan idea notes** — `mcp__mcpvault__list_directory` on `ideas/` to get all idea files (skip `scratch.md`, `archive/`, and any non-markdown files).
```
to:
```
1. **Scan idea notes** — `mcp__mcpvault__list_directory` on `feeds/inbox/` to get all idea files (skip `scratch.md`, `archive/`, and any non-markdown files).
```

No other changes needed — this skill doesn't reference `_meta/` or researcher context.

- [ ] **Step 2: Update `container/skills/idea-explore/SKILL.md`**

Line 25-26, replace the context-reading block:
```
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` for methods, interests, career stage
   - `mcp__mcpvault__read_note` on `_meta/top-of-mind.md` for current priorities
```
with:
```
   - `mcp__mcpvault__read_note` on `reference/researcher-profile.md` for methods, interests, career stage
```

Line 35, change:
```
   **Framing agent:** What's the theoretical contribution? How does this connect to the researcher's existing work and methods? Develop 2-3 possible angles, each with what it would contribute if successful. Read `_meta/researcher-profile.md` for the researcher's known expertise.
```
to:
```
   **Framing agent:** What's the theoretical contribution? How does this connect to the researcher's existing work and methods? Develop 2-3 possible angles, each with what it would contribute if successful. Read `reference/researcher-profile.md` for the researcher's known expertise.
```

Line 58, change:
```
1. Read `ideas/scratch.md` to get the list of backlinked ideas
```
to:
```
1. Read `feeds/inbox/scratch.md` to get the list of backlinked ideas
```

- [ ] **Step 3: Update `container/skills/project-status/SKILL.md`**

Line 22, change:
```
   - Check `ideas/` for sparks connected to this project
```
to:
```
   - Check `feeds/inbox/` for sparks connected to this project
```

No `_meta/` references in this file — it's already clean.

- [ ] **Step 4: Update `container/skills/paper-drafting/SKILL.md`**

Lines 48-50, replace:
```
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` — who the researcher is
   - `mcp__mcpvault__read_note` on `_meta/preferences.md` — writing style preferences
   - `mcp__mcpvault__read_note` on the project's vault directory — current status and goals
```
with:
```
   - `mcp__mcpvault__read_note` on `reference/researcher-profile.md` — who the researcher is
   - `mcp__mcpvault__read_note` on the project's vault directory — current status and goals
```

Line 64, change:
```
6. **Read the rubrics.** Load both `_meta/global-writing-rubric.md` (global rules via `mcp__mcpvault__read_note`) and the project's `writing-rubric.md` if one exists (check the project root). These define what you'll evaluate your draft against in the self-review pass.
```
to:
```
6. **Read the rubrics.** Load both `reference/templates/global-writing-rubric.md` (global rules via `mcp__mcpvault__read_note`) and the project's `writing-rubric.md` if one exists (check the project root). These define what you'll evaluate your draft against in the self-review pass.
```

Line 90, change:
```
Evaluate your draft against both the global rubric (`_meta/global-writing-rubric.md`) and the project rubric (if it exists). For each rubric criterion, produce a brief assessment:
```
to:
```
Evaluate your draft against both the global rubric (`reference/templates/global-writing-rubric.md`) and the project rubric (if it exists). For each rubric criterion, produce a brief assessment:
```

- [ ] **Step 5: Update `container/skills/paper-critique/SKILL.md`**

Line 45, change:
```
1. **Read the rubrics.** Load `_meta/global-writing-rubric.md` (global rules via `mcp__mcpvault__read_note`) and the project's `writing-rubric.md` (if it exists — check the project root). These are your evaluation criteria.
```
to:
```
1. **Read the rubrics.** Load `reference/templates/global-writing-rubric.md` (global rules via `mcp__mcpvault__read_note`) and the project's `writing-rubric.md` (if it exists — check the project root). These are your evaluation criteria.
```

Line 50, change:
```
   - `mcp__mcpvault__read_note` on `_meta/preferences.md` — the researcher's known standards
```
to (remove this line entirely — preferences is absorbed into CLAUDE.md):
```
```

Line 80, change:
```
Rubric: _meta/global-writing-rubric.md [+ project rubric if used]
```
to:
```
Rubric: reference/templates/global-writing-rubric.md [+ project rubric if used]
```

- [ ] **Step 6: Update `container/skills/paper-revision/SKILL.md`**

Line 58, change:
```
4. **Read the project rubrics** (`_meta/global-writing-rubric.md` via `mcp__mcpvault__read_note` and the project's `writing-rubric.md` if it exists in the project root) to understand the evaluation criteria. The critique file's rubric assessment tells you which criteria failed.
```
to:
```
4. **Read the project rubrics** (`reference/templates/global-writing-rubric.md` via `mcp__mcpvault__read_note` and the project's `writing-rubric.md` if it exists in the project root) to understand the evaluation criteria. The critique file's rubric assessment tells you which criteria failed.
```

- [ ] **Step 7: Update `container/skills/capabilities/SKILL.md`**

No `_meta/` references in this file. No path changes needed — vault tool descriptions are generic. Skip this file.

- [ ] **Step 8: Commit**

```bash
git add container/skills/idea-nudge/SKILL.md container/skills/idea-explore/SKILL.md container/skills/project-status/SKILL.md container/skills/paper-drafting/SKILL.md container/skills/paper-critique/SKILL.md container/skills/paper-revision/SKILL.md
git commit -m "refactor: update vault paths in container skills (idea, paper, project)

Update _meta/ references to reference/, ideas/ to feeds/inbox/,
literature/ to feeds/literature/, projects/_registry.md to
projects/_index.md. Remove top-of-mind.md and preferences.md
references (absorbed into CLAUDE.md / eliminated)."
```

---

### Task 2: Container skills — idea-capture and idea-triage path + behavior updates

These two skills need path updates AND behavioral changes (idea-capture loses researcher context loading; idea-triage has multiple path changes including registry rename).

**Files:**
- Modify: `container/skills/idea-capture/SKILL.md`
- Modify: `container/skills/idea-triage/SKILL.md`

- [ ] **Step 1: Update `container/skills/idea-capture/SKILL.md`**

Line 10, change:
```
When the researcher shares a substantive research thought — a hypothesis, a methodological angle, a connection between literatures — capture it as a note in `ideas/` and add a backlink to the scratch.
```
to:
```
When the researcher shares a substantive research thought — a hypothesis, a methodological angle, a connection between literatures — capture it as a note in `feeds/inbox/` and add a backlink to the scratch.
```

Lines 17-18, replace:
```
1. **Read researcher context** — `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` and `_meta/top-of-mind.md` to understand the researcher's active interests and projects.

2. **Check for duplicates** — `mcp__mcpvault__search_notes` in `ideas/` to see if a similar idea already exists. If it does, tell the researcher and offer to add to the existing note instead.
```
with:
```
1. **Check for duplicates** — `mcp__mcpvault__search_notes` in `feeds/inbox/` to see if a similar idea already exists. If it does, tell the researcher and offer to add to the existing note instead.
```

Line 22 (was line 23 before renumbering), change:
```
3. **Write the idea note** — `mcp__mcpvault__write_note` to `ideas/YYYY-MM-DD-slug.md`:
```
to:
```
2. **Write the idea note** — `mcp__mcpvault__write_note` to `feeds/inbox/YYYY-MM-DD-slug.md`:
```

Line 36 (was line 37), change:
```
4. **Add to scratch** — `mcp__mcpvault__patch_note` on `ideas/scratch.md` to prepend (newest first) a backlinked one-liner:
```
to:
```
3. **Add to scratch** — `mcp__mcpvault__patch_note` on `feeds/inbox/scratch.md` to prepend (newest first) a backlinked one-liner:
```

Renumber step 5 → 4 ("Confirm").

Line 57, change:
```
- Don't create subdirectories inside `ideas/`
```
to:
```
- Don't create subdirectories inside `feeds/inbox/`
```

- [ ] **Step 2: Update `container/skills/idea-triage/SKILL.md`**

All `ideas/` → `feeds/inbox/`:

Line 22, change `ideas/YYYY-MM-DD-slug.md` to `feeds/inbox/YYYY-MM-DD-slug.md`
Line 22, change `ideas/archive/YYYY-MM-DD-slug.md` to `feeds/inbox/archive/YYYY-MM-DD-slug.md`
Line 26, change `ideas/scratch.md` to `feeds/inbox/scratch.md`
Line 32, change `ideas/YYYY-MM-DD-slug.md` to `feeds/inbox/YYYY-MM-DD-slug.md`
Line 52, change `ideas/YYYY-MM-DD-slug.md` to `feeds/inbox/YYYY-MM-DD-slug.md`

Line 61, change:
```
   Project-specific evaluation criteria. Supplements `_meta/writing-rubric.md`
```
to:
```
   Project-specific evaluation criteria. Supplements `reference/templates/global-writing-rubric.md`
```

Line 102, change:
```
6. **Update registry** — `mcp__mcpvault__patch_note` on `projects/_registry.md` to append a row to the Active Projects table:
```
to:
```
6. **Update index** — `mcp__mcpvault__patch_note` on `projects/_index.md` to append a row to the Active Projects table:
```

Line 110, change:
```
7. **Remove from scratch** — `mcp__mcpvault__patch_note` on `ideas/scratch.md` to remove the line containing the idea's backlink.
```
to:
```
7. **Remove from scratch** — `mcp__mcpvault__patch_note` on `feeds/inbox/scratch.md` to remove the line containing the idea's backlink.
```

Also update the archive confirmation message (line 28 area):
```
4. **Confirm** — "Archived [[slug]]. It's in ideas/archive/ if you need it later."
```
to:
```
4. **Confirm** — "Archived [[slug]]. It's in feeds/inbox/archive/ if you need it later."
```

- [ ] **Step 3: Commit**

```bash
git add container/skills/idea-capture/SKILL.md container/skills/idea-triage/SKILL.md
git commit -m "refactor: update idea-capture and idea-triage vault paths

idea-capture: remove researcher context loading (mechanical task),
update ideas/ to feeds/inbox/.
idea-triage: update all ideas/ paths to feeds/inbox/, _registry.md
to _index.md, _meta/writing-rubric to reference/templates/."
```

---

### Task 3: Container skills — literature-monitoring and reading-list (path + context removal)

These two skills need path updates AND removal of eager researcher context loading.

**Files:**
- Modify: `container/skills/literature-monitoring/SKILL.md`
- Modify: `container/skills/reading-list/SKILL.md`

- [ ] **Step 1: Update `container/skills/literature-monitoring/SKILL.md`**

Lines 15-16, replace:
```
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` for research interests, methods, and domain keywords
   - `mcp__mcpvault__read_note` on `_meta/top-of-mind.md` for current priorities (weight results toward active concerns)
```
with:
```
   - `mcp__mcpvault__list_directory` on `projects/` and `mcp__mcpvault__read_multiple_notes` on each project's `PROJECT.md` for active research topics and keywords
```

Line 22 (search terms), change:
```
   - Search terms derived from: researcher interests, active project topics, and top-of-mind priorities
```
to:
```
   - Search terms derived from: active project topics and research needs from PROJECT.md files
```

Line 25, change:
```
   - **Must-Read** (2-5 papers): Directly relevant to active projects or top-of-mind priorities. The researcher would want to know about these immediately.
```
to:
```
   - **Must-Read** (2-5 papers): Directly relevant to active projects. The researcher would want to know about these immediately.
```

Line 31, change:
```
4. **Write the weekly note** — `mcp__mcpvault__write_note` to `literature/weekly-YYYY-WNN.md`:
```
to:
```
4. **Write the weekly note** — `mcp__mcpvault__write_note` to `feeds/literature/weekly-YYYY-WNN.md`:
```

Line 47, change:
```
5. **Update the reading queue** — `mcp__mcpvault__read_note` on `literature/queue.md`, then append must-read papers via `mcp__mcpvault__write_note` (append mode) or `mcp__mcpvault__patch_note`.
```
to:
```
5. **Update the reading queue** — `mcp__mcpvault__read_note` on `feeds/literature/queue.md`, then append must-read papers via `mcp__mcpvault__write_note` (append mode) or `mcp__mcpvault__patch_note`.
```

Line 67, change:
```
- Don't include papers the researcher has already cited (check `literature/notes/` for existing entries)
```
to:
```
- Don't include papers the researcher has already cited (check `feeds/literature/notes/` for existing entries)
```

- [ ] **Step 2: Update `container/skills/reading-list/SKILL.md`**

Lines 16, replace:
```
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md`, `_meta/top-of-mind.md`
```
with (remove this step entirely — project statuses in step 2 provide the context):
```
```

Renumber subsequent steps (old step 2 becomes step 1, etc.).

Line 24, change:
```
   - `mcp__mcpvault__search_notes` in `literature/` for recent `weekly-*.md` files
```
to:
```
   - `mcp__mcpvault__search_notes` in `feeds/literature/` for recent `weekly-*.md` files
```

Line 39, change:
```
     - **Researcher signals** (mentioned in top-of-mind, flagged in conversation)
```
to:
```
     - **Researcher signals** (flagged in conversation or recent daily notes)
```

Line 45, change:
```
7. **Write vault note** — `mcp__mcpvault__write_note` to `literature/reading-list.md`:
```
to:
```
6. **Write vault note** — `mcp__mcpvault__write_note` to `feeds/literature/reading-list.md`:
```

Renumber the remaining steps accordingly.

- [ ] **Step 3: Commit**

```bash
git add container/skills/literature-monitoring/SKILL.md container/skills/reading-list/SKILL.md
git commit -m "refactor: update literature skills — remove eager context loading

literature-monitoring: derive search terms from active projects
instead of researcher-profile + top-of-mind. Update literature/
to feeds/literature/.
reading-list: remove researcher context step, update literature/
to feeds/literature/, replace top-of-mind references."
```

---

### Task 4: Rewrite daily-briefing as standup (container skill)

Replace the daily-briefing container skill with a new standup skill. The standup is ephemeral (no vault writes), scans workbench + projects, and opens a conversation.

**Files:**
- Delete: `container/skills/daily-briefing/SKILL.md`
- Create: `container/skills/standup/SKILL.md`

- [ ] **Step 1: Create `container/skills/standup/SKILL.md`**

```markdown
---
name: standup
description: >
  Ephemeral morning standup. Scans projects, workbench, and idea pipeline,
  then opens a conversation about today's priorities. No vault writes.
  Replaces the old daily-briefing skill.
---

# Standup

A time-bounded morning check-in. You scan the researcher's workbench and projects, notice what's moved and what's stalled, and open a conversation. The researcher tells you what they're working on today. You flag conflicts or forgotten deadlines. Nothing persists from the standup itself — decisions get captured by the researcher in a daily note or task tracker.

## When this runs

Scheduled weekday mornings. Can also be triggered on demand ("standup", "what should I work on today", "morning check-in").

## Process

1. **Scan project statuses:**
   - `mcp__mcpvault__list_directory` on `projects/`
   - `mcp__mcpvault__read_multiple_notes` on each project's `PROJECT.md`
   - Note: current phase, blockers, deadlines, last_updated dates
   - Flag projects with no update in 14+ days as potentially stalled

2. **Scan recent workbench activity:**
   - `mcp__mcpvault__list_directory` on `workbench/daily/` — read the 2-3 most recent daily notes for continuity
   - `mcp__mcpvault__list_directory` on `workbench/reflections/` — read the latest weekly reflection for current priorities and self-orientation

3. **Check idea pipeline:**
   - `mcp__mcpvault__read_note` on `feeds/inbox/scratch.md` — count of active ideas
   - `mcp__mcpvault__list_directory` on `feeds/inbox/` — check frontmatter for `status: spark` (unexplored) and `status: explored` (awaiting triage)

4. **Check recent vault activity:**
   - `mcp__mcpvault__get_vault_stats` for recently modified files
   - Note anything that changed since the last standup

5. **Open the conversation:**
   - Lead with the single most important thing: a deadline, a blocker, a stalled project, or a decision needed
   - Briefly summarize project momentum: what moved, what didn't
   - If ideas are awaiting triage, mention the count
   - Ask: "What are you working on today?"
   - Keep the opening message under 300 words — this is a conversation starter, not a report

6. **During the conversation:**
   - Flag scheduling conflicts if the researcher's stated plan doesn't account for known deadlines
   - Pull in additional vault context on demand — use `mcp__mcpvault__read_note` or `mcp__mcpvault__search_notes` to reference `reference/venues.md`, `feeds/career/`, `reference/collaborators.md`, project working-notes, etc. as the conversation warrants
   - Don't eagerly load anything not listed in steps 1-4

## Project stage detection

Use these heuristics when assessing project health:

- **Active**: 3+ notes/week, concrete tasks being completed
- **Stalled**: No activity in 7-14 days, no explicit blocker
- **Blocked**: Explicit mention of blockers, "waiting on" language
- **Maintenance**: Infrequent updates, small adjustments
- **Complete**: Explicit completion marker, no activity 30+ days

## What this produces

A conversational message. No vault writes. The researcher captures decisions in their own daily note or task tracker.

## What not to do

- Don't write briefing notes to the vault — the standup is ephemeral
- Don't generate a report document — open a conversation
- Don't load researcher-profile.md — this is a mechanical scan
- Don't run on weekends unless asked
- Don't include projects with nothing to report
- Don't use vague language ("consider reviewing", "might want to look at")
- Don't pad with motivational filler
- Don't make decisions for the researcher — surface information, flag conflicts, ask questions
```

- [ ] **Step 2: Delete `container/skills/daily-briefing/SKILL.md`**

```bash
rm container/skills/daily-briefing/SKILL.md
rmdir container/skills/daily-briefing/
```

- [ ] **Step 3: Commit**

```bash
git add container/skills/standup/SKILL.md
git rm container/skills/daily-briefing/SKILL.md
git commit -m "feat: replace daily-briefing with ephemeral standup skill

The standup scans projects, workbench/daily, workbench/reflections,
and feeds/inbox to open a conversation about today's priorities.
No vault writes — decisions captured by the researcher. Absorbs
project stage detection heuristics from the old preferences.md."
```

---

### Task 5: Host skills — path updates and context removal

Update the `.claude/skills/shoggoth/` host skill files with the same path and context-loading changes.

**Files:**
- Modify: `.claude/skills/shoggoth/idea-capture.md`
- Modify: `.claude/skills/shoggoth/reading-list.md`
- Modify: `.claude/skills/shoggoth/paper-drafting.md`
- Modify: `.claude/skills/shoggoth/research-investigation.md`
- Modify: `.claude/skills/shoggoth/literature-monitoring.md`
- Delete: `.claude/skills/shoggoth/daily-briefing.md`
- Create: `.claude/skills/shoggoth/standup.md`

- [ ] **Step 1: Update `.claude/skills/shoggoth/idea-capture.md`**

Line 10, change `ideas/` to `feeds/inbox/`.

Lines 18-19, replace:
```
1. **Read researcher context** — `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` and `_meta/top-of-mind.md` to understand the researcher's active interests and projects.

2. **Write the note** — `mcp__mcpvault__write_note` to `ideas/YYYY-MM-DD-slug.md` with:
```
with:
```
1. **Check for duplicates** — `mcp__mcpvault__search_notes` in `feeds/inbox/` to see if a similar idea already exists.

2. **Write the note** — `mcp__mcpvault__write_note` to `feeds/inbox/YYYY-MM-DD-slug.md` with:
```

Remove the "Update the registry" step entirely (line 40 area) — the container skill already removed this step, and there is no `feeds/inbox/_registry.md` in the new vault layout. The container skill uses `feeds/inbox/scratch.md` as the sole index.

Line 52, change `ideas/` to `feeds/inbox/`.

- [ ] **Step 2: Update `.claude/skills/shoggoth/reading-list.md`**

Lines 16, replace:
```
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md`, `_meta/top-of-mind.md`
```
with (remove entirely — project statuses provide context):
```
```

Line 24, change `literature/` to `feeds/literature/`.
Line 39, change `top-of-mind` reference to `daily notes`.
Line 45, change `literature/reading-list.md` to `feeds/literature/reading-list.md`.

Renumber steps after removing step 1.

- [ ] **Step 3: Update `.claude/skills/shoggoth/paper-drafting.md`**

Lines 28-29, replace:
```
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` — who the researcher is
   - `mcp__mcpvault__read_note` on `_meta/preferences.md` — writing style preferences
```
with:
```
   - `mcp__mcpvault__read_note` on `reference/researcher-profile.md` — who the researcher is
```

- [ ] **Step 4: Update `.claude/skills/shoggoth/research-investigation.md`**

Lines 22-23, replace:
```
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` for methods, interests, career stage
   - `mcp__mcpvault__read_note` on `_meta/top-of-mind.md` for current priorities
```
with:
```
   - `mcp__mcpvault__read_note` on `reference/researcher-profile.md` for methods, interests, career stage
```

Line 40 area, change `ideas/YYYY-MM-DD-slug.md` to `feeds/inbox/YYYY-MM-DD-slug.md`.
Line 53 area, change `ideas/_registry.md` to `projects/_index.md`.

- [ ] **Step 5: Update `.claude/skills/shoggoth/literature-monitoring.md`**

Lines 15-16, replace:
```
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` for research interests, methods, and domain keywords
   - `mcp__mcpvault__read_note` on `_meta/top-of-mind.md` for current priorities (weight results toward active concerns)
```
with:
```
   - `mcp__mcpvault__list_directory` on `projects/` and `mcp__mcpvault__read_multiple_notes` on each project's `PROJECT.md` for active research topics and keywords
```

Line 22, change search term derivation to reference active projects instead of researcher interests + top-of-mind.
Line 31, change `literature/weekly-` to `feeds/literature/weekly-`.
Line 47, change `literature/queue.md` to `feeds/literature/queue.md`.
Line 67, change `literature/notes/` to `feeds/literature/notes/`.

- [ ] **Step 6: Create `.claude/skills/shoggoth/standup.md` and delete `daily-briefing.md`**

Create `.claude/skills/shoggoth/standup.md`:

```markdown
---
name: standup
description: >
  Ephemeral morning standup. Scans projects, workbench, and idea pipeline,
  then opens a conversation about today's priorities. No vault writes.
---

# Standup

Morning check-in that scans workbench and projects, surfaces what's moved and stalled, and opens a conversation about today's priorities.

## Process

1. **Read researcher context:**
   - `mcp__mcpvault__list_directory` on `projects/`
   - `mcp__mcpvault__read_multiple_notes` on each project's `PROJECT.md`
   - `mcp__mcpvault__list_directory` on `workbench/daily/` — read 2-3 most recent daily notes
   - `mcp__mcpvault__list_directory` on `workbench/reflections/` — read latest weekly reflection
   - `mcp__mcpvault__read_note` on `feeds/inbox/scratch.md` — idea pipeline count

2. **Open a conversation:**
   - Lead with the most important thing: deadline, blocker, stalled project, or decision needed
   - Summarize project momentum briefly
   - Ask what the researcher is working on today

3. **During conversation:**
   - Flag scheduling conflicts against known deadlines
   - Pull in vault context on demand (`reference/venues.md`, `feeds/career/`, `reference/collaborators.md`, etc.)

## What this produces

A conversation. No vault writes.

## What not to do

- Don't write briefing notes to the vault
- Don't run on weekends unless asked
- Don't load researcher-profile.md
- Don't pad with motivational filler
```

Delete the old file:

```bash
rm .claude/skills/shoggoth/daily-briefing.md
```

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/shoggoth/idea-capture.md .claude/skills/shoggoth/reading-list.md .claude/skills/shoggoth/paper-drafting.md .claude/skills/shoggoth/research-investigation.md .claude/skills/shoggoth/literature-monitoring.md .claude/skills/shoggoth/standup.md
git rm .claude/skills/shoggoth/daily-briefing.md
git commit -m "refactor: update host skills — paths, context loading, standup

Update all _meta/ paths to new vault layout. Remove eager
researcher context loading from mechanical skills. Replace
daily-briefing host skill with standup."
```

---

### Task 6: Update `groups/global/CLAUDE.md` — paths, preferences absorption, skill table

This is the most complex single-file edit. The global CLAUDE.md needs:
1. `_meta/` path references updated
2. `top-of-mind.md` references removed
3. Preferences content absorbed from `reference/agents/preferences.md`
4. Skill table updated (daily-briefing → standup)

**Files:**
- Modify: `groups/global/CLAUDE.md`

- [ ] **Step 1: Update Research Identity section**

Lines 7-11, replace:
```
Your researcher's profile, current priorities, and preferences are stored in the vault under `_meta/`. Before any research-related task, read:
- `_meta/researcher-profile.md` — background, methods, interests, career stage
- `_meta/top-of-mind.md` — current priorities and active concerns
- `_meta/preferences.md` — communication and workflow preferences

Access these via `mcp__mcpvault__read_note`.
```
with:
```
Your researcher's profile is stored in the vault at `reference/researcher-profile.md` — background, methods, interests, career stage. Only load it for tasks where researcher identity shapes the output (exploration, drafting, critique, investigation). Don't load it for mechanical tasks (capture, triage, monitoring, status updates).

Access via `mcp__mcpvault__read_note`.
```

- [ ] **Step 2: Update skill table**

Replace the daily-briefing row (line 39):
```
| Morning briefing (scheduled) or "give me a briefing" | `/daily-briefing` | Scans projects, recent activity, produces actionable briefing |
```
with:
```
| Morning standup (scheduled) or "standup", "what should I work on?" | `/standup` | Scans projects, workbench, opens a conversation about today's priorities |
```

Also update the idea-related paths in the skill table descriptions where `ideas/` appears (line 34):
```
| User shares a research idea, hypothesis, or methodological insight | `/idea-capture` | Captures to vault `ideas/` with backlink in scratch |
```
to:
```
| User shares a research idea, hypothesis, or methodological insight | `/idea-capture` | Captures to vault `feeds/inbox/` with backlink in scratch |
```

- [ ] **Step 3: Add preferences content as behavioral guidance**

After the "## Communication" section (after line 86), add a new section absorbing the key preferences content:

```markdown
## Behavioral Guidance

- Be concise. Bullet points over paragraphs for status updates and task lists.
- Be specific. Reference actual notes, dates, file paths. No generic advice.
- Be proactive. Surface stalled projects, missed connections, and emerging patterns without being asked.
- Be honest. If something looks stalled or deprioritized, say so directly.
- Push back when priorities seem misaligned with stated goals.
- Use Socratic engagement for strategic and framing decisions.
- Autonomous execution within well-defined structures — Shoggoth's architecture shapes what agents do.

### Task generation rules
- Tasks should be specific, actionable, and appropriately sized (30 min to 3 hours).
- Bad: "Work on project." Good: "Draft introduction section for platform-abm revision."
- Priority signals: explicit deadlines > mentioned urgency > regular project work > nice-to-haves.

### Privacy and boundaries
- No email addresses or PII in vault files.
- Be matter-of-fact about personal notes. Don't make assumptions about emotions or relationships.
- Archive contents are historical reference only; don't surface in briefings unless explicitly asked.

### Formatting
- Use YYYY-MM-DD for all dates.
- Project names in kebab-case for folder names.
- Weekly files use ISO week numbers (e.g., 2026-W12).
```

- [ ] **Step 4: Commit**

```bash
git add groups/global/CLAUDE.md
git commit -m "refactor: update global CLAUDE.md — new paths, absorb preferences, standup

Update _meta/ references to new vault paths. Remove top-of-mind
and preferences.md references. Add selective context loading
guidance. Absorb preferences.md behavioral content. Update
skill table: daily-briefing → standup, ideas/ → feeds/inbox/."
```

---

### Task 7: Update `scripts/agent-draft.sh`

**Files:**
- Modify: `scripts/agent-draft.sh`

- [ ] **Step 1: Update vault path references in the prompt**

Lines 87-88, replace:
```
   - Read ${VAULT_DIR}/_meta/researcher-profile.md
   - Read ${VAULT_DIR}/_meta/preferences.md
```
with:
```
   - Read ${VAULT_DIR}/reference/researcher-profile.md
```

- [ ] **Step 2: Commit**

```bash
git add scripts/agent-draft.sh
git commit -m "refactor: update agent-draft.sh vault paths

Update _meta/researcher-profile.md to reference/researcher-profile.md.
Remove _meta/preferences.md reference (absorbed into CLAUDE.md)."
```

---

### Task 8: Vault file operations

Move and delete files in the Obsidian vault to match the new layout. These are vault operations, not codebase edits.

**Files (vault):**
- Move: `reference/agents/researcher-profile.md` → `reference/researcher-profile.md`
- Move: `reference/agents/SHOGGOTH_ARCHITECTURE.md` → `reference/shoggoth/SHOGGOTH_ARCHITECTURE.md`
- Move: `reference/agents/WRITING_WORKFLOW.md` → `reference/WRITING_WORKFLOW.md`
- Delete: `reference/agents/project-manager.md`
- Delete: `reference/agents/preferences.md`
- Delete: `reference/templates/project-daily-note-template.md`
- Delete: `reference/agents/` directory

- [ ] **Step 1: Create `reference/shoggoth/` directory**

```bash
mkdir -p /home/square/obsidian-notes/reference/shoggoth
```

- [ ] **Step 2: Move files**

```bash
mv /home/square/obsidian-notes/reference/agents/researcher-profile.md /home/square/obsidian-notes/reference/researcher-profile.md
mv /home/square/obsidian-notes/reference/agents/SHOGGOTH_ARCHITECTURE.md /home/square/obsidian-notes/reference/shoggoth/SHOGGOTH_ARCHITECTURE.md
mv /home/square/obsidian-notes/reference/agents/WRITING_WORKFLOW.md /home/square/obsidian-notes/reference/WRITING_WORKFLOW.md
```

- [ ] **Step 3: Delete obsolete files**

```bash
rm /home/square/obsidian-notes/reference/agents/project-manager.md
rm /home/square/obsidian-notes/reference/agents/preferences.md
rm /home/square/obsidian-notes/reference/templates/project-daily-note-template.md
```

- [ ] **Step 4: Remove empty `reference/agents/` directory**

```bash
rmdir /home/square/obsidian-notes/reference/agents/
```

- [ ] **Step 5: Verify vault structure**

```bash
ls -la /home/square/obsidian-notes/reference/
ls -la /home/square/obsidian-notes/reference/shoggoth/
ls -la /home/square/obsidian-notes/reference/templates/
```

Expected:
```
reference/
├── researcher-profile.md
├── collaborators.md
├── venues.md
├── WRITING_WORKFLOW.md
├── shoggoth/
│   └── SHOGGOTH_ARCHITECTURE.md
├── templates/
│   ├── global-writing-rubric.md
│   └── project-writing-rubric-template.md
└── literature/
    └── ...
```

- [ ] **Step 6: Commit vault changes**

```bash
cd /home/square/obsidian-notes
git add -A reference/
git commit -m "refactor: reorganize reference/ — eliminate agents/ directory

Move researcher-profile.md to top-level reference/.
Move SHOGGOTH_ARCHITECTURE.md to reference/shoggoth/.
Move WRITING_WORKFLOW.md to reference/.
Remove project-manager.md (absorbed into standup skill).
Remove preferences.md (absorbed into CLAUDE.md).
Remove project-daily-note-template.md (deprecated).
Delete agents/ directory."
```

---

### Task 9: Update SHOGGOTH_ARCHITECTURE.md to reflect changes

The architecture doc in the vault references the old `_meta/` paths and briefings structure. Update it to match reality.

**Files (vault):**
- Modify: `/home/square/obsidian-notes/reference/shoggoth/SHOGGOTH_ARCHITECTURE.md`

- [ ] **Step 1: Update "Researcher Context" section (around line 122)**

Replace:
```
Three markdown files in the vault give agents persistent memory of who the researcher is:

- `reference/agents/researcher-profile.md` — Stable identity: interests, affiliation, methods, career stage
- `reference/agents/preferences.md` — Communication style, formatting, accumulated corrections
- `reference/agents/project-manager.md` — How to manage projects and interactions

Agents read these via MCP-Vault before research tasks. Per-project context lives in `projects/<name>/PROJECT.md`.
```
with:
```
One markdown file in the vault gives agents persistent memory of who the researcher is:

- `reference/researcher-profile.md` — Stable identity: interests, affiliation, methods, career stage

Only skills where researcher identity shapes the output read this file (exploration, drafting, critique, investigation). Behavioral preferences and communication style are configured in group CLAUDE.md files in the Shoggoth codebase, not in the vault. Per-project context lives in `projects/<name>/PROJECT.md`.
```

- [ ] **Step 2: Update scheduled tasks table (around line 164)**

Replace the morning briefing row:
```
| Morning briefing | Weekday mornings | Reads projects, recent activity, writes briefing |
```
with:
```
| Morning standup | Weekday mornings | Scans projects, workbench, opens a conversation about priorities |
```

- [ ] **Step 3: Update the "Open Questions" section (around line 235)**

Remove or mark resolved:
```
- **Vault path alignment:** Shoggoth's global CLAUDE.md still references `_meta/` for researcher context; the vault now uses `reference/agents/`. Needs reconciliation.
```
This is now resolved. Remove the bullet or replace with:
```
- **Vault path alignment:** Resolved — all Shoggoth references updated to match vault layout as of 2026-04-13.
```

- [ ] **Step 4: Update vault structure diagram (around line 177)**

The vault structure diagram should already be correct in the architecture doc (it shows the new layout). Verify — if it still references `_meta/`, update accordingly.

- [ ] **Step 5: Commit**

```bash
cd /home/square/obsidian-notes
git add reference/shoggoth/SHOGGOTH_ARCHITECTURE.md
git commit -m "docs: update SHOGGOTH_ARCHITECTURE.md for vault reconciliation

Update researcher context section (single file, selective loading).
Update scheduled tasks (briefing → standup). Mark vault path
alignment as resolved."
```
