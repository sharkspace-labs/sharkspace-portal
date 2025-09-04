// This is the Service Worker for the SharkSpace Labs portal.

let fileMap = null;
const SCOPE_PREFIX = '/portal-scope/';

// Use a BroadcastChannel to receive the file map from the main page.
const channel = new BroadcastChannel('file-transfer');
channel.onmessage = (event) => {
  console.log('[SW] File map received.');
  fileMap = event.data;
};

self.addEventListener('install', (event) => {
  // Activate the new service worker as soon as it's installed.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of all clients within the scope immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle requests that are within our virtual scope.
  if (url.pathname.startsWith(SCOPE_PREFIX)) {
    // We must respond to the request.
    event.respondWith((async () => {
      if (!fileMap) {
        // This can happen if the page is reloaded.
        // We could add logic to request the fileMap again, but for now, we'll show an error.
        return new Response('Service Worker is active but has no file data. Please refresh the main portal page.', { status: 500 });
      }

      // Normalize the path: '/portal-scope/index.html' -> 'index.html'
      // Or '/portal-scope/' -> 'index.html'
      let filePath = url.pathname.substring(SCOPE_PREFIX.length);
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