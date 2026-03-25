# Ideas Lifecycle Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the over-structured idea capture/investigation system with a lightweight scratch-based lifecycle: capture → explore → archive/upgrade.

**Architecture:** Four focused skills (`idea-capture`, `idea-explore`, `idea-triage`, `idea-nudge`) replace two existing skills. A scratch note in the Obsidian vault serves as the active index. Ideas flow through the scratch into individual notes, get explored by an Opus agent swarm, then get archived or upgraded to projects with GitHub repos.

**Tech Stack:** Markdown skill files, Obsidian MCP vault tools, GitHub CLI (`gh`), NanoClaw agent teams, NanoClaw task scheduler.

**Spec:** `docs/superpowers/specs/2026-03-25-ideas-lifecycle-redesign.md`

---

### Task 1: Create the scratch note and archive directory

**Files:**
- Create: `~/obsidian-notes/ideas/scratch.md` (via MCP or direct write)
- Create: `~/obsidian-notes/ideas/archive/.gitkeep`

This is a vault setup task, not a code task. No tests.

- [ ] **Step 1: Create the scratch note**

Write `ideas/scratch.md` to the Obsidian vault:

```markdown
---
type: idea-scratch
---
```

Empty scratch, ready for backlinks. Use `mcp__mcpvault__write_note` if running inside the container, or write directly to `~/obsidian-notes/ideas/scratch.md`.

- [ ] **Step 2: Create the archive directory**

```bash
mkdir -p ~/obsidian-notes/ideas/archive
touch ~/obsidian-notes/ideas/archive/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
cd ~/obsidian-notes
git add ideas/scratch.md ideas/archive/.gitkeep
git commit -m "feat: add ideas scratch note and archive directory"
```

---

### Task 2: Rewrite the idea-capture skill

**Files:**
- Modify: `container/skills/idea-capture/SKILL.md` (full rewrite)

- [ ] **Step 1: Read the current skill**

```bash
cat container/skills/idea-capture/SKILL.md
```

Confirm the current content matches what's in the spec (rich frontmatter, registry updates, escalation prompt).

- [ ] **Step 2: Rewrite the skill**

Replace `container/skills/idea-capture/SKILL.md` with:

```markdown
---
name: idea-capture
description: >
  Capture research ideas as minimal Obsidian notes with a backlink in the
  scratch note. No structured sections, no registry, no escalation prompt.
---

# Idea Capture

When the researcher shares a substantive research thought — a hypothesis, a methodological angle, a connection between literatures — capture it as a note in `ideas/` and add a backlink to the scratch.

## What counts as a substantive thought

A research-relevant idea, not a task, question, or casual remark. Use judgment. "We should look into platform design effects on moderation" is an idea. "Remind me to email Giuliano" is not.

## Capture process

1. **Read researcher context** — `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` and `_meta/top-of-mind.md` to understand the researcher's active interests and projects.

2. **Check for duplicates** — `mcp__mcpvault__search_notes` in `ideas/` to see if a similar idea already exists. If it does, tell the researcher and offer to add to the existing note instead.

3. **Write the idea note** — `mcp__mcpvault__write_note` to `ideas/YYYY-MM-DD-slug.md`:

   Frontmatter (nothing else):
   ```yaml
   ---
   created: 'YYYY-MM-DD'
   status: spark
   ---
   ```

   Body: the idea in freeform prose. Write it as a sharp research assistant who knows the researcher's work — situate the idea in context, note why it matters for *this researcher*, sketch possible angles. No headings, no template sections. Just a paragraph or two of good thinking.

   Slug: lowercase, hyphen-separated, max ~60 chars, derived from the core concept.

4. **Add to scratch** — `mcp__mcpvault__patch_note` on `ideas/scratch.md` to prepend (newest first) a backlinked one-liner:

   ```
   - [[YYYY-MM-DD-slug]] — one-sentence summary of the idea
   ```

   Insert after the frontmatter closing `---`, before existing entries.

5. **Confirm** — Tell the researcher: "Captured [[slug]] in scratch."

## Tone

Write like a sharp research assistant who knows the researcher's work. No filler, no generic academic language. Be specific about why this idea matters *for this researcher*.

## What not to do

- Don't add frontmatter fields beyond `created` and `status`
- Don't add headings or template sections to the idea note
- Don't update any registry file
- Don't prompt for investigation or escalation — the nudge handles that
- Don't create subdirectories inside `ideas/`
- Don't overwrite existing notes
```

