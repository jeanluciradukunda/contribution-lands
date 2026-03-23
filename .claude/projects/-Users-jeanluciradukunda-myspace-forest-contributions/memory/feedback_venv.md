---
name: Use venv for Python
description: Always create a virtual environment before installing Python packages
type: feedback
---

Always create a venv before installing Python packages — don't install into the global Python.

**Why:** User prefers isolated environments for project dependencies.
**How to apply:** Run `python3 -m venv .venv` first, then use `.venv/bin/pip` and `.venv/bin/pytest` for all commands.
