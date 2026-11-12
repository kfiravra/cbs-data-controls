#!/usr/bin/env python3
"""Prints one line per control whose name carries no test tag, over every page of the list.

  python3 dev/active/dc-delivery/tools/untagged.py [base url]

The gate specs touch only controls they create and tag; two of these listings, before and after a gate run,
must be equal. The last run's id is left out on purpose only when asked: a gate spec never runs an example.
"""
import json
import re
import sys
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"
tag = re.compile(r" e2e-[0-9a-z]{6}")
page, rows, total = 1, [], None
while total is None or (page - 1) * 200 < total:
    with urllib.request.urlopen(f"{base}/api/v1/controls?active=all&page={page}&pageSize=200") as response:
        body = json.load(response)
    total = body["total"]
    rows += [item for item in body["items"] if not tag.search(item["name"])]
    page += 1
for item in sorted(rows, key=lambda item: item["id"]):
    last = item["lastRun"]["id"] if item["lastRun"] else None
    print(json.dumps([item["id"], item["name"], item["version"], item["isActive"], last], ensure_ascii=False))
