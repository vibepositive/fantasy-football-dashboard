(() => {
  const livePoints = new Map();
  const historicalTeamPoints = new Map();
  const currentTeamPoints = new Map();
  const currentMatchups = new Map();
  let refreshTimer = null;
  let refreshing = false;
  let historyLoadedForWeek = null;

  const originalPointsFor = pointsFor;
  const originalRenderRosters = renderRosters;

  function actualFor(playerId) {
    const key = String(playerId);
    return livePoints.has(key) ? livePoints.get(key) : null;
  }

  function scoreText(value) {
    return value == null ? '&mdash;' : Number(value).toFixed(2);
  }

  function performanceClass(actual, projection) {
    const a = Number(actual);
    const p = Number(projection);
    if (!Number.isFinite(a) || !Number.isFinite(p) || a === 0) return 'neutral';
    if (a > p) return 'over-proj';
    if (a < p) return 'under-proj';
    return 'met-proj';
  }

  function livePlayerRow(p) {
    const actual = actualFor(p.player_id);
    const perf = performanceClass(actual, p.projection);
    return `
      <div class="player-row live-score-row">
        <span class="pos">${p.position || "&mdash;"}</span>
        <span class="player-info">
          <span class="player-name">${p.full_name || p.player_id}</span>
          <div class="player-meta">
            ${[p.team,p.age ? `Age ${p.age}` : null,p.injury_status].filter(Boolean).join(" &bull; ")}
          </div>
        </span>
        <span class="projection live-projection">${p.projection != null ? Number(p.projection).toFixed(2) : "&mdash;"}</span>
        <span class="actual-score ${actual != null ? 'has-score' : ''} ${perf}">${scoreText(actual)}</span>
      </div>
    `;
  }

  function liveBlock(title, players) {
    return `
      <div class="roster-section">
        <div class="section-title-row live-score-header">
          <div class="section-title">${title}</div>
          <div class="section-score-headings" aria-label="Weekly projected and actual points">
            <span class="proj-heading" title="Projected points for the current week">PROJ</span>
            <span class="actual-heading" title="Actual fantasy points scored this week">ACTUAL</span>
          </div>
        </div>
        ${players?.length ? players.map(livePlayerRow).join("") : '<div class="player-meta">None</div>'}
      </div>
    `;
  }

  playerRow = livePlayerRow;
  block = liveBlock;

  pointsFor = function(t) {
    const rid = String(t?.roster_id ?? '');
    if (historicalTeamPoints.has(rid) || currentTeamPoints.has(rid)) {
      return Number(historicalTeamPoints.get(rid) || 0) + Number(currentTeamPoints.get(rid) || 0);
    }
    return originalPointsFor(t);
  };

  function matchupPopover(rosterId) {
    const info = currentMatchups.get(String(rosterId));
    if (!info) {
      return `<div class="team-matchup-popover"><div class="matchup-popover-title">THIS WEEK</div><div class="matchup-popover-empty">No matchup data available.</div></div>`;
    }

    const mine = snapshot?.teams?.find(t => String(t.roster_id) === String(rosterId));
    const opp = snapshot?.teams?.find(t => String(t.roster_id) === String(info.opponentRosterId));
    const myName = mine?.team_name || mine?.display_name || 'Team';
    const oppName = opp?.team_name || opp?.display_name || (info.opponentRosterId ? 'Opponent' : 'Bye');
    const myPts = Number(info.points || 0).toFixed(2);
    const oppPts = info.opponentRosterId == null ? '—' : Number(info.opponentPoints || 0).toFixed(2);

    return `
      <div class="team-matchup-popover" role="status">
        <div class="matchup-popover-title">WEEK ${snapshot.current_week} MATCHUP</div>
        <div class="matchup-popover-row"><strong>${myName}</strong><span>${myPts}</span></div>
        <div class="matchup-popover-vs">vs</div>
        <div class="matchup-popover-row"><strong>${oppName}</strong><span>${oppPts}</span></div>
      </div>
    `;
  }

  function decorateTeamCards() {
    document.querySelectorAll('.team-card').forEach(cardEl => {
      const rid = String(cardEl.dataset.roster || '');
      cardEl.classList.add('has-matchup-hover');
      cardEl.tabIndex = 0;
      cardEl.querySelector('.team-matchup-popover')?.remove();
      cardEl.insertAdjacentHTML('beforeend', matchupPopover(rid));
    });
  }

  renderRosters = function() {
    originalRenderRosters();
    decorateTeamCards();
  };

  function ensureControls() {
    const row = document.querySelector('.roster-controls .filter-row');
    if (!row || document.getElementById('refreshLiveScoresBtn')) return;

    const live = document.createElement('div');
    live.className = 'live-score-controls';
    live.innerHTML = `
      <span id="liveScoreStatus" class="live-score-status">Live scores loading...</span>
      <button id="refreshLiveScoresBtn" type="button" class="live-score-refresh" title="Refresh this week's Sleeper scores">Refresh scores</button>
    `;
    row.prepend(live);
    document.getElementById('refreshLiveScoresBtn').addEventListener('click', refreshLiveScores);
  }

  function applyCurrentMatchups(matchups) {
    livePoints.clear();
    currentTeamPoints.clear();
    currentMatchups.clear();

    const groups = new Map();
    for (const matchup of matchups || []) {
      const rid = String(matchup.roster_id);
      currentTeamPoints.set(rid, Number(matchup.points || 0));

      for (const [playerId, points] of Object.entries(matchup.players_points || {})) {
        livePoints.set(String(playerId), Number(points || 0));
      }

      const mid = String(matchup.matchup_id ?? `solo-${rid}`);
      if (!groups.has(mid)) groups.set(mid, []);
      groups.get(mid).push(matchup);
    }

    for (const group of groups.values()) {
      for (const matchup of group) {
        const rid = String(matchup.roster_id);
        const opponent = group.find(x => String(x.roster_id) !== rid) || null;
        currentMatchups.set(rid, {
          points: Number(matchup.points || 0),
          opponentRosterId: opponent ? String(opponent.roster_id) : null,
          opponentPoints: opponent ? Number(opponent.points || 0) : null
        });
      }
    }
  }

  async function loadHistoricalTeamPoints() {
    const week = Number(snapshot?.current_week || 0);
    if (!week || historyLoadedForWeek === week) return;

    historicalTeamPoints.clear();
    if (week <= 1) {
      historyLoadedForWeek = week;
      return;
    }

    const calls = [];
    for (let w = 1; w < week; w++) {
      calls.push(
        fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${w}?ts=${Date.now()}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      );
    }

    const weeks = await Promise.all(calls);
    for (const matchups of weeks) {
      for (const matchup of matchups || []) {
        const rid = String(matchup.roster_id);
        historicalTeamPoints.set(
          rid,
          Number(historicalTeamPoints.get(rid) || 0) + Number(matchup.points || 0)
        );
      }
    }

    historyLoadedForWeek = week;
  }

  async function refreshLiveScores() {
    if (refreshing || !snapshot?.current_week) return;
    refreshing = true;
    ensureControls();

    const button = document.getElementById('refreshLiveScoresBtn');
    const status = document.getElementById('liveScoreStatus');
    if (button) {
      button.disabled = true;
      button.textContent = 'Refreshing...';
    }

    try {
      await loadHistoricalTeamPoints();
      const week = snapshot.current_week;
      const url = `https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${week}?ts=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Sleeper returned ${response.status}`);
      const matchups = await response.json();

      applyCurrentMatchups(matchups);
      renderRosters();
      if (status) status.textContent = `Week ${week} live · ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}`;
    } catch (error) {
      if (status) status.textContent = 'Live score refresh failed';
      console.error('Live score refresh failed:', error);
    } finally {
      refreshing = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Refresh scores';
      }
    }
  }

  function startWhenReady() {
    ensureControls();
    if (!snapshot?.current_week) {
      setTimeout(startWhenReady, 200);
      return;
    }

    refreshLiveScores();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!document.hidden) refreshLiveScores();
    }, 60000);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && snapshot?.current_week) refreshLiveScores();
  });

  startWhenReady();
})();