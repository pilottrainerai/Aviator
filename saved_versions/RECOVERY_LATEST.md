# Recovery commands for this project

## VS Code Copilot
```
cd "$HOME/Desktop/Aviator" && npm run recover:copilot
```

## Claude
```
cd "$HOME/Desktop/Aviator" && npm run recover:claude
```

## Snapshot only (no app start)
```
npm run snapshot:copilot
npm run snapshot:claude
```

## Latest context files
- `saved_versions/LATEST_COPILOT_CONTEXT.txt`
- `saved_versions/LATEST_CLAUDE_CONTEXT.txt`

## Timestamped snapshots
All snapshots are also saved in `.handoff/` with a timestamp prefix.
