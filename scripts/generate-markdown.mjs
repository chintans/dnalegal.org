// Post-build: write a Markdown twin (<page>.md) next to every built HTML page.
// functions/_middleware.ts serves these when a client sends `Accept: text/markdown`.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeHtmlMarkdown } from 'node-html-markdown';

const DIST = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const nhm = new NodeHtmlMarkdown({ ignore: ['script', 'style', 'svg', 'noscript'] });

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

let count = 0;
for await (const file of walk(DIST)) {
  const html = await readFile(file, 'utf8');
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
    ?.trim()
    .replace(/&amp;/g, '&');
  const main = html.match(/<main[\s\S]*<\/main>/)?.[0] ?? html.match(/<body[\s\S]*<\/body>/)?.[0] ?? html;
  const body = nhm.translate(main).trim();
  await writeFile(file.replace(/\.html$/, '.md'), `${title ? `# ${title}\n\n` : ''}${body}\n`);
  count++;
}
console.log(`generate-markdown: wrote ${count} .md files`);
