const SITE = 'https://prime-auto-care-mz03200786-2785s-projects.vercel.app';
Deno.serve((req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const incoming = new URL(req.url);
  const marker = '/prime-auto-care-website';
  const suffix = incoming.pathname.includes(marker)
    ? incoming.pathname.slice(incoming.pathname.indexOf(marker) + marker.length)
    : '';
  const target = new URL(SITE + (suffix.startsWith('/booking') ? '/booking/' : '/'));
  target.search = incoming.search;
  return Response.redirect(target.toString(), 308);
});
