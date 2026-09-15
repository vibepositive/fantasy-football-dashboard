const fs = require('fs');

const snapshot = JSON.parse(fs.readFileSync('snapshot.json', 'utf8'));

const keepPlayer = p => p ? {
  id: p.player_id,
  name: p.full_name || p.name,
  pos: p.position,
  nfl: p.team,
  age: p.age,
  injury: p.injury_status,
  injury_part: p.injury_body_part,
  depth: p.depth_chart_order,
  proj: p.projection ?? p.projected_points ?? null,
  adds: p.trending_adds || 0,
  value: p.dynasty_value_1qb ?? null,
  ecr: p.dynasty_ecr_1qb ?? null
} : null;

const keepTeam = t => ({
  roster_id: t.roster_id,
  owner: t.owner_name || t.display_name || t.username,
  name: t.team_name || t.name,
  players: (t.players || []).map(keepPlayer),
  starters: (t.starters || []).map(keepPlayer),
  reserve: (t.reserve || []).map(keepPlayer),
  taxi: (t.taxi || []).map(keepPlayer)
});

const eligible = (snapshot.free_agents || [])
  .filter(p => ['QB','RB','WR','TE'].includes(p.position));

// Keep a compact union of the most useful waiver candidates so this file stays
// easy to retrieve remotely without changing the existing hourly run cadence.
const selected = new Map();
const addTop = (fn, n = 30) => [...eligible].sort(fn).slice(0, n).forEach(p => selected.set(String(p.player_id), p));
addTop((a,b) => (b.dynasty_value_1qb || 0) - (a.dynasty_value_1qb || 0), 35);
addTop((a,b) => (b.projection || b.projected_points || 0) - (a.projection || a.projected_points || 0), 35);
addTop((a,b) => (b.trending_adds || 0) - (a.trending_adds || 0), 35);

const freeAgents = [...selected.values()]
  .sort((a,b) => Math.max(b.dynasty_value_1qb || 0, (b.trending_adds || 0) / 100) - Math.max(a.dynasty_value_1qb || 0, (a.trending_adds || 0) / 100))
  .map(keepPlayer);

const analysis = {
  generated_at: snapshot.generated_at || new Date().toISOString(),
  league: snapshot.league ? {
    id: snapshot.league.league_id,
    name: snapshot.league.name,
    season: snapshot.league.season,
    scoring: snapshot.league.scoring_settings,
    roster_positions: snapshot.league.roster_positions
  } : null,
  current_week: snapshot.current_week,
  my_team: snapshot.my_team ? keepTeam(snapshot.my_team) : null,
  free_agents: freeAgents,
  market_date: snapshot.dynasty_market?.scrape_date || null
};

fs.writeFileSync('analysis.json', JSON.stringify(analysis, null, 2));
console.log(`Compact analysis snapshot: ${freeAgents.length} waiver candidates`);
