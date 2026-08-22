import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  MIN_POSTS_FOR_INDEXABLE_TAG,
  isoDate,
  pageUrl,
  sortPosts,
  tagIndex,
  tagUrl,
  urlFor,
} from '../lib/insights';

/**
 * Static marketing pages. The /altA/* routes are an alternative design variant
 * of the same content, so they are deliberately excluded — listing both would
 * put duplicate content in the index.
 */
const STATIC_PAGES: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'monthly' },
  { path: '/about', priority: '0.8', changefreq: 'yearly' },
  { path: '/practice-areas', priority: '0.9', changefreq: 'yearly' },
  { path: '/team', priority: '0.8', changefreq: 'yearly' },
  { path: '/contact', priority: '0.7', changefreq: 'yearly' },
  { path: '/insights', priority: '0.9', changefreq: 'weekly' },
];

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function entry(loc: string, opts: { lastmod?: string; changefreq?: string; priority?: string } = {}) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    opts.lastmod ? `    <lastmod>${opts.lastmod}</lastmod>` : null,
    opts.changefreq ? `    <changefreq>${opts.changefreq}</changefreq>` : null,
    opts.priority ? `    <priority>${opts.priority}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://dnalegal.org');
  const posts = sortPosts(await getCollection('insights'));

  const urls: string[] = [];

  for (const page of STATIC_PAGES) {
    urls.push(
      entry(new URL(page.path, base).href, {
        changefreq: page.changefreq,
        priority: page.priority,
      }),
    );
  }

  // Listing pages 2..n
  const pageCount = Math.max(1, Math.ceil(posts.length / 9));
  for (let page = 2; page <= pageCount; page++) {
    urls.push(entry(new URL(pageUrl(page), base).href, { changefreq: 'weekly', priority: '0.5' }));
  }

  for (const post of posts) {
    urls.push(
      entry(new URL(urlFor(post), base).href, {
        lastmod: isoDate(post.data.dateModified ?? post.data.datePublished),
        changefreq: 'yearly',
        priority: '0.8',
      }),
    );
  }

  // Only tag archives substantial enough to be indexable.
  for (const { label, posts: tagged } of tagIndex(posts).values()) {
    if (tagged.length < MIN_POSTS_FOR_INDEXABLE_TAG) continue;
    urls.push(entry(new URL(tagUrl(label), base).href, { changefreq: 'monthly', priority: '0.6' }));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
