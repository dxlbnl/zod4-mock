#!/usr/bin/env python3
"""Vibin SessionStart hook.

Injects the wiki entry point into context for every session — including subagents,
since SessionStart fires for them too. Keeps output small (INDEX.md is intentionally
short) to avoid context bloat.
"""
import os
import sys


def project_dir():
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def main():
    proj = project_dir()
    wiki_dir = os.path.join(proj, "wiki")
    index = os.path.join(wiki_dir, "INDEX.md")

    out = ["# Vibin — wiki is the single source of truth"]

    if os.path.isfile(index):
        with open(index) as fh:
            out.append("## wiki/INDEX.md\n")
            out.append(fh.read().rstrip())
    else:
        out.append(
            "No wiki/INDEX.md yet. Run /bootstrap to interview the user and populate "
            "the wiki before any build work."
        )

    if os.path.isdir(wiki_dir):
        pages = []
        for base, _dirs, files in os.walk(wiki_dir):
            for name in sorted(files):
                if name.endswith(".md"):
                    rel = os.path.relpath(os.path.join(base, name), proj)
                    pages.append(rel)
        if pages:
            out.append("\n## Wiki pages on disk\n")
            out.extend(f"- {p}" for p in sorted(pages))

    out.append(
        "\n---\nReminder: read wiki/INDEX.md before writing files, running Bash, or "
        "launching agents — the wiki-gate hook enforces this. Build work goes through "
        "the manager pipeline (spec -> tests-first -> implementation -> review)."
    )

    sys.stdout.write("\n".join(out) + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
