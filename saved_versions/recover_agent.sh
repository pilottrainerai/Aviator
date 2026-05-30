#!/bin/zsh
set -euo pipefail

agent="${1:-}"
if [[ "$agent" != "copilot" && "$agent" != "claude" ]]; then
  echo "Usage: zsh ./saved_versions/recover_agent.sh [copilot|claude]"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

open -a "Visual Studio Code" .
zsh ./saved_versions/session_snapshot.sh --agent "$agent"

if lsof -ti tcp:3000 >/dev/null 2>&1; then
  echo "Dev server already running on http://localhost:3000"
  exit 0
fi

if lsof -ti tcp:3001 >/dev/null 2>&1; then
  echo "Port 3001 already running. Start manually if needed."
  exit 0
fi

if [[ -f package.json ]]; then
  if grep -q '"dev"' package.json; then
    echo "Starting local dev server..."
    npm run dev
    exit 0
  fi
fi

echo "No npm dev script found. Start your app manually."
