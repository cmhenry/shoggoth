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
