const fs = require('fs');

const snapshot = JSON.parse(fs.readFileSync('snapshot.json', 'utf8'));

const keepPlayer = p => p ? {
  player_id: p.player_id,
  full_name: p.full_name || p.name,
  position: p.position,
  team: p.team,
  age: p.age,
  years_exp: p.years_exp,
  injury_status: p.injury_status,
  injury_body_part: p.injury_body_part,
  practice_description: p.practice_description,
  depth_chart_position: p.depth_chart_position,
  depth_chart_order: p.depth_chart_order,
  opponent: p.opponent,
  projection: p.projection,
  projected_points: p.projected_points,
  trending_adds: p.trending_adds,
  dynasty_value_1qb: p.dynasty_value_1qb,
  dynasty_ecr_1qb: p.dynasty_ecr_1qb,
  dynasty_pos_ecr: p.dynasty_pos_ecr
} : null;

const keepTeam = t => ({
  roster_id: t.roster_id,
  owner_id: t.owner_id,
  owner_name: t.owner_name || t.display_name || t.username,
  team_name: t.team_name || t.name,
  players: (t.players || []).map(keepPlayer),
  starters: (t.starters || []).map(keepPlayer),
  reserve: (t.reserve || []).map(keepPlayer),
  taxi: (t.taxi || []).map(keepPlayer)
});

const analysis = {
  generated_at: snapshot.generated_at || new Date().toISOString(),
  league: snapshot.league ? {
    league_id: snapshot.league.league_id,
    name: snapshot.league.name,
    season: snapshot.league.season,
    total_rosters: snapshot.league.total_rosters,
    scoring_settings: snapshot.league.scoring_settings,
    roster_positions: snapshot.league.roster_positions
  } : null,
  current_week: snapshot.current_week,
  my_team: snapshot.my_team ? keepTeam(snapshot.my_team) : null,
  teams: (snapshot.teams || []).map(keepTeam),
  free_agents: (snapshot.free_agents || []).map(keepPlayer),
  dynasty_market: snapshot.dynasty_market || null
};

fs.writeFileSync('analysis.json', JSON.stringify(analysis, null, 2));
console.log(`Analysis snapshot: ${analysis.free_agents.length} free agents, ${analysis.teams.length} teams`);
