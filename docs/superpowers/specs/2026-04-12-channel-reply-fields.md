# Channel Reply Fields

## Summary

Populate the `reply_to_*` fields on `NewMessage` in Discord and WhatsApp channels so agents see structured reply context instead of baked-in text prefixes.

## Discord (`src/channels/discord.ts`)

Currently fetches the replied-to message (lines 119-132) and prepends `[Reply to Name]` to content. Change to:

1. Keep the `message.reference?.messageId` fetch logic
2. Instead of prepending to content, set `reply_to_message_id`, `reply_to_message_content` (truncated to ~200 chars), and `reply_to_sender_name` on the NewMessage object
3. Remove the `[Reply to ...]` content prefix

## WhatsApp (`src/channels/whatsapp.ts`)

The Baileys `extendedTextMessage` includes `contextInfo` on replies:
- `contextInfo.stanzaId` — original message ID
- `contextInfo.quotedMessage` — the quoted message content (conversation or extendedTextMessage.text)
- `contextInfo.participant` — sender JID of the quoted message

Extract these after content extraction and populate the `reply_to_*` fields. For `reply_to_sender_name`, use participant JID prefix (number before `@`) as fallback — pushName isn't available on contextInfo.

## Testing

- Discord: test that a message with `reference.messageId` produces `reply_to_*` fields in onMessage callback
- WhatsApp: test that a message with `contextInfo` produces `reply_to_*` fields in onMessage callback

## Out of scope

- Rendering — already handled by upstream cherry-pick of `formatMessages`
- `thread_id` field — not persisted to DB, leave unpopulated for now
