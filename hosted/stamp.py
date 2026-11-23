"""Stamp the page's publish time and the last GitHub push into the page's <meta> tags.

Run it AFTER `git push`, right before publishing, writing to the copy you publish:

    python3 hosted/stamp.py --out <publish copy>          # recommended: repo file stays untouched
    python3 hosted/stamp.py [path]                          # older form: stamps hosted/index.html in place

Tags it fills (added to <head> if missing):
    forge:published  now, UTC
    forge:pushed     commit time of the remote branch head (the last push)
    forge:commit     that commit's SHA
    forge:repo       https://github.com/<owner>/<repo>
"""
import argparse, datetime, re, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument("path", nargs="?", default="hosted/index.html", help="page to read (default hosted/index.html)")
ap.add_argument("--out", help="write the stamped page here instead of overwriting the source")
ap.add_argument("--remote", default="origin")
ap.add_argument("--branch", help="branch whose last push to show (default: current branch)")
ap.add_argument("--prefix", default="forge", help="meta name prefix (default forge)")
a = ap.parse_args()

def git(*args):
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return ""

now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
branch = a.branch or git("rev-parse", "--abbrev-ref", "HEAD")
ref = f"{a.remote}/{branch}"
pushed_iso = git("log", "-1", "--format=%cI", ref)
pushed = datetime.datetime.fromisoformat(pushed_iso).astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if pushed_iso else ""
sha = git("rev-parse", ref)
url = git("remote", "get-url", a.remote)
m = re.search(r"github\.com[:/]+([^/]+)/([^/.]+)", url)
repo = f"https://github.com/{m.group(1)}/{m.group(2)}" if m else ""
if git("rev-parse", "HEAD") and sha and git("rev-parse", "HEAD") != sha:
    print(f"note: local HEAD isn't pushed to {ref} yet; showing the last pushed commit", file=sys.stderr)

s = open(a.path, encoding="utf-8").read()
for key, val in (("published", now), ("pushed", pushed), ("commit", sha), ("repo", repo)):
    tag = f'<meta name="{a.prefix}:{key}" content="{val}">'
    s, n = re.subn(rf'<meta name="{re.escape(a.prefix)}:{key}" content="[^"]*">', tag, s)
    if not n:   # add the tag: after <meta charset>, else after <head>, else at the very top
        s, n = re.subn(r"(<meta charset[^>]*>)", lambda mm: mm.group(1) + "\n" + tag, s, count=1)
        if not n: s, n = re.subn(r"(<head[^>]*>)", lambda mm: mm.group(1) + "\n" + tag, s, count=1, flags=re.I)
        if not n: s = tag + "\n" + s
open(a.out or a.path, "w", encoding="utf-8").write(s)
print(f"stamped published {now}; pushed {pushed or '(no remote branch found)'} {sha[:7]}")
