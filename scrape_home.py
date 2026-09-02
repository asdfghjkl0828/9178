#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrape_home.py — 免费自动抓取洛克王国家园数据（零成本，不碰 rocom 付费接口）

数据源：rocodex.org 的免费家园查询接口（底层仍是游戏后端，但 rocodex 用每日 3 次/IP 的
额度替用户垫了积分，对每个 UID 查询免费）。本脚本在 GitHub Actions 上运行：每次运行使用
全新 cookie（= 新 clientId），白嫖当天 3 个 UID 的免费快照，写入 data/home_<uid>.json 并
汇总到 data/home_index.json，供 home.html 直接读取。

额度限制：每个 clientId/IP 每天 3 次查询。脚本查到 remaining<=0 即停止后续 UID 并记录。
"""
import sys
import os
import re
import json
import argparse
import ssl
import urllib.request
import urllib.error
import http.cookiejar
from datetime import datetime, timezone, timedelta

BASE = "https://rocodex.org"
QUOTA_URL = BASE + "/api/home-query/quota"
QUERY_URL = BASE + "/api/home-query/query"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
REFERER = BASE + "/home-query"

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

HERE = os.path.dirname(os.path.abspath(__file__))


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def make_opener():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def req_json(opener, url, method="GET", body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers={
        "User-Agent": UA,
        "Accept": "application/json",
        "Referer": REFERER,
        "Content-Type": "application/json",
    })
    with opener.open(r, timeout=40) as resp:
        return json.loads(resp.read().decode("utf-8", "ignore"))


def load_uids(path):
    with open(path, "r", encoding="utf-8") as f:
        arr = json.load(f)
    uids = []
    for u in arr:
        if isinstance(u, int):
            uids.append(u)
        elif isinstance(u, str) and u.strip().isdigit():
            uids.append(int(u.strip()))
        elif isinstance(u, dict) and str(u.get("uid", "")).strip().isdigit():
            uids.append(int(str(u["uid"]).strip()))
    return uids


def scrape(uids):
    out = []
    for uid in uids:
        opener = make_opener()
        try:
            q = req_json(opener, QUOTA_URL)
        except Exception as e:
            print(f"[WARN] UID {uid}: 取配额失败 {e}")
            out.append({"uid": uid, "ok": False, "error": f"quota: {e}"})
            continue
        quota = (q.get("quota") or {}).get("remaining")
        if quota is not None and quota <= 0:
            print(f"[STOP] 今日额度已耗尽（remaining={quota}），停止抓取剩余 UID。")
            out.append({"uid": uid, "ok": False, "error": "quota_exhausted", "remaining": quota})
            break
        try:
            res = req_json(opener, QUERY_URL, method="POST", body={"uid": uid})
        except Exception as e:
            print(f"[WARN] UID {uid}: 查询失败 {e}")
            out.append({"uid": uid, "ok": False, "error": f"query: {e}"})
            continue
        if res.get("error") or not res.get("data"):
            print(f"[WARN] UID {uid}: 返回异常 {res.get('message') or res.get('statusMessage')}")
            out.append({"uid": uid, "ok": False, "error": str(res.get("message") or res.get("statusMessage") or "empty")})
            continue
        data = res["data"]
        remaining = (res.get("quota") or {}).get("remaining")
        payload = {
            "uid": str(uid),
            "fetched_at": now_iso(),
            "source": "rocodex.org (免费)",
            "quota_remaining": remaining,
            "from_cache": res.get("fromCache"),
            "data": data,
        }
        out_fname = os.path.join(HERE, "data", f"home_{uid}.json")
        with open(out_fname, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
        print(f"[OK] UID {uid}: {data.get('homeName','?')} Lv{data.get('homeLevel','?')} | 精灵 {len(data.get('pets',[]))} 株 植物 {len(data.get('plants',[]))} 株 | 剩余额度 {remaining}")
        out.append({"uid": uid, "ok": True, "homeName": data.get("homeName"), "homeLevel": data.get("homeLevel")})
    return out


def write_index(results):
    idx = {
        "updated_at": now_iso(),
        "source": "rocodex.org (免费自动抓取)",
        "uids": [
            {"uid": str(r["uid"]), "homeName": r.get("homeName"), "homeLevel": r.get("homeLevel"), "ok": r.get("ok")}
            for r in results if r.get("ok")
        ],
    }
    with open(os.path.join(HERE, "data", "home_index.json"), "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, indent=1)
    print(f"[IDX] 已写入 home_index.json，成功 {sum(1 for r in results if r.get('ok'))}/{len(results)} 个 UID")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uids", default=os.path.join(HERE, "data", "uids.json"))
    ap.add_argument("--uid", type=int, help="只查单个 UID（调试用）")
    args = ap.parse_args()
    if args.uid:
        uids = [args.uid]
    else:
        uids = load_uids(args.uids)
    if not uids:
        print("[INFO] uids.json 为空，无 UID 可查。")
        write_index([])
        return
    print(f"[INFO] 待查 UID: {uids}")
    results = scrape(uids)
    write_index(results)


if __name__ == "__main__":
    main()
