# Vault Path Reconciliation

**Date:** 2026-04-13
**Status:** Draft

---

## Problem

The Obsidian vault has been reorganized from an older flat structure (with `_meta/`, top-level `ideas/`, `briefings/`, `literature/`) to a new layout with `workbench/`, `feeds/`, `reference/`, and `projects/`. The Shoggoth codebase — container skills, host skills, group configs, and scripts — still references the old paths. Additionally, `reference/agents/` mixes skill files, scaffolds, and researcher identity docs that should be separated.

## Design Principles

1. **The vault is data, Shoggoth is behavior.** No skill files live in the vault. Agent behavior is defined in the Shoggoth codebase (`container/skills/`, `.claude/skills/shoggoth/`, group CLAUDE.md files). The vault holds researcher-written identity, reference material, and agent-generated outputs.

2. **Selective context loading.** Skills only load researcher identity (`researcher-profile.md`) when it actually shapes the output — exploration, drafting, critique. Mechanical tasks (capture, triage, nudge, monitoring) don't load it.

3. **Standup replaces briefing.** The morning briefing becomes an ephemeral standup conversation. The agent scans workbench and projects, opens a conversation, and captures nothing itself. Decisions are captured by the researcher (daily note or Trello card).

## Vault Path Migration

| Old path | New path | Notes |
|---|---|---|
| `_meta/researcher-profile.md` | `reference/researcher-profile.md` | Top-level reference doc |
| `_meta/preferences.md` | **removed** | Absorbed into CLAUDE.md files |
| `_meta/top-of-mind.md` | **removed** | Replaced by `workbench/daily/` + `workbench/reflections/` |
| `_meta/global-writing-rubric.md` | `reference/templates/global-writing-rubric.md` | |
| `ideas/` | `feeds/inbox/` | |
| `ideas/scratch.md` | `feeds/inbox/scratch.md` | |
| `ideas/archive/` | `feeds/inbox/archive/` | Created on first triage |
| `briefings/` | **removed** | Standup is ephemeral |
| `literature/` | `feeds/literature/` | |
| `literature/queue.md` | `feeds/literature/queue.md` | |
| `literature/weekly-*.md` | `feeds/literature/weekly-*.md` | |
| `projects/_registry.md` | `projects/_index.md` | |

## Vault Reorganization

### `reference/` new layout

```
reference/
├── researcher-profile.md        ← researcher identity (read by select skills)
├── collaborators.md
├── venues.md
├── WRITING_WORKFLOW.md           ← moved from agents/
├── shoggoth/
│   └── SHOGGOTH_ARCHITECTURE.md  ← architecture docs
├── templates/
│   ├── global-writing-rubric.md
│   └── project-writing-rubric-template.md
└── literature/
    └── ...
```

### Files removed from vault

- `reference/agents/project-manager.md` — behavior absorbed into new `standup` container skill
- `reference/agents/preferences.md` — content distributed into CLAUDE.md files
- `reference/templates/project-daily-note-template.md` — deprecated
- `reference/agents/` directory — eliminated entirely

### Files moved in vault

- `reference/agents/researcher-profile.md` → `reference/researcher-profile.md`
- `reference/agents/SHOGGOTH_ARCHITECTURE.md` → `reference/shoggoth/SHOGGOTH_ARCHITECTURE.md`
- `reference/agents/WRITING_WORKFLOW.md` → `reference/WRITING_WORKFLOW.md`

## Researcher Context Loading

Skills are divided into two categories based on whether researcher identity shapes their output.

### Needs `reference/researcher-profile.md`

- `idea-explore` — framing agent needs expertise and methods
- `paper-drafting` — voice, positioning, career narrative
- `paper-critique` — evaluating against researcher's standards
- `paper-revision` — same as drafting
- `research-investigation` — scoping against interests and methods

### Does not need researcher context

- `idea-capture` — write what was said, tag it, add to scratch
- `idea-triage` — archive or upgrade, follow the checklist (path updates: `ideas/` → `feeds/inbox/`, `projects/_registry.md` → `projects/_index.md`, `_meta/writing-rubric.md` → `reference/templates/global-writing-rubric.md`)
- `idea-nudge` — scan frontmatter dates, report what's stale
- `literature-monitoring` — search APIs, write the list (search terms from projects)
- `reading-list` — rank against active projects
- `project-status` — read PROJECT.md, summarize, append
- `standup` — scan workbench + projects, open a conversation
- `capabilities` / `status` — system info

## Standup Skill (replaces `daily-briefing`)

### Behavior

The standup is time-bounded, verbal, and ephemeral. The agent scans the researcher's workbench and projects, notices what's moved and what's stalled, and opens a conversation. The researcher says what they're working on. The agent flags conflicts or forgotten deadlines. Decisions get captured by the researcher in a daily note or as a Trello card.

### What it reads on startup

- `projects/*/PROJECT.md` — status, deadlines
- `workbench/daily/` — recent daily notes for continuity
- `workbench/reflections/` — latest weekly reflection for priorities
- `feeds/inbox/scratch.md` — ideas awaiting triage

### On-demand vault access

Full MCP-Vault access for pulling in context as the conversation warrants — `reference/venues.md`, `feeds/career/`, `reference/collaborators.md`, etc. Nothing eagerly loaded beyond the startup set.

### What it produces

A conversational message. No vault writes.

### Channel flexibility

Runs as a scheduled task targeting any registered group — `whatsapp_main`, a Discord channel, or the global group. Claudian (Obsidian plugin) noted as a future integration point.

## Preferences Absorption

Content from `reference/agents/preferences.md` gets distributed into CLAUDE.md:

- Communication style, privacy/boundaries, task generation rules → `groups/global/CLAUDE.md`
- Formatting conventions (date format, kebab-case, ISO weeks) → already covered in group CLAUDE.md or project CLAUDE.md
- Project stage detection heuristics → `standup` container skill
- Workflow preferences (context recovery, weekly review) → relevant container skills or global CLAUDE.md

## Files Changed in Shoggoth Codebase

### Container skills (path updates, `top-of-mind` removed)

- `container/skills/idea-capture/SKILL.md`
- `container/skills/idea-explore/SKILL.md`
- `container/skills/idea-nudge/SKILL.md`
- `container/skills/idea-triage/SKILL.md`
- `container/skills/literature-monitoring/SKILL.md`
- `container/skills/reading-list/SKILL.md`
- `container/skills/paper-drafting/SKILL.md`
- `container/skills/paper-critique/SKILL.md`
- `container/skills/paper-revision/SKILL.md`
- `container/skills/project-status/SKILL.md`
- `container/skills/daily-briefing/SKILL.md` — rewritten as `container/skills/standup/SKILL.md`
- `container/skills/capabilities/SKILL.md`

### Host skills (`.claude/skills/shoggoth/`)

- `idea-capture.md`
- `reading-list.md`
- `paper-drafting.md`
- `daily-briefing.md` — rewritten as `standup.md`
- `research-investigation.md`
- `literature-monitoring.md`

### Group config

- `groups/global/CLAUDE.md` — update `_meta/` references, remove `top-of-mind`, update skill table (daily-briefing → standup), absorb relevant `preferences.md` content

### Scripts

- `scripts/agent-draft.sh` — update `_meta/` references to new paths

### Not changed

- `src/index.ts` — vault mount logic already correct (`obsidian-notes` → `vault`)
- `container/agent-runner/src/index.ts` — MCP-Vault config already mounts at `/workspace/extra/vault`
- `.mcp.json` — already points to `/home/square/obsidian-notes`
