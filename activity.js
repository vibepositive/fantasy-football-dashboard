(() => {
  const $ = id => document.getElementById(id);
  const SEEN_KEY = 'mettlers:last-seen-activity';
  let activitySnapshot = null;
  let activityType = 'ALL';

  function teamName(rosterId){const t=activitySnapshot?.teams?.find(x=>String(x.roster_id)===String(rosterId));return t?.team_name||t?.display_name||`Roster ${rosterId}`;}
  function playerLabel(p){if(!p)return'Unknown player';const meta=[p.position,p.team].filter(Boolean).join(' | ');return meta?`${p.full_name} (${meta})`:p.full_name;}
  function allTransactions(){return(activitySnapshot?.activity||[]).slice().sort((a,b)=>Number(b.created||0)-Number(a.created||0));}
  function formatDate(ts){if(!ts)return'';return new Date(Number(ts)).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
  function chips(items){if(!items.length)return'<span class="muted">None</span>';return`<div class="activity-assets">${items.map(x=>`<span class="activity-asset">${x}</span>`).join('')}</div>`;}

  function rosterMoveCard(tx){
    const added=(tx.adds||[]).map(playerLabel),dropped=(tx.drops||[]).map(playerLabel);const manager=tx.primary_team_name||(tx.primary_roster_id?teamName(tx.primary_roster_id):'Unknown team');const waiver=tx.kind==='waiver',drop=tx.kind==='drop';
    const title=drop?`${dropped[0]?.replace(/ \([^)]*\)$/,'')||'Player'} dropped`:added.length===1?`${added[0].replace(/ \([^)]*\)$/,'')} ${waiver?'claimed':'added'}`:`${added.length} players ${waiver?'claimed':'added'}`;
    const kind=drop?'Player Drop':waiver?'Waiver Claim':'Free Agent Add';const budget=waiver&&tx.waiver_budget_remaining!=null?` | <span class="activity-faab">$${Number(tx.waiver_bid||0)} spent · $${Number(tx.waiver_budget_remaining)} left</span>`:'';
    return`<article class="panel activity-card"><div class="activity-card-top"><div><span class="activity-kind">${kind}</span><h3>${title}</h3><div class="activity-team">${manager}${budget}</div></div><span class="activity-time">Week ${tx.week} | ${formatDate(tx.created)}</span></div><div class="activity-details">${added.length?`<div class="activity-detail-row"><span class="activity-detail-label">Added</span>${chips(added)}</div>`:''}${dropped.length?`<div class="activity-detail-row"><span class="activity-detail-label">Dropped</span>${chips(dropped)}</div>`:''}</div></article>`;
  }
  function pickLabel(p){return`${p.season||''} ${p.round?`Round ${p.round}`:'Draft pick'}`.trim();}
  function tradeCard(tx){const ids=(tx.roster_ids||[]).map(String);const sections=ids.map(id=>{const players=(tx.adds||[]).filter(x=>String(x.roster_id)===id).map(playerLabel);const picks=(tx.draft_picks||[]).filter(p=>String(p.owner_id??p.roster_id)===id).map(pickLabel);const budget=(tx.waiver_budget||[]).filter(x=>String(x.receiver)===id).map(x=>`$${Number(x.amount||0)} waiver budget`);return`<div class="activity-detail-row"><span class="activity-detail-label">${teamName(id)}</span>${chips([...players,...picks,...budget])}</div>`;}).join('');return`<article class="panel activity-card"><div class="activity-card-top"><div><span class="activity-kind">Trade</span><h3>${ids.map(teamName).join(' ↔ ')}</h3></div><span class="activity-time">Week ${tx.week} | ${formatDate(tx.created)}</span></div><div class="activity-details">${sections||'<div class="muted">Trade details unavailable.</div>'}</div></article>`;}

  function newestActivityTime(){return Math.max(0,...allTransactions().map(tx=>Number(tx.created||0)));}
  function updateNewBadge(){
    const badge=$('activityNewBadge');if(!badge||!activitySnapshot)return;
    const lastSeen=Number(localStorage.getItem(SEEN_KEY)||0);const unseen=allTransactions().filter(tx=>Number(tx.created||0)>lastSeen).length;
    if(unseen>0){badge.textContent=unseen>99?'99+':String(unseen);badge.hidden=false;$('activityBtn')?.classList.add('has-new-activity');}else{badge.hidden=true;badge.textContent='';$('activityBtn')?.classList.remove('has-new-activity');}
  }
  function markActivitySeen(){const newest=newestActivityTime();if(newest)localStorage.setItem(SEEN_KEY,String(newest));const badge=$('activityNewBadge');if(badge){badge.hidden=true;badge.textContent='';}$('activityBtn')?.classList.remove('has-new-activity');}

  function renderActivity(){if(!activitySnapshot)return;const week=$('activityWeekFilter')?.value||'ALL',team=$('activityTeamFilter')?.value||'ALL';let txs=allTransactions();if(activityType==='WAIVERS')txs=txs.filter(tx=>['waiver','free_agent','drop'].includes(tx.kind));else if(activityType==='TRADES')txs=txs.filter(tx=>tx.kind==='trade');if(week!=='ALL')txs=txs.filter(tx=>String(tx.week)===week);if(team!=='ALL')txs=txs.filter(tx=>(tx.roster_ids||[]).some(id=>String(id)===team));$('activityList').innerHTML=txs.length?txs.map(tx=>tx.kind==='trade'?tradeCard(tx):rosterMoveCard(tx)).join(''):'<div class="panel activity-empty">No completed activity matched these filters.</div>';$('activityCount').textContent=`${txs.length} transaction${txs.length===1?'':'s'}`;}
  function populateFilters(){const w=$('activityWeekFilter'),t=$('activityTeamFilter');if(!w||!t)return;const weeks=[...new Set(allTransactions().map(tx=>tx.week))].filter(Boolean).sort((a,b)=>b-a);w.innerHTML='<option value="ALL">All Weeks</option>'+weeks.map(x=>`<option value="${x}">Week ${x}</option>`).join('');t.innerHTML='<option value="ALL">All Teams</option>'+(activitySnapshot.teams||[]).slice().sort((a,b)=>(a.team_name||'').localeCompare(b.team_name||'')).map(x=>`<option value="${x.roster_id}">${x.team_name}</option>`).join('');}
  function showActivity(){['rostersView','waiversView','tradesView'].forEach(id=>{const e=$(id);if(e)e.hidden=true;});$('activityView').hidden=false;['analyzeMyTeamBtn','analyzeTradesBtn','analyzeWaiversBtn'].forEach(id=>$(id)?.classList.remove('active'));$('activityBtn')?.classList.add('active');markActivitySeen();renderActivity();window.scrollTo({top:0,behavior:'smooth'});}
  function leaveActivity(){if($('activityView'))$('activityView').hidden=true;$('activityBtn')?.classList.remove('active');}
  ['analyzeMyTeamBtn','analyzeTradesBtn','analyzeWaiversBtn'].forEach(id=>$(id)?.addEventListener('click',leaveActivity));$('activityBtn')?.addEventListener('click',showActivity);
  document.querySelectorAll('.activity-type-filter').forEach(btn=>btn.addEventListener('click',()=>{activityType=btn.dataset.activityType;document.querySelectorAll('.activity-type-filter').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderActivity();}));$('activityWeekFilter')?.addEventListener('change',renderActivity);$('activityTeamFilter')?.addEventListener('change',renderActivity);
  fetch(`snapshot.json?activity=${Date.now()}`).then(r=>{if(!r.ok)throw new Error(`Snapshot failed: ${r.status}`);return r.json();}).then(data=>{activitySnapshot=data;populateFilters();renderActivity();updateNewBadge();}).catch(err=>{if($('activityList'))$('activityList').innerHTML=`<div class="panel activity-empty">Unable to load activity. ${err.message}</div>`;});
})();
