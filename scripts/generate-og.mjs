/**
 * Generates 1200x630 social preview images into public/og/.
 *
 * Run after adding a post or changing a title:
 *   node scripts/generate-og.mjs
 *
 * Output PNGs are committed, so the Astro build itself stays dependency-free.
 * Uses sharp, which Astro already ships for image optimisation.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BLOG_DIR = 'content/blog';
const OUT_DIR = 'public/og';

const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 88;
const TEXT_WIDTH = WIDTH - PAD * 2;

const INK = '#f8fafc';
const MUTED = '#94a3b8';
const ACCENT = '#d9a441';
const BG = '#0f172a';

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Reads the few frontmatter scalars we need without pulling in a YAML parser. */
function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (!field) continue;
    data[field[1]] = field[2].trim().replace(/^["']|["']$/g, '');
  }
  return data;
}

/**
 * Greedy wrap using an average glyph advance — good enough for a title card.
 * 0.53em matches bold Georgia closely; going lower overflows the right margin.
 */
function wrap(text, fontSize, maxWidth, maxLines) {
  const perChar = fontSize * 0.53;
  const maxChars = Math.floor(maxWidth / perChar);
  const lines = [];
  let line = '';

  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  if (lines.length === maxLines) {
    const consumed = lines.join(' ').length;
    if (consumed < text.length - 1) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,;:.\s]+$/, '')}…`;
    }
  }
  return lines;
}

function fontSizeFor(title) {
  if (title.length <= 58) return 66;
  if (title.length <= 92) return 56;
  if (title.length <= 130) return 48;
  return 43;
}

function card({ kicker, title, footer }) {
  const size = title ? fontSizeFor(title) : 0;
  const lines = title ? wrap(title, size, TEXT_WIDTH, 4) : [];
  const lineHeight = Math.round(size * 1.22);

  // Bottom-anchor the title block so cards with 2 and 4 lines stay balanced.
  const titleBottom = HEIGHT - 132;
  const titleTop = titleBottom - (lines.length - 1) * lineHeight;

  const titleTspans = lines
    .map(
      (line, i) =>
        `<text x="${PAD}" y="${titleTop + i * lineHeight}" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`,
    )
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="18%" cy="0%" r="85%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${WIDTH}" height="8" fill="${ACCENT}"/>

  <text x="${PAD}" y="118" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="700" letter-spacing="7" fill="${INK}">DNA LEGAL</text>
  <text x="${PAD}" y="150" font-family="'Segoe UI', Arial, sans-serif" font-size="15" letter-spacing="6" fill="${ACCENT}">ADVOCATES &amp; SOLICITORS</text>

  <line x1="${PAD}" y1="196" x2="${PAD + 96}" y2="196" stroke="${ACCENT}" stroke-width="3"/>

  ${kicker ? `<text x="${PAD}" y="248" font-family="'Segoe UI', Arial, sans-serif" font-size="19" font-weight="600" letter-spacing="4" fill="${ACCENT}">${escapeXml(kicker.toUpperCase())}</text>` : ''}

  ${titleTspans}

  <text x="${PAD}" y="${HEIGHT - 56}" font-family="'Segoe UI', Arial, sans-serif" font-size="19" letter-spacing="3" fill="${MUTED}">${escapeXml(footer)}</text>
</svg>`;
}

async function render(svg, outPath) {
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(outPath, png);
  return png.length;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Brand default, used by pages without their own image.
  const defaultSvg = card({
    kicker: 'Advocates & Solicitors',
    title: 'Trusted Counsel. Decisive Results.',
    footer: 'dnalegal.org',
  });
  const defaultBytes = await render(defaultSvg, path.join(OUT_DIR, 'default.png'));
  console.log(`default.png (${(defaultBytes / 1024).toFixed(0)} KB)`);

  const files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const source = await readFile(path.join(BLOG_DIR, file), 'utf8');
    const data = frontmatter(source);
    if (!data.title) {
      console.warn(`skipped ${file} — no title in frontmatter`);
      continue;
    }
    const slug = data.slug || file.replace(/\.md$/, '');
    const bytes = await render(
      card({ kicker: data.category, title: data.title, footer: 'dnalegal.org/insights' }),
      path.join(OUT_DIR, `${slug}.png`),
    );
    console.log(`${slug}.png (${(bytes / 1024).toFixed(0)} KB)`);
  }
}

await main();
