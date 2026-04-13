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
   - `mcp__mcpvault__read_note` on `reference/researcher-profile.md` for methods, interests, career stage
   - Read the idea note(s) to explore via `mcp__mcpvault__read_note`

2. **Dispatch sub-agents** via agent teams (`TeamCreate`):

   **Literature agent:** Search for relevant papers using web search and academic databases. Find direct precedents, methodological exemplars, theoretical foundations, and recent work (last 2 years). Cite specific papers with author-year. If you can't find relevant literature, say so — don't hallucinate citations.

   **Methodology agent:** How would you actually study this? What data and methods are feasible given the researcher's resources (simulation platforms, available data, collaborator network)? What's the most tractable path to a contribution? Be honest about feasibility.

   **Framing agent:** What's the theoretical contribution? How does this connect to the researcher's existing work and methods? Develop 2-3 possible angles, each with what it would contribute if successful. Read `reference/researcher-profile.md` for the researcher's known expertise.

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

1. Read `feeds/inbox/scratch.md` to get the list of backlinked ideas
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
