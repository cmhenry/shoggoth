# Stale Session Self-Heal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stale-session-pointer bug that caused this morning's WhatsApp standup to hang: when the DB session ID has no backing JSONL, containers fail with "No conversation found" and retries make it permanent. Add three defenses: pre-flight check, error-gated persistence, and self-heal on session-not-found error.

**Architecture:** Add a new `src/sessions.ts` module with `resolveSessionId(groupFolder)` (reads DB + checks JSONL exists + clears if missing) and `isSessionNotFoundError(error)` (error-string matcher). Wire into both container-launch call sites (`src/index.ts:runAgent` and `src/task-scheduler.ts`). Gate `setSession` on `output.status === 'success'`. On error matching `isSessionNotFoundError`, call `clearSession` before returning.

**Tech Stack:** TypeScript, better-sqlite3, vitest, ESM. All edits under `src/`.

---

## Pre-work

- [ ] **Confirm clean working tree** — `git status` should be clean; branch off `main` to `fix/stale-session-selfheal`.

```bash
cd /home/square/shoggoth
git status                    # expect clean
git checkout -b fix/stale-session-selfheal
```

---

### Task 1: Add `clearSession` helper to `db.ts`

**Files:**
- Modify: `src/db.ts` (add function after `getAllSessions` ~line 604)
- Test: `src/db.test.ts` (add block near end)

- [ ] **Step 1: Write the failing test**

Append to `src/db.test.ts` (at the bottom of the file, after existing describe blocks). Also add `clearSession`, `getSession`, `setSession` to the imports at the top.

```ts
describe('clearSession', () => {
  it('removes the session row for the given group', () => {
    setSession('whatsapp_main', 'abc-123');
    expect(getSession('whatsapp_main')).toBe('abc-123');

    clearSession('whatsapp_main');
    expect(getSession('whatsapp_main')).toBeUndefined();
  });

  it('is a no-op when the group has no session row', () => {
    expect(() => clearSession('nonexistent')).not.toThrow();
    expect(getSession('nonexistent')).toBeUndefined();
  });

  it('only clears the given group, not others', () => {
    setSession('group_a', 'aaa');
    setSession('group_b', 'bbb');

    clearSession('group_a');

    expect(getSession('group_a')).toBeUndefined();
    expect(getSession('group_b')).toBe('bbb');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- db.test.ts
```
Expected: FAIL — `clearSession is not exported from './db.js'` (or TS compile error).

- [ ] **Step 3: Implement `clearSession`**

In `src/db.ts`, after `getAllSessions` (around line 604), add:

```ts
export function clearSession(groupFolder: string): void {
  db.prepare('DELETE FROM sessions WHERE group_folder = ?').run(groupFolder);
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- db.test.ts
```
Expected: PASS for the three new `clearSession` tests plus all existing tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/db.ts src/db.test.ts
git commit -m "feat(db): add clearSession helper for session self-heal"
```

---

### Task 2: Create `src/sessions.ts` with `resolveSessionId` + `isSessionNotFoundError`

**Files:**
- Create: `src/sessions.ts`
- Create: `src/sessions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/sessions.test.ts`:

```ts
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock config to point DATA_DIR at a temp location we control per test
const TEST_DATA_DIR = path.join('/tmp', 'nanoclaw-sessions-test');
vi.mock('./config.js', () => ({
  DATA_DIR: TEST_DATA_DIR,
  ASSISTANT_NAME: 'TestBot',
  STORE_DIR: path.join(TEST_DATA_DIR, 'store'),
}));

import { _initTestDatabase, setSession, getSession } from './db.js';
import { resolveSessionId, isSessionNotFoundError } from './sessions.js';

function jsonlPath(groupFolder: string, sessionId: string): string {
  return path.join(
    TEST_DATA_DIR,
    'sessions',
    groupFolder,
    '.claude',
    'projects',
    '-workspace-group',
    `${sessionId}.jsonl`,
  );
}

