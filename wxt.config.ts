import { defineConfig } from 'wxt';

const ALL_SITES = ['http://*/*', 'https://*/*'];

export default defineConfig({
  srcDir: 'src',
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
    host_permissions: ['https://openrouter.ai/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    // Requested at runtime: all sites for the Selection Icon (ADR 0004),
    // specific origins for Local Providers outside localhost.
    optional_host_permissions: ALL_SITES,
    commands: {
      'translate-selection': {
        suggested_key: { default: 'Alt+Shift+T' },
        description: '__MSG_commandTranslateSelection__',
      },
    },
  },
  hooks: {
    // The content script uses `registration: 'runtime'`, which makes WXT add its
    // matches to the required host permissions. Keep them optional instead.
    'build:manifestGenerated': (_wxt, manifest) => {
      const mv3 = manifest as { host_permissions?: string[] };
      mv3.host_permissions = mv3.host_permissions?.filter(
        (pattern) => pattern !== '<all_urls>' && !ALL_SITES.includes(pattern),
      );
    },
  },
});
