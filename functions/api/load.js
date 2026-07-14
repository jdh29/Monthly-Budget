export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const syncCode = url.searchParams.get('syncCode');
  if (!syncCode) return new Response('Missing sync code', { status: 400 });
  const data = await env.APPS_KV.get(`budget:${syncCode}`);
  if (!data) return new Response(JSON.stringify(null), {
    headers: { 'Content-Type': 'application/json' }
  });
  return new Response(data, {
    headers: { 'Content-Type': 'application/json' }
  });
}
