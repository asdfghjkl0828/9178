// Cloudflare Pages Function —— 家园实时查询代理
// 部署为 *.pages.dev 后，home.html 通过 https://<项目>.pages.dev/home?uid= 实时拉取 rocodex（带 CORS，中国可达）。
// 每次请求用新访客身份（新 clientId cookie），≈无限次免费实时，绕开每日 3 次/IP 额度限制。
const ROCODEX = 'https://rocodex.org';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Cache-Control': 'no-store'
};

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid || !/^\d{1,20}$/.test(uid)) {
    return new Response(JSON.stringify({ error: '缺少或非法的 uid 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
    });
  }
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const baseHeaders = { 'User-Agent': ua, 'Referer': ROCODEX + '/home-query' };
  try {
    // 先拿一次 quota 建立新访客身份（clientId cookie），再查询，绕开 IP 额度
    const q = await fetch(ROCODEX + '/api/home-query/quota', { headers: baseHeaders });
    const setCookie = q.headers.get('set-cookie') || '';
    const cookie = setCookie.split(';')[0];
    const h2 = { ...baseHeaders };
    if (cookie) h2['Cookie'] = cookie;

    const r = await fetch(ROCODEX + '/api/home-query/query', {
      method: 'POST',
      headers: { ...h2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: Number(uid) })
    });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
    });
  }
}