function createJsonl(groupFolder: string, sessionId: string): void {
  const file = jsonlPath(groupFolder, sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
}

beforeEach(() => {
  _initTestDatabase();
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

describe('resolveSessionId', () => {
  it('returns undefined when the group has no DB row', () => {
    expect(resolveSessionId('whatsapp_main')).toBeUndefined();
  });

  it('returns the session id when the jsonl exists on disk', () => {
    setSession('whatsapp_main', 'good-id');
    createJsonl('whatsapp_main', 'good-id');

    expect(resolveSessionId('whatsapp_main')).toBe('good-id');
    expect(getSession('whatsapp_main')).toBe('good-id');
  });

  it('returns undefined and clears the DB row when the jsonl is missing', () => {
    setSession('whatsapp_main', 'stale-id');
    // Intentionally do NOT create the jsonl

    expect(resolveSessionId('whatsapp_main')).toBeUndefined();
    expect(getSession('whatsapp_main')).toBeUndefined();
  });
});

describe('isSessionNotFoundError', () => {
  it('matches the Claude Code session-not-found error string', () => {
    const err =
      'Claude Code returned an error result: No conversation found with session ID: abc-123';
    expect(isSessionNotFoundError(err)).toBe(true);
  });

  it('matches when the error is the inner message only', () => {
    expect(
      isSessionNotFoundError('No conversation found with session ID: xyz'),
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isSessionNotFoundError('Credit balance is too low')).toBe(false);
    expect(isSessionNotFoundError('')).toBe(false);
    expect(isSessionNotFoundError(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify failure**

```bash
npm test -- sessions.test.ts
```
Expected: FAIL — module `./sessions.js` not found.

- [ ] **Step 3: Implement `src/sessions.ts`**

Create `src/sessions.ts`:

```ts
import fs from 'fs';
import path from 'path';

import { DATA_DIR } from './config.js';
import { clearSession, getSession } from './db.js';
import { logger } from './logger.js';

/**
 * Return the group's stored session ID if (and only if) its backing JSONL
 * still exists on disk. If the DB points at a session whose file is missing,
 * clear the DB row and return undefined so the next container launch starts
 * a fresh session instead of failing with "No conversation found".
 */
export function resolveSessionId(groupFolder: string): string | undefined {
  const sessionId = getSession(groupFolder);
  if (!sessionId) return undefined;

  const jsonlFile = path.join(
    DATA_DIR,
    'sessions',
    groupFolder,
    '.claude',
    'projects',
    '-workspace-group',
    `${sessionId}.jsonl`,
  );

  if (fs.existsSync(jsonlFile)) {
    return sessionId;
  }

  logger.warn(
    { groupFolder, sessionId, jsonlFile },
    'Stored session JSONL is missing; clearing stale pointer',
  );
  clearSession(groupFolder);
  return undefined;
}

/**
 * True iff the given error was caused by Claude Code failing to resume a
 * session that no longer exists on disk.
 */
export function isSessionNotFoundError(error: unknown): boolean {
  if (typeof error !== 'string' || error.length === 0) return false;
  return error.includes('No conversation found with session ID');
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- sessions.test.ts
```
Expected: PASS for all six tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/sessions.ts src/sessions.test.ts
git commit -m "feat(sessions): add resolveSessionId pre-flight + not-found matcher"
```

---

### Task 3: Wire `resolveSessionId` into `src/index.ts:runAgent`

**Files:**
- Modify: `src/index.ts:466` (and surrounding imports)

- [ ] **Step 1: Update imports**

At the top of `src/index.ts`, add to the existing `./sessions.js`-adjacent imports (this import block does not yet exist — add a new one after the `./task-scheduler.js` import at line 69):

```ts
import { isSessionNotFoundError, resolveSessionId } from './sessions.js';
```

- [ ] **Step 2: Replace the cache read with `resolveSessionId`**

Find (around line 465-466):

```ts
  const isMain = group.isMain === true;
  const sessionId = sessions[group.folder];
```

Replace with:

```ts
  const isMain = group.isMain === true;
  const sessionId = resolveSessionId(group.folder);
  if (!sessionId) {
    delete sessions[group.folder];
  }
```

(The in-memory `sessions` map is the module-level cache populated from `getAllSessions()` at startup; we keep it in sync when the pre-flight clears DB.)

- [ ] **Step 3: Typecheck and verify no unrelated breakage**

```bash
npm run typecheck
npm test -- db.test.ts sessions.test.ts
```
Expected: PASS, no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "fix(index): preflight session JSONL before container launch"
```

---

### Task 4: Wire `resolveSessionId` into `src/task-scheduler.ts`

**Files:**
- Modify: `src/task-scheduler.ts:152-155`

- [ ] **Step 1: Add the import**

Near the other `./` imports at the top of `src/task-scheduler.ts`, add:

```ts
import { resolveSessionId } from './sessions.js';
```

- [ ] **Step 2: Replace the session lookup**

Find (lines 152-155):

```ts
  // For group context mode, use the group's current session
  const sessions = deps.getSessions();
  const sessionId =
    task.context_mode === 'group' ? sessions[task.group_folder] : undefined;
```

Replace with:

```ts
  // For group context mode, use the group's current session (with JSONL pre-flight)
  const sessionId =
    task.context_mode === 'group'
      ? resolveSessionId(task.group_folder)
      : undefined;
```

(The `deps.getSessions()` cache is now bypassed for this path. If linter flags an unused-variable warning for any remaining reference, either keep the line for use elsewhere in the function or remove it — inspect the function body.)

- [ ] **Step 3: Check whether `deps.getSessions()` is still used below**

```bash
grep -n "getSessions\|\\bsessions\\b" src/task-scheduler.ts
```
If no remaining usages, also delete the now-dead getter from the `deps` interface at the top of the file. If there are usages, leave it.

- [ ] **Step 4: Typecheck and run tests**

```bash
npm run typecheck
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/task-scheduler.ts
git commit -m "fix(scheduler): preflight session JSONL for group-context tasks"
```

---

### Task 5: Gate `setSession` on `output.status === 'success'` in `runAgent`

**Files:**
- Modify: `src/index.ts` (around lines 494-525 — the `wrappedOnOutput` closure and the post-await block inside `runAgent`)

- [ ] **Step 1: Gate the streamed-output write**

Find (lines 493-502):

```ts
  // Wrap onOutput to track session ID from streamed results
  const wrappedOnOutput = onOutput
    ? async (output: ContainerOutput) => {
        if (output.newSessionId) {
          sessions[group.folder] = output.newSessionId;
          setSession(group.folder, output.newSessionId);
        }
        await onOutput(output);
      }
    : undefined;
```

Replace with:

```ts
  // Wrap onOutput to track session ID from streamed results.
  // Only persist the session ID when the container reports success —
  // Claude Code echoes back the resumed ID even on resume failure, which
  // would otherwise re-poison the DB with a stale pointer.
  const wrappedOnOutput = onOutput
    ? async (output: ContainerOutput) => {
        if (output.newSessionId && output.status === 'success') {
          sessions[group.folder] = output.newSessionId;
          setSession(group.folder, output.newSessionId);
        }
        await onOutput(output);
      }
    : undefined;
```

- [ ] **Step 2: Gate the post-await write**

Find (around lines 522-525):

```ts
    if (output.newSessionId) {
      sessions[group.folder] = output.newSessionId;
      setSession(group.folder, output.newSessionId);
    }
```

Replace with:

```ts
    if (output.newSessionId && output.status === 'success') {
      sessions[group.folder] = output.newSessionId;
      setSession(group.folder, output.newSessionId);
    }
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "fix(index): only persist session id on success, not on error"
```

---

### Task 6: Self-heal DB on "No conversation found" errors

**Files:**
- Modify: `src/index.ts` (error-handling block around line 527-533 inside `runAgent`)

- [ ] **Step 1: Add `clearSession` to the `./db.js` imports**

Find the existing `from './db.js'` block (around lines 32-47) and add `clearSession` to the list:

```ts
import {
  // ... existing imports
  clearSession,
  // ... existing imports
  setSession,
  // ...
} from './db.js';
```

- [ ] **Step 2: Self-heal in the error branch**

Find (around lines 527-533):

```ts
    if (output.status === 'error') {
      logger.error(
        { group: group.name, error: output.error },
        'Container agent error',
      );
      return 'error';
    }
```

Replace with:

```ts
    if (output.status === 'error') {
      logger.error(
        { group: group.name, error: output.error },
        'Container agent error',
      );
      if (isSessionNotFoundError(output.error)) {
        logger.warn(
          { group: group.name, sessionId },
          'Clearing stale session pointer after "No conversation found" error',
        );
        clearSession(group.folder);
        delete sessions[group.folder];
      }
      return 'error';
    }
```

- [ ] **Step 3: Typecheck and run tests**

```bash
npm run typecheck
npm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "fix(index): self-heal DB when container reports session not found"
```

---

### Task 7: Verify end-to-end and unblock today's standup

**Files:** none (verification + runtime fix)

- [ ] **Step 1: Full build + test + lint + format-check**

```bash
npm run build
npm test
npm run lint
npm run format:check
```
Expected: all pass.

- [ ] **Step 2: Inspect current stale DB row**

```bash
sqlite3 /home/square/shoggoth/store/messages.db \
  "SELECT group_folder, session_id FROM sessions WHERE group_folder='whatsapp_main';"
```
Expected: one row with `ec63f33c-3c07-4049-bd54-8c921a2bd0c0` (or whatever stale id).

- [ ] **Step 3: Clear the stale row manually (unblock user now)**

```bash
sqlite3 /home/square/shoggoth/store/messages.db \
  "DELETE FROM sessions WHERE group_folder='whatsapp_main';"
```

- [ ] **Step 4: Confirm no currently-running agent containers**

```bash
docker ps --format '{{.Names}}' | grep '^nanoclaw-' || echo "no containers"
```
If containers are running, wait or coordinate with the user before the next step.

- [ ] **Step 5: Restart nanoclaw to pick up the new code**

```bash
systemctl --user restart nanoclaw
systemctl --user status nanoclaw --no-pager | head -15
```
Expected: `active (running)`.

- [ ] **Step 6: Tail the journal during a test WhatsApp message**

Ask the user to send a WhatsApp message. Stream the log:

```bash
journalctl --user -u nanoclaw -f -n 50
```
Expected: container spawns with `session: new` (not a resumed stale id); agent responds.

- [ ] **Step 7: Final commit summary (if any docs/changes left) and push branch**

```bash
git status
git log --oneline main..HEAD
git push -u origin fix/stale-session-selfheal
```

Then open a PR with a concise summary referencing the three defenses and the Apr 14 incident.

---

## Self-review checklist (done during planning, re-check at end)

- Every task has a commit step.
- No placeholders ("TODO", "implement later", "handle edge cases").
- Every code step includes the actual code to write.
- Function / export names are consistent across tasks (`clearSession`, `resolveSessionId`, `isSessionNotFoundError`).
- No task depends on symbols introduced later.
- Pre-flight + error-gating + self-heal each get their own commit for a clean history.
