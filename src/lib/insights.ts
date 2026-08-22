import type { CollectionEntry } from 'astro:content';

export type Insight = CollectionEntry<'insights'>;

/** Articles per listing page. Page 1 spends one slot on the lead article. */
export const POSTS_PER_PAGE = 9;

/**
 * A tag archive with only one article is thin content, so those pages are
 * generated for navigation but excluded from the index.
 */
export const MIN_POSTS_FOR_INDEXABLE_TAG = 2;

/** Route segment for a post: explicit frontmatter `slug`, else the file-derived id. */
export function slugFor(post: Insight): string {
  return post.data.slug ?? post.id;
}

export function urlFor(post: Insight): string {
  return post.data.canonical ?? `/insights/${slugFor(post)}`;
}

/** e.g. "22 August 2026" */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** YYYY-MM-DD, for <time datetime> and JSON-LD. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Uses the frontmatter value when set, otherwise estimates at 220 wpm. */
export function readingTime(post: Insight): string {
  if (post.data.readingTime) return post.data.readingTime;
  const words = (post.body ?? '').split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} min`;
}

/** Newest first. Drafts are excluded from production builds only. */
export function sortPosts(posts: Insight[]): Insight[] {
  return posts
    .filter((p) => !p.data.draft || import.meta.env.DEV)
    .sort((a, b) => b.data.datePublished.valueOf() - a.data.datePublished.valueOf());
}

/** URL-safe segment for a tag, e.g. "Section 16(c)" -> "section-16-c". */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function tagUrl(tag: string): string {
  return `/insights/topic/${tagSlug(tag)}`;
}

/** Collects every tag across the given posts, with its post list. */
export function tagIndex(posts: Insight[]): Map<string, { label: string; posts: Insight[] }> {
  const index = new Map<string, { label: string; posts: Insight[] }>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const key = tagSlug(tag);
      if (!key) continue;
      const existing = index.get(key);
      if (existing) existing.posts.push(post);
      else index.set(key, { label: tag, posts: [post] });
    }
  }
  return index;
}

/** Listing page href. Page 1 lives at /insights, later pages at /insights/page/N. */
export function pageUrl(page: number): string {
  return page <= 1 ? '/insights' : `/insights/page/${page}`;
}

export function totalPages(count: number): number {
  return Math.max(1, Math.ceil(count / POSTS_PER_PAGE));
}

/** The posts shown on a given listing page. Page 1 leads with the newest post. */
export function postsForPage(posts: Insight[], page: number): Insight[] {
  return posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Faq {
  question: string;
  answer: string;
}

/**
 * Pulls Q&A pairs out of the article's FAQ section for FAQPage JSON-LD.
 *
 * Expects the house format: an `## Frequently Asked Questions` heading, then
 * each question as an `###` heading (or a standalone bold line) followed by its
 * answer. Returns an empty array when the section is absent, so posts without
 * one just skip the FAQPage block.
 */
export function extractFaqs(body: string): Faq[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) =>
    /^##\s+.*(frequently asked questions|faqs?)\b/i.test(line),
  );
  if (start === -1) return [];

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const faqs: Faq[] = [];
  let current: Faq | null = null;

  const commit = () => {
    if (current && current.answer) faqs.push(current);
    current = null;
  };

  for (const raw of lines.slice(start + 1, end)) {
    const line = raw.trim();
    const question = line.match(/^#{3,6}\s+(.+)$/) ?? line.match(/^\*\*(.+?)\*\*$/);
    if (question) {
      commit();
      current = { question: stripMarkdown(question[1]), answer: '' };
      continue;
    }
    if (!current || !line || line === '---') continue;
    current.answer = `${current.answer} ${line}`.trim();
  }
  commit();

  return faqs.map((faq) => ({ ...faq, answer: stripMarkdown(faq.answer) }));
}
