"""Stamp the page's publish time into hosted/index.html (run right before publishing).
   python3 hosted/stamp.py [path]"""
import datetime, re, sys
path = sys.argv[1] if len(sys.argv) > 1 else "hosted/index.html"
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
s = open(path).read()
s, n = re.subn(r'<meta name="forge:published" content="[^"]*">', f'<meta name="forge:published" content="{now}">', s)
assert n == 1, "publish stamp not found"
open(path, "w").write(s)
print("stamped", now)
