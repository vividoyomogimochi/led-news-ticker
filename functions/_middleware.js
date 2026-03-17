/**
 * Cloudflare Pages middleware
 *
 * When the main page (/) is requested with query parameters,
 * rewrites og:image to point to /ogp with the same params so that
 * social media crawlers get a dynamic preview image for each ticker URL.
 */

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  // Only intercept the main page when query params are present
  if (url.pathname !== '/' || !url.search) {
    return next();
  }

  const response = await next();

  if (!response.headers.get('Content-Type')?.includes('text/html')) {
    return response;
  }

  const ogpUrl = new URL('/ogp', url.origin);
  ogpUrl.search = url.search;

  return new HTMLRewriter()
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', ogpUrl.href);
      },
    })
    .transform(response);
}
