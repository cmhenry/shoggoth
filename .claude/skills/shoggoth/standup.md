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
