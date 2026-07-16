export async function onRequestPost(context) {
  const { request, env } = context;
  const { syncCode, data } = await request.json();
  if (!syncCode) return new Response('Missing sync code', { status: 400 });
  await env.APPS_KV.put(`budgetv4:${syncCode}`, JSON.stringify(data));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
