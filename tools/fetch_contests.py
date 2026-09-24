#!/usr/bin/env python3
"""fetch_contests.py — pull the latest LeetCode contests and their problems into data/contests.json.

Public GraphQL only, no login, stdlib only. Usage:
    python3 tools/fetch_contests.py [--count 8] [--out data/contests.json]
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

GQL = "https://leetcode.com/graphql"
HEADERS = {"Content-Type": "application/json", "Referer": "https://leetcode.com/contest/", "User-Agent": "Mozilla/5.0 (dsa-dojo fetch)"}


def gql(query: str, variables: dict, retries: int = 3) -> dict:
    body = json.dumps({"query": query, "variables": variables}).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(GQL, data=body, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=25) as r:
                data = json.load(r)
            if "errors" in data:
                raise RuntimeError(data["errors"][0].get("message", "graphql error"))
            return data["data"]
        except (urllib.error.URLError, RuntimeError) as e:
            if attempt == retries - 1:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def fetch(count: int) -> list:
    page = gql("query($p:Int!,$n:Int!){ pastContests(pageNo:$p, numPerPage:$n){ data{ title titleSlug startTime } } }", {"p": 1, "n": count})
    out = []
    for c in page["pastContests"]["data"]:
        qs = gql("query($s:String!){ contest(titleSlug:$s){ questions{ title titleSlug credit } } }", {"s": c["titleSlug"]})["contest"]["questions"]
        problems = []
        for idx, q in enumerate(qs, start=1):
            meta = gql("query($s:String!){ question(titleSlug:$s){ questionFrontendId difficulty topicTags{ name } paidOnly: isPaidOnly } }", {"s": q["titleSlug"]})["question"] or {}
            problems.append({
                "pos": f"Q{idx}",
                "title": q["title"],
                "slug": q["titleSlug"],
                "url": f"https://leetcode.com/problems/{q['titleSlug']}/",
                "credit": q.get("credit"),
                "id": meta.get("questionFrontendId"),
                "difficulty": (meta.get("difficulty") or "").capitalize() or None,
                "tags": [t["name"] for t in meta.get("topicTags") or []],
                "paidOnly": bool(meta.get("paidOnly")),
            })
            time.sleep(0.3)
        out.append({"contest": c["title"], "slug": c["titleSlug"], "date": time.strftime("%Y-%m-%d", time.gmtime(c["startTime"])), "problems": problems})
        time.sleep(0.5)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=8)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "data" / "contests.json"))
    a = ap.parse_args()
    try:
        contests = fetch(a.count)
    except Exception as e:  # network / schema drift — leave the old file in place
        print(f"fetch failed: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    payload = {"fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "contests": contests}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    n = sum(len(c["problems"]) for c in contests)
    print(f"wrote {a.out}: {len(contests)} contests, {n} problems (latest: {contests[0]['contest']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
