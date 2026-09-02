#!/usr/bin/env python3
# 洛克王国家园「实时查询」本地代理 + 静态服务器
# 作用：
#   1) 托管整个 PvPCalc-Mine 目录（含 home.html / css / data 等），默认页 home.html
#   2) 提供 /home?uid= 实时接口：浏览器经本机代理查询 rocodex.org，
#      绕开 rocodex 的 CORS 限制，且每次用新 clientId 白嫖免费额度（≈无限次实时）
# 用法：双击 run_proxy.bat 启动，保持窗口打开；关闭窗口即停止。
import os
import http.server
import socketserver
import http.cookiejar
import urllib.request
import json
import ssl
from urllib.parse import urlparse, parse_qs

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
BASE = "https://rocodex.org"
PORT = 8787
ROOT = os.path.dirname(os.path.abspath(__file__))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

CT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


def fetch_home(uid):
    # 每次新建 cookiejar => 新 clientId => 新 3 次/天额度（白嫖）
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cj),
        urllib.request.HTTPSHandler(context=CTX),
    )
    # 1) 建立 clientId（quota 接口写 cookie）
    qr0 = urllib.request.Request(BASE + "/api/home-query/quota",
                                 headers={"User-Agent": UA, "Referer": BASE + "/home-query"})
    try:
        opener.open(qr0, timeout=30).read()
    except Exception:
        pass
    # 2) 查询该 UID 家园
    body = json.dumps({"uid": str(uid)}).encode("utf-8")
    req = urllib.request.Request(BASE + "/api/home-query/query", data=body,
                                 headers={"User-Agent": UA, "Referer": BASE + "/home-query",
                                          "Content-Type": "application/json"})
    with opener.open(req, timeout=30) as resp:
        return json.loads(resp.read())


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path in ("/home", "/home/"):
            self.serve_home_api(u.query)
            return
        # 其余路径：托管静态文件
        rel = u.path.split("?")[0]
        if rel in ("", "/"):
            rel = "/home.html"
        self.serve_static(rel)

    def serve_home_api(self, query):
        uid = parse_qs(query).get("uid", ["5678116"])[0]
        try:
            data = fetch_home(uid)
            out = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
        except Exception as e:
            err = json.dumps({"error": str(e)}, ensure_ascii=False).encode("utf-8")
            self.send_response(502)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)

    def serve_static(self, rel):
        fp = os.path.normpath(os.path.join(ROOT, rel.lstrip("/")))
        if not fp.startswith(ROOT):
            self.send_error(403)
            return
        if os.path.isdir(fp):
            fp = os.path.join(fp, "index.html")
        if not os.path.exists(fp):
            self.send_error(404)
            return
        ext = os.path.splitext(fp)[1].lower()
        ct = CT_TYPES.get(ext, "application/octet-stream")
        try:
            with open(fp, "rb") as f:
                data = f.read()
        except Exception as e:
            self.send_error(500, str(e))
            return
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler)
    print(f"洛克王国家园实时代理已启动: http://127.0.0.1:{PORT}/home.html")
    print("请保持此窗口打开；关闭窗口即停止实时查询。")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n代理已停止。")
