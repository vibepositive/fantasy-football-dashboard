const fs = require('fs');

const LEAGUE_ID = process.env.LEAGUE_ID || '1312504205092610048';
const USERNAME = process.env.SLEEPER_USERNAME || 'chrisgervais';
const BASE = 'https://api.sleeper.app/v1';

async function s(path) {
  const r = await fetch(BASE + path, {
    headers: {'user-agent': 'mettlers-dynasty-dashboard/1.0'}
  });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function ps(id, db, projectionMap, trendingMap = {}) {
  const p = db[id] || {};
  return {
    player_id: id,
    full_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || id,
    position: p.position || null,
    fantasy_positions: p.fantasy_positions || [],
    team: p.team || null,
    status: p.status || null,
    injury_status: p.injury_status || null,
    age: p.age || null,
    years_exp: p.years_exp ?? null,
    projection: projectionMap[id] ?? null,
    trending_adds: trendingMap[id] || 0
  };
}

(async () => {
  const [league, rosters, users, picks, state, drafts, players, trending] =
    await Promise.all([
      s(`/league/${LEAGUE_ID}`),
      s(`/league/${LEAGUE_ID}/rosters`),
      s(`/league/${LEAGUE_ID}/users`),
      s(`/league/${LEAGUE_ID}/traded_picks`),
      s('/state/nfl'),
      s(`/league/${LEAGUE_ID}/drafts`).catch(() => []),
      s('/players/nfl'),
      s('/players/nfl/trending/add?lookback_hours=24&limit=100').catch(() => [])
    ]);

  const week = Number(state.week || state.leg || 1);

  const projections = await fetch(
    `https://api.sleeper.com/projections/nfl/${league.season}/${week}?season_type=regular`
  ).then(r => r.json()).catch(() => []);

  const projectionMap = Object.fromEntries(
    projections
      .filter(x => x.company === 'rotowire')
      .map(x => [x.player_id, x.stats?.pts_half_ppr ?? null])
  );

  const trendingMap = Object.fromEntries(
    trending.map(x => [String(x.player_id), Number(x.count || 0)])
  );

  const ub = Object.fromEntries(users.map(u => [u.user_id, u]));

  const teams = rosters.map(r => {
    const u = ub[r.owner_id] || {};
    const starterIds = new Set(r.starters || []);
    const reserveIds = new Set(r.reserve || []);
    const taxiIds = new Set(r.taxi || []);

    return {
      roster_id: r.roster_id,
      owner_id: r.owner_id,
      username: u.username || null,
      display_name: u.display_name || null,
      avatar: u.avatar || null,
      avatar_url: u.avatar
        ? `https://sleepercdn.com/avatars/thumbs/${u.avatar}`
        : null,
      team_name:
        u.metadata?.team_name ||
        u.display_name ||
        u.username ||
        'Unknown Team',
      settings: r.settings || {},
      starters: (r.starters || []).map(id =>
        ps(id, players, projectionMap, trendingMap)
      ),
      reserve: (r.reserve || []).map(id =>
        ps(id, players, projectionMap, trendingMap)
      ),
      taxi: (r.taxi || []).map(id =>
        ps(id, players, projectionMap, trendingMap)
      ),
      players: (r.players || []).map(id => ({
        ...ps(id, players, projectionMap, trendingMap),
        starter: starterIds.has(id),
        reserve: reserveIds.has(id),
        taxi: taxiIds.has(id)
      }))
    };
  });

  const rosteredIds = new Set(
    rosters.flatMap(r => [
      ...(r.players || []),
      ...(r.reserve || []),
      ...(r.taxi || [])
    ]).map(String)
  );

  const fantasyPositions = new Set(['QB', 'RB', 'WR', 'TE']);

  const freeAgents = Object.entries(players)
    .filter(([id, p]) =>
      !rosteredIds.has(String(id)) &&
      fantasyPositions.has(p.position) &&
      p.active !== false &&
      p.status !== 'Inactive'
    )
    .map(([id]) => ps(id, players, projectionMap, trendingMap))
    .sort((a, b) =>
      (b.trending_adds || 0) - (a.trending_adds || 0) ||
      (b.projection ?? -999) - (a.projection ?? -999) ||
      (a.full_name || '').localeCompare(b.full_name || '')
    );

  const me = users.find(u =>
    [u.username, u.display_name]
      .some(v => String(v || '').toLowerCase() === USERNAME.toLowerCase())
  );

  const my = me
    ? teams.find(t => t.owner_id === me.user_id)
    : teams.find(t =>
        String(t.team_name || '').toLowerCase() ===
        'boomtown splash hogs'.toLowerCase()
      );

  const weeks = Array.from(
    {length: Math.max(1, week)},
    (_, i) => i + 1
  );

  const [matchups, tx] = await Promise.all([
    s(`/league/${LEAGUE_ID}/matchups/${week}`).catch(() => []),
    Promise.all(
      weeks.map(async w => ({
        week: w,
        transactions: await s(
          `/league/${LEAGUE_ID}/transactions/${w}`
        ).catch(() => [])
      }))
    )
  ]);

  const out = {
    generated_at: new Date().toISOString(),
    league: {
      league_id: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
      total_rosters: league.total_rosters,
      roster_positions: league.roster_positions,
      settings: league.settings,
      scoring_settings: league.scoring_settings,
      metadata: league.metadata || null
    },
    nfl_state: state,
    my_team: my,
    teams,
    free_agents: freeAgents,
    traded_picks: picks,
    current_week: week,
    current_matchups: matchups,
    recent_transactions: tx,
    drafts: drafts.map(d => ({
      draft_id: d.draft_id,
      season: d.season,
      status: d.status,
      type: d.type,
      settings: d.settings,
      metadata: d.metadata || null,
      start_time: d.start_time
    }))
  };

  fs.writeFileSync(
    'snapshot.json',
    JSON.stringify(out, null, 2)
  );

  console.log(`Generated snapshot for ${league.name}: ${teams.length} teams`);
  console.log(`Unrostered QB/RB/WR/TE: ${freeAgents.length}`);
  console.log(
    `Trending free agents: ${freeAgents.filter(p => p.trending_adds > 0).length}`
  );
  console.log(
    `Projected free agents: ${freeAgents.filter(p => p.projection != null).length}`
  );
  console.log(`Transaction weeks captured: ${weeks.length}`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
