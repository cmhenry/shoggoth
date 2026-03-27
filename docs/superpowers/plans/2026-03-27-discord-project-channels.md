# Discord Project Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Shoggoth to dynamically create Discord channels linked to projects in `~/projects/`, with the agent orchestrating conversation and the host executing privileged side effects via IPC.

**Architecture:** Agent in main group container handles conversational flow (list projects, confirm). On confirmation, writes IPC action file. Host IPC watcher picks it up, creates Discord channel via API, registers group in DB with `project_path`, creates group folder, writes response. Container runner mounts `project_path` read-write at `/workspace/project` for project groups.

**Tech Stack:** TypeScript, discord.js, better-sqlite3, vitest

---

### Task 1: Add `project_path` column to `registered_groups` and update type

**Files:**
- Modify: `src/types.ts:38-46`
- Modify: `src/db.ts:76-84` (schema), `src/db.ts:125-136` (migration area), `src/db.ts:560-598` (getRegisteredGroup), `src/db.ts:600-617` (setRegisteredGroup), `src/db.ts:619-653` (getAllRegisteredGroups)
- Test: `src/db.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/db.test.ts`:

```typescript
describe('project_path support', () => {
  it('stores and retrieves project_path on registered group', () => {
    setRegisteredGroup('dc:123', {
      name: 'Project Channel',
      folder: 'project_test',
      trigger: '@Andy',
      added_at: '2024-01-01T00:00:00.000Z',
      projectPath: '/home/user/projects/test',
    });

    const group = getRegisteredGroup('dc:123');
    expect(group).toBeDefined();
    expect(group!.projectPath).toBe('/home/user/projects/test');
  });

  it('returns undefined projectPath when not set', () => {
    setRegisteredGroup('dc:456', {
      name: 'Regular Channel',
      folder: 'discord_regular',
      trigger: '@Andy',
      added_at: '2024-01-01T00:00:00.000Z',
    });

    const group = getRegisteredGroup('dc:456');
    expect(group).toBeDefined();
    expect(group!.projectPath).toBeUndefined();
  });

  it('includes projectPath in getAllRegisteredGroups', () => {
    setRegisteredGroup('dc:789', {
      name: 'Project Channel',
      folder: 'project_foo',
      trigger: '@Andy',
      added_at: '2024-01-01T00:00:00.000Z',
      projectPath: '/home/user/projects/foo',
    });

    const all = getAllRegisteredGroups();
    expect(all['dc:789'].projectPath).toBe('/home/user/projects/foo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db.test.ts --reporter verbose 2>&1 | tail -20`
Expected: FAIL — `projectPath` not recognized on `RegisteredGroup` type

- [ ] **Step 3: Add `projectPath` to `RegisteredGroup` type**

In `src/types.ts`, add to the `RegisteredGroup` interface:

```typescript
export interface RegisteredGroup {
  name: string;
  folder: string;
  trigger: string;
  added_at: string;
  containerConfig?: ContainerConfig;
  requiresTrigger?: boolean;
  isMain?: boolean;
  projectPath?: string; // Absolute path to linked project directory
}
```

- [ ] **Step 4: Add DB migration for `project_path` column**

In `src/db.ts`, add after the `is_main` migration block (after line 136):

```typescript
  // Add project_path column for project-linked groups
  try {
    database.exec(
      `ALTER TABLE registered_groups ADD COLUMN project_path TEXT`,
    );
  } catch {
    /* column already exists */
  }
```

- [ ] **Step 5: Update `getRegisteredGroup` to read `project_path`**

In `src/db.ts`, update the `getRegisteredGroup` function. Add `project_path: string | null;` to the row type, and add to the return object:

```typescript
    projectPath: row.project_path || undefined,
```

Add it after the `isMain` line in the return statement.

- [ ] **Step 6: Update `setRegisteredGroup` to write `project_path`**

In `src/db.ts`, update the SQL and `.run()` call in `setRegisteredGroup`:

