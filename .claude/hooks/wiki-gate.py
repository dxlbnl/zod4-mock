#!/usr/bin/env python3
"""Vibin wiki gate.

Every actor (top-level session and each subagent) must read the wiki before it writes
files in the project, runs non-trivial Bash, or spawns agents.

PreToolUse:
  - Read of a file under wiki/  -> refresh this actor's marker, allow.
  - Write/Edit/NotebookEdit of a file INSIDE the project  -> require fresh marker.
    (Writes outside the project — e.g. /root/.claude/plans/* — pass through.)
  - Bash  -> require fresh marker, unless the command is a safe read-only invocation
    (ls, pwd, cat, head, tail, grep, find, rg, wc, git status/log/diff/show/branch).
  - Task/Agent -> require fresh marker.
PostToolUse:
  - Write/Edit/NotebookEdit targeting a file under wiki/ -> refresh the marker (this
    actor just changed the wiki, so it is in sync with its own change).

Marker = .claude/state/wiki-read/<session_id>__<agent_id|main>, content is a unix
timestamp. A marker is "fresh" if its timestamp is at least the newest mtime in wiki/.
"""
import json
import os
import shlex
import sys
import time

WRITE_TOOLS = {"Write", "Edit", "NotebookEdit"}
SPAWN_TOOLS = {"Task", "Agent"}

# Read-only Bash allowlist. Single-binary commands; for `git` we further check the
# sub-command. Anything not on this list falls through to the gate.
READ_ONLY_BINS = {"ls", "pwd", "cat", "head", "tail", "grep", "find", "rg", "wc", "echo"}
READ_ONLY_GIT_SUBCOMMANDS = {"status", "log", "diff", "show", "branch", "rev-parse"}

# Shell features that make a static safety check unreliable. If a Bash command contains
# any of these, treat it as non-safe and fall through to the marker check. The bypass is
# only for simple single-command invocations like `ls -la` or `git status`.
UNSAFE_SHELL_FEATURES = (
    "&&", "||", "|", ";", "\n", "$(", "`", ">", "<", "&", "*", "?", "~",
)


def project_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def tool_target(tool_name, tool_input):
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


def marker_status(path, wiki_dir):
    """Returns 'fresh', 'stale', or 'missing'."""
    if not os.path.exists(path):
        return "missing"
    try:
        with open(path) as fh:
            marked = float(fh.read().strip())
    except (OSError, ValueError):
        return "missing"
    if marked >= newest_wiki_mtime(wiki_dir):
        return "fresh"
    return "stale"


def is_safe_bash(command):
    """True iff `command` is a single simple read-only invocation.

    Conservative on purpose: any chain operator, pipe, redirect, substitution, or glob
    falls through to the marker check. Once the actor has read the wiki, those work too;
    the bypass is just so a fresh-session `ls` or `git status` doesn't need a wiki read.
    """
    if not isinstance(command, str) or not command.strip():
        return False
    if any(f in command for f in UNSAFE_SHELL_FEATURES):
        return False
    try:
        tokens = shlex.split(command, posix=True)
    except ValueError:
        return False
    # Strip leading env-var assignments (FOO=bar BIN ...).
    i = 0
    while i < len(tokens) and "=" in tokens[i] and not tokens[i].startswith("="):
        i += 1
    if i >= len(tokens):
        return False
    bin_ = os.path.basename(tokens[i])
    if bin_ in READ_ONLY_BINS:
        return True
    if bin_ == "git" and i + 1 < len(tokens) and tokens[i + 1] in READ_ONLY_GIT_SUBCOMMANDS:
        return True
    return False


NEVER_READ_MSG = (
    "BLOCKED by Vibin wiki gate: read wiki/INDEX.md first — it's the single source "
    "of truth and the spec. The wiki tells you what the project is and what to "
    "build. Read it, then retry your action.\n"
)

STALE_MSG = (
    "BLOCKED by Vibin wiki gate: the wiki changed since you last read it. Re-read "
    "wiki/INDEX.md (and any pages you edited or that are relevant to your action), "
    "then retry.\n"
)


def block(reason):
    sys.stderr.write(reason)
    sys.exit(2)


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
    target_abs = None
    if target:
        target_abs = target if os.path.isabs(target) else os.path.join(proj, target)
    target_in_wiki = bool(target_abs) and is_under(target_abs, wiki_dir)
    target_in_project = bool(target_abs) and is_under(target_abs, proj)

    if event == "PostToolUse":
        if tool_name in WRITE_TOOLS and target_in_wiki:
            refresh_marker(marker)
        sys.exit(0)

    # PreToolUse
    if tool_name == "Read":
        if target_in_wiki:
            refresh_marker(marker)
        sys.exit(0)

    if tool_name in WRITE_TOOLS:
        # Only gate writes inside the project. Out-of-project writes (plan files,
        # /tmp scratch, $HOME configs) pass through.
        if not target_in_project:
            sys.exit(0)
        status = marker_status(marker, wiki_dir)
        if status == "fresh":
            sys.exit(0)
        block(STALE_MSG if status == "stale" else NEVER_READ_MSG)

    if tool_name == "Bash":
        if is_safe_bash(tool_input.get("command", "")):
            sys.exit(0)
        status = marker_status(marker, wiki_dir)
        if status == "fresh":
            sys.exit(0)
        block(STALE_MSG if status == "stale" else NEVER_READ_MSG)

    if tool_name in SPAWN_TOOLS:
        status = marker_status(marker, wiki_dir)
        if status == "fresh":
            sys.exit(0)
        block(STALE_MSG if status == "stale" else NEVER_READ_MSG)

    sys.exit(0)


if __name__ == "__main__":
    main()
