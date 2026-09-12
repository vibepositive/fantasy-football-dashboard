(() => {
  const $ = id => document.getElementById(id);
  let activitySnapshot = null;
  let activityType = 'ALL';

  function teamName(rosterId) {
    const team = activitySnapshot?.teams?.find(t => String(t.roster_id) === String(rosterId));
    return team?.team_name || team?.display_name || `Roster ${rosterId}`;
  }

  function playerLabel(p) {
    if (!p) return 'Unknown player';
    const meta = [p.position, p.team].filter(Boolean).join(' | ');
    return meta ? `${p.full_name} (${meta})` : p.full_name;
  }

  function allTransactions() {
    return (activitySnapshot?.activity || []).slice().sort((a, b) => Number(b.created || 0) - Number(a.created || 0));
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    return new Date(Number(timestamp)).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
  }

  function chips(items) {
    if (!items.length) return '<span class="muted">None</span>';
    return `<div class="activity-assets">${items.map(x => `<span class="activity-asset">${x}</span>`).join('')}</div>`;
  }

  function rosterMoveCard(tx) {
    const addedNames = (tx.adds || []).map(playerLabel);
    const droppedNames = (tx.drops || []).map(playerLabel);
    const manager = tx.primary_team_name || (tx.primary_roster_id ? teamName(tx.primary_roster_id) : 'Unknown team');
    const isWaiver = tx.kind === 'waiver';
    const isDrop = tx.kind === 'drop';
    const title = isDrop
      ? `${droppedNames[0]?.replace(/ \([^)]*\)$/, '') || 'Player'} dropped`
      : addedNames.length === 1
        ? `${addedNames[0].replace(/ \([^)]*\)$/, '')} ${isWaiver ? 'claimed' : 'added'}`
        : `${addedNames.length} players ${isWaiver ? 'claimed' : 'added'}`;
    const kindLabel = isDrop ? 'Player Drop' : isWaiver ? 'Waiver Claim' : 'Free Agent Add';
    const budget = isWaiver && tx.waiver_budget_remaining != null
      ? ` | <span class="activity-faab">$${Number(tx.waiver_bid || 0)} spent · $${Number(tx.waiver_budget_remaining)} left</span>`
      : '';

    return `<article class="panel activity-card">
      <div class="activity-card-top"><div><span class="activity-kind">${kindLabel}</span><h3>${title}</h3><div class="activity-team">${manager}${budget}</div></div><span class="activity-time">Week ${tx.week} | ${formatDate(tx.created)}</span></div>
      <div class="activity-details">
        ${addedNames.length ? `<div class="activity-detail-row"><span class="activity-detail-label">Added</span>${chips(addedNames)}</div>` : ''}
        ${droppedNames.length ? `<div class="activity-detail-row"><span class="activity-detail-label">Dropped</span>${chips(droppedNames)}</div>` : ''}
      </div>
    </article>`;
  }

  function pickLabel(pick) {
    const season = pick.season || '';
    const round = pick.round ? `Round ${pick.round}` : 'Draft pick';
    return `${season} ${round}`.trim();
  }

  function tradeCard(tx) {
    const rosterIds = (tx.roster_ids || []).map(String);
    const teamSections = rosterIds.map(rosterId => {
      const receivedPlayers = (tx.adds || []).filter(x => String(x.roster_id) === rosterId).map(playerLabel);
      const receivedPicks = (tx.draft_picks || []).filter(p => String(p.owner_id ?? p.roster_id) === rosterId).map(pickLabel);
      const receivedBudget = (tx.waiver_budget || []).filter(x => String(x.receiver) === rosterId).map(x => `$${Number(x.amount || 0)} waiver budget`);
      return `<div class="activity-detail-row"><span class="activity-detail-label">${teamName(rosterId)}</span>${chips([...receivedPlayers, ...receivedPicks, ...receivedBudget])}</div>`;
    }).join('');
    return `<article class="panel activity-card"><div class="activity-card-top"><div><span class="activity-kind">Trade</span><h3>${rosterIds.map(teamName).join(' ↔ ')}</h3></div><span class="activity-time">Week ${tx.week} | ${formatDate(tx.created)}</span></div><div class="activity-details">${teamSections || '<div class="muted">Trade details unavailable.</div>'}</div></article>`;
  }

  function renderActivity() {
    if (!activitySnapshot) return;
    const weekValue = $('activityWeekFilter')?.value || 'ALL';
    const teamValue = $('activityTeamFilter')?.value || 'ALL';
    let txs = allTransactions();
    if (activityType === 'WAIVERS') txs = txs.filter(tx => ['waiver','free_agent','drop'].includes(tx.kind));
    else if (activityType === 'TRADES') txs = txs.filter(tx => tx.kind === 'trade');
    if (weekValue !== 'ALL') txs = txs.filter(tx => String(tx.week) === weekValue);
    if (teamValue !== 'ALL') txs = txs.filter(tx => (tx.roster_ids || []).some(id => String(id) === teamValue));
    $('activityList').innerHTML = txs.length ? txs.map(tx => tx.kind === 'trade' ? tradeCard(tx) : rosterMoveCard(tx)).join('') : '<div class="panel activity-empty">No completed activity matched these filters.</div>';
    $('activityCount').textContent = `${txs.length} transaction${txs.length === 1 ? '' : 's'}`;
  }

  function populateFilters() {
    const weekSelect=$('activityWeekFilter'), teamSelect=$('activityTeamFilter'); if(!weekSelect||!teamSelect)return;
    const weeks=[...new Set(allTransactions().map(tx=>tx.week))].filter(Boolean).sort((a,b)=>b-a);
    weekSelect.innerHTML='<option value="ALL">All Weeks</option>'+weeks.map(w=>`<option value="${w}">Week ${w}</option>`).join('');
    teamSelect.innerHTML='<option value="ALL">All Teams</option>'+(activitySnapshot.teams||[]).slice().sort((a,b)=>(a.team_name||'').localeCompare(b.team_name||'')).map(team=>`<option value="${team.roster_id}">${team.team_name}</option>`).join('');
  }

  function showActivity(){['rostersView','waiversView','tradesView'].forEach(id=>{const el=$(id);if(el)el.hidden=true;});$('activityView').hidden=false;['analyzeMyTeamBtn','analyzeTradesBtn','analyzeWaiversBtn'].forEach(id=>$(id)?.classList.remove('active'));$('activityBtn')?.classList.add('active');renderActivity();window.scrollTo({top:0,behavior:'smooth'});}
  function leaveActivity(){if($('activityView'))$('activityView').hidden=true;$('activityBtn')?.classList.remove('active');}
  ['analyzeMyTeamBtn','analyzeTradesBtn','analyzeWaiversBtn'].forEach(id=>$(id)?.addEventListener('click',leaveActivity));
  $('activityBtn')?.addEventListener('click',showActivity);
  document.querySelectorAll('.activity-type-filter').forEach(btn=>btn.addEventListener('click',()=>{activityType=btn.dataset.activityType;document.querySelectorAll('.activity-type-filter').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderActivity();}));
  $('activityWeekFilter')?.addEventListener('change',renderActivity);$('activityTeamFilter')?.addEventListener('change',renderActivity);
  fetch(`snapshot.json?activity=${Date.now()}`).then(r=>{if(!r.ok)throw new Error(`Snapshot failed: ${r.status}`);return r.json();}).then(data=>{activitySnapshot=data;populateFilters();renderActivity();}).catch(err=>{if($('activityList'))$('activityList').innerHTML=`<div class="panel activity-empty">Unable to load activity. ${err.message}</div>`;});
})();
