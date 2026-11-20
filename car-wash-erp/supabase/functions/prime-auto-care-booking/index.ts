const BOOKING = 'https://prime-auto-care-mz03200786-2785s-projects.vercel.app/booking/';
Deno.serve((req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const target = new URL(BOOKING);
  target.search = new URL(req.url).search;
  return Response.redirect(target.toString(), 308);
});
