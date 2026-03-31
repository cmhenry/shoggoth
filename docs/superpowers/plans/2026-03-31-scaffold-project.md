# scaffold_project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `scaffold_project` IPC action that creates GitHub repos, clones them, and creates Discord channels — all from a container request — while preserving the container security model.

**Architecture:** New `scaffoldProject()` function in `src/index.ts` handles host-side operations (gh, git clone, Discord channel creation). New `scaffold_project` case in `src/ipc.ts` routes IPC requests to it. Input validation (name regex, path confinement, hardcoded owner) is the security boundary. The `idea-triage` container skill is updated to use IPC instead of aspirational direct `gh` calls.

**Tech Stack:** TypeScript, Node.js `child_process.execFileSync`, vitest, existing IPC infrastructure

**Spec:** `docs/superpowers/specs/2026-03-31-scaffold-project-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/config.ts` | Add `PROJECTS_ROOT` and `GITHUB_OWNER` constants |
| `src/scaffold-project.ts` | **New.** `validateProjectName()`, `scaffoldProject()` function + types |
| `src/scaffold-project.test.ts` | **New.** Unit tests for validation and scaffold logic |
| `src/ipc.ts` | Add `ScaffoldProjectRequest/Result` interfaces, `scaffold_project` case, wire `scaffoldProject` into `IpcDeps` |
| `src/ipc-auth.test.ts` | Add authorization tests for `scaffold_project` |
| `src/index.ts` | Import and wire `scaffoldProject` into IPC deps |
| `container/skills/idea-triage/SKILL.md` | Replace `gh` calls with IPC-based scaffold sequence |

---

### Task 1: Add config constants

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Add PROJECTS_ROOT and GITHUB_OWNER to config.ts**

In `src/config.ts`, after the `HOME_DIR` line (line 19), add:

```typescript
export const PROJECTS_ROOT = path.join(HOME_DIR, 'projects');
export const GITHUB_OWNER = 'cmhenry';
```

- [ ] **Step 2: Verify build**

Run: `cd /home/square/shoggoth && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: add PROJECTS_ROOT and GITHUB_OWNER config constants"
```

---

### Task 2: Create scaffold-project module with validation

**Files:**
- Create: `src/scaffold-project.ts`
- Create: `src/scaffold-project.test.ts`

- [ ] **Step 1: Write validation tests**

Create `src/scaffold-project.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import { validateProjectName } from './scaffold-project.js';

describe('validateProjectName', () => {
  it('accepts valid lowercase-hyphenated names', () => {
    expect(validateProjectName('gravity-misinfo')).toBeNull();
    expect(validateProjectName('my-project')).toBeNull();
    expect(validateProjectName('a')).toBeNull();
    expect(validateProjectName('project123')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(validateProjectName('')).toMatch(/must match/i);
  });

  it('rejects names with uppercase', () => {
    expect(validateProjectName('MyProject')).toMatch(/must match/i);
  });

  it('rejects names with path separators', () => {
    expect(validateProjectName('foo/bar')).toMatch(/must match/i);
    expect(validateProjectName('../etc')).toMatch(/must match/i);
  });

  it('rejects names with dots', () => {
    expect(validateProjectName('my.project')).toMatch(/must match/i);
  });

  it('rejects names with spaces', () => {
    expect(validateProjectName('my project')).toMatch(/must match/i);
  });

  it('rejects names starting with hyphen', () => {
    expect(validateProjectName('-bad')).toMatch(/must match/i);
  });

  it('rejects names longer than 63 characters', () => {
    expect(validateProjectName('a'.repeat(64))).toMatch(/must match/i);
  });

  it('accepts names exactly 63 characters', () => {
    expect(validateProjectName('a'.repeat(63))).toBeNull();
  });

  it('rejects reserved names', () => {
    expect(validateProjectName('main')).toMatch(/reserved/i);
    expect(validateProjectName('global')).toMatch(/reserved/i);
    expect(validateProjectName('test')).toMatch(/reserved/i);
    expect(validateProjectName('node-modules')).toMatch(/reserved/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/square/shoggoth && npx vitest run src/scaffold-project.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the validation function and types**

Create `src/scaffold-project.ts`:

```typescript
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { GITHUB_OWNER, PROJECTS_ROOT } from './config.js';
import { logger } from './logger.js';

export interface ScaffoldProjectRequest {
  projectName: string;
  requestedBy: string;
  templateRepo?: string;
  skipGithub?: boolean;
  skipDiscord?: boolean;
}

