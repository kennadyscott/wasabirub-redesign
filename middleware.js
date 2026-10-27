// A/B test: 50/50 sticky split between the current site (A) and the 2027 store (B, under /b/).
// Serves both at the SAME clean URLs via internal rewrite; crawlers always get A.
import { next, rewrite } from '@vercel/edge';

export const config = {
  // Skip the B tree, API, static asset dirs, and the standalone sub-apps.
  matcher: '/((?!b/|api/|assets/|css/|fonts/|_vercel|rsvp|checkin|wellness-event|sportpharm-pharmacy-check-in).*)',
};

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Only split real pages: the root, extensionless paths, or *.html. Let assets pass through.
  const isPage = path === '/' || path.endsWith('.html') || !/\.[a-z0-9]+$/i.test(path);
  if (!isPage) return next();

  // Keep search engines / link-preview bots on A so indexing stays stable.
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  if (/bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternalhit|embedly|quora|pinterest|slackbot|whatsapp|telegram|discord|preview|lighthouse/.test(ua)) {
    return next();
  }

  // Sticky 50/50 assignment via the wr_ab cookie.
  const cookie = request.headers.get('cookie') || '';
  const had = (cookie.match(/(?:^|;\s*)wr_ab=(a|b)/) || [])[1];
  let variant = had;
  // Links in SportPharm HQ's emails carry ?ab=a|b, the site that person saw,
  // so a click from another device or an in-app browser lands on the same
  // site instead of a fresh coin flip. It wins over the cookie and resets it.
  const pinned = url.searchParams.get('ab');
  if (pinned === 'a' || pinned === 'b') variant = pinned;
  if (!variant) variant = Math.random() < 0.5 ? 'b' : 'a';
  const fresh = variant !== had;

  let res;
  if (variant === 'b') {
    const dest = new URL(request.url);
    dest.pathname = '/b' + (path === '/' ? '/index.html' : path);
    res = rewrite(dest);
  } else {
    res = next();
  }
  if (fresh) {
    res.headers.append('Set-Cookie', `wr_ab=${variant}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  return res;
}
