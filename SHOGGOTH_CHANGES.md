# NanoClaw Changes for RP Service Integration

These changes wire NanoClaw's message routing to the Research Partner service.
Apply in the NanoClaw repo (`~/shoggoth/`), in a separate session.

---

## Change 1: Extend `RegisteredGroup` type

**File:** `src/types.ts`

In the `RegisteredGroup` interface, add an optional `dispatch` field:

```typescript
dispatch?: "container" | "rp_service";  // default: "container"
```

Groups without this field (or with `"container"`) behave exactly as before.

---

## Change 2: Routing branch in `processGroupMessages()`

**File:** `src/index.ts`

In `processGroupMessages()`, after `getMessagesSince()` returns `missedMessages`
and **before** `formatMessages()` is called (~line 311), add:

```typescript
if (group.dispatch === "rp_service") {
  const latest = missedMessages[missedMessages.length - 1];
  if (!latest) return;

  const rpUrl = process.env.RP_SERVICE_URL || "http://localhost:8300";
  try {
    const res = await fetch(`${rpUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: latest.content,
        sender: latest.sender_name,
        channel: chatJid,
      }),
    });
    if (res.ok) {
      const { response } = await res.json();
      if (response) channel.sendMessage(chatJid, response);
    } else {
      const errBody = await res.text();
      log.error(`RP service error: ${res.status} ${errBody}`);
      channel.sendMessage(chatJid, "Research Partner is currently unavailable.");
    }
  } catch (err) {
    log.error(`RP service unreachable: ${err.message}`);
    channel.sendMessage(chatJid, "Research Partner service is not running.");
  }
  return;
}
```

**Why this location:**
- Before `formatMessages()`: the RP should receive raw user text, not XML
  container-agent formatting.
- Only the latest message: Letta maintains its own conversation history.
  Sending the full `missedMessages` window would duplicate context.
- Cursor advancement already happens before this point, so messages
  won't be reprocessed.

---

## Change 3: Register `#research-partner` channel

Register the Discord `#research-partner` channel with `dispatch: "rp_service"`
in the group config. The exact mechanism depends on how the channel is
registered (config file or `registerGroup()` call). Example:

```typescript
registerGroup({
  jid: "dc:<research-partner-channel-id>",
  folder: "research-partner",
  dispatch: "rp_service",
  // ... other config
});
```
