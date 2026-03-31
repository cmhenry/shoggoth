import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

import { PROJECTS_ROOT, GITHUB_OWNER } from './config.js';

const { mockExistsSyncFn } = vi.hoisted(() => ({
  mockExistsSyncFn: vi.fn(),
}));

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
      existsSync: mockExistsSyncFn,
    },
    existsSync: mockExistsSyncFn,
  };
});

import { execFileSync } from 'child_process';
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
  const mockExecFileSync = vi.mocked(execFileSync);
  const mockExistsSync = mockExistsSyncFn;

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
