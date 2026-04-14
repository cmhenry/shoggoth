---
name: sim-review
description: >
  Simulate peer review of a paper draft before submission. Dispatches three
  independent reviewer personas (identification, theorist, generalist) in
  parallel, then a meta-review synthesis. Expensive — invoke only on
  explicit request: "sim review", "simulate peer review", "mock reviews
  before submission", "run a simulated review against [venue]".
---

# Synthetic Peer Review Simulator

Simulate a full peer-review package for a paper draft: three independent reviewer passes plus a meta-review synthesis. The researcher reads the output cold, like real reviews.

## When to Use

On explicit request before submitting a paper draft. This runs four sub-agents — three reviewers in parallel plus a meta-review. Always confirm the target venue and draft location before starting.

## Finding the Project

Where you find the project depends on how this channel is set up:

- **Project-linked channels** (e.g., Discord `#project-<slug>`): project is mounted at `/workspace/project`.
- **Main channel with additional mounts**: projects are at `/workspace/extra/<project-name>`. List `/workspace/extra/` to see available mounts.

```bash
ls /workspace/project/CLAUDE.md 2>/dev/null && echo "Project at /workspace/project" || ls /workspace/extra/
```

`cd` into the project directory before starting.

## Inputs

- **Paper draft**: a `.tex` or `.pdf` file in the project directory. Confirm the file path with the researcher if unclear.
- **Target venue**: the venue the paper will be submitted to. Used to load the venue profile.
- **Venue profile** (optional): a vault note at `reference/venue-profiles/<venue-slug>.md` describing the venue's intellectual culture, reviewer fixations, methodological hierarchies, and common reasons for rejection. Load via `mcp__mcpvault__read_note`. If absent, note the gap and proceed.
- **Calibration reviews** (optional): anonymized real reviews in the vault at `reference/received-reviews/<venue-slug>/`. Load via `mcp__mcpvault__list_directory` then `mcp__mcpvault__read_note`. If present, pass to each reviewer persona as few-shot calibration. If absent, proceed without.
- **Writing rubrics**:
  - Global rubric: `reference/templates/global-writing-rubric.md` in the vault (via `mcp__mcpvault__read_note`).
  - Project rubric: `writing-rubric.md` at the project root, if present (normal `Read`).

## Process

### Step 0: Setup

1. Read the paper draft in full.
2. Load the venue profile (vault), if it exists.
3. Load calibration reviews for the target venue (vault), if they exist.
4. Load the global writing rubric (vault) and the project rubric (project root), if present.
5. Report to the researcher what context was loaded and what is missing. Do not block on missing context — proceed with what is available and note the limitations.

### Step 1: Dispatch Independent Reviewer Passes

Dispatch the three reviewers **in parallel** using `TeamCreate`. Each reviewer receives only:

- The paper draft
- The venue profile (if available)
- Calibration reviews for the target venue (if available)
- The writing rubric(s) (if available)
- Its own persona file

No reviewer sees another reviewer's persona or output. Independence is a structural requirement.

Persona files (read from `/workspace/skills/sim-review/`):

- `R1-identification.md` — methods and identification focus. Tools: `Read` only. No MCP.
- `R2-theorist.md` — theoretical contribution and novelty focus. Tools: `Read` plus `mcp__content-registry__search_registry` and `mcp__content-registry__expand_paper` for grounding novelty claims in the indexed literature.
- `R3-generalist.md` — framing, clarity, presentation focus. Tools: `Read` only. No MCP.

Dispatch pattern for each reviewer (adapt for each persona):

```
TeamCreate:
  prompt: |
    Read your persona file at /workspace/skills/sim-review/<persona>.md
    and follow it exactly.

    Paper draft: <absolute path>
    Target venue: <venue>
    Venue profile: <inline content, or "none available">
    Calibration reviews: <inline content, or "none available">
    Global rubric: <inline content, or "none available">
    Project rubric: <inline content, or "none available">

    Produce your review in the format specified by your persona file.
    Do not fabricate citations. If the content registry is unavailable,
    say so rather than inventing references.
  allowedTools: [Read]   # R2 also gets mcp__content-registry__*
```

When R2's dispatch prompt mentions the content registry, include the explicit tool names: `mcp__content-registry__search_registry` (semantic search) and `mcp__content-registry__expand_paper` (full details).

Wait for all three to complete before proceeding.

### Step 2: Dispatch Meta-Review

After all three reviewer passes complete, dispatch the meta-review via `TeamCreate`. The meta-reviewer receives:

- The paper draft
- The venue profile (if available)
- All three completed reviews, verbatim

Persona file: `meta-review.md`. Tools: `Read` only. No MCP.

### Step 3: Collect and Deliver

Assemble output in the project directory:

```
<project>/
  reviews/
    review-sim-<YYYY-MM-DD>/
      R1-identification.md
      R2-theorist.md
      R3-generalist.md
      meta-review.md
```

Each file should be self-contained and readable on its own. Report completion to the researcher with a one-line summary of the mock decision and the path to the review directory.

## What NOT to Do

- Do not let reviewers see each other's personas or output. Independence is the point.
- Do not soften reviews. Constructive specificity is more useful than diplomatic vagueness. "The identification strategy could be strengthened" is worthless. "Community overlap could proxy for ideological proximity rather than competition — the paper needs to instrument for this or acknowledge it as a limitation" is useful.
- Do not ask the researcher for input during the review process. The value of the simulation is that it runs without author intervention.
- Do not hallucinate citations in any reviewer's output. If the content registry is unavailable, R2 must say so rather than invent references.
- Do not commit the review output to git. These are working documents.

## Calibration Notes

Output quality depends on two content investments — both optional, both raise the ceiling:

1. **Venue profiles** (`reference/venue-profiles/` in the vault): ~500-word notes describing a venue's intellectual culture from an insider perspective. What reviewers fixate on, what gets desk-rejected, the implicit methodological hierarchy, what kinds of contributions the venue values. Written by the researcher and sharpened over time by comparing simulator output against real reviews received.

2. **Calibration reviews** (`reference/received-reviews/<venue-slug>/` in the vault): anonymized real reviews organized by venue. Even 2–3 per venue dramatically improve output quality by calibrating tone, specificity, and what counts as a fatal flaw versus a minor concern. Strip identifying information before storing.

The skill works without them but produces more generic output.
