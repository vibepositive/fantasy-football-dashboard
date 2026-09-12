(() => {
  const $ = id => document.getElementById(id);
  const livePoints = new Map();
  const teamGameStatus = new Map();
  let matchupTimer = null;
  let matchupData = [];

  function ensureUi(){
    if (!document.querySelector('link[href="matchups.css"]')) {
      const link=document.createElement('link');link.rel='stylesheet';link.href='matchups.css';document.head.appendChild(link);
    }
    const nav=document.querySelector('.header-actions');
    if(nav&&!$('matchupsBtn')){const btn=document.createElement('button');btn.id='matchupsBtn';btn.textContent='MATCHUPS';nav.prepend(btn);}
    if(!$('matchupsView')){
      const main=document.querySelector('main');const section=document.createElement('section');section.id='matchupsView';section.className='matchups-view';section.innerHTML=`<section class="panel matchups-header"><div><h2>This Week's Matchups</h2><p class="muted">Tap a matchup to view starters, bench players, current projections and points scored this week.</p></div><div><div id="matchupsWeek" class="matchups-week">WEEK</div><div id="matchupsStatus" class="matchups-status">Loading matchups...</div></div></section><section id="matchupsGrid" class="matchups-grid"></section>`;main?.prepend(section);
    }
  }

  function teamByRoster(id){return snapshot?.teams?.find(t=>String(t.roster_id)===String(id))||null;}
  function mineId(){return String(snapshot?.my_team?.roster_id??'');}
  function proj(p){return Number(p?.projection||0);}
  function pts(id){return livePoints.has(String(id))?Number(livePoints.get(String(id))||0):0;}
  function starterProjection(team){return (team?.starters||[]).reduce((sum,p)=>sum+proj(p),0);}
  function rosterActual(matchup){return Number(matchup?.points||0);}
  function gameHasStarted(player){
    const nflTeam=String(player?.team||'').toUpperCase();
    const status=teamGameStatus.get(nflTeam);
    if(status)return !['pre_game','scheduled','pre'].includes(String(status).toLowerCase());
    return pts(player?.player_id)!==0;
  }
  function expectedSoFar(team){return (team?.starters||[]).reduce((sum,p)=>sum+(gameHasStarted(p)?proj(p):0),0);}
  function scoreClass(actual,expected){if(!Number.isFinite(actual)||actual===0||!Number.isFinite(expected)||expected<=0)return'neutral';return actual>=expected?'over-proj':'under-proj';}
  function playerScoreClass(p){const actual=pts(p.player_id),projection=Number(p?.projection);if(actual===0||!gameHasStarted(p)||!Number.isFinite(projection)||projection<=0)return'neutral';return actual>=projection?'over-proj':'under-proj';}
  function playerRow(p){const actual=pts(p.player_id);return `<div class="matchup-player-row"><span class="pos">${p.position||'—'}</span><span class="matchup-player-name">${p.full_name||p.player_id}<span class="matchup-player-meta">${[p.team,p.injury_status].filter(Boolean).join(' · ')}</span></span><span class="matchup-player-num projection-num">${p.projection!=null?Number(p.projection).toFixed(2):'—'}</span><span class="matchup-player-num actual-num ${playerScoreClass(p)}">${actual.toFixed(2)}</span></div>`;}
  function lineup(team){if(!team)return'<div class="muted">Roster unavailable.</div>';const starterIds=new Set((team.starters||[]).map(p=>String(p.player_id)));const starters=team.starters||[];const bench=(team.players||[]).filter(p=>!starterIds.has(String(p.player_id))&&!p.reserve&&!p.taxi);const fullProj=starterProjection(team);const paceProj=expectedSoFar(team);const starterPts=starters.reduce((sum,p)=>sum+pts(p.player_id),0);return `<div class="matchup-lineup"><div class="matchup-lineup-title"><div><span class="lineup-team-name">${team.team_name||team.display_name||'Team'}</span><span class="lineup-label">STARTING LINEUP</span></div><div class="lineup-total"><span>WEEK TOTAL</span><strong class="${scoreClass(starterPts,paceProj)}">${starterPts.toFixed(2)}</strong><small>${paceProj.toFixed(2)} expected so far · ${fullProj.toFixed(2)} full week</small></div></div><div class="matchup-player-head"><span>POS</span><span>PLAYER</span><span>PROJ</span><span>PTS</span></div>${starters.map(playerRow).join('')||'<div class="muted">No starters.</div>'}${bench.length?`<div class="matchup-bench-label">BENCH</div>${bench.map(playerRow).join('')}`:''}</div>`;}
  function matchupCard(group){const a=group[0],b=group[1]||null;const ta=teamByRoster(a?.roster_id),tb=teamByRoster(b?.roster_id);const aName=ta?.team_name||ta?.display_name||'Team',bName=tb?.team_name||tb?.display_name||(b?'Team':'Bye');const aOwner=ta?.username||ta?.display_name||'',bOwner=tb?.username||tb?.display_name||'';const mine=[String(a?.roster_id),String(b?.roster_id)].includes(mineId());const aPts=rosterActual(a),bPts=b?rosterActual(b):0;const aFull=starterProjection(ta),bFull=tb?starterProjection(tb):0;const aPace=expectedSoFar(ta),bPace=tb?expectedSoFar(tb):0;return `<details class="panel matchup-card ${mine?'mine':''}"><summary><div class="matchup-summary"><div class="matchup-team"><span class="matchup-team-name">${aName}</span><span class="matchup-team-owner">${aOwner?`@${aOwner}`:''}</span></div><div class="matchup-score"><div class="matchup-total"><span>PTS</span><strong class="${scoreClass(aPts,aPace)}">${aPts.toFixed(2)}</strong></div><span class="matchup-vs">${b?'VS':'BYE'}</span><div class="matchup-total"><span>PTS</span><strong class="${b?scoreClass(bPts,bPace):'neutral'}">${b?bPts.toFixed(2):'—'}</strong></div></div><div class="matchup-team away"><span class="matchup-team-name">${bName}</span><span class="matchup-team-owner">${bOwner?`@${bOwner}`:''}</span></div></div><div class="matchup-proj-row"><div><span>Pace target</span><strong>${aPace.toFixed(2)}</strong><small>${aFull.toFixed(2)} week</small></div><div><span>Pace target</span><strong>${b?bPace.toFixed(2):'—'}</strong><small>${b?`${bFull.toFixed(2)} week`:''}</small></div></div><span class="matchup-expand-hint">VIEW LINEUPS <span aria-hidden="true">⌄</span></span></summary><div class="matchup-detail"><div class="matchup-lineups">${lineup(ta)}${b?lineup(tb):''}</div></div></details>`;}
  function groups(){const map=new Map();for(const m of matchupData||[]){const key=String(m.matchup_id??`solo-${m.roster_id}`);if(!map.has(key))map.set(key,[]);map.get(key).push(m);}return [...map.values()].sort((x,y)=>{const xm=x.some(m=>String(m.roster_id)===mineId())?0:1;const ym=y.some(m=>String(m.roster_id)===mineId())?0:1;return xm-ym;});}
  function render(){if(!snapshot)return;const grid=$('matchupsGrid');if(!grid)return;const gs=groups();$('matchupsWeek').textContent=`WEEK ${snapshot.current_week||''}`;$('matchupsStatus').textContent=`${gs.length} matchup${gs.length===1?'':'s'} · live Sleeper scoring`;grid.innerHTML=gs.length?gs.map(matchupCard).join(''):'<div class="panel">No matchup data available for this week.</div>';}
  function apply(matchups){matchupData=matchups||[];livePoints.clear();for(const m of matchupData){for(const [id,p] of Object.entries(m.players_points||{}))livePoints.set(String(id),Number(p||0));}render();}
  async function loadSchedule(){
    const season=snapshot?.league?.season||snapshot?.season||'2026';
    try{
      const r=await fetch(`https://api.sleeper.app/schedule/nfl/regular/${season}?ts=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)return;
      const games=await r.json();teamGameStatus.clear();
      for(const game of games||[]){if(Number(game.week)!==Number(snapshot?.current_week))continue;const status=game.status||'pre_game';if(game.home)teamGameStatus.set(String(game.home).toUpperCase(),status);if(game.away)teamGameStatus.set(String(game.away).toUpperCase(),status);}
    }catch(e){console.warn('NFL schedule status unavailable; using scoring activity as fallback.',e);}
  }
  async function refresh(){if(!snapshot?.current_week)return;try{await loadSchedule();const r=await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${snapshot.current_week}?ts=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Sleeper returned ${r.status}`);apply(await r.json());$('matchupsStatus').textContent+=` · updated ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;}catch(e){console.error('Matchup refresh failed:',e);if(snapshot?.current_matchups)apply(snapshot.current_matchups);$('matchupsStatus').textContent='Live refresh failed · showing latest snapshot';}}
  function showMatchups(){['rostersView','waiversView','tradesView','activityView'].forEach(id=>{const el=$(id);if(el)el.hidden=true;});$('matchupsView').hidden=false;['analyzeMyTeamBtn','analyzeTradesBtn','analyzeWaiversBtn','activityBtn'].forEach(id=>$(id)?.classList.remove('active'));$('matchupsBtn')?.classList.add('active');render();window.scrollTo({top:0,behavior:'smooth'});}
  function leaveMatchups(){if($('matchupsView'))$('matchupsView').hidden=true;$('matchupsBtn')?.classList.remove('active');}
  function wireNav(){$('matchupsBtn')?.addEventListener('click',showMatchups);['analyzeMyTeamBtn','analyzeTradesBtn','analyzeWaiversBtn','activityBtn'].forEach(id=>$(id)?.addEventListener('click',leaveMatchups));}
  function start(){if(!snapshot?.current_week){setTimeout(start,200);return;}apply(snapshot.current_matchups||[]);showMatchups();refresh();clearInterval(matchupTimer);matchupTimer=setInterval(()=>{if(!document.hidden)refresh();},60000);}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&snapshot?.current_week)refresh();});
  ensureUi();wireNav();showMatchups();start();
})();
