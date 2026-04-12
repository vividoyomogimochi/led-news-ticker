import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { Marked } from 'marked';

const helpMdJa = readFileSync(resolve(__dirname, 'content/help.md'), 'utf-8');
const helpMdEn = readFileSync(resolve(__dirname, 'content/help.en.md'), 'utf-8');
const marked = new Marked();
const helpHtmlJa = marked.parse(helpMdJa) as string;
const helpHtmlEn = marked.parse(helpMdEn) as string;
const helpHtml =
  `<div data-i18n-show="ja" lang="ja">${helpHtmlJa}</div>` +
  `<div data-i18n-show="en" lang="en">${helpHtmlEn}</div>`;

const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
})();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const githubRepo = env.VITE_GITHUB_REPO || '';
  const versionLabel = githubRepo
    ? commitHash !== 'unknown'
      ? `<a href="${githubRepo}/tree/${commitHash}" target="_blank" rel="noopener">${commitHash}</a>`
      : `<a href="${githubRepo}" target="_blank" rel="noopener">${commitHash}</a>`
    : commitHash;
  const versionHtml = `<p class="help-version">version: ${versionLabel}</p>`;

  return {
    plugins: [
      {
        name: 'inject-help-content',
        transformIndexHtml(html) {
          return html.replace('<!--HELP_CONTENT-->', helpHtml + versionHtml);
        },
      },
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
            } catch {
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
          config: resolve(__dirname, 'config/index.html'),
        },
      },
    },
  };
});
