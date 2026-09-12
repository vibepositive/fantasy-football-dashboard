(() => {
  const $ = id => document.getElementById(id);

  let activitySnapshot = null;
  let activityType = 'ALL';

  function teamName(rosterId) {
    const team = activitySnapshot?.teams?.find(
      t => String(t.roster_id) === String(rosterId)
    );
    return team?.team_name || team?.display_name || `Roster ${rosterId}`;
  }

  function playerIndex() {
    const map = new Map();
    (activitySnapshot?.teams || []).forEach(team => {
      (team.players || []).forEach(player => {
        map.set(String(player.player_id), player);
      });
    });
    (activitySnapshot?.free_agents || []).forEach(player => {
      map.set(String(player.player_id), player);
    });
    return map;
  }

  function playerLabel(id, players) {
    const p = players.get(String(id));
    if (!p) return String(id);
    const meta = [p.position, p.team].filter(Boolean).join(' | ');
    return meta ? `${p.full_name} (${meta})` : p.full_name;
  }

  function allTransactions() {
    return (activitySnapshot?.recent_transactions || [])
      .flatMap(group =>
        (group.transactions || []).map(tx => ({
          ...tx,
          week: Number(group.week || 0)
        }))
      )
      .filter(tx => tx.status === 'complete' && ['waiver', 'free_agent', 'trade'].includes(tx.type))
      .sort((a, b) => Number(b.created || 0) - Number(a.created || 0));
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    return new Date(Number(timestamp)).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function chips(items) {
    if (!items.length) return '<span class="muted">None</span>';
    return `<div class="activity-assets">${items
      .map(x => `<span class="activity-asset">${x}</span>`)
      .join('')}</div>`;
  }

  function waiverCard(tx, players) {
    const adds = Object.entries(tx.adds || {});
    const drops = Object.entries(tx.drops || {});
    const rosterId = adds[0]?.[1] ?? tx.roster_ids?.[0];
    const manager = rosterId != null ? teamName(rosterId) : 'Unknown team';
    const addedNames = adds.map(([id]) => playerLabel(id, players));
    const droppedNames = drops.map(([id]) => playerLabel(id, players));
    const bid = tx.type === 'waiver' ? Number(tx.settings?.waiver_bid ?? 0) : null;
    const title = addedNames.length === 1
      ? `${addedNames[0].replace(/ \([^)]*\)$/, '')} ${tx.type === 'waiver' ? 'claimed' : 'added'}`
      : `${addedNames.length} players ${tx.type === 'waiver' ? 'claimed' : 'added'}`;

    return `
      <article class="panel activity-card">
        <div class="activity-card-top">
          <div>
            <span class="activity-kind">${tx.type === 'waiver' ? 'Waiver Claim' : 'Free Agent Add'}</span>
            <h3>${title}</h3>
            <div class="activity-team">${manager}${bid != null ? ` | <span class="activity-faab">$${bid} FAAB</span>` : ''}</div>
          </div>
          <span class="activity-time">Week ${tx.week} | ${formatDate(tx.created)}</span>
        </div>
        <div class="activity-details">
          <div class="activity-detail-row">
            <span class="activity-detail-label">Added</span>
            ${chips(addedNames)}
          </div>
          <div class="activity-detail-row">
            <span class="activity-detail-label">Dropped</span>
            ${chips(droppedNames)}
          </div>
        </div>
      </article>`;
  }

  function pickLabel(pick) {
    const season = pick.season || '';
    const round = pick.round ? `Round ${pick.round}` : 'Draft pick';
    return `${season} ${round}`.trim();
  }

  function tradeCard(tx, players) {
    const rosterIds = (tx.roster_ids || []).map(String);
    const adds = Object.entries(tx.adds || {});
    const picks = tx.draft_picks || [];
    const faab = tx.waiver_budget || [];

    const teamSections = rosterIds.map(rosterId => {
      const receivedPlayers = adds
        .filter(([, destination]) => String(destination) === rosterId)
        .map(([id]) => playerLabel(id, players));

      const receivedPicks = picks
        .filter(p => String(p.owner_id ?? p.roster_id) === rosterId)
        .map(pickLabel);

      const receivedFaab = faab
        .filter(item => String(item.receiver) === rosterId)
        .map(item => `$${Number(item.amount || 0)} FAAB`);

      return `
        <div class="activity-detail-row">
          <span class="activity-detail-label">${teamName(rosterId)}</span>
          ${chips([...receivedPlayers, ...receivedPicks, ...receivedFaab])}
        </div>`;
    }).join('');

    return `
      <article class="panel activity-card">
        <div class="activity-card-top">
          <div>
            <span class="activity-kind">Trade</span>
            <h3>${rosterIds.map(teamName).join(' ↔ ')}</h3>
          </div>
          <span class="activity-time">Week ${tx.week} | ${formatDate(tx.created)}</span>
        </div>
        <div class="activity-details">
          ${teamSections || '<div class="muted">Trade details unavailable.</div>'}
        </div>
      </article>`;
  }

  function renderActivity() {
    if (!activitySnapshot) return;

    const players = playerIndex();
    const weekValue = $('activityWeekFilter')?.value || 'ALL';
    const teamValue = $('activityTeamFilter')?.value || 'ALL';

    let txs = allTransactions();

    if (activityType === 'WAIVERS') {
      txs = txs.filter(tx => tx.type === 'waiver' || tx.type === 'free_agent');
    } else if (activityType === 'TRADES') {
      txs = txs.filter(tx => tx.type === 'trade');
    }

    if (weekValue !== 'ALL') {
      txs = txs.filter(tx => String(tx.week) === weekValue);
    }

    if (teamValue !== 'ALL') {
      txs = txs.filter(tx => {
        if ((tx.roster_ids || []).some(id => String(id) === teamValue)) return true;
        if (Object.values(tx.adds || {}).some(id => String(id) === teamValue)) return true;
        if (Object.values(tx.drops || {}).some(id => String(id) === teamValue)) return true;
        return false;
      });
    }

    $('activityList').innerHTML = txs.length
      ? txs.map(tx => tx.type === 'trade' ? tradeCard(tx, players) : waiverCard(tx, players)).join('')
      : '<div class="panel activity-empty">No completed activity matched these filters.</div>';

    $('activityCount').textContent = `${txs.length} transaction${txs.length === 1 ? '' : 's'}`;
  }

  function populateFilters() {
    const weekSelect = $('activityWeekFilter');
    const teamSelect = $('activityTeamFilter');
    if (!weekSelect || !teamSelect) return;

    const weeks = [...new Set(allTransactions().map(tx => tx.week))]
      .filter(Boolean)
      .sort((a, b) => b - a);

    weekSelect.innerHTML = '<option value="ALL">All Weeks</option>' +
      weeks.map(w => `<option value="${w}">Week ${w}</option>`).join('');

    teamSelect.innerHTML = '<option value="ALL">All Teams</option>' +
      (activitySnapshot.teams || [])
        .slice()
        .sort((a, b) => (a.team_name || '').localeCompare(b.team_name || ''))
        .map(team => `<option value="${team.roster_id}">${team.team_name}</option>`)
        .join('');
  }

  function showActivity() {
    ['rostersView', 'waiversView', 'tradesView'].forEach(id => {
      const el = $(id);
      if (el) el.hidden = true;
    });
    $('activityView').hidden = false;

    ['analyzeMyTeamBtn', 'analyzeTradesBtn', 'analyzeWaiversBtn'].forEach(id => {
      $(id)?.classList.remove('active');
    });
    $('activityBtn')?.classList.add('active');

    renderActivity();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function leaveActivity() {
    if ($('activityView')) $('activityView').hidden = true;
    $('activityBtn')?.classList.remove('active');
  }

  ['analyzeMyTeamBtn', 'analyzeTradesBtn', 'analyzeWaiversBtn'].forEach(id => {
    $(id)?.addEventListener('click', leaveActivity);
  });

  $('activityBtn')?.addEventListener('click', showActivity);

  document.querySelectorAll('.activity-type-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      activityType = btn.dataset.activityType;
      document.querySelectorAll('.activity-type-filter').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      renderActivity();
    });
  });

  $('activityWeekFilter')?.addEventListener('change', renderActivity);
  $('activityTeamFilter')?.addEventListener('change', renderActivity);

  fetch(`snapshot.json?activity=${Date.now()}`)
    .then(r => {
      if (!r.ok) throw new Error(`Snapshot failed: ${r.status}`);
      return r.json();
    })
    .then(data => {
      activitySnapshot = data;
      populateFilters();
      renderActivity();
    })
    .catch(err => {
      if ($('activityList')) {
        $('activityList').innerHTML = `<div class="panel activity-empty">Unable to load activity. ${err.message}</div>`;
      }
    });
})();
