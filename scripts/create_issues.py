#!/usr/bin/env python3
"""Create labels, milestones and backlog issues on GitHub from scripts/backlog.json.

Usage: GITHUB_REPO=owner/name python3 scripts/create_issues.py
Uses curl. Set GH_TOKEN for auth if your environment doesn't provide it.
Issues are created in order, so issue #N is ticket TNN on an empty repo.
"""
import json, os, subprocess, sys, time, pathlib

REPO = os.environ.get("GITHUB_REPO", "n1m5l5ss/lernlab")
API = f"https://api.github.com/repos/{REPO}"
TOKEN = os.environ.get("GH_TOKEN_REAL")

def call(method, path, body=None):
    cmd = ["curl", "-sS", "-X", method, API + path,
           "-H", "Accept: application/vnd.github+json",
           "-H", "Content-Type: application/json"]
    if TOKEN:
        cmd += ["-H", f"Authorization: Bearer {TOKEN}"]
    if body is not None:
        cmd += ["--data-binary", "@-"]
    out = subprocess.run(cmd, input=json.dumps(body) if body is not None else None,
                         capture_output=True, text=True).stdout
    try:
        return json.loads(out) if out.strip() else {}
    except json.JSONDecodeError:
        return {"raw": out}

LABELS = {
    "epic": ("5319e7", "A group of related tickets"),
    "feature": ("1d76db", "New functionality"),
    "bug": ("d73a4a", "Something isn't working"),
    "design": ("f9a8d4", "Mockups, visual style, UX"),
    "foundation": ("0e8a16", "Repo structure, engine, CI"),
    "release": ("fbca04", "Installers, signing, updates"),
    "security": ("b60205", "Security-sensitive work"),
    "i18n": ("c5def5", "Translation and languages"),
    "a11y": ("bfd4f2", "Accessibility"),
    "docs": ("0075ca", "Documentation"),
    "deck": ("d4c5f9", "Shared decks"),
    "good first issue": ("7057ff", "Good for newcomers"),
    "help wanted": ("008672", "Extra attention is needed"),
    "size: S": ("ededed", "Under half a day"),
    "size: M": ("cccccc", "About a day"),
    "size: L": ("999999", "Several days"),
}
MILESTONES = {"1.0": "First public release", "1.x": "Subject features after 1.0", "2.0": "Sync and phone app"}

def main():
    tickets = json.loads(pathlib.Path(__file__).with_name("backlog.json").read_text())
    epics = sorted({t["epic"] for t in tickets}, key=lambda e: int(e.split()[0][1:]))
    for e in epics:
        LABELS[f"epic: {e.split(' ', 1)[1]}"] = ("e4e669", e)

    existing = {l["name"] for l in call("GET", "/labels?per_page=100") if isinstance(l, dict)}
    for name, (color, desc) in LABELS.items():
        if name not in existing:
            call("POST", "/labels", {"name": name, "color": color, "description": desc})
    print("labels ok")

    ms = {m["title"]: m["number"] for m in call("GET", "/milestones?state=all") if isinstance(m, dict)}
    for title, desc in MILESTONES.items():
        if title not in ms:
            ms[title] = call("POST", "/milestones", {"title": title, "description": desc})["number"]
    print("milestones ok", ms)

    have = {i["title"] for i in call("GET", "/issues?state=all&per_page=100") if isinstance(i, dict)}
    for t in tickets:
        if t["title"] in have:
            print("skip", t["id"]); continue
        body = (f"**Goal:** {t['goal']}\n\n### Done when\n" +
                "\n".join(f"- [ ] {d}" for d in t["done"]) +
                ("\n\n### Notes\n" + t["notes"] if t["notes"] else "") +
                f"\n\n---\n**Ticket:** {t['id']} · **Epic:** {t['epic']} · **Release:** {t['release']} · **Size:** {t['size']}\n"
                "Read `CLAUDE.md` and `docs/PLAN.md` before starting.")
        labels = t["labels"] + [f"size: {t['size']}", f"epic: {t['epic'].split(' ', 1)[1]}"]
        r = call("POST", "/issues", {"title": t["title"], "body": body,
                                     "labels": labels, "milestone": ms[t["release"]]})
        print(t["id"], "→", r.get("number"), r.get("message", ""))
        if not r.get("number"):
            sys.exit(1)
        time.sleep(1.2)  # stay under GitHub's content-creation rate limit

if __name__ == "__main__":
    main()
