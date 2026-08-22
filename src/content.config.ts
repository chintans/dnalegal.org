import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Long-form legal writing lives in `content/blog/` as plain Markdown so that
 * drafts can be reviewed outside the site build. Routes are served from
 * `/insights/<slug>` — see `src/pages/insights/`.
 */
const insights = defineCollection({
  loader: glob({ base: './content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    /** Overrides the filename-derived route. Falls back to the entry id. */
    slug: z.string().optional(),
    /** Shorter <title> for search results; the full title is often too long. */
    seoTitle: z.string().optional(),
    /** Meta description. Keep to roughly 150–160 characters. */
    description: z.string(),
    /** Card summary on the index page. Falls back to `description`. */
    excerpt: z.string().optional(),
    category: z.string().default('Insights'),
    tags: z.array(z.string()).default([]),
    author: z.string().default('DNA Legal'),
    datePublished: z.coerce.date(),
    dateModified: z.coerce.date().optional(),
    /** Overrides the word-count estimate, e.g. "14 min". */
    readingTime: z.string().optional(),
    jurisdiction: z.string().default('India'),
    /** Site-relative canonical path. Defaults to the generated route. */
    canonical: z.string().optional(),
    /** Social preview image. Defaults to /og/<slug>.png (see scripts/generate-og.mjs). */
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    schema: z
      .object({
        type: z.enum(['LegalArticle', 'Article', 'BlogPosting']).default('LegalArticle'),
        /** Emit FAQPage JSON-LD from the article's FAQ section. */
        faqPage: z.boolean().default(false),
      })
      .default({ type: 'LegalArticle', faqPage: false }),
  }),
});

export const collections = { insights };
