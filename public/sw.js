let fileMap = null;
// This is the unique part of the path we will look for.
const VIRTUAL_SCOPE = '/portal-scope/';

const channel = new BroadcastChannel('file-transfer');
channel.onmessage = (event) => {
  console.log('[SW] File map received.');
  fileMap = event.data;
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // --- MODIFICATION ---
  // Instead of checking if the path starts with a hardcoded string,
  // we find our unique virtual scope within the full path.
  const scopeIndex = path.indexOf(VIRTUAL_SCOPE);

  if (scopeIndex !== -1) {
    event.respondWith((async () => {
      if (!fileMap) {
        return new Response('Service Worker is active but has no file data.', { status: 500 });
      }

      // Extract the filename by getting the substring after the virtual scope part.
      // e.g., '/sharkspace-portal/portal-scope/about.html' -> 'about.html'
      let filePath = path.substring(scopeIndex + VIRTUAL_SCOPE.length);
      if (filePath === '' || filePath.endsWith('/')) {
        filePath += 'index.html';
      }

      const fileBlob = fileMap.get(filePath);

      if (fileBlob) {
        console.log(`[SW] Serving virtual file: ${filePath}`);
        return new Response(fileBlob);
      } else {
        console.error(`[SW] Virtual file not found: ${filePath}`);
        return new Response('File not found in virtual project.', { status: 404 });
      }
    })());
  }
});