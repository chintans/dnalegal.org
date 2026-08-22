import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sortPosts, urlFor } from '../../lib/insights';

const TITLE = 'DNA Legal — Insights';
const DESCRIPTION =
  'Commentary and analysis from DNA Legal on commercial disputes, property litigation, arbitration and regulatory practice in India.';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RFC 822, as required by RSS 2.0 pubDate. */
function rfc822(date: Date): string {
  return date.toUTCString();
}

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://dnalegal.org');
  const posts = sortPosts(await getCollection('insights'));

  const items = posts
    .map((post) => {
      const link = new URL(urlFor(post), base).href;
      const categories = post.data.tags
        .map((tag) => `      <category>${escapeXml(tag)}</category>`)
        .join('\n');

      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(post.data.excerpt ?? post.data.description)}</description>
      <pubDate>${rfc822(post.data.datePublished)}</pubDate>
      <author>${escapeXml(post.data.author)}</author>
${categories}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${escapeXml(new URL('/insights', base).href)}</link>
    <description>${escapeXml(DESCRIPTION)}</description>
    <language>en-in</language>
    <copyright>© ${new Date().getFullYear()} DNA Legal</copyright>
    <atom:link href="${escapeXml(new URL('/insights/rss.xml', base).href)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
