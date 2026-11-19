const CANONICAL_SITE = 'https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-site/';

Deno.serve((request) => {
  const incoming = new URL(request.url);
  const marker = '/prime-auto-care-website';
  const suffix = incoming.pathname.includes(marker)
    ? incoming.pathname.slice(incoming.pathname.indexOf(marker) + marker.length)
    : '';
  const target = new URL(CANONICAL_SITE);
  if (suffix) target.pathname = target.pathname.replace(/\/$/, '') + suffix;
  target.search = incoming.search;
  return Response.redirect(target.toString(), 308);
});
