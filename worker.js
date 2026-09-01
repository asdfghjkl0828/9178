// Cloudflare Worker —— 远行商人代理
// 作用：持有 WeGame API Key，转发到 wegame.shallow.ink，并补 CORS 头，
//       让纯静态前端（GitHub Pages）能安全拉取远行商人实时货架。
//
// 部署步骤：
// 1. 登录 https://dash.cloudflare.com/  → Workers & Pages → 创建 Worker
// 2. 把本文件内容粘贴进编辑器并部署
// 3. Settings → Variables → 添加环境变量 API_KEY = 你的 WeGame API Key（建议设为 Secret）
// 4. 部署后得到地址，例如 https://rocom-proxy.<你的子域>.workers.dev
// 5. 把该地址填进 merchant.html 顶部的 WORKER_URL 常量并推送

const UPSTREAM = 'https://wegame.shallow.ink/api/v1/games/rocom/merchant/info';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 只允许 /merchant 路径
    if (url.pathname !== '/merchant') {
      return new Response('Not Found', { status: 404 });
    }

    const apiKey = env.API_KEY;
    if (!apiKey) {
      return json({ error: 'API_KEY 未配置：请在 Worker Settings → Variables 中添加 API_KEY 环境变量。' }, 500);
    }

    try {
      const target = UPSTREAM + '?refresh=false&random_goods=all';
      const upstream = await fetch(target, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'rocom-merchant-proxy/1.0'
        }
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        }
      });
    } catch (e) {
      return json({ error: '上游请求失败：' + e.message }, 502);
    }
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
