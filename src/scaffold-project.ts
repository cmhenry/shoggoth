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
