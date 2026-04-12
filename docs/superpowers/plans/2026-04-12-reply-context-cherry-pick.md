# Reply Context Cherry-Pick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate upstream reply/quoted message context support (commit `ee599b9`) so agents can see which message a user is replying to.

**Architecture:** Straight cherry-pick — no downstream fixes expected since Shoggoth's changes are in different tables/interfaces.

**Tech Stack:** TypeScript, SQLite, vitest

---

### Task 1: Cherry-pick upstream commit and verify

**Files:**
- Modify: `src/types.ts` (NewMessage interface)
- Modify: `src/db.ts` (migrations + storeMessage + getNewMessages + getMessagesSince)
- Modify: `src/router.ts` (formatMessages XML rendering)
- Modify: `src/db.test.ts` (reply context tests)
- Modify: `src/formatting.test.ts` (reply formatting tests)

- [ ] **Step 1: Attempt the cherry-pick**

```bash
git cherry-pick ee599b9 --no-commit
```

If conflicts arise (unlikely), resolve them. The upstream changes add:

`src/types.ts` — four new optional fields on `NewMessage`:
```typescript
  thread_id?: string;
  reply_to_message_id?: string;
  reply_to_message_content?: string;
  reply_to_sender_name?: string;
```

`src/db.ts` — new migration block adding reply columns to messages table, updated INSERT in `storeMessage` to include reply fields, updated SELECT in `getNewMessages` and `getMessagesSince` to include reply columns.

`src/router.ts` — `formatMessages` renders `reply_to` attribute and `<quoted_message>` child element when reply fields are present.

- [ ] **Step 2: Build and run tests**

```bash
npm run build && npm test
```

Expected: all pass, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/db.ts src/router.ts src/db.test.ts src/formatting.test.ts
git commit -m "feat: cherry-pick upstream ee599b9 — reply/quoted message context

Adds reply context infrastructure:
- thread_id and reply_to_* fields on NewMessage
- DB migrations for reply context columns on messages table
- storeMessage/getNewMessages/getMessagesSince persist and retrieve reply fields
- formatMessages renders <quoted_message> XML for agent context

Channels don't populate these fields yet — future work.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
