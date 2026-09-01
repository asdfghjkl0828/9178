// Cloudflare Worker —— 远行商人代理
// 作用：持有 WeGame API Key，转发到 wegame.shallow.ink，并补 CORS 头，
//       让纯静态前端（GitHub Pages）能安全拉取远行商人实时货架。
//
// 部署步骤：
// 1. 登录 https://dash.cloudflare.com/  → Workers & Pages → 创建 Worker
// 2. 把本文件内容粘贴进编辑器并部署
// 3. Settings → Variables → 添加环境变量 API_KEY = 你的 WeGame API Key（建议设为 Secret）
// 4. 部署后得到地址，例如 https://rocom-proxy.<你的子域>.workers.dev
// 5. 把该地址发给助理，填进 merchant.html 顶部的 WORKER_URL 常量并推送

const UPSTREAM = 'https://wegame.shallow.ink/api/v1/games/rocom/merchant/info';
const CACHE_TTL = 30; // 秒：同实例内缓存，减少对上游的调用，避免按账号限流

// 模块级缓存（单实例生命周期内有效，可挡掉页面轮询与多人访问的一部分请求）
let cache = { ts: 0, body: null, status: 200 };

function corsHeaders(extra) {
  return Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  }, extra || {});
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: corsHeaders()
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 只允许 /merchant 路径
    if (url.pathname !== '/merchant') {
      return new Response('Not Found', { status: 404 });
    }

    const apiKey = env.API_KEY;
    if (!apiKey) {
      return json({ error: 'API_KEY 未配置：请在 Worker Settings → Variables 中添加 API_KEY 环境变量（建议 Secret）。' }, 500);
    }

    // 缓存命中（同实例内）
    const now = Date.now();
    if (cache.body && (now - cache.ts) < CACHE_TTL * 1000) {
      return new Response(cache.body, {
        status: cache.status,
        headers: corsHeaders({ 'X-Cache': 'HIT' })
      });
    }

    try {
      const target = UPSTREAM + '?refresh=false&random_goods=all';
      const upstream = await fetch(target, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'rocom-merchant-proxy/1.1'
        }
      });
      const text = await upstream.text();
      cache = { ts: now, body: text, status: upstream.status };
      return new Response(text, {
        status: upstream.status,
        headers: corsHeaders({ 'X-Cache': 'MISS' })
      });
    } catch (e) {
      // 上游异常但仍有旧缓存：降级返回，保证页面不空
      if (cache.body) {
        return new Response(cache.body, {
          status: cache.status,
          headers: corsHeaders({ 'X-Cache': 'STALE' })
        });
      }
      return json({ error: '上游请求失败：' + e.message }, 502);
    }
  }
};
