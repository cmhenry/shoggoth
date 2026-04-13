---
name: idea-capture
description: >
  Capture research ideas as minimal Obsidian notes with a backlink in the
  scratch note. No structured sections, no registry, no escalation prompt.
---

# Idea Capture

When the researcher shares a substantive research thought — a hypothesis, a methodological angle, a connection between literatures — capture it as a note in `feeds/inbox/` and add a backlink to the scratch.

## What counts as a substantive thought

A research-relevant idea, not a task, question, or casual remark. Use judgment. "We should look into platform design effects on moderation" is an idea. "Remind me to email Giuliano" is not.

## Capture process

1. **Check for duplicates** — `mcp__mcpvault__search_notes` in `feeds/inbox/` to see if a similar idea already exists. If it does, tell the researcher and offer to add to the existing note instead.

2. **Write the idea note** — `mcp__mcpvault__write_note` to `feeds/inbox/YYYY-MM-DD-slug.md`:

   Frontmatter (nothing else):
   ```yaml
   ---
   created: 'YYYY-MM-DD'
   status: spark
   ---
   ```

   Body: the idea in freeform prose. Write it as a sharp research assistant who knows the researcher's work — situate the idea in context, note why it matters for *this researcher*, sketch possible angles. No headings, no template sections. Just a paragraph or two of good thinking.

   Slug: lowercase, hyphen-separated, max ~60 chars, derived from the core concept.

3. **Add to scratch** — `mcp__mcpvault__patch_note` on `feeds/inbox/scratch.md` to prepend (newest first) a backlinked one-liner:

   ```
   - [[YYYY-MM-DD-slug]] — one-sentence summary of the idea
   ```

   Insert after the frontmatter closing `---`, before existing entries.

4. **Confirm** — Tell the researcher: "Captured [[slug]] in scratch."

## Tone

Write like a sharp research assistant who knows the researcher's work. No filler, no generic academic language. Be specific about why this idea matters *for this researcher*.

## What not to do

- Don't add frontmatter fields beyond `created` and `status`
- Don't add headings or template sections to the idea note
- Don't update any registry file
- Don't prompt for investigation or escalation — the nudge handles that
- Don't create subdirectories inside `feeds/inbox/`
- Don't overwrite existing notes
