import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  // Visible in the macOS file picker, unlike .output, for Load unpacked.
  outDir: 'out',
  modules: ['@wxt-dev/module-svelte'],
  // Explicit imports keep every module readable on its own.
  imports: false,
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://github.com/politan/glossa',
    minimum_chrome_version: '121',
    permissions: [
      'activeTab',
      'contextMenus',
      'declarativeNetRequestWithHostAccess',
      'scripting',
      'storage',
    ],
    // All sites: the Selection Icon runs everywhere (ADR 0005), and Local
    // Providers may live anywhere on the user's network.
    host_permissions: ['<all_urls>'],
    commands: {
      'translate-selection': {
        suggested_key: { default: 'Alt+Shift+T' },
        description: '__MSG_commandTranslateSelection__',
      },
    },
  },
});
