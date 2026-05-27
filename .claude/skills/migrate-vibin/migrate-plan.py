#!/usr/bin/env python3
"""Plan (and safely apply part of) a Vibin seed migration in a single run.

This is a committed, project-owned tool — not an ad-hoc script — so `/migrate-vibin`
can do all of its network access, diffing, and classification in ONE approved command
instead of improvising many `curl | python3 -c` calls (each of which needs approval).

What it does, end to end:
  1. Reads BASE from .vibin-version, fetches LATEST (head of dxlbnl/vibin main).
  2. Compares BASE..LATEST via the GitHub API to get the changed files.
  3. Classifies every changed file:
       - seed-meta (migrations/**, CHANGELOG.md, docs/**, root README.md) -> never
         written into the project; newly-added migrations are staged for the agent to
         read their content-aware steps.
       - child-machinery (.claude/**, CLAUDE.md, the two wiki template READMEs) ->
         compared against the seed at BASE:
           * unchanged locally (local == seed@BASE)  -> APPLIED here (safe, reversible).
           * customized locally (local != seed@BASE) -> staged for the agent to reconcile.
           * new file                                 -> APPLIED here.
       - project-content (everything else, incl. wiki/*.md and wiki/INDEX.md) -> left
         entirely to the agent's content-aware migration steps; never touched here.
  4. Stages what the agent still needs under .vibin-migrate/ so the agent needs NO
     further network calls: base/ + latest/ copies of customized files, and the new
     migration docs.
  5. Prints a plan. It does NOT write .vibin-version, and it does NOT commit — the
     agent does that after the content-aware steps and verification.

Public repo, so content is read from raw.githubusercontent.com (no API rate limit);
only the two api.github.com calls (commits/main, compare) hit the rate-limited API.
Set GITHUB_TOKEN to raise that limit if needed.
"""

import json
import os
import shutil
import sys
import urllib.error
import urllib.request

OWNER_REPO = "dxlbnl/vibin"
BRANCH = "main"
STAGING = ".vibin-migrate"

# Child-machinery that is safe to adopt wholesale when unchanged locally.
APPLY_PREFIXES = (".claude/",)
APPLY_EXACT = {"CLAUDE.md", "wiki/specs/README.md", "wiki/backlog/README.md"}

# Seed-meta: documents Vibin's own evolution, never written into a project.
def is_seed_meta(path):
    return (
        path.startswith("migrations/")
        or path.startswith("docs/")
        or path == "CHANGELOG.md"
        or path == "README.md"
    )


def is_child_machinery(path):
    return path in APPLY_EXACT or any(path.startswith(p) for p in APPLY_PREFIXES)


def _request(url, accept="application/vnd.github+json"):
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "vibin-migrate-plan")
    req.add_header("Accept", accept)
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    return urllib.request.urlopen(req, timeout=30)


def api_json(path):
    with _request(f"https://api.github.com{path}") as resp:
        return json.load(resp)


def raw_text(sha, path):
    """Return file text at a commit, or None if it does not exist there."""
    url = f"https://raw.githubusercontent.com/{OWNER_REPO}/{sha}/{path}"
    try:
        with _request(url, accept="text/plain") as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def safe_join(root, rel):
    dest = os.path.normpath(os.path.join(root, rel))
    if os.path.relpath(dest, root).startswith(".."):
        raise ValueError(f"unsafe path escapes {root!r}: {rel!r}")
    return dest


def write_file(root, rel, text):
    dest = safe_join(root, rel)
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(text)
    return dest