- [ ] **Step 3: Verify the skill file is valid**

```bash
head -5 container/skills/idea-capture/SKILL.md
```

Confirm frontmatter is present and well-formed.

- [ ] **Step 4: Commit**

```bash
git add container/skills/idea-capture/SKILL.md
git commit -m "feat: rewrite idea-capture for scratch-based workflow"
```

---

### Task 3: Create the idea-explore skill

**Files:**
- Create: `container/skills/idea-explore/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p container/skills/idea-explore
```

- [ ] **Step 2: Write the skill file**

Write `container/skills/idea-explore/SKILL.md`:

```markdown
---
name: idea-explore
description: >
  Dispatch parallel Opus sub-agents to explore a research idea. Literature,
  methodology, and framing agents run concurrently, then findings are
  synthesized into the idea note. Manual trigger only.
---

# Idea Explore

A thorough exploration of a research idea using parallel sub-agents. This is expensive — multiple Opus agents running concurrently. Only run when the researcher explicitly asks.

## Trigger

Manual only. Researcher says something like:
- "explore [[slug]]"
- "dig into this idea"
- "explore the ideas in scratch"

Never run without explicit confirmation.

## Process

1. **Read context:**
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md` for methods, interests, career stage
   - `mcp__mcpvault__read_note` on `_meta/top-of-mind.md` for current priorities
   - Read the idea note(s) to explore via `mcp__mcpvault__read_note`

2. **Dispatch sub-agents** via agent teams (`TeamCreate`):

   **Literature agent:** Search for relevant papers using web search and academic databases. Find direct precedents, methodological exemplars, theoretical foundations, and recent work (last 2 years). Cite specific papers with author-year. If you can't find relevant literature, say so — don't hallucinate citations.

   **Methodology agent:** How would you actually study this? What data and methods are feasible given the researcher's resources (simulation platforms, available data, collaborator network)? What's the most tractable path to a contribution? Be honest about feasibility.

   **Framing agent:** What's the theoretical contribution? How does this connect to the researcher's existing work and methods? Develop 2-3 possible angles, each with what it would contribute if successful. Read `_meta/researcher-profile.md` for the researcher's known expertise.

   All three agents run in parallel.

3. **Handle partial failures:** If a sub-agent fails (timeout, search unavailable), proceed with the results you have and note which perspective is missing in the synthesis.

4. **Synthesize** — Combine sub-agent outputs into freeform prose in the idea note. Write under two minimal anchors:

   `## What we found` — A coherent narrative synthesizing literature, methodology, and framing findings. Not three separate dumps — one integrated picture.

   `## What to do next` — Actionable directions. What's the most promising angle? What would the first concrete step be?

   Use `mcp__mcpvault__patch_note` to append these sections to the existing idea note body.

5. **Update frontmatter** — `mcp__mcpvault__update_frontmatter`:
   - `status: explored`
   - `explored: 'YYYY-MM-DD'`

6. **Report back** — Summarize key findings conversationally. Highlight the most promising angle and the immediate next step.

## Batch exploration

When the researcher says "explore the ideas in scratch":

1. Read `ideas/scratch.md` to get the list of backlinked ideas
2. Filter to those with `status: spark` (skip already-explored ideas)
3. Process each idea as a separate exploration — each gets its own 3-agent swarm
4. Cap at 2-3 ideas per invocation to manage Opus quota
5. If more ideas are pending, report what you explored and note the remainder

## Quality bar

