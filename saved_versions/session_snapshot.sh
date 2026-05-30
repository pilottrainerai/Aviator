#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

agent="claude"
if [[ "${1:-}" == "--agent" && -n "${2:-}" ]]; then
  agent="$2"
fi
agent_upper="${(U)agent}"

mkdir -p .handoff saved_versions
ts="$(date +%Y%m%d-%H%M%S)"
out=".handoff/${agent}-context-$ts.txt"
latest="saved_versions/LATEST_${agent_upper}_CONTEXT.txt"

{
  echo "=== PROJECT HANDOFF SNAPSHOT ==="
  echo "Agent: $agent"
  echo "Generated: $(date)"
  echo "Repo: $ROOT_DIR"
  echo

  echo "=== RECENT COMMITS ==="
  git log --oneline -10 || true
  echo

  echo "=== GIT OVERVIEW ==="
  git remote -v || true
  echo
  git branch --show-current || true
  echo
  git status --short --branch || true
  echo

  echo "=== CHANGED FILES (STAT) ==="
  git diff --stat || true
  echo

  echo "=== FULL DIFF ==="
  git diff || true
  echo

  echo "=== TOP FILES ==="
  find src .github -type f 2>/dev/null | head -n 120 || true
  echo

  echo "=== MEMORY INDEX ==="
  MEMORY_DIR="$HOME/.claude/projects/-Users-rohitsharma/memory"
  if [[ -f "$MEMORY_DIR/MEMORY.md" ]]; then
    cat "$MEMORY_DIR/MEMORY.md"
  else
    echo "(no memory index found at $MEMORY_DIR/MEMORY.md)"
  fi
  echo

  echo "=== CLAUDE.md ==="
  [[ -f "$ROOT_DIR/CLAUDE.md" ]] && cat "$ROOT_DIR/CLAUDE.md" || echo "(none)"
  echo
} > "$out"

cp "$out" "$latest"
echo "Saved: $out"
echo "Updated latest: $latest"
if command -v pbcopy >/dev/null 2>&1; then
  pbcopy < "$latest"
  echo "Copied latest context to clipboard"
fi
