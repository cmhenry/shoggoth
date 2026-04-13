---
name: reading-list
description: >
  Prioritized non-fiction reading list. Reads active projects and literature
  monitor output, manages Zotero "To Read" collection, produces a ranked
  vault note and WhatsApp summary. Runs twice weekly.
---

# Reading List

Produce a prioritized non-fiction reading list by combining Zotero queue, active project needs, and recent literature discoveries. Scheduled Monday and Thursday mornings; can also be triggered on demand.

## Process

1. **Read active project statuses:**
   - `mcp__mcpvault__list_directory` on `projects/`
   - `mcp__mcpvault__read_multiple_notes` on each project's `PROJECT.md`
   - Extract research needs, methods being used, and topics from `## Status` sections

2. **Check recent literature monitor output:**
   - `mcp__mcpvault__search_notes` in `feeds/literature/` for recent `weekly-*.md` files
   - Identify must-read and should-read papers not yet in Zotero

3. **Suggest additions to Zotero:**
   - For each paper from step 2 not already in Zotero, check via `zotero-cli search "<title>"` to avoid duplicates
   - Add new items via `zotero-cli add --title "..." --authors "..." --doi "..." --collection "To Read" --note "Relevant because: ..."`
   - The `--note` explains which project this supports and why it's timely

4. **Get current Zotero queue:**
   - Run `zotero-cli list "To Read"` to get all items in the collection

5. **Prioritize:**
   - Rank items by:
     - **Project relevance** (directly supports active work — highest weight)
     - **Urgency** (time-sensitive topics, fast-moving fields)
     - **Researcher signals** (flagged in conversation or recent daily notes)
   - Group into tiers:
     - **Read Next** (3-5 items) — highest priority
     - **On Deck** (5-10 items) — important but not urgent
     - **Backlog** (remainder) — worth reading eventually

6. **Write vault note** — `mcp__mcpvault__write_note` to `feeds/literature/reading-list.md`:

   ```yaml
   ---
   generated: 'YYYY-MM-DD'
   total_items: <N>
   new_additions: <N>
   ---
   ```

   Body:
   - `# Reading List — YYYY-MM-DD`
   - `## Read Next` — each item with a 1-sentence note on why it matters *now*
   - `## On Deck` — items with brief relevance notes
   - `## Backlog` — titles and authors only

7. **Send WhatsApp summary** — `mcp__nanoclaw__send_message`:
   - Top 3 "Read Next" items with why
   - Number of new additions since last run
   - Flag any items that have been in "To Read" for over 4 weeks

## Error handling

If `zotero-cli` commands fail (API key expired, network issues, Zotero outage):
- Still produce the vault note using whatever data is available (vault-only sources, cached information)
- Note in the vault file and WhatsApp message that Zotero was unreachable
- Do not abort the entire skill run

## Quality bar

- Every "Read Next" item must have a specific reason tied to active work, not a generic "relevant to your field"
- Don't inflate tiers — if only 1 item is urgent, the Read Next section has 1 item
- Items sitting in the queue for 4+ weeks should be called out (stale queue warning)
- New additions must be genuinely relevant, not padded to look productive

## What not to do

- Don't add fiction or non-research items to Zotero
- Don't remove items from Zotero without the researcher's confirmation
- Don't duplicate items already in Zotero (always search before adding)
- Don't generate a reading list if the Zotero queue is empty and there are no new papers — just report "nothing new"
