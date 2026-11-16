import { defineConfig, type Plugin } from 'vite';

/** Génère sw.js avec la liste exacte des fichiers du build, pour un jeu jouable hors ligne. */
function horsLigne(): Plugin {
  return {
    name: 'hors-ligne',
    apply: 'build',
    generateBundle(_, bundle) {
      const fichiers = ['./', './index.html', './icone.svg', './manifest.json', ...Object.keys(bundle).map((f) => './' + f)];
      const version = Date.now().toString(36);
      const source = `const CACHE = 'structures-${version}';
const FICHIERS = ${JSON.stringify(fichiers)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [horsLigne()],
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