- Literature citations must be real papers (verify via web search)
- Feasibility must be honest — don't oversell tractability
- Next steps must be concrete enough to act on without further planning
- Framings must connect to the researcher's actual methods and expertise

## What not to do

- Don't run without explicit researcher confirmation
- Don't hallucinate paper citations
- Don't impose structured templates — the two anchor headings are the only structure
- Don't overwrite the original idea prose — append exploration below it
- Don't recommend methods the researcher has no experience with unless you flag the learning curve
```

- [ ] **Step 3: Verify the skill file**

```bash
head -7 container/skills/idea-explore/SKILL.md
```

Confirm frontmatter is present and well-formed.

- [ ] **Step 4: Commit**

```bash
git add container/skills/idea-explore/SKILL.md
git commit -m "feat: add idea-explore skill for parallel agent exploration"
```

---

### Task 4: Create the idea-triage skill

**Files:**
- Create: `container/skills/idea-triage/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p container/skills/idea-triage
```

- [ ] **Step 2: Write the skill file**

Write `container/skills/idea-triage/SKILL.md`:

```markdown
---
name: idea-triage
description: >
  Archive or upgrade an explored idea. Archiving moves it to ideas/archive/.
  Upgrading creates a project folder in the vault and a private GitHub repo.
---

# Idea Triage

Move an idea to its final destination: archive (not viable or not timely) or upgrade to a full project.

## Trigger

Manual. Researcher says something like:
- "archive [[slug]]"
- "upgrade [[slug]] to project"
- "this one's not going anywhere, archive it"
- "let's turn this into a project"

## Archive path

1. **Move the note** — `mcp__mcpvault__move_note` from `ideas/YYYY-MM-DD-slug.md` to `ideas/archive/YYYY-MM-DD-slug.md`

2. **Update frontmatter** — `mcp__mcpvault__update_frontmatter` on the moved note: `status: archived`

3. **Remove from scratch** — `mcp__mcpvault__patch_note` on `ideas/scratch.md` to remove the line containing `[[YYYY-MM-DD-slug]]`

4. **Confirm** — "Archived [[slug]]. It's in ideas/archive/ if you need it later."

## Upgrade path

1. **Read the idea note** — `mcp__mcpvault__read_note` on `ideas/YYYY-MM-DD-slug.md` to get the exploration findings for seeding the project.

2. **Create PROJECT.md** — `mcp__mcpvault__write_note` to `projects/{slug}/PROJECT.md`:

   ```yaml
   ---
   phase: research
   priority: medium
   last_updated: YYYY-MM-DD
   ---
   ```

   Sections seeded from the idea's exploration findings:
   - `# {Project Title}` — derived from the idea, not the slug
   - `## Status` — "Promoted from idea exploration on YYYY-MM-DD. [Summary of where things stand based on What we found / What to do next]"
   - `## Context` — Key findings from exploration: literature landscape, feasibility notes, methodological approach
   - `## Key Decisions` — "YYYY-MM-DD — Promoted from idea to project based on [researcher's reasoning if stated]"

   The slug for the project folder drops the date prefix from the idea slug (e.g., `ideas/2026-03-25-adversarial-deliberation.md` becomes `projects/adversarial-deliberation/`).

3. **Move idea note as ORIGIN.md** — `mcp__mcpvault__move_note` from `ideas/YYYY-MM-DD-slug.md` to `projects/{slug}/ORIGIN.md`

4. **Update frontmatter** — `mcp__mcpvault__update_frontmatter` on ORIGIN.md: `status: upgraded`

5. **Create GitHub repo** — via Bash:

   ```bash
   gh repo create {slug} --private --template cmhenry/research-project-template
   ```

   If the template repo doesn't exist yet, create a plain private repo instead:

   ```bash
   gh repo create {slug} --private
   ```

   Then report that the template repo needs to be set up.

6. **Remove from scratch** — `mcp__mcpvault__patch_note` on `ideas/scratch.md` to remove the line containing the idea's backlink.

7. **Confirm** — "Upgraded [[slug]] to project. Vault: projects/{slug}/, Repo: github.com/cmhenry/{slug}"

