#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
远行商人每日货架自动爬虫（免费·免 Key）
数据源：https://www.onebiji.com 洛克王国远行商人查询器（公开页面，无需任何 API Key）
原理：每个轮次（08/12/16/20 点后）抓取当前轮真实货架，合并写入 data/merchant_daily.json，
      merchant.html 前端自动读取展示。零成本、不消耗 rocom 积分。
仅用标准库（urllib + re），便于在 GitHub Actions 中直接运行，无需 pip 安装。
"""
import sys
import os
import re
import json
import ssl
import argparse
import urllib.request
from datetime import datetime, timezone, timedelta

URL = "https://www.onebiji.com/hykb_tools/comm/lkwgmerchant/preview.php?id=1&immgj=0"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.onebiji.com/",
}

ROUND_LABELS = {
    "1": "08:00-12:00",
    "2": "12:00-16:00",
    "3": "16:00-20:00",
    "4": "20:00-24:00",
}

BEIJING = timezone(timedelta(hours=8))


def fetch_html(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except ssl.SSLError:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            raw = resp.read()
    # 尝试 utf-8，失败回退 gbk
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "ignore")


def _text(s):
    if not s:
        return ""
    return re.sub(r"<[^>]+>", "", s).strip()


def parse(html):
    out = {"server_now": 0, "active_round": None, "rounds": {}}

    # 服务器时间戳（北京时间）
    sn = re.search(r"var\s+serverNow\s*=\s*(\d+)", html)
    server_now = int(sn.group(1)) if sn else 0
    out["server_now"] = server_now

    # 当前轮次（time-list 中带 on 的 li，取 em 时间区间）
    tm = re.search(r'class="time-list".*?<li[^>]*class="[^"]*on[^"]*"[^>]*>(.*?)</li>', html, re.S)
    if tm:
        ems = re.findall(r"<em>(.*?)</em>", tm.group(1))
        if len(ems) >= 2:
            out["active_round"] = f"{ems[0].strip()}-{ems[1].strip()}"

    # 商品块：含 shop_name 的 <li>（页面仅渲染当前轮，class 含 all_show）
    blocks = re.findall(r'<li[^>]*class="[^"]*all_show[^"]*"[^>]*>.*?</li>', html, re.S)
    for b in blocks:
        if "shop_name" not in b:
            continue
        # 轮次：show_N
        rm = re.search(r"show_(\d)", b)
        round_no = rm.group(1) if rm else None
        if round_no not in ROUND_LABELS:
            continue
        # 名称
        nm = re.search(r'class="shop_name"[^>]*>(.*?)</', b, re.S)
        name = _text(nm.group(1)) if nm else "未知"
        # 价格
        pm = re.search(r'class="shop_price"[^>]*>(.*?)</', b, re.S)
        price = "未知"
        if pm:
            pv = re.search(r"[：:]\s*([\d.wW]+)", pm.group(1))
            price = pv.group(1).strip() if pv else _text(pm.group(1))
        # 限购
        lm = re.search(r'class="gitem"[^>]*>.*?<em>(.*?)</em>', b, re.S)
        limit = "无限制"
        if lm:
            lv = re.search(r"(\d+)", lm.group(1))
            limit = lv.group(1) if lv else "无限制"
        # 角标
        high_value = "tp1" in b
        recommend = "tp2" in b
        # 描述 / 类型（onclick showShopinfo）
        onclick = b
        desc = ""
        dm = re.search(r"showShopinfo\([^,]+,[^,]+,[^,]+,'([^']*)'\)", onclick)
        if dm:
            desc = dm.group(1)
        type_m = re.search(r"showShopinfo\([^,]+,[^,]+,'([^']*)'", onclick)
        item_type = type_m.group(1) if type_m else ""
        # 结束时间
        dtm = re.search(r'data-time="(\d+)"', b)
        end_time = int(dtm.group(1)) if dtm else 0
        remain = "未知"
        if server_now and end_time:
            surplus = end_time - server_now
            if surplus > 0:
                h = surplus // 3600
                m = (surplus % 3600) // 60
                remain = f"{h}小时{m}分钟"
            else:
                remain = "已结束"
        # 图片
        img = ""
        im = re.search(r'class="gitem"[^>]*>.*?<img[^>]*src="([^"]+)"', b, re.S)
        if im:
            img = im.group(1)

        item = {
            "name": name,
            "price": price,
            "limit": limit,
            "desc": desc,
            "type": item_type,
            "high_value": high_value,
            "recommend": recommend,
            "remain": remain,
            "image": img,
        }
        out["rounds"].setdefault(round_no, {"label": ROUND_LABELS[round_no], "items": []})
        out["rounds"][round_no]["items"].append(item)

    return out


def merge_and_write(parsed, out_path):
    today = datetime.now(BEIJING).strftime("%Y-%m-%d")
    data = {"date": today, "updated_at": datetime.now(BEIJING).isoformat(), "server_now": parsed["server_now"], "active_round": parsed["active_round"], "rounds": {}}
    # 合并已存在的同日数据
    if os.path.exists(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                old = json.load(f)
            if old.get("date") == today:
                data["rounds"] = old.get("rounds", {})
        except Exception:
            pass
    # 用本次解析覆盖对应轮次
    for rn, rd in parsed["rounds"].items():
        data["rounds"][rn] = rd
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="本地 HTML 文件（测试用），默认抓取线上")
    ap.add_argument("--out", default="data/merchant_daily.json", help="输出 JSON 路径")
    args = ap.parse_args()

    html = fetch_html(URL) if not args.file else open(args.file, encoding="utf-8").read()
    parsed = parse(html)
    # 取当前解析出的轮次号（页面只渲染当前轮）
    captured = list(parsed["rounds"].keys())
    data = merge_and_write(parsed, args.out)

    print(f"捕获轮次: {captured}  当前时段: {parsed['active_round']}")
    for rn in captured:
        items = data["rounds"][rn]["items"]
        print(f"  轮次{rn} ({data['rounds'][rn]['label']}): {len(items)} 件")
        for it in items:
            tags = ("[超高价值]" if it["high_value"] else "") + ("[强烈推荐]" if it["recommend"] else "")
            print(f"    - {it['name']} | {it['price']}洛克贝 | 限购{it['limit']} | 剩余{it['remain']} {tags}")
    print(f"已写入: {args.out}")


if __name__ == "__main__":
    main()
