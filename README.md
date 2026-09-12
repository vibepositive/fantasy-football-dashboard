# Mettlers Dynasty Command Center

A read-only GitHub Pages dashboard for Sleeper league `1312504205092610048`, built around **Boomtown Splash Hogs** (`chrisgervais`).

## Live dashboard

The dashboard is published with GitHub Pages from the `main` branch and provides three primary views:

- **Rosters** - league-wide rosters, weekly projections, records, and team selection.
- **Waiver Wire** - unrostered QB/RB/WR/TE players with projections, injury/status information, position filters, search, and Sleeper-wide trending adds.
- **Trade Market** - roster-fit trade targets based on Boomtown's lineup, positional needs, league depth, and player tradeability heuristics.

Analysis actions can generate/copy prompts for ChatGPT using the public `snapshot.json` as the league-data source.

## Data refresh

`.github/workflows/update-sleeper.yml` runs the snapshot generator and commits an updated `snapshot.json` automatically. The generator pulls public Sleeper league/player data plus weekly projection data.

`snapshot.json` is generated data. Avoid manually editing it during feature work; let the workflow regenerate it.

## Project structure

- `index.html` - dashboard markup
- `styles.css` - dashboard styling
- `app.js` - client-side rendering, filtering, navigation, trade logic, and prompt generation
- `scripts/generate-snapshot.js` - Sleeper snapshot generator
- `snapshot.json` - generated league snapshot consumed by the dashboard
- `.github/workflows/update-sleeper.yml` - automated snapshot refresh workflow

## Local development

```powershell
cd C:\Users\chris\Desktop\Projects\fantasy-football-dashboard
npx.cmd serve .
```

Open the local URL printed by `serve`, then hard refresh after code changes when needed.

Before starting new work, sync your local `main` branch:

```powershell
git checkout main
git pull --rebase origin main
```

For feature or cleanup work, use a dedicated branch and merge through a pull request after testing.

## Repository hygiene

- Do not commit `node_modules`, local caches, temporary files, or editor settings.
- Do not commit local backup files created while editing.
- Keep generated `snapshot.json` changes separate from feature changes whenever practical.
- Prefer focused pull requests so functional fixes and code cleanup can be reviewed independently.

## Security

No Sleeper password or API key is required. The project is read-only and uses public Sleeper data. GitHub Pages is public, so the generated league snapshot is public as well. Do not add secrets, tokens, passwords, or private credentials to this repository.
