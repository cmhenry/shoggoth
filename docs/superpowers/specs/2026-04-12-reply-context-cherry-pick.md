# Reply/Quoted Message Context Cherry-Pick (upstream ee599b9)

## Summary

Cherry-pick upstream commit `ee599b9` which adds reply/quoted message context support. Adds fields to NewMessage, DB migrations, query updates, and XML rendering in formatMessages.

## Upstream Changes

**`src/types.ts`:** Add to `NewMessage` interface: `thread_id?`, `reply_to_message_id?`, `reply_to_message_content?`, `reply_to_sender_name?`.

**`src/db.ts`:** Add `reply_to_*` column migrations on `messages` table. Update `storeMessage` to persist reply fields. Update `getNewMessages` and `getMessagesSince` SELECT queries to include reply fields.

**`src/router.ts`:** Render reply context as `<quoted_message>` XML inside `<message>` elements when reply fields are present.

**`src/db.test.ts` + `src/formatting.test.ts`:** Tests for DB persistence and formatting of reply context.

## Shoggoth-Specific Considerations

No downstream fixes needed. Shoggoth's modifications to `db.ts` are in `scheduled_tasks`/`registered_groups` tables and functions. Upstream changes target the `messages` table and message query functions — completely separate code regions.

## Future Work

Discord and WhatsApp channel implementations don't populate reply fields yet. Channels should be updated to pass `reply_to_*` metadata when available.

## Verification

1. `npm run build` — no type errors
2. `npm test` — all tests pass
