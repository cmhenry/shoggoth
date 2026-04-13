---
name: idea-triage
description: >
  Archive or upgrade an explored idea. Archiving moves it to feeds/inbox/archive/.
  Upgrading creates a project folder in the vault and a private GitHub repo.
---

# Idea Triage

Move an idea to its final destination: archive (not viable or not timely) or upgrade to a full project.

## Trigger

Manual. Researcher says something like:
- "archive [[slug]]"
- "upgrade [[slug]] to project"
- "this one's not going anywhere, archive it"
- "let's turn this into a project"

## Archive path

1. **Move the note** — `mcp__mcpvault__move_note` from `feeds/inbox/YYYY-MM-DD-slug.md` to `feeds/inbox/archive/YYYY-MM-DD-slug.md`

2. **Update frontmatter** — `mcp__mcpvault__update_frontmatter` on the moved note: `status: archived`

3. **Remove from scratch** — `mcp__mcpvault__patch_note` on `feeds/inbox/scratch.md` to remove the line containing `[[YYYY-MM-DD-slug]]`

4. **Confirm** — "Archived [[slug]]. It's in feeds/inbox/archive/ if you need it later."

## Upgrade path

1. **Read the idea note** — `mcp__mcpvault__read_note` on `feeds/inbox/YYYY-MM-DD-slug.md` to get the exploration findings for seeding the project.

2. **Create PROJECT.md** — `mcp__mcpvault__write_note` to `projects/{slug}/PROJECT.md`:

   ```yaml
   ---
   phase: research
   priority: medium
   last_updated: YYYY-MM-DD
   ---
   ```

   Sections seeded from the idea's exploration findings:
   - `# {Project Title}` — derived from the idea, not the slug
   - `## Status` — "Promoted from idea exploration on YYYY-MM-DD. [Summary of where things stand based on What we found / What to do next]"
   - `## Context` — Key findings from exploration: literature landscape, feasibility notes, methodological approach
   - `## Key Decisions` — "YYYY-MM-DD — Promoted from idea to project based on [researcher's reasoning if stated]"

   The slug for the project folder drops the date prefix from the idea slug (e.g., `feeds/inbox/2026-03-25-adversarial-deliberation.md` becomes `projects/adversarial-deliberation/`).

3. **Move idea note as ORIGIN.md** — `mcp__mcpvault__move_note` from `feeds/inbox/YYYY-MM-DD-slug.md` to `projects/{slug}/ORIGIN.md`

4. **Update frontmatter** — `mcp__mcpvault__update_frontmatter` on ORIGIN.md: `status: upgraded`

5. **Generate writing rubric** — `mcp__mcpvault__write_note` to `projects/{slug}/{slug}-writing-rubric.md`:

   ```markdown
   # Writing Rubric: {Project Title}

   Project-specific evaluation criteria. Supplements `reference/templates/global-writing-rubric.md`
   (global rules always apply). This file encodes the venue requirements,
   framing decisions, and project-specific standards.

   ---

   ## Venue

   - **Target:** [Seed from ORIGIN.md if available, else TBD]
   - **Format:** TBD
   - **Review criteria:** TBD

   ## Audience

   - **Primary reader:** TBD
   - **Assumed knowledge:** TBD

   ## Framing Constraints

   - **Core argument in one sentence:** [Seed from ORIGIN.md core concept if available, else TBD]
   - **This paper is NOT about:** TBD

   ## Citation Norms

   - **Must-cite papers:** [Seed from ORIGIN.md papers-to-read if available]

   ## Section-Specific Notes

   [To be filled as the project develops]

   ## Project-Specific Anti-Patterns

   [To be filled as writing begins]

   ---

   _Last updated: {date}_ _Update this file when the venue, framing, or argument changes._
   ```

   Populate sections from ORIGIN.md wherever data is available (venue targets, must-cite papers, framing). Leave as TBD where no data exists.

6. **Update index** — `mcp__mcpvault__patch_note` on `projects/_index.md` to append a row to the Active Projects table:

   ```
   | [{slug}]({slug}/PROJECT.md) | research | medium | {date} | New project; [one-line status from PROJECT.md] |
   ```

   Insert the row at the end of the Active Projects table (before any section break or `## Project Clusters`).

7. **Remove from scratch** — `mcp__mcpvault__patch_note` on `feeds/inbox/scratch.md` to remove the line containing the idea's backlink.

8. **Scaffold host resources via IPC** — Write the IPC task file:

   ```bash
   cat > /workspace/ipc/tasks/scaffold_project_$(date +%s).json << 'IPCEOF'
   {
     "type": "scaffold_project",
     "projectName": "{slug}",
     "requestedBy": "{chat-jid-of-requesting-channel}"
   }
   IPCEOF
   ```

   Replace `{slug}` and `{chat-jid}` with actual values.

9. **Read result** — Wait a few seconds, then check for the result:

   ```bash
   ls -t /workspace/ipc/input/scaffold_project_result_*.json 2>/dev/null | head -1 | xargs cat
   ```

   Report the combined result to the user:

   **Full success:** "Upgraded {slug} to project. Vault: projects/{slug}/, Repo: github.com/cmhenry/{slug}, Discord: #{slug}"

   **Partial success:** Report what succeeded and what failed. Vault operations always succeed (they ran first). Note that re-running the scaffold IPC is safe (idempotent).

   **Failure:** Report the error. Note that vault operations completed successfully.

## What not to do

- Don't archive or upgrade without explicit researcher instruction
- Don't lose the original idea prose — it's preserved as ORIGIN.md
- Don't set project priority to high by default — let the researcher adjust
- Don't create extra directories in the repo — just the template skeleton
