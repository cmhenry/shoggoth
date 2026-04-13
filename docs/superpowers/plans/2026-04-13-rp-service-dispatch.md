# RP Service Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route messages from groups marked `dispatch: "rp_service"` to an external Research Partner HTTP service instead of the container agent pipeline.

**Architecture:** Add a `dispatch` field to `RegisteredGroup`. In `processGroupMessages()`, check `dispatch` before calling `formatMessages()` — if it's `"rp_service"`, POST only the latest message to the RP endpoint and short-circuit. This keeps the container pipeline untouched for all existing groups.

**Tech Stack:** Node.js, TypeScript, Vitest, native `fetch`

---

### Task 1: Extend `RegisteredGroup` type

**Files:**
- Modify: `src/types.ts:38-47`

- [ ] **Step 1: Add the `dispatch` field to `RegisteredGroup`**

In `src/types.ts`, add the optional `dispatch` property to the `RegisteredGroup` interface:

```typescript
export interface RegisteredGroup {
  name: string;
  folder: string;
  trigger: string;
  added_at: string;
  containerConfig?: ContainerConfig;
  requiresTrigger?: boolean; // Default: true for groups, false for solo chats
  isMain?: boolean; // True for the main control group (no trigger, elevated privileges)
  projectPath?: string; // Absolute path to linked project directory
  dispatch?: "container" | "rp_service"; // default: "container"
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: Clean compilation, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add dispatch field to RegisteredGroup type"
```

---

### Task 2: Add RP service dispatch branch (with tests)

**Files:**
- Modify: `src/index.ts:279-311`
- Create: `src/rp-dispatch.test.ts`

- [ ] **Step 1: Write the failing test for RP dispatch — happy path**