## What not to do

- Don't archive or upgrade without explicit researcher instruction
- Don't lose the original idea prose — it's preserved as ORIGIN.md
- Don't set project priority to high by default — let the researcher adjust
- Don't create extra directories in the repo — just the template skeleton
```

- [ ] **Step 3: Verify the skill file**

```bash
head -6 container/skills/idea-triage/SKILL.md
```

- [ ] **Step 4: Commit**

```bash
git add container/skills/idea-triage/SKILL.md
git commit -m "feat: add idea-triage skill for archive/upgrade lifecycle"
```

---

### Task 5: Create the idea-nudge skill

**Files:**
- Create: `container/skills/idea-nudge/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p container/skills/idea-nudge
```

- [ ] **Step 2: Write the skill file**

Write `container/skills/idea-nudge/SKILL.md`:

```markdown
---
name: idea-nudge
description: >
  Scheduled scan (every 3 days, Sonnet) for stale ideas. Sends a single
  WhatsApp summary of unexplored sparks and explored-but-untriaged ideas.
---

# Idea Nudge

A lightweight scheduled check for ideas that need attention. Reads only frontmatter — does not ingest note bodies.

## When this runs

Scheduled task, every 3 days. Uses Sonnet to keep costs low. Do not run expensive operations or spawn sub-agents.

## Process

1. **Scan idea notes** — `mcp__mcpvault__list_directory` on `ideas/` to get all idea files (skip `scratch.md`, `archive/`, and any non-markdown files).

2. **Read frontmatter** — `mcp__mcpvault__get_frontmatter` on each idea file. Categorize:
   - **Unexplored:** `status: spark`
   - **Explored, needs triage:** `status: explored` or `status: investigated` (legacy)

3. **If nothing stale:** Do nothing. No "all clear" messages.

4. **If stale ideas found:** Send a single message via `mcp__nanoclaw__send_message` grouping ideas by category:

   ```
   You have {N} unexplored ideas and {M} explored ideas waiting for a decision:

   *Unexplored:*
   • {slug} ({Mon DD})
   • {slug} ({Mon DD})

   *Explored, needs triage:*
   • {slug} ({Mon DD})

   Want me to explore or triage any of these?
   ```

   Use WhatsApp formatting (single asterisks for bold, bullet points). No markdown.

## What not to do

