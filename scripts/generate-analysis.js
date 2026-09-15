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

const eligible = (snapshot.free_agents || []).filter(p => ['QB','RB','WR','TE'].includes(p.position));
const byValue = [...eligible].sort((a,b) => (b.dynasty_value_1qb || 0) - (a.dynasty_value_1qb || 0));
const byProjection = [...eligible].sort((a,b) => (b.projection || b.projected_points || 0) - (a.projection || a.projected_points || 0));
const byAdds = [...eligible].sort((a,b) => (b.trending_adds || 0) - (a.trending_adds || 0));

const selected = new Map();
for (const group of [byValue.slice(0,35), byProjection.slice(0,35), byAdds.slice(0,35)]) {
  for (const p of group) selected.set(String(p.player_id), p);
}
const freeAgents = [...selected.values()].map(keepPlayer);

const leagueInfo = snapshot.league ? {
  id: snapshot.league.league_id,
  name: snapshot.league.name,
  season: snapshot.league.season,
  scoring: snapshot.league.scoring_settings,
  roster_positions: snapshot.league.roster_positions
} : null;

const analysis = {
  generated_at: snapshot.generated_at || new Date().toISOString(),
  league: leagueInfo,
  current_week: snapshot.current_week,
  my_team: snapshot.my_team ? keepTeam(snapshot.my_team) : null,
  free_agents: freeAgents,
  market_date: snapshot.dynasty_market?.scrape_date || null
};

const shortlist = {
  generated_at: analysis.generated_at,
  league: { name: leagueInfo?.name, season: leagueInfo?.season, format: '1QB', rec: leagueInfo?.scoring?.rec, roster_positions: leagueInfo?.roster_positions },
  my_roster: (snapshot.my_team?.players || []).map(keepPlayer),
  top_dynasty_available: byValue.slice(0,15).map(keepPlayer),
  top_projected_available: byProjection.slice(0,15).map(keepPlayer),
  most_added_available: byAdds.slice(0,15).map(keepPlayer)
};

fs.writeFileSync('analysis.json', JSON.stringify(analysis, null, 2));
fs.writeFileSync('waiver-shortlist.json', JSON.stringify(shortlist, null, 2));
console.log(`Compact analysis snapshot: ${freeAgents.length} waiver candidates`);