def read_local(rel):
    try:
        with open(rel, encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return None


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--clean":
        if os.path.isdir(STAGING):
            shutil.rmtree(STAGING)
            print(f"Removed {STAGING}/.")
        else:
            print(f"{STAGING}/ not present.")
        return 0

    base = sys.argv[1] if len(sys.argv) > 1 else (read_local(".vibin-version") or "").strip()
    if not base:
        print(
            "ERROR: no BASE. .vibin-version is missing/empty and none was passed as an "
            "argument. Ask the user for the Vibin commit this project was cloned from, "
            "then re-run: python3 .claude/skills/migrate-vibin/migrate-plan.py <BASE_HASH>",
            file=sys.stderr,
        )
        return 2

    try:
        latest = api_json(f"/repos/{OWNER_REPO}/commits/{BRANCH}")["sha"]
    except urllib.error.HTTPError as e:
        hint = " (rate-limited? set GITHUB_TOKEN)" if e.code in (403, 429) else ""
        print(f"ERROR: could not fetch LATEST head ({e}){hint}.", file=sys.stderr)
        return 1

    if base == latest:
        print(f"UP TO DATE — BASE == LATEST == {latest[:10]}. Nothing to migrate.")
        return 0

    try:
        compare = api_json(f"/repos/{OWNER_REPO}/compare/{base}...{latest}")
    except urllib.error.HTTPError as e:
        hint = " (rate-limited? set GITHUB_TOKEN)" if e.code in (403, 429) else ""
        print(f"ERROR: could not fetch the BASE...LATEST compare ({e}){hint}.", file=sys.stderr)
        return 1
    files = compare.get("files", [])

    # Fresh staging dir each run.
    if os.path.isdir(STAGING):
        shutil.rmtree(STAGING)

    applied, reconcile, new_migrations, project_content, seed_meta_skipped, notes = (
        [], [], [], [], [], [],
    )

    for entry in files:
        path = entry["filename"]
        status = entry["status"]  # added | modified | removed | renamed

        if is_seed_meta(path):
            if path.startswith("migrations/") and status in ("added", "renamed"):
                text = raw_text(latest, path)
                if text is not None:
                    write_file(STAGING, os.path.join("migrations", os.path.basename(path)), text)
                    new_migrations.append(path)
            else:
                seed_meta_skipped.append(path)
            continue

        if not is_child_machinery(path):
            project_content.append((path, status))
            continue

        # Child-machinery: decide apply vs reconcile.
        if status == "removed":
            notes.append(f"{path}: removed upstream — review by hand (not auto-removed).")
            continue

        latest_text = raw_text(latest, path)
        if latest_text is None:
            notes.append(f"{path}: could not fetch LATEST content — skipped.")
            continue

        local_text = read_local(path)
        base_text = raw_text(base, path)

        if local_text is None:
            write_file(".", path, latest_text)
            applied.append(f"{path} (new)")
        elif base_text is not None and local_text == base_text:
            write_file(".", path, latest_text)
            applied.append(path)
        else:
            write_file(STAGING, os.path.join("latest", path), latest_text)
            if base_text is not None:
                write_file(STAGING, os.path.join("base", path), base_text)
            reconcile.append(path)

    # ---- Report ----
    print(f"BASE   {base[:10]}")
    print(f"LATEST {latest[:10]}")
    print(f"After applying, write {latest} to .vibin-version.\n")

    print(f"APPLIED (unchanged locally, adopted from LATEST) — {len(applied)}:")
    for p in applied:
        print(f"  + {p}")

    print(f"\nRECONCILE BY HAND (customized locally) — {len(reconcile)}:")
    for p in reconcile:
        print(f"  ~ {p}")
        print(f"      base:   {STAGING}/base/{p}")
        print(f"      latest: {STAGING}/latest/{p}")
        print(f"      local:  {p}")

    print(f"\nNEW MIGRATIONS TO APPLY (content-aware steps — staged, not copied in) — {len(new_migrations)}:")
    for p in new_migrations:
        print(f"  > {p}  ->  {STAGING}/migrations/{os.path.basename(p)}")

    print(f"\nPROJECT CONTENT changed upstream (do NOT auto-apply; follow the migration "
          f"steps for your own wiki) — {len(project_content)}:")
    for p, status in project_content:
        print(f"  . {p} ({status})")

    if seed_meta_skipped:
        print(f"\nSEED-META ignored (never written into a project) — {len(seed_meta_skipped)}:")
        for p in seed_meta_skipped:
            print(f"  x {p}")

    if notes:
        print("\nNOTES:")
        for n in notes:
            print(f"  ! {n}")

    print("\nNEXT: read each staged migration's content-aware steps and apply them to "
          "your wiki; reconcile the customized files using the staged base/latest; then "
          f"write {latest} to .vibin-version, commit, and run this script with --clean to "
          f"remove {STAGING}/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
