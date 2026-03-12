/**
 * Cloudflare Pages Function: /proxy
 *
 * Usage: GET /proxy?url=<encoded-url>
 *
 * Fetches the given URL and returns its content with CORS headers,
 * so browser clients can access RSS feeds without CORS restrictions.
 */
export async function onRequest(context) {
  const { request } = context;

  // Derive the allowed origin from the function's own URL (same domain)
  const allowedOrigin = new URL(request.url).origin;
  const requestOrigin = request.headers.get('Origin');
  const corsOrigin = requestOrigin === allowedOrigin ? allowedOrigin : null;

  // Handle preflight
  if (request.method === 'OPTIONS') {
    if (!corsOrigin) return new Response(null, { status: 403 });
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET',
        'Vary': 'Origin',
      },
    });
  }

  if (!corsOrigin) {
    return new Response('Forbidden', { status: 403 });
  }

  const rawUrl = new URL(request.url).searchParams.get('url');
  if (!rawUrl) {
    return new Response('Missing ?url= parameter', { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  // Only allow http/https
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    return new Response('Only http/https URLs are allowed', { status: 403 });
  }

  const upstream = await fetch(targetUrl.toString(), {
    headers: { 'User-Agent': 'led-news-ticker/1.0' },
  });

  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/xml',
      'Access-Control-Allow-Origin': corsOrigin,
      'Cache-Control': 'public, max-age=120',
      'Vary': 'Origin',
    },
  });
}