```typescript
export function setRegisteredGroup(jid: string, group: RegisteredGroup): void {
  if (!isValidGroupFolder(group.folder)) {
    throw new Error(`Invalid group folder "${group.folder}" for JID ${jid}`);
  }
  db.prepare(
    `INSERT OR REPLACE INTO registered_groups (jid, name, folder, trigger_pattern, added_at, container_config, requires_trigger, is_main, project_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    jid,
    group.name,
    group.folder,
    group.trigger,
    group.added_at,
    group.containerConfig ? JSON.stringify(group.containerConfig) : null,
    group.requiresTrigger === undefined ? 1 : group.requiresTrigger ? 1 : 0,
    group.isMain ? 1 : 0,
    group.projectPath || null,
  );
}
```

- [ ] **Step 7: Update `getAllRegisteredGroups` to read `project_path`**

Add `project_path: string | null;` to the row type in `getAllRegisteredGroups`, and add to each result entry:

```typescript
      projectPath: row.project_path || undefined,
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/db.test.ts --reporter verbose 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/db.ts src/db.test.ts
git commit -m "feat: add project_path column to registered_groups"
```

---

### Task 2: Include `projectPath` in `available_groups.json`

**Files:**
- Modify: `src/container-runner.ts:817-822` (AvailableGroup interface)
- Modify: `src/index.ts:125-137` (getAvailableGroups)

- [ ] **Step 1: Add `projectPath` to `AvailableGroup` interface**

In `src/container-runner.ts`, update the interface:

```typescript
export interface AvailableGroup {
  jid: string;
  name: string;
  lastActivity: string;
  isRegistered: boolean;
  projectPath?: string;
}
```

- [ ] **Step 2: Populate `projectPath` in `getAvailableGroups`**

In `src/index.ts`, update the `getAvailableGroups` function to include `projectPath` from registered groups:

```typescript
export function getAvailableGroups(): import('./container-runner.js').AvailableGroup[] {
  const chats = getAllChats();
  const registeredJids = new Set(Object.keys(registeredGroups));

  return chats
    .filter((c) => c.jid !== '__group_sync__' && c.is_group)
    .map((c) => ({
      jid: c.jid,
      name: c.name,
      lastActivity: c.last_message_time,
      isRegistered: registeredJids.has(c.jid),
      projectPath: registeredGroups[c.jid]?.projectPath,
    }));
}
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `npx vitest run --reporter verbose 2>&1 | tail -30`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/container-runner.ts src/index.ts
git commit -m "feat: include projectPath in available_groups.json"
```

---

### Task 3: Mount `project_path` in container for project groups

**Files:**
- Modify: `src/container-runner.ts:132-312` (buildVolumeMounts)
- Test: `src/container-runner.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/container-runner.test.ts`. This test needs access to `buildVolumeMounts`, but it's not exported. Since the test file already mocks `fs` and `spawn`, we test through `runContainerAgent` by checking the spawn args. Add after the existing describe block:

```typescript
import { spawn } from 'child_process';

describe('project_path volume mount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeProc = createFakeProcess();

    // Make fs.existsSync return true for project paths
    const fs = vi.mocked(await import('fs')).default;
    fs.existsSync.mockImplementation((p: any) => {
      const s = String(p);
      return (
        s.includes('/projects/test-project') ||
        s.includes('container/skills') ||
        s.includes('container/agent-runner/src')
      );
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts project_path at /workspace/project for non-main groups', async () => {
    const projectGroup: RegisteredGroup = {
      name: 'Project Channel',
      folder: 'project_test',
      trigger: '@Andy',
      added_at: new Date().toISOString(),
      projectPath: '/home/user/projects/test-project',
    };

    const resultPromise = runContainerAgent(
      projectGroup,
      {
        prompt: 'Hello',
        groupFolder: 'project_test',
        chatJid: 'dc:123',
        isMain: false,
      },
      () => {},
    );

    // Check spawn was called with project mount args
    const spawnMock = vi.mocked(spawn);
    const args = spawnMock.mock.calls[0][1] as string[];
    const mountArgs = args.join(' ');

    expect(mountArgs).toContain('/home/user/projects/test-project');
    expect(mountArgs).toContain('/workspace/project');

    // Clean up
    emitOutputMarker(fakeProc, { status: 'success', result: 'ok' });
    await vi.advanceTimersByTimeAsync(10);
    fakeProc.emit('close', 0);
    await vi.advanceTimersByTimeAsync(10);
    await resultPromise;
  });
});
```

Note: This test may need adjustment based on the exact mock setup. The key assertion is that the spawn args include the project path mount.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/container-runner.test.ts --reporter verbose 2>&1 | tail -20`
Expected: FAIL — no project mount in spawn args

