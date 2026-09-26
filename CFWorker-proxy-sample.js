export default {
  async fetch(request, env, ctx) {
    const body = await request.json();
    const res = await fetch(body.endpointURL, {
      method: "POST",
      body: JSON.stringify(body.body),
      headers: body.FORWARDHEADERS,
    });
    if (!res.ok) return Response.json({ success: false });
    else return Response.json({ success: true });
  },
};

// This is a script that can be set up using CloudFlare workers to proxy notification requests.
// Some services implement per-day rate limiting, preventing CloudFlare Workers from working with them.
// I notably experienced issues with the hosted version of NTFY.
