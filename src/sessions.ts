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
