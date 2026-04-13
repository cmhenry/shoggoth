---
name: idea-capture
description: >
  Capture research ideas as lightweight Obsidian notes when the researcher
  shares a substantive thought. Offers optional escalation to investigation.
---

# Idea Capture

When the researcher shares a substantive research thought — a hypothesis, a methodological angle, a connection between literatures — capture it as a note in `feeds/inbox/`.

## What counts as a substantive thought

A research-relevant idea, not a task, question, or casual remark. Use judgment. "We should look into platform design effects on moderation" is an idea. "Remind me to email Giuliano" is not.

## Capture process

1. **Check for duplicates** — `mcp__mcpvault__search_notes` in `feeds/inbox/` to see if a similar idea already exists.

2. **Write the note** — `mcp__mcpvault__write_note` to `feeds/inbox/YYYY-MM-DD-slug.md` with:

   ```yaml
   ---
   created: 'YYYY-MM-DD'
   status: spark
   domain: <1-2 word domain>
   connected_projects:
     - <project name if applicable>
   potential: <low|medium|high>
   ---
   ```

   Body structure:
   - `# Title` — descriptive, not the raw quote
   - `_Raw idea captured YYYY-MM-DD via WhatsApp._`
   - `## The idea` — the researcher's words as a blockquote
   - `## Why this matters` — 2-4 sentences connecting the idea to the researcher's existing work, methods, or open questions. This is the value-add: situating the spark in context.
   - `## Initial framings` — 2-3 possible angles, each 2-3 sentences. Draw on the researcher's known methods and interests.

3. **Confirm and offer escalation** — Tell the researcher what you captured. Then ask: "Want me to run a research investigation on this?" Never escalate without explicit confirmation.

## Tone

Write like a sharp research assistant who knows the researcher's work. No filler, no generic academic language. Be specific about why this idea matters *for this researcher*.

## What not to do

- Don't add boilerplate frontmatter fields beyond what's listed
- Don't create subdirectories inside `feeds/inbox/`
- Don't overwrite existing notes — check if a similar idea exists first via `mcp__mcpvault__search_notes`
- Don't escalate to investigation without confirmation
