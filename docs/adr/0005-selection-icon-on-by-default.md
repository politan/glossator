# The Selection Icon is on by default

Supersedes [ADR 0004](0004-selection-icon-is-an-opt-in-permission.md).

Using Glossa showed that a translate icon next to the selection is the main way people reach it: the shortcut is invisible and the context menu takes two clicks. So the content script now runs on every page from install, and the extension requires access to all sites up front, accepting the "Read and change all your data on all websites" warning at install. The icon can still be switched off in Settings or hidden per site from the Toolbar Popup; the context menu and the shortcut keep working either way. The same grant also covers Local Providers on the private network, so Settings no longer asks for per-host permissions.
