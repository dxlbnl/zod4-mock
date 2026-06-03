#!/usr/bin/env python3
"""Vibin wiki gate.

Hard enforcement that every actor (the top-level session and each subagent) reads the
wiki before it writes files, runs Bash, or spawns agents.

PreToolUse:
  - Read of a file under wiki/  -> refresh this actor's marker, allow.
  - Write/Edit/NotebookEdit/Bash/Task/Agent -> allow only if the marker exists and is at
    least as new as the newest file under wiki/ (a stale marker means the wiki changed
    since this actor last read it). Otherwise block with exit code 2.
PostToolUse:
  - Write/Edit/NotebookEdit targeting a file under wiki/ -> refresh the marker (this
    actor just changed the wiki, so it is in sync with that change).

Marker = .claude/state/wiki-read/<session_id>__<agent_id|main>, content is a unix
timestamp. session_id is shared by parent + subagents, so agent_id keeps it per-actor.
"""
import json
import os
import sys
import time

BLOCKING_TOOLS = {"Write", "Edit", "NotebookEdit", "Bash", "Task", "Agent"}
WRITE_TOOLS = {"Write", "Edit", "NotebookEdit"}


def project_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def tool_target(tool_name, tool_input):
    """Absolute-ish path the tool acts on, or None."""
    if tool_name == "NotebookEdit":
        return tool_input.get("notebook_path")
    if tool_name in ("Read", "Write", "Edit"):
        return tool_input.get("file_path")
    return None


def is_under(path, root):
    try:
        path = os.path.realpath(path)
        root = os.path.realpath(root)
        return os.path.commonpath([path, root]) == root
    except (ValueError, OSError):
        return False


def newest_wiki_mtime(wiki_dir):
    newest = 0.0
    for base, _dirs, files in os.walk(wiki_dir):
        for name in files:
            try:
                m = os.path.getmtime(os.path.join(base, name))
                if m > newest:
                    newest = m
            except OSError:
                pass
    return newest


def marker_path(proj, data):
    actor = data.get("agent_id") or "main"
    session = data.get("session_id") or "nosession"
    state = os.path.join(proj, ".claude", "state", "wiki-read")
    return os.path.join(state, f"{session}__{actor}")


def refresh_marker(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(str(time.time()))


def marker_fresh(path, wiki_dir):
    if not os.path.exists(path):
        return False
    try:
        with open(path) as fh:
            marked = float(fh.read().strip())
    except (OSError, ValueError):
        return False
    return marked >= newest_wiki_mtime(wiki_dir)


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)  # never break the session on a malformed payload

    proj = project_dir(data)
    wiki_dir = os.path.join(proj, "wiki")
    if not os.path.isdir(wiki_dir):
        sys.exit(0)  # no wiki yet -> nothing to enforce

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    event = data.get("hook_event_name", "PreToolUse")
    marker = marker_path(proj, data)
    target = tool_target(tool_name, tool_input)
    target_in_wiki = bool(target) and is_under(
        os.path.join(proj, target) if not os.path.isabs(target) else target, wiki_dir
    )

    if event == "PostToolUse":
        if tool_name in WRITE_TOOLS and target_in_wiki:
            refresh_marker(marker)
        sys.exit(0)

    # PreToolUse
    if tool_name == "Read":
        if target_in_wiki:
            refresh_marker(marker)
        sys.exit(0)

    if tool_name in BLOCKING_TOOLS:
        if marker_fresh(marker, wiki_dir):
            sys.exit(0)
        sys.stderr.write(
            "BLOCKED by Vibin wiki gate: read wiki/INDEX.md (the single source of "
            "truth and the spec) before writing files, running Bash, or launching "
            "agents. If you have read it already, the wiki changed since — read the "
            "relevant wiki pages again, then retry.\n"
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