export interface ScaffoldProjectResult {
  success: boolean;
  error?: string;
  github?: {
    repoUrl: string;
    clonedTo: string;
    alreadyExisted: boolean;
  };
  discord?: {
    channelId: string;
    channelName: string;
    folder: string;
    alreadyExisted: boolean;
  };
}

const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const RESERVED_NAMES = new Set([
  'main',
  'global',
  'test',
  'node-modules',
  'dist',
  'src',
  'node',
]);

/**
 * Validate a project name. Returns null if valid, or an error message string.
 */
export function validateProjectName(name: string): string | null {
  if (!PROJECT_NAME_PATTERN.test(name)) {
    return `Project name must match ${PROJECT_NAME_PATTERN} (lowercase alphanumeric + hyphens, 1-63 chars, starts with alphanumeric)`;
  }
  if (RESERVED_NAMES.has(name)) {
    return `Project name "${name}" is reserved`;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/square/shoggoth && npx vitest run src/scaffold-project.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/scaffold-project.ts src/scaffold-project.test.ts
git commit -m "feat: add scaffold-project module with name validation"
```

---

### Task 3: Implement scaffoldProject function

**Files:**
- Modify: `src/scaffold-project.ts`
- Modify: `src/scaffold-project.test.ts`

- [ ] **Step 1: Write scaffoldProject tests**

Rewrite `src/scaffold-project.test.ts` as a complete file (supersedes Task 2's version — adds mocks needed for `scaffoldProject` tests while keeping validation tests):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

import { PROJECTS_ROOT, GITHUB_OWNER } from './config.js';

// Mock child_process.execFileSync
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

// Mock fs for existence checks in scaffoldProject
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
    },
    existsSync: vi.fn(),
  };
});

import { validateProjectName, scaffoldProject } from './scaffold-project.js';

// --- validateProjectName tests (unchanged from Task 2) ---

describe('validateProjectName', () => {
  it('accepts valid lowercase-hyphenated names', () => {
    expect(validateProjectName('gravity-misinfo')).toBeNull();
    expect(validateProjectName('my-project')).toBeNull();
    expect(validateProjectName('a')).toBeNull();
    expect(validateProjectName('project123')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(validateProjectName('')).toMatch(/must match/i);
  });

  it('rejects names with uppercase', () => {
    expect(validateProjectName('MyProject')).toMatch(/must match/i);
  });

  it('rejects names with path separators', () => {
    expect(validateProjectName('foo/bar')).toMatch(/must match/i);
    expect(validateProjectName('../etc')).toMatch(/must match/i);
  });

  it('rejects names with dots', () => {
    expect(validateProjectName('my.project')).toMatch(/must match/i);
  });

  it('rejects names with spaces', () => {
    expect(validateProjectName('my project')).toMatch(/must match/i);
  });

  it('rejects names starting with hyphen', () => {
    expect(validateProjectName('-bad')).toMatch(/must match/i);
  });

  it('rejects names longer than 63 characters', () => {
    expect(validateProjectName('a'.repeat(64))).toMatch(/must match/i);
  });

  it('accepts names exactly 63 characters', () => {
    expect(validateProjectName('a'.repeat(63))).toBeNull();
  });

  it('rejects reserved names', () => {
    expect(validateProjectName('main')).toMatch(/reserved/i);
    expect(validateProjectName('global')).toMatch(/reserved/i);
    expect(validateProjectName('test')).toMatch(/reserved/i);
    expect(validateProjectName('node-modules')).toMatch(/reserved/i);
  });
});

// --- scaffoldProject tests ---

describe('scaffoldProject', () => {
  const { execFileSync } = await import('child_process');
  const fs = await import('fs');
  const mockExecFileSync = vi.mocked(execFileSync);
  const mockExistsSync = vi.mocked(fs.existsSync);

  const mockCreateProjectChannel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('rejects invalid project name', async () => {
    const result = await scaffoldProject(
      { projectName: '../evil', requestedBy: 'dc:123' },
      mockCreateProjectChannel,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/must match/i);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('rejects reserved project name', async () => {
    const result = await scaffoldProject(
      { projectName: 'main', requestedBy: 'dc:123' },
      mockCreateProjectChannel,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/reserved/i);
  });

  it('creates repo and clones when nothing exists', async () => {
    mockExecFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'gh' && args?.[0] === 'repo' && args?.[1] === 'view') {
        throw new Error('not found');
      }
      return Buffer.from('');
    });

    const result = await scaffoldProject(
      { projectName: 'new-project', requestedBy: 'dc:123', skipDiscord: true },
      mockCreateProjectChannel,
    );

    expect(result.success).toBe(true);
    expect(result.github?.alreadyExisted).toBe(false);
    expect(result.github?.repoUrl).toBe(
      `https://github.com/${GITHUB_OWNER}/new-project`,
    );
    expect(result.github?.clonedTo).toBe(
      path.join(PROJECTS_ROOT, 'new-project'),
    );

    // Verify gh repo create was called with correct args
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      [
        'repo',
        'create',
        `${GITHUB_OWNER}/new-project`,
        '--private',
        '--template',
        `${GITHUB_OWNER}/research-project-template`,
      ],
      expect.any(Object),
    );
  });

  it('skips repo creation when repo already exists', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));
    // Folder exists and is a git repo
    mockExistsSync.mockImplementation((p) => {
      const s = String(p);
      return s.includes('new-project') || s.includes('.git');
    });

    const result = await scaffoldProject(
      { projectName: 'new-project', requestedBy: 'dc:123', skipDiscord: true },
      mockCreateProjectChannel,
    );

    expect(result.success).toBe(true);
    expect(result.github?.alreadyExisted).toBe(true);
  });

  it('skips github when skipGithub is true', async () => {
    mockCreateProjectChannel.mockResolvedValue({
      success: true,
      channelId: 'dc:999',
      channelName: 'new-project',
      folder: 'project_new-project',
    });
    // Simulate the project folder existing (since we skipped github, createProjectChannel needs it)
    mockExistsSync.mockReturnValue(true);

    const result = await scaffoldProject(
      { projectName: 'new-project', requestedBy: 'dc:123', skipGithub: true },
      mockCreateProjectChannel,
    );

    expect(result.success).toBe(true);
    expect(result.github).toBeUndefined();
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('uses custom template repo but forces correct owner', async () => {
    mockExecFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'gh' && args?.[0] === 'repo' && args?.[1] === 'view') {
        throw new Error('not found');
      }
      return Buffer.from('');
    });

    await scaffoldProject(
      {
        projectName: 'new-project',
        requestedBy: 'dc:123',
        templateRepo: 'evil-org/backdoor-template',
        skipDiscord: true,
      },
      mockCreateProjectChannel,
    );

    // Template owner should be forced to GITHUB_OWNER
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining([
        '--template',
        `${GITHUB_OWNER}/backdoor-template`,
      ]),
      expect.any(Object),
    );
  });

  it('reports partial success when discord fails', async () => {
    mockExecFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'gh' && args?.[0] === 'repo' && args?.[1] === 'view') {
        throw new Error('not found');
      }
      return Buffer.from('');
    });
    mockCreateProjectChannel.mockResolvedValue({
      success: false,
      error: 'Discord bot offline',
    });

    const result = await scaffoldProject(
      { projectName: 'new-project', requestedBy: 'dc:123' },
      mockCreateProjectChannel,
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Discord/);
    expect(result.github?.alreadyExisted).toBe(false);
  });

  it('fails if clone target exists but is not a git repo', async () => {
    mockExecFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'gh' && args?.[0] === 'repo' && args?.[1] === 'view') {
        throw new Error('not found');
      }
      return Buffer.from('');
    });
    // Folder exists but .git does not
    mockExistsSync.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith('.git')) return false;
      if (s.includes('new-project')) return true;
      return false;
    });

    const result = await scaffoldProject(
      { projectName: 'new-project', requestedBy: 'dc:123', skipDiscord: true },
      mockCreateProjectChannel,
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exists but is not a git repo/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/square/shoggoth && npx vitest run src/scaffold-project.test.ts`
Expected: Validation tests PASS, scaffoldProject tests FAIL — `scaffoldProject` not exported

- [ ] **Step 3: Implement scaffoldProject**

Add to `src/scaffold-project.ts` after the existing validation code:

```typescript
// Define the callback type inline to avoid circular imports with ipc.ts.
// This matches the shape of CreateProjectChannelRequest/Result from ipc.ts.
type CreateProjectChannelFn = (req: {
  projectName: string;
  projectPath: string;
  channelName: string;
  requestedBy: string;
}) => Promise<{
  success: boolean;
  channelId?: string;
  channelName?: string;
  folder?: string;
  error?: string;
}>;

/**
 * Sanitize a template repo string: extract repo name, force GITHUB_OWNER prefix.
 */
function sanitizeTemplateRepo(template: string): string {
  // Strip owner if present (e.g., "evil-org/my-template" → "my-template")
  const repoName = template.includes('/') ? template.split('/').pop()! : template;
  return `${GITHUB_OWNER}/${repoName}`;
}

/**
 * Check if a GitHub repo exists. Returns true if it does.
 */
function repoExists(fullName: string): boolean {
  try {
    execFileSync('gh', ['repo', 'view', fullName, '--json', 'name'], {
      stdio: 'pipe',
      timeout: 30000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Full project scaffolding: validate, create GitHub repo, clone, create Discord channel.
 */
export async function scaffoldProject(
  req: ScaffoldProjectRequest,
  createProjectChannel?: CreateProjectChannelFn,
  existingProjectPaths?: Set<string>,
): Promise<ScaffoldProjectResult> {
  // 1. Validate project name
  const nameError = validateProjectName(req.projectName);
  if (nameError) {
    return { success: false, error: nameError };
  }

  // 2. Verify target path is confined to PROJECTS_ROOT
  const targetPath = path.join(PROJECTS_ROOT, req.projectName);
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(PROJECTS_ROOT);
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    return {
      success: false,
      error: `Path confinement violation: ${resolvedTarget} is not under ${resolvedRoot}`,
    };
  }

  const result: ScaffoldProjectResult = { success: true };
  const repoFullName = `${GITHUB_OWNER}/${req.projectName}`;
  const repoUrl = `https://github.com/${repoFullName}`;

  // 3. GitHub repo + clone
  if (!req.skipGithub) {
    try {
      const repoAlreadyExists = repoExists(repoFullName);
      const folderExists = fs.existsSync(targetPath);
      const isGitRepo =
        folderExists && fs.existsSync(path.join(targetPath, '.git'));

      if (folderExists && !isGitRepo) {
        return {
          success: false,
          error: `Directory ${targetPath} exists but is not a git repo — will not overwrite (may contain user content)`,
        };
      }

      if (!repoAlreadyExists) {
        const template = sanitizeTemplateRepo(
          req.templateRepo || `${GITHUB_OWNER}/research-project-template`,
        );
        execFileSync(
          'gh',
          [
            'repo',
            'create',
            repoFullName,
            '--private',
            '--template',
            template,
          ],
          { stdio: 'pipe', timeout: 30000 },
        );
        logger.info({ repoFullName, template }, 'GitHub repo created');
      }

      if (!isGitRepo) {
        execFileSync('git', ['clone', repoUrl, targetPath], {
          stdio: 'pipe',
          timeout: 60000,
        });
        logger.info({ repoUrl, targetPath }, 'Repo cloned');
      }

      result.github = {
        repoUrl,
        clonedTo: targetPath,
        alreadyExisted: repoAlreadyExists && isGitRepo,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, repoFullName }, 'GitHub scaffold step failed');
      return {
        success: false,
        error: `GitHub step failed: ${msg}`,
        github: result.github,
      };
    }
  }

  // 4. Discord channel + Shoggoth registration
  if (!req.skipDiscord) {
    // Check if a channel already exists for this project path
    if (existingProjectPaths?.has(resolvedTarget)) {
      result.discord = {
        channelId: '',
        channelName: req.projectName,
        folder: `project_${req.projectName}`,
        alreadyExisted: true,
      };
    } else {
      if (!createProjectChannel) {
        return {
          ...result,
          success: false,
          error: 'Discord channel creation not available (createProjectChannel not provided)',
        };
      }

      const channelResult = await createProjectChannel({
        projectName: req.projectName,
        projectPath: targetPath,
        channelName: req.projectName,
        requestedBy: req.requestedBy,
      });

      if (channelResult.success) {
        result.discord = {
          channelId: channelResult.channelId!,
          channelName: channelResult.channelName!,
          folder: channelResult.folder!,
          alreadyExisted: false,
        };
      } else {
        return {
          ...result,
          success: false,
          error: `Discord step failed: ${channelResult.error}`,
        };
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/square/shoggoth && npx vitest run src/scaffold-project.test.ts`
Expected: All PASS

- [ ] **Step 5: Verify full build**

Run: `cd /home/square/shoggoth && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/scaffold-project.ts src/scaffold-project.test.ts
git commit -m "feat: implement scaffoldProject with GitHub, clone, and Discord steps"
```

---

### Task 4: Wire scaffold_project into IPC

**Files:**
- Modify: `src/ipc.ts`
- Modify: `src/ipc-auth.test.ts`

- [ ] **Step 1: Write IPC authorization tests**

Append to `src/ipc-auth.test.ts`:

```typescript
// --- scaffold_project authorization ---

describe('scaffold_project authorization', () => {
  it('non-main group cannot scaffold projects', async () => {
    const scaffoldFn = vi.fn();
    const depsWithScaffold = {
      ...deps,
      scaffoldProject: scaffoldFn,
    };

    await processTaskIpc(
      {
        type: 'scaffold_project',
        projectName: 'test-project',
        requestedBy: 'dc:123',
      },
      'other-group',
      false,
      depsWithScaffold,
    );

    expect(scaffoldFn).not.toHaveBeenCalled();
  });

  it('main group can scaffold a project', async () => {
    const scaffoldFn = vi.fn().mockResolvedValue({
      success: true,
      github: {
        repoUrl: 'https://github.com/cmhenry/test-project',
        clonedTo: '/home/square/projects/test-project',
        alreadyExisted: false,
      },
      discord: {
        channelId: 'dc:999',
        channelName: 'test-project',
        folder: 'project_test-project',
        alreadyExisted: false,
      },
    });
    const depsWithScaffold = {
      ...deps,
      scaffoldProject: scaffoldFn,
    };

    await processTaskIpc(
      {
        type: 'scaffold_project',
        projectName: 'test-project',
        requestedBy: 'dc:123',
      },
      'whatsapp_main',
      true,
      depsWithScaffold,
    );

    expect(scaffoldFn).toHaveBeenCalledWith({
      projectName: 'test-project',
      requestedBy: 'dc:123',
      templateRepo: undefined,
      skipGithub: undefined,
      skipDiscord: undefined,
    });
  });

  it('rejects scaffold_project with missing projectName', async () => {
    const scaffoldFn = vi.fn();
    const depsWithScaffold = {
      ...deps,
      scaffoldProject: scaffoldFn,
    };

    await processTaskIpc(
      {
        type: 'scaffold_project',
        requestedBy: 'dc:123',
      },
      'whatsapp_main',
      true,
      depsWithScaffold,
    );

    expect(scaffoldFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/square/shoggoth && npx vitest run src/ipc-auth.test.ts`
Expected: FAIL — `scaffoldProject` not in deps type

- [ ] **Step 3: Add scaffold_project to IPC**

In `src/ipc.ts`, add to the `IpcDeps` interface after `createProjectChannel`:

```typescript
  scaffoldProject?: (
    req: import('./scaffold-project.js').ScaffoldProjectRequest,
  ) => Promise<import('./scaffold-project.js').ScaffoldProjectResult>;
```

In `processTaskIpc()`, add a new case before `default:`:

```typescript
    case 'scaffold_project':
      // Only main group can scaffold projects
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized scaffold_project attempt blocked',
        );
        break;
      }
      if (data.projectName && data.requestedBy && deps.scaffoldProject) {
        const result = await deps.scaffoldProject({
          projectName: data.projectName,
          requestedBy: data.requestedBy,
          templateRepo: data.templateRepo,
          skipGithub: data.skipGithub,
          skipDiscord: data.skipDiscord,
        });

        // Write result back to IPC for the agent to read
        const ipcBaseDir = path.join(DATA_DIR, 'ipc');
        const responseDir = path.join(ipcBaseDir, sourceGroup, 'input');
        fs.mkdirSync(responseDir, { recursive: true });
        const responseFile = path.join(
          responseDir,
          `scaffold_project_result_${Date.now()}.json`,
        );
        fs.writeFileSync(
          responseFile,
          JSON.stringify(
            { action: 'scaffold_project_result', ...result },
            null,
            2,
          ),
        );
        logger.info(
          { sourceGroup, result },
          'Project scaffold result written',
        );
      } else {
        logger.warn(
          { data },
          'Invalid scaffold_project request - missing required fields',
        );
      }
      break;
```

- [ ] **Step 4: Run IPC auth tests**

Run: `cd /home/square/shoggoth && npx vitest run src/ipc-auth.test.ts`
Expected: All PASS

- [ ] **Step 5: Verify full build**

Run: `cd /home/square/shoggoth && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/ipc.ts src/ipc-auth.test.ts
git commit -m "feat: wire scaffold_project IPC action with authorization"
```

---

### Task 5: Wire scaffoldProject into index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import and wire scaffoldProject**

In `src/index.ts`, add the import near the top (alongside other imports):

```typescript
import { scaffoldProject } from './scaffold-project.js';
```

In the `startIpcWatcher()` call (around line 758), add `scaffoldProject` to the deps object. Find the line:

```typescript
    createProjectChannel,
```

And add after it:

```typescript
    scaffoldProject: (req) => {
      const existingPaths = new Set(
        Object.values(registeredGroups)
          .filter((g) => g.projectPath)
          .map((g) => path.resolve(g.projectPath!)),
      );
      return scaffoldProject(req, createProjectChannel, existingPaths);
    },
```

This passes the existing `createProjectChannel` function and a set of already-registered project paths for idempotency.

- [ ] **Step 2: Verify full build**

Run: `cd /home/square/shoggoth && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all tests**

Run: `cd /home/square/shoggoth && npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire scaffoldProject into IPC deps in index.ts"
```

---

### Task 6: Update idea-triage container skill

**Files:**
- Modify: `container/skills/idea-triage/SKILL.md`

- [ ] **Step 1: Replace the upgrade path in idea-triage**

Replace the entire `## Upgrade path` section in `container/skills/idea-triage/SKILL.md` with:

```markdown
## Upgrade path

1. **Read the idea note** — `mcp__mcpvault__read_note` on `ideas/YYYY-MM-DD-slug.md` to get the exploration findings for seeding the project.

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

   The slug for the project folder drops the date prefix from the idea slug (e.g., `ideas/2026-03-25-adversarial-deliberation.md` becomes `projects/adversarial-deliberation/`).

3. **Move idea note as ORIGIN.md** — `mcp__mcpvault__move_note` from `ideas/YYYY-MM-DD-slug.md` to `projects/{slug}/ORIGIN.md`

4. **Update frontmatter** — `mcp__mcpvault__update_frontmatter` on ORIGIN.md: `status: upgraded`

5. **Generate writing rubric** — `mcp__mcpvault__write_note` to `projects/{slug}/{slug}-writing-rubric.md`:

   ```markdown
   # Writing Rubric: {Project Title}

   Project-specific evaluation criteria. Supplements `_meta/writing-rubric.md`
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

6. **Update registry** — `mcp__mcpvault__patch_note` on `projects/_registry.md` to append a row to the Active Projects table:

   ```
   | [{slug}]({slug}/PROJECT.md) | research | medium | {date} | New project; [one-line status from PROJECT.md] |
   ```

   Insert the row at the end of the Active Projects table (before any section break or `## Project Clusters`).

7. **Remove from scratch** — `mcp__mcpvault__patch_note` on `ideas/scratch.md` to remove the line containing the idea's backlink.

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
```

- [ ] **Step 2: Verify the skill file is valid markdown**

Read back the file and confirm it parses correctly, all sections are present, and the IPC JSON uses the correct `scaffold_project` type.

- [ ] **Step 3: Commit**

```bash
git add container/skills/idea-triage/SKILL.md
git commit -m "feat: update idea-triage skill to use scaffold_project IPC"
```

---

### Task 7: Integration test — manual end-to-end verification

**Files:** None (manual testing)

- [ ] **Step 1: Build the project**

Run: `cd /home/square/shoggoth && npm run build`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `cd /home/square/shoggoth && npx vitest run`
Expected: All PASS

- [ ] **Step 3: Restart nanoclaw**

Run: `systemctl --user restart nanoclaw`

- [ ] **Step 4: Verify service is healthy**

Run: `sleep 3 && systemctl --user status nanoclaw | head -10`
Expected: `active (running)`

- [ ] **Step 5: Test scaffold_project via IPC**

Write a test IPC task (using a project that already exists to verify idempotency):

```bash
mkdir -p /home/square/shoggoth/data/ipc/discord_general/tasks
cat > /home/square/shoggoth/data/ipc/discord_general/tasks/test_scaffold_$(date +%s).json << 'EOF'
{
  "type": "scaffold_project",
  "projectName": "gravity-misinfo",
  "requestedBy": "dc:1486810983824490620"
}
EOF
```

Wait 5 seconds, then check:

```bash
sleep 5 && ls -t /home/square/shoggoth/data/ipc/discord_general/input/scaffold_project_result_*.json 2>/dev/null | head -1 | xargs cat
```

Expected: Success with `alreadyExisted: true` for both github and discord (since gravity-misinfo's repo, folder, and Discord channel were all set up earlier today).

- [ ] **Step 6: Verify logs show no errors**

Run: `journalctl --user -u nanoclaw --since "2 minutes ago" --no-pager | grep -i scaffold`
Expected: Log entries showing successful scaffold processing

- [ ] **Step 7: Commit any fixes if needed**

If the integration test revealed issues, fix them and commit.
