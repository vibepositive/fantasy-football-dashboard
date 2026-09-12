(() => {
  const livePoints = new Map();
  let refreshTimer = null;
  let refreshing = false;

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
      const week = snapshot.current_week;
      const url = `https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${week}?ts=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Sleeper returned ${response.status}`);
      const matchups = await response.json();

      livePoints.clear();
      for (const matchup of matchups || []) {
        for (const [playerId, points] of Object.entries(matchup.players_points || {})) {
          livePoints.set(String(playerId), Number(points || 0));
        }
      }

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