- [ ] **Step 3: Add project_path mount logic to `buildVolumeMounts`**

In `src/container-runner.ts`, in the `buildVolumeMounts` function, add after the non-main group folder mount (after the `globalDir` block around line 188):

```typescript
    // Project-linked groups get their project directory mounted read-write
    if (group.projectPath) {
      mounts.push({
        hostPath: group.projectPath,
        containerPath: '/workspace/project',
        readonly: false,
      });
    }
```

This goes inside the `else` block (non-main groups), after the global memory mount.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/container-runner.test.ts --reporter verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `npx vitest run --reporter verbose 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/container-runner.ts src/container-runner.test.ts
git commit -m "feat: mount project_path at /workspace/project for project groups"
```

---

### Task 4: Add `create_project_channel` IPC action handler

**Files:**
- Modify: `src/ipc.ts:12-26` (IpcDeps interface), `src/ipc.ts:157-178` (processTaskIpc data type), `src/ipc.ts:428-464` (add new case)
- Test: `src/ipc-auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/ipc-auth.test.ts`:

```typescript
// --- create_project_channel authorization and behavior ---

describe('create_project_channel', () => {
  it('non-main group cannot create project channels', async () => {
    const createChannel = vi.fn();
    const depsWithCreate = {
      ...deps,
      createProjectChannel: createChannel,
    };

    await processTaskIpc(
      {
        type: 'create_project_channel',
        projectName: 'test-project',
        projectPath: '/home/user/projects/test-project',
        channelName: 'project-test-project',
        requestedBy: 'dc:123',
      },
      'other-group',
      false,
      depsWithCreate,
    );

    expect(createChannel).not.toHaveBeenCalled();
  });

  it('main group can create project channel', async () => {
    const createChannel = vi.fn().mockResolvedValue({
      success: true,
      channelId: 'dc:999',
      channelName: 'project-test-project',
      folder: 'project_test-project',
    });
    const depsWithCreate = {
      ...deps,
      createProjectChannel: createChannel,
    };

    await processTaskIpc(
      {
        type: 'create_project_channel',
        projectName: 'test-project',
        projectPath: '/home/user/projects/test-project',
        channelName: 'project-test-project',
        requestedBy: 'dc:123',
      },
      'whatsapp_main',
      true,
      depsWithCreate,
    );

    expect(createChannel).toHaveBeenCalledWith({
      projectName: 'test-project',
      projectPath: '/home/user/projects/test-project',
      channelName: 'project-test-project',
      requestedBy: 'dc:123',
    });
  });

  it('rejects create_project_channel with missing fields', async () => {
    const createChannel = vi.fn();
    const depsWithCreate = {
      ...deps,
      createProjectChannel: createChannel,
    };

    await processTaskIpc(
      {
        type: 'create_project_channel',
        projectName: 'test-project',
        // missing projectPath, channelName, requestedBy
      },
      'whatsapp_main',
      true,
      depsWithCreate,
    );

    expect(createChannel).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ipc-auth.test.ts --reporter verbose 2>&1 | tail -20`
Expected: FAIL — `create_project_channel` not handled, `createProjectChannel` not on IpcDeps

- [ ] **Step 3: Add `createProjectChannel` to `IpcDeps`**

In `src/ipc.ts`, add to the `IpcDeps` interface:

```typescript
export interface CreateProjectChannelRequest {
  projectName: string;
  projectPath: string;
  channelName: string;
  requestedBy: string;
}

export interface CreateProjectChannelResult {
  success: boolean;
  channelId?: string;
  channelName?: string;
  folder?: string;
  error?: string;
}
```

