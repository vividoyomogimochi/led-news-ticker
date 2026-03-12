import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'rss-proxy',
      configureServer(server) {
        server.middlewares.use('/proxy', async (req, res) => {
          const host = req.headers['host'] ?? 'localhost';
          const allowedOrigin = `http://${host}`;
          const requestOrigin = req.headers['origin'];
          // No Origin header = same-origin request (browser omits it); allow it.
          const corsOrigin = !requestOrigin || requestOrigin === allowedOrigin ? allowedOrigin : null;

          if (req.method === 'OPTIONS') {
            if (!corsOrigin) { res.writeHead(403); res.end(); return; }
            res.writeHead(204, {
              'Access-Control-Allow-Origin': corsOrigin,
              'Access-Control-Allow-Methods': 'GET',
              'Vary': 'Origin',
            });
            res.end();
            return;
          }

          if (!corsOrigin) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }

          const rawUrl = new URL(req.url ?? '', 'http://localhost').searchParams.get('url');
          if (!rawUrl) {
            res.writeHead(400);
            res.end('Missing ?url= parameter');
            return;
          }
          let targetUrl: URL;
          try {
            targetUrl = new URL(rawUrl);
          } catch {
            res.writeHead(400);
            res.end('Invalid URL');
            return;
          }
          if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
            res.writeHead(403);
            res.end('Only http/https URLs are allowed');
            return;
          }
          try {
            const upstream = await fetch(targetUrl.toString(), {
              headers: { 'User-Agent': 'led-news-ticker/1.0' },
            });
            const body = await upstream.arrayBuffer();
            res.writeHead(upstream.status, {
              'Content-Type': upstream.headers.get('Content-Type') ?? 'application/xml',
              'Access-Control-Allow-Origin': corsOrigin,
              'Vary': 'Origin',
            });
            res.end(Buffer.from(body));
          } catch (err) {
            res.writeHead(502);
            res.end('Upstream fetch failed');
          }
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ticker: resolve(__dirname, 'ticker/index.html'),
      },
    },
  },
});