- Don't read note bodies — frontmatter only
- Don't send messages if nothing is stale
- Don't spawn sub-agents or run investigations
- Don't modify any notes — this is a read-only scan
```

- [ ] **Step 3: Verify the skill file**

```bash
head -6 container/skills/idea-nudge/SKILL.md
```

- [ ] **Step 4: Commit**

```bash
git add container/skills/idea-nudge/SKILL.md
git commit -m "feat: add idea-nudge skill for stale idea reminders"
```

---

### Task 6: Delete the research-investigation skill and registry

**Files:**
- Delete: `container/skills/research-investigation/SKILL.md`
- Delete: `~/obsidian-notes/ideas/_registry.md` (via MCP or direct)

- [ ] **Step 1: Remove the research-investigation skill**

```bash
rm -rf container/skills/research-investigation
```

- [ ] **Step 2: Remove the registry file from the vault**

```bash
rm ~/obsidian-notes/ideas/_registry.md
```

- [ ] **Step 3: Commit both removals**

```bash
git -C /home/square/shoggoth add -A container/skills/research-investigation
git -C /home/square/shoggoth commit -m "chore: remove research-investigation skill (replaced by idea-explore)"
```

```bash
cd ~/obsidian-notes
git add ideas/_registry.md
git commit -m "chore: remove ideas registry (replaced by scratch note)"
```

---

### Task 7: Update group CLAUDE.md

**Files:**
- Modify: `groups/global/CLAUDE.md`

- [ ] **Step 1: Read the current file**

```bash
cat groups/global/CLAUDE.md
```

- [ ] **Step 2: Update the skill table**

Replace the skills table rows for idea-capture and research-investigation with the new skills. The updated table rows:

```markdown
| User shares a research idea, hypothesis, or methodological insight | `/idea-capture` | Captures to vault `ideas/` with backlink in scratch |
| "explore this idea", "explore the ideas in scratch" (explicit only) | `/idea-explore` | Parallel Opus sub-agent exploration: literature, methodology, framing |
| "archive [[slug]]", "upgrade [[slug]] to project" | `/idea-triage` | Archives idea or upgrades to project with vault folder + GitHub repo |
| Scheduled every 3 days (Sonnet) | `/idea-nudge` | Scans for stale ideas, sends WhatsApp summary |
```

- [ ] **Step 3: Update the "What You Can Do" list**

Replace:
```markdown
- **Capture research ideas** to the vault
- **Run research investigations** with sub-agents
```

With:
```markdown
- **Capture research ideas** to the vault scratch note
- **Explore ideas** with parallel Opus sub-agent swarms
- **Triage ideas** — archive or upgrade to projects with GitHub repos
```

- [ ] **Step 4: Update the proactive capture instruction**

Replace:
```markdown
**Important:** When the user shares something that sounds like a research idea (a hypothesis, a connection between fields, a methodological angle), invoke `/idea-capture` proactively. Don't wait for them to say "capture this."
```

With:
```markdown
**Important:** When the user shares something that sounds like a research idea (a hypothesis, a connection between fields, a methodological angle), invoke `/idea-capture` proactively. Don't wait for them to say "capture this." Do NOT auto-trigger `/idea-explore` — exploration only runs on explicit request.
```

- [ ] **Step 5: Commit**

```bash
git add groups/global/CLAUDE.md
git commit -m "feat: update group CLAUDE.md for new idea lifecycle skills"
```

---

### Task 8: Update the daily-briefing skill

**Files:**
- Modify: `container/skills/daily-briefing/SKILL.md`

- [ ] **Step 1: Read the current skill**

```bash
cat container/skills/daily-briefing/SKILL.md
```

- [ ] **Step 2: Replace the full skill file**

Replace `container/skills/daily-briefing/SKILL.md` with:

```markdown
---
name: daily-briefing
description: >
  Generate a daily research briefing on weekday mornings. Reads researcher
  context, project statuses, idea pipeline, and recent vault activity to
  produce an actionable summary in briefings/.
---

# Daily Briefing

Produce a morning briefing that tells the researcher what matters today. Scheduled weekday mornings, but can also be triggered on demand.

## Process

1. **Read researcher context:**
   - `mcp__mcpvault__read_note` on `_meta/researcher-profile.md`, `_meta/top-of-mind.md`, `_meta/preferences.md`

2. **Scan all project statuses:**
   - `mcp__mcpvault__list_directory` on `projects/`
   - `mcp__mcpvault__read_multiple_notes` on each project's `PROJECT.md`
   - Read the `## Status` section of each for blockers, deadlines, and stalled items

3. **Scan idea pipeline:**
   - `mcp__mcpvault__read_note` on `ideas/scratch.md` to count active ideas
   - `mcp__mcpvault__list_directory` on `ideas/` and check frontmatter for `status: spark` (unexplored) and `status: explored` or `status: investigated` (awaiting triage)

4. **Check recent vault activity:**
   - `mcp__mcpvault__get_vault_stats` for recently modified files
   - `mcp__mcpvault__search_notes` for ideas captured in the last few days

