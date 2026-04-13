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
