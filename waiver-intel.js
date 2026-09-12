(() => {
  const SEVERE_INJURY = new Set(['Out', 'IR', 'PUP', 'Suspended', 'Doubtful']);

  function allFantasyPlayers() {
    if (!snapshot) return [];
    return [
      ...(snapshot.teams || []).flatMap(team => team.players || []),
      ...(snapshot.free_agents || [])
    ];
  }

  function teammatesAtPosition(player) {
    if (!player?.team || !player?.position) return [];
    return allFantasyPlayers().filter(p =>
      String(p.player_id) !== String(player.player_id) &&
      p.team === player.team &&
      p.position === player.position
    );
  }

  function injuredPlayersAhead(player) {
    const order = Number(player.depth_chart_order || 99);
    return teammatesAtPosition(player)
      .filter(p => {
        const teammateOrder = Number(p.depth_chart_order || 99);
        const status = String(p.injury_status || p.status || '');
        return SEVERE_INJURY.has(status) && teammateOrder < order;
      })
      .sort((a, b) => Number(a.depth_chart_order || 99) - Number(b.depth_chart_order || 99));
  }

  function projectionRank(player) {
    const peers = (snapshot?.free_agents || [])
      .filter(p => p.position === player.position && p.projection != null)
      .sort((a, b) => Number(b.projection || 0) - Number(a.projection || 0));
    const index = peers.findIndex(p => String(p.player_id) === String(player.player_id));
    return index < 0 ? null : { rank: index + 1, total: peers.length };
  }

  function likelyTrendDriver(player, ahead, rank, depth, opponent) {
    if (ahead.length) {
      const names = ahead.map(p => `${p.full_name} (${p.injury_status || p.status})`).join(', ');
      return `Likely driven by the injury situation ahead of him: ${names}. That gives ${player.full_name} a clearer path to snaps and touches.`;
    }

    if (depth === 1) {
      return `Likely driven by role: Sleeper lists ${player.full_name} first at ${player.depth_chart_position || player.position} for ${player.team}.`;
    }

    if (rank && rank.total >= 5 && rank.rank <= Math.max(5, Math.ceil(rank.total * 0.15))) {
      return `Likely driven by this week's fantasy outlook: ${Number(player.projection).toFixed(2)} projected half-PPR points, ranking ${rank.rank} of ${rank.total} available ${player.position}s${opponent ? ` against ${opponent}` : ''}.`;
    }

    if (depth === 2) {
      return `Likely driven by upside in the depth chart: ${player.full_name} is No. 2 at ${player.depth_chart_position || player.position} for ${player.team} and is one role change away from more work.`;
    }

    if (player.projection != null && Number(player.projection) >= 7) {
      return `Likely driven by short-term usability: ${Number(player.projection).toFixed(2)} projected half-PPR points${opponent ? ` against ${opponent}` : ''}.`;
    }

    if (player.age && Number(player.age) <= 24 && Number(player.years_exp ?? 99) <= 2) {
      return `Likely driven by dynasty speculation: age ${player.age} with only ${player.years_exp || 0} years of NFL experience.`;
    }

    return 'No specific injury, depth-chart, or projection trigger is identifiable in the current snapshot, so this may be news- or speculation-driven.';
  }

  function whyTrending(player) {
    const reasons = [];
    const adds = Number(player.trending_adds || 0);
    const depth = Number(player.depth_chart_order || 0);
    const ahead = injuredPlayersAhead(player);
    const rank = projectionRank(player);
    const opponent = player.projection_opponent || null;

    if (adds > 0) {
      const label = adds >= 10000 ? 'ADD SURGE' : adds >= 1000 ? 'RISING' : 'TRENDING';
      reasons.push({
        type: 'market',
        label,
        text: `${formatAdds(adds)} Sleeper adds in the last 24 hours. ${likelyTrendDriver(player, ahead, rank, depth, opponent)}`
      });
    }

    if (ahead.length) {
      reasons.push({
        type: 'opportunity',
        label: 'INJURY OPPORTUNITY',
        text: `${ahead.map(p => `${p.full_name} (${p.injury_status || p.status})`).join(', ')} ${ahead.length > 1 ? 'are' : 'is'} listed ahead on the ${player.team} depth chart, creating a clearer path to snaps and touches.`
      });
    } else if (depth === 1) {
      reasons.push({
        type: 'role',
        label: 'PRIMARY ROLE',
        text: `Sleeper currently lists ${player.full_name} first at ${player.depth_chart_position || player.position} on the ${player.team} depth chart.`
      });
    } else if (depth === 2) {
      reasons.push({
        type: 'role',
        label: 'DEPTH CHART',
        text: `${player.full_name} is currently No. 2 at ${player.depth_chart_position || player.position} for ${player.team}, putting him close to a larger role if usage changes.`
      });
    }

    if (rank && rank.total >= 5 && rank.rank <= Math.max(5, Math.ceil(rank.total * 0.15))) {
      const pct = Math.max(1, Math.round((rank.rank / rank.total) * 100));
      reasons.push({
        type: 'matchup',
        label: opponent ? `WEEK ${snapshot.current_week} vs ${opponent}` : 'WEEKLY PROJECTION',
        text: `Rotowire projects ${Number(player.projection).toFixed(2)} half-PPR points, ranking ${rank.rank} of ${rank.total} available ${player.position}s${opponent ? ` for the matchup with ${opponent}` : ''}. That is a top-${pct}% weekly projection signal.`
      });
    } else if (player.projection != null && Number(player.projection) >= 7) {
      reasons.push({
        type: 'matchup',
        label: opponent ? `WEEK ${snapshot.current_week} vs ${opponent}` : 'WEEKLY OUTLOOK',
        text: `The current Rotowire projection is ${Number(player.projection).toFixed(2)} half-PPR points${opponent ? ` against ${opponent}` : ''}, suggesting usable short-term fantasy involvement.`
      });
    }

    if (player.age && Number(player.age) <= 24 && Number(player.years_exp ?? 99) <= 2) {
      reasons.push({ type: 'dynasty', label: 'YOUNG UPSIDE', text: `Age ${player.age} with ${player.years_exp || 0} years of NFL experience makes this a reasonable dynasty stash profile if roster space allows.` });
    }

    if (player.injury_status) {
      reasons.push({ type: 'risk', label: 'RISK', text: `${player.full_name} is currently designated ${player.injury_status}${player.injury_body_part ? ` (${player.injury_body_part})` : ''}, so the trend may not translate directly into immediate availability.` });
    }

    if (!reasons.length) {
      reasons.push({ type: 'market', label: 'TREND SIGNAL', text: 'No specific injury-created role or strong weekly projection signal is present in the current snapshot.' });
    }

    const evidenceCount = reasons.filter(r => r.type === 'opportunity' || r.type === 'role' || r.type === 'matchup').length;
    const confidence = ahead.length ? 'HIGH' : evidenceCount >= 2 ? 'MEDIUM' : 'LOW';
    return { reasons, confidence };
  }

  function intelMarkup(player) {
    const { reasons, confidence } = whyTrending(player);
    return `
      <div class="waiver-intel-panel">
        <div class="waiver-intel-heading">
          <div>
            <span class="waiver-intel-kicker">WHY THIS PLAYER IS TRENDING</span>
            <strong>${player.full_name}</strong>
          </div>
          <span class="waiver-confidence ${confidence.toLowerCase()}">${confidence} CONFIDENCE</span>
        </div>
        <div class="waiver-intel-reasons">
          ${reasons.map(r => `
            <div class="waiver-intel-reason ${r.type}">
              <span>${r.label}</span>
              <p>${r.text}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const baseWaiverRow = waiverRow;
  waiverRow = function enhancedWaiverRow(player) {
    const hasIntel = Number(player.trending_adds || 0) > 0 || player.projection != null || player.depth_chart_order || player.injury_status;
    if (!hasIntel) return baseWaiverRow(player);

    return `
      <details class="waiver-intel-item">
        <summary class="waiver-row waiver-row-expandable" aria-label="Show waiver intelligence for ${player.full_name || player.player_id}">
          <span class="pos">${player.position || '&mdash;'}</span>
          <span class="waiver-player">
            <span class="waiver-name-line">
              <strong>${player.full_name || player.player_id}</strong>
              ${waiverSignal(player)}
              <span class="waiver-expand-caret" aria-hidden="true">⌄</span>
            </span>
            <span class="player-meta">${[player.team || 'FA', player.age ? `Age ${player.age}` : null].filter(Boolean).join(' &bull; ')}</span>
          </span>
          <span class="waiver-status">${waiverStatus(player)}</span>
          <span class="waiver-projection">${player.projection != null ? Number(player.projection).toFixed(2) : '&mdash;'}</span>
          <span class="waiver-adds">${player.trending_adds ? formatAdds(player.trending_adds) : '&mdash;'}</span>
        </summary>
        ${intelMarkup(player)}
      </details>
    `;
  };
})();