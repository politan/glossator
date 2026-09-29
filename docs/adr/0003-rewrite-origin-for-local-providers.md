# Rewrite the Origin header on requests to Local Providers

Ollama rejects requests whose `Origin` is not on its allowlist, and `chrome-extension://` is not on the default list. The alternative was asking users to set `OLLAMA_ORIGINS` and restart Ollama, which is platform-specific (`launchctl`, systemd) and would stop most people at the first step. Instead Glossa installs a dynamic `declarativeNetRequest` rule that sets `Origin` to the Local Provider's own origin. The rule only matches that Provider's configured base URL and only requests Glossa itself initiates (`initiatorDomains: [chrome.runtime.id]`). Ollama's origin check exists to stop arbitrary web pages from using the local model; this rule leaves that protection intact because web pages' requests are never rewritten. The same technique is used by Page Assist.

## Consequences

- The rule must be updated whenever a Local Provider's base URL changes, and removed when the Provider is deleted.
- The README documents the manual `OLLAMA_ORIGINS` setup as a fallback in case the rule stops working.
