---
name: standup
description: >
  Interactive morning standup. Walks through projects one at a time,
  proposing priority tasks per project and converging on a curated
  daily-priorities list. Ephemeral — no vault writes.
---

# Standup

An interactive conversation that covers projects one at a time, proposes priority tasks the researcher accepts/edits/rejects, and ends with today's priorities synthesized across the projects discussed.

**Anti-goal:** an upfront briefing dump. Do not summarize project momentum before the researcher has chosen where to start. Do not list project names unprompted in the opener.

## Phase 1 — Open (lightweight signal-finding)

Build status awareness without dumping anything to the researcher.

1. `mcp__mcpvault__list_directory` on `projects/`. **Filter out** `_index.md` and any entry that does not contain its own `PROJECT.md` inside.
2. For each remaining project, run a cheap metadata sweep: `mcp__mcpvault__get_frontmatter` (or `get_notes_info`) on `projects/<name>/PROJECT.md`. Frontmatter only — do not read bodies. This gives you status awareness for every project so you can answer "what about project X?" without admitting ignorance.
3. `mcp__mcpvault__list_directory` on `workbench/daily/`. If the directory is empty, skip — do not mention its emptiness to the researcher. If non-empty, read the **2 most recent** notes only.
4. Same for `workbench/reflections/`: skip silently if empty, otherwise read the **latest** weekly reflection only.

From those signals, identify anything that genuinely needs attention this morning: a deadline within ~3 days, a blocker mentioned in the last daily note, a project the researcher flagged in the weekly reflection.

**Open with one short message:**

- If 1–2 items genuinely need attention, lead with them and ask "where do you want to start?"
- If nothing stands out, open with a plain "Morning — where do you want to start?" Do not manufacture urgency. Do not list projects unprompted; if the researcher asks what's on the docket, list them then.

## Phase 2 — Per-project loop

For each project the researcher picks (or that you raise after they've covered theirs):

1. Load full context now: `mcp__mcpvault__read_note` on `projects/<name>/PROJECT.md` and the most recent project-specific note if there is one. (You already have frontmatter from Phase 1; this fills in the body.)
2. State current status in 2–3 lines max — what moved, what's stalled, what's blocked.
3. Propose **1–3 specific priority tasks** for today on this project. Phrase them as concrete, doable-today actions, not vague intentions.
4. Hand the turn back: ask which to take, edit, drop, or replace. Track what they commit to.
5. **Treat a topic switch as ambiguous.** If the researcher mentions a different project mid-thought, confirm with "pausing on X to come back to?" before advancing — don't abandon the current project on the first mention of another.
6. Move on when the researcher explicitly signals done with this project.

Keep a running tally visible in your turns so you don't lose track. At each per-project handoff, emit something like `covered: bluesky-scraper, gravity-misinfo | remaining: 11`. Without this, by message 15 you will have forgotten which projects were genuinely discussed vs. mentioned in passing.

Before closing, surface any projects that haven't been touched and ask if they should be skipped or briefly addressed.

## Phase 3 — Close

Trigger the close when **any** of these holds:
- All projects have been covered or explicitly skipped.
- The researcher signals end ("gotta go", "thanks", etc.).
- The conversation stalls for more than one turn.

Run the close immediately with whatever was committed. Don't wait for full coverage if the researcher has bailed.

1. Synthesize today's curated priority list from **committed** tasks only (skipped projects contribute nothing). One bullet per task, grouped by project.
2. **Cap the list at ~5 total.** If the researcher committed to more, flag the overload explicitly: "that's N tasks — likely too many for a day; want to pick the top 5?"
3. Flag any scheduling conflicts you noticed against known deadlines.
4. End your turn. Don't ask follow-ups. The researcher can resume on their own.

## On-demand context (any phase)

Pull from the vault when the conversation needs it: `reference/venues.md`, `reference/collaborators.md`, `feeds/inbox/scratch.md`, etc. Don't pre-load.

## What this produces

A conversation. A capped list of today's priorities at the end. **No vault writes.**

## What not to do

- Don't dump a briefing in Phase 1. The metadata sweep is for *your* awareness, not the researcher's opening message.
- Don't list project names unprompted in the opener.
- Don't read every PROJECT.md body upfront. Bodies are loaded lazily in Phase 2.
- Don't treat `_index.md` as a project. (`oops/` IS a real project — OOPS is an acronym; treat it like any other.)
- Don't write briefing notes to the vault.
- Don't run on weekends unless asked.
- Don't load researcher-profile.md.
- Don't pad with motivational filler.
- Don't manufacture urgency when nothing is genuinely urgent.
- Don't generate priority tasks the researcher didn't get a chance to push back on. Every per-project task list is a proposal.
- Don't skip the close — even on a short conversation, the synthesized list is the artifact.
