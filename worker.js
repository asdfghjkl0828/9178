// Cloudflare Worker —— 洛克魔法书代理
// 作用：持有 WeGame API Key，转发到 wegame.shallow.ink，并补 CORS 头，
//       让纯静态前端（GitHub Pages）能安全拉取远行商人货架 & 家园查询。
//
// 部署步骤：
// 1. 登录 https://dash.cloudflare.com/  → Workers & Pages → 创建 Worker
// 2. 把本文件内容粘贴进编辑器并部署
// 3. Settings → Variables → 添加环境变量 API_KEY = 你的 WeGame API Key（建议设为 Secret）
// 4. 部署后得到地址，例如 https://rocom-proxy.<你的子域>.workers.dev
// 5. 把该地址发给助理，填进 merchant.html / home.html 顶部的 WORKER_URL 常量并推送

const INGAME = 'https://wegame.shallow.ink/api/v1/games/rocom/ingame';
const CACHE_TTL = 30; // 秒：远行商人同实例缓存，减少对上游的调用，避免按账号限流

// 模块级缓存（单实例生命周期内有效）
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 远行商人（带缓存 + 上游降级）
async function proxyMerchant(apiKey) {
  const now = Date.now();
  if (cache.body && (now - cache.ts) < CACHE_TTL * 1000) {
    return new Response(cache.body, { status: cache.status, headers: corsHeaders({ 'X-Cache': 'HIT' }) });
  }
  const upstream = await fetch(INGAME + '/merchant/info?refresh=false&random_goods=all', {
    method: 'GET',
    headers: { 'X-API-Key': apiKey, 'Accept': 'application/json', 'User-Agent': 'rocom-proxy/1.1' }
  });
  const text = await upstream.text();
  cache = { ts: now, body: text, status: upstream.status };
  return new Response(text, { status: upstream.status, headers: corsHeaders({ 'X-Cache': 'MISS' }) });
}

// 家园查询（异步任务：202 + task_id → 轮询 tasks/{id}）
async function proxyHome(apiKey, uid) {
  const initUrl = INGAME + '/home/info?uid=' + encodeURIComponent(uid) + '&wait_ms=0';
  const init = await fetch(initUrl, {
    headers: { 'X-API-Key': apiKey, 'Accept': 'application/json', 'User-Agent': 'rocom-proxy/1.1' }
  });
  if (init.status === 200) {
    return new Response(await init.text(), { status: 200, headers: corsHeaders({ 'X-Cache': 'DIRECT' }) });
  }
  if (init.status === 202) {
    const j = (await init.json().catch(() => ({}))) || {};
    const taskId = j.task_id || (j.data && (j.data.task_id || j.data.taskId)) ||
                   (j.data && j.data.data && j.data.data.task_id);
    if (!taskId) return json({ error: '未获取到 task_id，上游返回：' + JSON.stringify(j).slice(0, 300) }, 502);
    for (let i = 0; i < 25; i++) {
      await sleep(1200);
      const t = await fetch(INGAME + '/tasks/' + encodeURIComponent(taskId), {
        headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
      });
      const tj = (await t.json().catch(() => ({}))) || {};
      const st = tj.status || (tj.data && tj.data.status);
      if (st && st !== 'running' && st !== 'queued') {
        return new Response(JSON.stringify(tj), { status: 200, headers: corsHeaders({ 'X-Cache': 'TASK' }) });
      }
    }
    return json({ error: '家园任务轮询超时（上游 30s 内未完成）' }, 504);
  }
  const txt = await init.text();
  return json({ error: '上游返回 ' + init.status, raw: txt.slice(0, 400) }, init.status === 400 ? 400 : 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const apiKey = env.API_KEY;
    if (!apiKey) {
      return json({ error: 'API_KEY 未配置：请在 Worker Settings → Variables 中添加 API_KEY 环境变量（建议 Secret）。' }, 500);
    }

    if (url.pathname === '/merchant') {
      try {
        return await proxyMerchant(apiKey);
      } catch (e) {
        if (cache.body) {
          return new Response(cache.body, { status: cache.status, headers: corsHeaders({ 'X-Cache': 'STALE' }) });
        }
        return json({ error: '上游请求失败：' + e.message }, 502);
      }
    }

    if (url.pathname === '/home') {
      const uid = (url.searchParams.get('uid') || '').trim();
      if (!uid) return json({ error: '缺少 uid 参数' }, 400);
      try {
        return await proxyHome(apiKey, uid);
      } catch (e) {
        return json({ error: '上游请求失败：' + e.message }, 502);
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
