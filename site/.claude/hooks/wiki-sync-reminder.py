#!/usr/bin/env python3
"""Vibin PostToolUse hook.

After product code is written or edited, nudges to keep the wiki in sync. A hook only
sees the file path — it cannot judge "significant behaviour change" — so it reminds
rather than auto-running anything. Non-blocking (always exit 0).
"""
import json
import os
import sys


def project_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_input = data.get("tool_input", {}) or {}
    path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not path:
        sys.exit(0)

    proj = project_dir(data)
    abspath = path if os.path.isabs(path) else os.path.join(proj, path)
    rel = os.path.relpath(abspath, proj)

    # Only nudge for product code — not the wiki itself, not Claude config.
    if rel.startswith("wiki" + os.sep) or rel == "wiki":
        sys.exit(0)
    if rel.startswith(".claude" + os.sep):
        sys.exit(0)

    reminder = (
        f"Product code changed ({rel}). The wiki is the single source of truth — if "
        f"this change makes behaviour diverge from the wiki, update the relevant "
        f"wiki/ page (or run /wiki-sync) so the spec stays accurate."
    )
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": reminder,
                }
            }
        )
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
