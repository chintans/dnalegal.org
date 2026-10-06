// Content negotiation: `Accept: text/markdown` gets the build-time Markdown twin of an
// HTML page (see scripts/generate-markdown.mjs); everyone else gets HTML as before.
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

function markdownPath(pathname: string): string | null {
  if (/\.[a-z0-9]+$/i.test(pathname.split('/').pop() ?? '')) return null;
  return pathname.endsWith('/') ? `${pathname}index.md` : `${pathname}/index.md`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
  const wantsMarkdown = /text\/markdown/i.test(request.headers.get('Accept') ?? '');
  const mdPath = wantsMarkdown ? markdownPath(url.pathname) : null;

  if (mdPath) {
    const asset = await env.ASSETS.fetch(new Request(new URL(mdPath, url), { method: 'GET' }));
    if (asset.ok) {
      const text = await asset.text();
      return new Response(request.method === 'HEAD' ? null : text, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'x-markdown-tokens': String(Math.ceil(text.length / 4)),
          Vary: 'Accept',
        },
      });
    }
  }

  const response = await next();
  if (response.headers.get('Content-Type')?.includes('text/html')) {
    const res = new Response(response.body, response);
    res.headers.append('Vary', 'Accept');
    return res;
  }
  return response;
};