5. **Write the briefing** — `mcp__mcpvault__write_note` to `briefings/YYYY-MM-DD-Weekday.md`:

   ```yaml
   ---
   date: 'YYYY-MM-DD'
   day: <Weekday>
   generated_by: Shoggoth PM
   projects_reviewed: <N>
   ---
   ```

   Body sections:
   - `# Daily Briefing — Weekday, Month DD, YYYY`
   - `## Most Urgent` — The single highest-priority item with specific context: what's blocked, why it matters now, what the immediate target is. Be concrete about time estimates and consequences of delay.
   - `## Active / Needs Attention` — Each active project with current status, blockers, and a specific ask for today. Skip projects with no updates or actions. Include an **Ideas pipeline** sub-item showing: count of sparks in scratch, count of explored ideas awaiting triage. Only include this sub-item if there are ideas in either category.
   - `## Recent Captures` — Ideas captured since the last briefing, with one-line summaries.
   - `## Suggested Focus` — A concrete recommendation for how to spend the day, given priorities and energy. Not "work on your projects" — something like "2 hours on pipeline wiring, then the diagnostic call."

## Quality bar

- Every item must have a *specific* action, not a vague reminder
- Reference actual file paths, data points, and project states — not summaries of summaries
- If a blocker has persisted across multiple briefings, call it out explicitly
- Prioritize by research impact and time-sensitivity, not recency
- Keep it under 800 words unless there's genuinely a lot happening

## What not to do

- Don't generate briefings on weekends unless asked
- Don't include projects with nothing to report
- Don't use vague language ("consider reviewing", "might want to look at")
- Don't pad with motivational filler
```

- [ ] **Step 3: Commit**

```bash
git add container/skills/daily-briefing/SKILL.md
git commit -m "feat: add idea pipeline status to daily briefing"
```

---

### Task 9: Create the GitHub template repo

**Files:**
- New GitHub repo: `cmhenry/research-project-template`

- [ ] **Step 1: Create a temporary directory for the template**

```bash
mkdir -p /tmp/research-project-template
cd /tmp/research-project-template
git init
```

- [ ] **Step 2: Create the template skeleton**

```bash
mkdir -p draft src
```

Write `CLAUDE.md`:
```markdown
# Project

## Structure

- `draft/` — writing artifacts (papers, notes, outlines)
- `src/` — code (analysis scripts, simulations, data processing)
- `data/` — datasets (created as needed, gitignored if large)
- `test/` — tests (created as needed)
- `experiments/` — experiment configs and results (created as needed)

## Development

Run code from the project root. Use relative paths for data references.
```

Write `README.md`:
```markdown
# Project Name

> One-line description.

## Overview

## Status

## Setup
```

Write `.gitignore`:
```
# Large data files
*.csv
*.tsv
*.parquet
*.feather
*.arrow
*.h5
*.hdf5
*.pkl
*.pickle
*.npy
*.npz
*.pt
*.pth
*.onnx
*.safetensors

# Data directories (uncomment if using)
# data/raw/
# data/processed/

# Python
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/
dist/
build/

# R
.Rhistory
.RData
.Rproj.user/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log

# Environment
.env
.env.local
```

- [ ] **Step 3: Commit and create the GitHub repo**

```bash
cd /tmp/research-project-template
git add -A
git commit -m "Initial template skeleton"
gh repo create research-project-template --private --source . --push
```

- [ ] **Step 4: Mark it as a template repo**

```bash
gh api -X PATCH repos/cmhenry/research-project-template -F is_template=true
```

- [ ] **Step 5: Clean up**

```bash
rm -rf /tmp/research-project-template
```

---

### Task 10: Schedule the idea-nudge task

This task uses the NanoClaw scheduled task system. Run from within a conversation with Shoggoth or via the task scheduler API.

- [ ] **Step 1: Schedule the nudge task**

From within the Shoggoth container (or via `mcp__nanoclaw__schedule_task`):

```
Schedule a recurring task:
- prompt: "Run /idea-nudge — scan for stale ideas and send a WhatsApp summary if any are found."
- schedule_type: cron
- schedule_value: "0 10 */3 * *"
- model: sonnet
- context_mode: isolated
```

- [ ] **Step 2: Verify the task is scheduled**

```
List scheduled tasks and confirm idea-nudge appears with the correct cron schedule.
```

- [ ] **Step 3: Test the nudge manually**

Send Shoggoth: "Run /idea-nudge" and verify it scans frontmatter and either sends a summary or stays silent (depending on whether stale ideas exist).
