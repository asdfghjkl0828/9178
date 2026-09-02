// Vercel Serverless Function —— 家园实时查询代理
// 部署为 *.vercel.app 后，GitHub Pages 上的 home.html 通过它实时拉取 rocodex（带 CORS，中国可达）。
// 每次请求都用新访客身份（新 clientId），≈无限次免费实时，绕开每日 3 次/IP 额度限制。
const ROCODEX = 'https://rocodex.org';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Cache-Control': 'no-store'
  };
}

function applyCors(res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  const uid = req.query.uid;
  if (!uid || !/^\d{1,20}$/.test(uid)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    applyCors(res);
    return res.status(400).json({ error: '缺少或非法的 uid 参数' });
  }

  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const baseHeaders = { 'User-Agent': ua, 'Referer': ROCODEX + '/home-query' };

  try {
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

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    applyCors(res);
    return res.status(r.status).send(text);
  } catch (e) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    applyCors(res);
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
};
