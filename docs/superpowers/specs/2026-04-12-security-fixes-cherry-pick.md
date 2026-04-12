# Security Fixes Cherry-Pick (upstream a4fd4f2)

## Summary

Cherry-pick upstream commit `a4fd4f2` which fixes command injection in `stopContainer` and mount path injection in `mount-security.ts`. One downstream caller in `container-runner.ts` needs manual adaptation.

## Upstream Changes

**`src/container-runtime.ts`:**
- `stopContainer` validates container name against `^[a-zA-Z0-9][a-zA-Z0-9_.-]*$` before executing
- Changes from returning a shell command string to executing the command internally (return type `string` → `void`)
- `cleanupOrphans` caller updated to call `stopContainer(name)` directly instead of wrapping in `execSync`

**`src/mount-security.ts`:**
- Rejects container paths containing `:` to prevent Docker `-v` option injection
- Fixes allowlist caching: "file not found" is no longer permanently cached, only parse/structural errors are

**`src/container-runtime.test.ts`:**
- Updates tests for new `stopContainer` behavior (void return, validation)

## Shoggoth-Specific Fix

**`src/container-runner.ts:562`** calls `exec(stopContainer(containerName), ...)` expecting a string return. After cherry-pick, `stopContainer` is void and runs the command itself.

Fix: replace the async `exec()` wrapper with a direct `stopContainer()` call in a try/catch, falling back to `container.kill('SIGKILL')` on failure. The timeout kill path becomes synchronous, which is acceptable — it's already a last-resort cleanup path.

```typescript
// Before:
exec(stopContainer(containerName), { timeout: 15000 }, (err) => {
  if (err) {
    container.kill('SIGKILL');
  }
});

// After:
try {
  stopContainer(containerName);
} catch {
  logger.warn({ group: group.name, containerName }, 'Graceful stop failed, force killing');
  container.kill('SIGKILL');
}
```

## Verification

1. `npm run build` — no type errors
2. Run existing tests
3. Confirm `mount-security.ts` changes applied cleanly (file was unmodified in Shoggoth)