Add to `IpcDeps`:

```typescript
  createProjectChannel?: (
    req: CreateProjectChannelRequest,
  ) => Promise<CreateProjectChannelResult>;
```

- [ ] **Step 4: Add fields to `processTaskIpc` data type**

In the `data` parameter type of `processTaskIpc`, add:

```typescript
    // For create_project_channel
    projectName?: string;
    projectPath?: string;
    channelName?: string;
    requestedBy?: string;
```

- [ ] **Step 5: Add `create_project_channel` case to the switch**

In `processTaskIpc`, add before the `default` case:

```typescript
    case 'create_project_channel':
      // Only main group can create project channels
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized create_project_channel attempt blocked',
        );
        break;
      }
      if (
        data.projectName &&
        data.projectPath &&
        data.channelName &&
        data.requestedBy &&
        deps.createProjectChannel
      ) {
        const result = await deps.createProjectChannel({
          projectName: data.projectName,
          projectPath: data.projectPath,
          channelName: data.channelName,
          requestedBy: data.requestedBy,
        });

        // Write result back to IPC for the agent to read
        const ipcBaseDir = path.join(DATA_DIR, 'ipc');
        const responseDir = path.join(ipcBaseDir, sourceGroup, 'input');
        fs.mkdirSync(responseDir, { recursive: true });
        const responseFile = path.join(
          responseDir,
          `create_project_channel_result_${Date.now()}.json`,
        );
        fs.writeFileSync(
          responseFile,
          JSON.stringify(
            { action: 'create_project_channel_result', ...result },
            null,
            2,
          ),
        );
        logger.info(
          { sourceGroup, result },
          'Project channel creation result written',
        );
      } else {
        logger.warn(
          { data },
          'Invalid create_project_channel request - missing required fields',
        );
      }
      break;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/ipc-auth.test.ts --reporter verbose 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/ipc.ts src/ipc-auth.test.ts
git commit -m "feat: add create_project_channel IPC action handler"
```

---

### Task 5: Implement host-side `createProjectChannel` function

**Files:**
- Modify: `src/index.ts` (implement and wire up `createProjectChannel`)
- Modify: `src/channels/discord.ts` (add `createChannel` method)

- [ ] **Step 1: Add `createChannel` method to `DiscordChannel`**

In `src/channels/discord.ts`, add a new public method after `setTyping`:

```typescript
  /**
   * Create a new text channel in the first guild the bot is in.
   */
  async createChannel(name: string): Promise<{ id: string; name: string }> {
    if (!this.client) {
      throw new Error('Discord client not initialized');
    }
    const guild = this.client.guilds.cache.first();
    if (!guild) {
      throw new Error('Bot is not in any guild');
    }
    const channel = await guild.channels.create({
      name,
      type: 0, // GuildText
    });
    return { id: channel.id, name: channel.name };
  }
```

- [ ] **Step 2: Add `createChannel` to `Channel` interface**

In `src/types.ts`, add to the `Channel` interface:

```typescript
  // Optional: create a new channel on the platform
  createChannel?(name: string): Promise<{ id: string; name: string }>;
```

- [ ] **Step 3: Implement `createProjectChannel` in `src/index.ts`**

Add the following function in `src/index.ts`, near the `registerGroup` function:

```typescript
import {
  CreateProjectChannelRequest,
  CreateProjectChannelResult,
} from './ipc.js';

async function createProjectChannel(
  req: CreateProjectChannelRequest,
): Promise<CreateProjectChannelResult> {
  // Validate project path exists
  if (!fs.existsSync(req.projectPath)) {
    return {
      success: false,
      error: `Project path does not exist: ${req.projectPath}`,
    };
  }

  // Find Discord channel to create through
  const discordChannel = channels.find((ch) => ch.name === 'discord');
  if (!discordChannel || !discordChannel.createChannel) {
    return {
      success: false,
      error: 'Discord channel not available',
    };
  }

  try {
    // Create the Discord channel
    const created = await discordChannel.createChannel(req.channelName);
    const jid = `dc:${created.id}`;
    const folder = `project_${req.projectName.replace(/[^a-zA-Z0-9-]/g, '_')}`;

    // Create group folder and seed CLAUDE.md if absent
    const groupDir = path.join(GROUPS_DIR, folder);
    fs.mkdirSync(groupDir, { recursive: true });
    const claudeMdPath = path.join(groupDir, 'CLAUDE.md');
    if (!fs.existsSync(claudeMdPath)) {
      fs.writeFileSync(
        claudeMdPath,
        `# Project: ${req.projectName}\n\nProject directory mounted at /workspace/project.\n`,
      );
    }

    // Register the group
    registerGroup(jid, {
      name: `Shoggoth #${created.name}`,
      folder,
      trigger: `@${ASSISTANT_NAME}`,
      added_at: new Date().toISOString(),
      requiresTrigger: true,
      projectPath: req.projectPath,
    });

    return {
      success: true,
      channelId: jid,
      channelName: created.name,
      folder,
    };
  } catch (err) {
    logger.error({ err, req }, 'Failed to create project channel');
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Wire `createProjectChannel` into IPC deps**

In `src/index.ts`, in the `startIpcWatcher` call (around line 621), add:

```typescript
    createProjectChannel,
```

to the deps object.

- [ ] **Step 5: Build to verify compilation**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds with no type errors

- [ ] **Step 6: Commit**

```bash
git add src/channels/discord.ts src/types.ts src/index.ts
git commit -m "feat: implement createProjectChannel host-side handler"
```

---

### Task 6: Update main group `CLAUDE.md` with project channel instructions

**Files:**
- Modify: `groups/main/CLAUDE.md`

- [ ] **Step 1: Add project channel creation instructions**

Append to `groups/main/CLAUDE.md`, before the `## Global Memory` section:

```markdown
## Creating Project Channels

Users can ask you to create a Discord channel linked to a project in `~/projects/`.

### Flow

1. **List projects**: Read the contents of `/home/square/projects/` and check `available_groups.json` for existing project links. Present the list showing which projects already have channels.

2. **Confirm**: State the channel name (`#project-<folder-name>`) and project path, then ask for confirmation.

3. **Create via IPC**: Write the action file:

```bash
cat > /workspace/ipc/tasks/create_project_channel_$(date +%s).json << 'IPCEOF'
{
  "type": "create_project_channel",
  "projectName": "<folder-name>",
  "projectPath": "/home/square/projects/<folder-name>",
  "channelName": "project-<folder-name>",
  "requestedBy": "<chat-jid-of-requesting-channel>"
}
IPCEOF
```

4. **Read result**: Wait a few seconds, then check `/workspace/ipc/input/` for a file matching `create_project_channel_result_*.json`. Report the result.

### Example

```
User: @Andy create a channel for discontinuous-machines

You: Here are your projects:
  • **discontinuous-machines** — no channel
  • **platform-abm** — no channel

I'll create **#project-discontinuous-machines** linked to `~/projects/discontinuous-machines`. Go ahead?

User: Yes

You: [write IPC file, wait, read result]
Done — **#project-discontinuous-machines** is live and linked to your project.
```

### Channel Naming

All project channels use the `project-` prefix: `#project-<folder-name>`.

### Checking Existing Links

`available_groups.json` includes a `projectPath` field for groups that are linked to projects. Use this to show which projects already have channels.
```

- [ ] **Step 2: Commit**

```bash
git add groups/main/CLAUDE.md
git commit -m "docs: add project channel creation instructions to main group"
```

---

### Task 7: Build, restart, and verify end-to-end

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter verbose 2>&1 | tail -40`
Expected: All tests PASS

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Restart nanoclaw service**

Run: `systemctl --user restart nanoclaw && sleep 3 && systemctl --user status nanoclaw | head -15`
Expected: Service active and running, Discord bot connected

- [ ] **Step 4: Commit final state if any adjustments were made**

```bash
git add -A
git commit -m "chore: build and verify discord project channels"
```
