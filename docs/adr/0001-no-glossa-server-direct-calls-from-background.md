# No Glossa server: the background worker calls the translation service directly

Glossa has no backend. The user brings their own API Key, which is stored in `chrome.storage.local` (never `storage.sync`), and only the extension's background service worker uses it to call the translation service. Content scripts receive the streamed Translation over a message port and never see the key, so it cannot leak into a web page's context. We chose this over a proxy server because a proxy would need hosting, accounts and billing, and every Selection would pass through infrastructure we operate. That contradicts the privacy promise that is the reason Glossa exists.

## Consequences

- There is no way to rotate, revoke or rate-limit keys centrally. Each user manages their key at the translation service.
- The key is only as safe as the browser profile. A local attacker with access to the profile can read it.
- The key is validated when it is saved in Settings (for OpenRouter via `GET /api/v1/key`), because nothing else would catch a bad key before the first Translation.