Create `src/rp-dispatch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('RP service dispatch', () => {
  const MOCK_RP_URL = 'http://localhost:8300';

  beforeEach(() => {
    vi.stubEnv('RP_SERVICE_URL', MOCK_RP_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('POSTs latest message to RP service and sends response to channel', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: 'RP says hello' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Import after mocking
    const { dispatchToRpService } = await import('./index.js');

    const sendMessage = vi.fn();
    const result = await dispatchToRpService(
      {
        content: 'hello research partner',
        sender_name: 'Alice',
      },
      'dc:research-channel',
      { sendMessage },
    );

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(`${MOCK_RP_URL}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello research partner',
        sender: 'Alice',
        channel: 'dc:research-channel',
      }),
    });
    expect(sendMessage).toHaveBeenCalledWith('dc:research-channel', 'RP says hello');
  });

  it('sends error message when RP service returns non-OK', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { dispatchToRpService } = await import('./index.js');

    const sendMessage = vi.fn();
    const result = await dispatchToRpService(
      { content: 'hello', sender_name: 'Alice' },
      'dc:research-channel',
      { sendMessage },
    );

    expect(result).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(
      'dc:research-channel',
      'Research Partner is currently unavailable.',
    );
  });

  it('sends error message when RP service is unreachable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', mockFetch);

    const { dispatchToRpService } = await import('./index.js');

    const sendMessage = vi.fn();
    const result = await dispatchToRpService(
      { content: 'hello', sender_name: 'Alice' },
      'dc:research-channel',
      { sendMessage },
    );

    expect(result).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(
      'dc:research-channel',
      'Research Partner service is not running.',
    );
  });

  it('returns true with no action when missedMessages is empty', async () => {
    const { dispatchToRpService } = await import('./index.js');

    const sendMessage = vi.fn();
    const result = await dispatchToRpService(
      undefined,
      'dc:research-channel',
      { sendMessage },
    );

    expect(result).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not send channel message when RP response is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: '' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { dispatchToRpService } = await import('./index.js');

    const sendMessage = vi.fn();
    await dispatchToRpService(
      { content: 'hello', sender_name: 'Alice' },
      'dc:research-channel',
      { sendMessage },
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('uses default URL when RP_SERVICE_URL is not set', async () => {
    vi.unstubAllEnvs(); // Remove the env stub
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { dispatchToRpService } = await import('./index.js');

    const sendMessage = vi.fn();
    await dispatchToRpService(
      { content: 'hello', sender_name: 'Alice' },
      'dc:research-channel',
      { sendMessage },
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8300/message',
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rp-dispatch.test.ts`
Expected: FAIL — `dispatchToRpService` is not exported from `./index.js`.

- [ ] **Step 3: Implement `dispatchToRpService` and the routing branch**

In `src/index.ts`, add the exported helper function (after the imports, near the other exports around line 74):

```typescript
/**
 * Dispatch a message to the Research Partner service.
 * Returns true on success (or no-op), false on error.
 * Exported for testing — called internally by processGroupMessages().
 */
export async function dispatchToRpService(
  latestMessage: { content: string; sender_name: string } | undefined,
  chatJid: string,
  channel: { sendMessage(jid: string, text: string): Promise<void> | void },
): Promise<boolean> {
  if (!latestMessage) return true;

  const rpUrl = process.env.RP_SERVICE_URL || "http://localhost:8300";
  try {
    const res = await fetch(`${rpUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: latestMessage.content,
        sender: latestMessage.sender_name,
        channel: chatJid,
      }),
    });
    if (res.ok) {
      const { response } = await res.json();
      if (response) await channel.sendMessage(chatJid, response);
      return true;
    } else {
      const errBody = await res.text();
      logger.error(`RP service error: ${res.status} ${errBody}`);
      await channel.sendMessage(chatJid, "Research Partner is currently unavailable.");
      return false;
    }
  } catch (err: any) {
    logger.error(`RP service unreachable: ${err.message}`);
    await channel.sendMessage(chatJid, "Research Partner service is not running.");
    return false;
  }
}
```

Then in `processGroupMessages()`, insert the dispatch branch **after** `if (missedMessages.length === 0) return true;` (line 298) and **before** `const prompt = formatMessages(...)` (line 311):

```typescript
  // RP service dispatch — bypass container pipeline entirely
  if (group.dispatch === "rp_service") {
    const latest = missedMessages[missedMessages.length - 1];
    // Advance cursor before dispatching
    lastAgentTimestamp[chatJid] = latest.timestamp;
    saveState();
    await dispatchToRpService(
      { content: latest.content, sender_name: latest.sender_name },
      chatJid,
      channel,
    );
    return true;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rp-dispatch.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npm test`
Expected: All existing tests still pass.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/rp-dispatch.test.ts
git commit -m "feat: add RP service dispatch for rp_service groups"
```

---

### Task 3: Register `#research-partner` Discord channel

**Files:**
- No code changes — this is a runtime registration

- [ ] **Step 1: Identify the Discord channel ID**

The `#research-partner` channel needs to exist in Discord. Get the channel ID from Discord (right-click channel > Copy Channel ID with developer mode on). It will look like `dc:1234567890`.

- [ ] **Step 2: Register the group via IPC or direct DB call**

The easiest approach is to register through the existing IPC mechanism from a running agent, or use the `registerGroup` call. Since we're in the NanoClaw repo, we can add the registration to the config.

If the channel already exists in Discord, register it by adding to the appropriate config or through the main group agent. The registration needs:

```typescript
registerGroup('dc:<research-partner-channel-id>', {
  name: 'Shoggoth #research-partner',
  folder: 'research-partner',
  trigger: '@Shoggoth',
  added_at: new Date().toISOString(),
  requiresTrigger: false, // RP should respond to all messages
  dispatch: 'rp_service',
});
```

- [ ] **Step 3: Create the group folder**

```bash
mkdir -p groups/research-partner/logs
```

- [ ] **Step 4: Seed the group's CLAUDE.md**

Create `groups/research-partner/CLAUDE.md`:

```markdown
# Research Partner

Messages in this channel are dispatched to the Research Partner (Letta) service, not to a container agent.
```

- [ ] **Step 5: Smoke test**

1. Start NanoClaw: `npm run dev`
2. Send a message in `#research-partner`
3. Verify in logs that the RP service dispatch branch is hit (look for "RP service" in log output)
4. If the RP service at `~/partner` is running, verify the response comes back to Discord

- [ ] **Step 6: Commit**

```bash
git add groups/research-partner/
git commit -m "feat: register #research-partner channel with rp_service dispatch"
```

---

### Notes

- **RP_SERVICE_URL** defaults to `http://localhost:8300`. Override via `.env` if the partner service runs elsewhere.
- The dispatch branch advances the cursor before calling the RP service — same pattern as the container pipeline. If the RP service is down, the user gets an error message but the message won't be reprocessed (matching the spec's note that cursor advancement already happens).
- Task 3 depends on knowing the Discord channel ID. If `#research-partner` doesn't exist yet in Discord, create it first (or use the `/add-discord` skill's channel creation).
