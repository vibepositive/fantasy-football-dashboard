const MY_USERNAME = "chrisgervais";
const MY_TEAM_NAME = "Boomtown Splash Hogs";
const LEAGUE_ID = "1312504205092610048";

const POSITIONS = ["QB", "RB", "WR", "TE"];

let snapshot = null;
let selectedRosterId = null;
let currentView = "rosters";
let waiverPosition = "ALL";
let waiverDisplayLimit = 100;
let tradePosition = "ALL";
let toastTimer = null;

const $ = id => document.getElementById(id);

function recordText(t) {
  const s = t.settings || {};
  return `${s.wins || 0}-${s.losses || 0}${s.ties ? `-${s.ties}` : ""}`;
}

function pointsFor(t) {
  const s = t.settings || {};
  return Number(s.fpts || 0) + Number(s.fpts_decimal || 0) / 100;
}

function formatAdds(n) {
  n = Number(n || 0);

  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }

  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  }

  return String(n);
}

function showToast(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2600);
}

function playerRow(p) {
  return `
    <div class="player-row">
      <span class="pos">${p.position || "&mdash;"}</span>

      <span class="player-info">
        <span class="player-name">${p.full_name || p.player_id}</span>

        <div class="player-meta">
          ${
            [
              p.team,
              p.age ? `Age ${p.age}` : null,
              p.injury_status
            ]
            .filter(Boolean)
            .join(" &bull; ")
          }
        </div>
      </span>

      <span class="projection">
        ${
          p.projection != null
            ? Number(p.projection).toFixed(2)
            : "&mdash;"
        }
      </span>
    </div>
  `;
}

function block(title, players) {
  return `
    <div class="roster-section">

      <div class="section-title-row">
        <div class="section-title">${title}</div>
        <div class="section-proj">PROJ</div>
      </div>

      ${
        players?.length
          ? players.map(playerRow).join("")
          : '<div class="player-meta">None</div>'
      }

    </div>
  `;
}

function card(t) {
  const mine =
    (t.username || "").toLowerCase() === MY_USERNAME ||
    String(t.display_name || "").toLowerCase() === MY_USERNAME ||
    String(t.team_name || "").toLowerCase() === MY_TEAM_NAME.toLowerCase();

  const starterIds = new Set(
    (t.starters || []).map(p => p.player_id)
  );

  const bench = (t.players || []).filter(
    p =>
      !starterIds.has(p.player_id) &&
      !p.reserve &&
      !p.taxi
  );

  const selected =
    String(t.roster_id) === String(selectedRosterId);

  const avatar = t.avatar_url
    ? `<img class="team-avatar" src="${t.avatar_url}" alt="">`
    : `
      <div class="team-avatar fallback">
        ${(t.team_name || t.display_name || "?").charAt(0).toUpperCase()}
      </div>
    `;

  return `
    <article
      class="team-card ${mine ? "mine" : ""} ${selected ? "selected" : ""}"
      data-roster="${t.roster_id}"
    >

      <div class="team-header">

        <div class="team-title-row">

          <div class="team-identity">

            ${avatar}

            <div>
              <h3 class="team-name">
                ${t.team_name || t.display_name || "Unnamed"}
                ${mine ? '<span class="badge">MY TEAM</span>' : ""}
              </h3>

              <div class="owner">
                @${t.username || t.display_name || "unknown"}
              </div>
            </div>

          </div>

          <span class="record">${recordText(t)}</span>

        </div>

        <div class="team-stats">

          <div class="team-stat">
            <span>Wins</span>
            <strong>${t.settings?.wins || 0}</strong>
          </div>

          <div class="team-stat">
            <span>Points</span>
            <strong>${pointsFor(t).toFixed(1)}</strong>
          </div>

          <div class="team-stat">
            <span>Players</span>
            <strong>${t.players?.length || 0}</strong>
          </div>

        </div>

      </div>

      ${block("Starters", t.starters)}
      ${block("Bench", bench)}
      ${block("IR / Reserve", t.reserve)}
      ${block("Taxi", t.taxi)}

    </article>
  `;
}

function renderRosters() {
  if (!snapshot) return;

  let teams = [...snapshot.teams];

  const q = $("searchInput").value
    .trim()
    .toLowerCase();

  if (q) {
    teams = teams.filter(t =>
      [
        t.team_name,
        t.username,
        t.display_name,
        ...(t.players || []).map(p => p.full_name)
      ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q)
    );
  }

  const sort = $("sortSelect").value;

  teams.sort((a, b) => {
    if (sort === "wins") {
      return (b.settings?.wins || 0) - (a.settings?.wins || 0);
    }

    if (sort === "points") {
      return pointsFor(b) - pointsFor(a);
    }

    return (a.team_name || "")
      .localeCompare(b.team_name || "");
  });

  $("teamsGrid").innerHTML =
    teams.map(card).join("");

  document
    .querySelectorAll(".team-card")
    .forEach(c => {
      c.onclick = () => {
        selectedRosterId = c.dataset.roster;

        const t = snapshot.teams.find(
          x =>
            String(x.roster_id) ===
            String(selectedRosterId)
        );

        $("selectedTeamName").textContent =
          t?.team_name || "Selected";

        $("analyzeSelectedBtn").disabled = false;

        renderRosters();
      };
    });
}

function waiverPriorityScore(p) {
  const adds = Number(p.trending_adds || 0);
  const proj = Number(p.projection || 0);

  let score = 0;

  if (adds > 0) {
    score += Math.log10(adds + 1) * 25;
  }

  score += proj * 3;

  if (p.team) {
    score += 5;
  }

  if (p.injury_status) {
    score -= 4;
  }

  return score;
}

function waiverSignal(p) {
  const adds = Number(p.trending_adds || 0);

  if (adds >= 10000) {
    return `<span class="waiver-signal hot">HOT</span>`;
  }

  if (adds >= 1000) {
    return `<span class="waiver-signal rising">RISING</span>`;
  }

  return "";
}

function waiverStatus(p) {
  if (p.injury_status) {
    return `
      <span class="injury-pill">
        ${p.injury_status}
      </span>
    `;
  }

  if (p.status && p.status !== "Active") {
    return `
      <span class="status-pill">
        ${p.status}
      </span>
    `;
  }

  return `
    <span class="healthy-status">
      Active
    </span>
  `;
}

function waiverRow(p) {
  return `
    <div class="waiver-row">

      <span class="pos">
        ${p.position || "&mdash;"}
      </span>

      <span class="waiver-player">

        <span class="waiver-name-line">
          <strong>${p.full_name || p.player_id}</strong>
          ${waiverSignal(p)}
        </span>

        <span class="player-meta">
          ${
            [
              p.team || "FA",
              p.age ? `Age ${p.age}` : null
            ]
            .filter(Boolean)
            .join(" &bull; ")
          }
        </span>

      </span>

      <span class="waiver-status">
        ${waiverStatus(p)}
      </span>

      <span class="waiver-projection">
        ${
          p.projection != null
            ? Number(p.projection).toFixed(2)
            : "&mdash;"
        }
      </span>

      <span class="waiver-adds">
        ${
          p.trending_adds
            ? formatAdds(p.trending_adds)
            : "&mdash;"
        }
      </span>

    </div>
  `;
}

function filteredWaivers() {
  if (!snapshot?.free_agents) {
    return [];
  }

  let players = [...snapshot.free_agents];

  if (waiverPosition !== "ALL") {
    players = players.filter(
      p => p.position === waiverPosition
    );
  }

  const q =
    $("waiverSearchInput")
      .value
      .trim()
      .toLowerCase();

  if (q) {
    players = players.filter(
      p =>
        [
          p.full_name,
          p.team,
          p.position,
          p.injury_status,
          p.status
        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  const sort =
    $("waiverSortSelect").value;

  players.sort((a, b) => {

    if (sort === "projection") {
      return (
        (b.projection ?? -999) -
        (a.projection ?? -999)
      );
    }

    if (sort === "trending") {
      return (
        Number(b.trending_adds || 0) -
        Number(a.trending_adds || 0)
      );
    }

    if (sort === "name") {
      return (a.full_name || "")
        .localeCompare(b.full_name || "");
    }

    if (sort === "age") {
      return (
        (a.age ?? 999) -
        (b.age ?? 999)
      );
    }

    return (
      waiverPriorityScore(b) -
      waiverPriorityScore(a)
    );
  });

  return players;
}

function renderWaivers() {
  if (!snapshot) return;

  const players = filteredWaivers();

  const shown =
    players.slice(0, waiverDisplayLimit);

  $("waiverList").innerHTML =
    shown.length
      ? shown.map(waiverRow).join("")
      : `
        <div class="empty-waivers">
          No matching unrostered players.
        </div>
      `;

  $("waiverShowing").textContent =
    `Showing ${Math.min(shown.length, players.length)} of ${players.length} players`;

  $("showMoreWaiversBtn").hidden =
    shown.length >= players.length;

  const all = snapshot.free_agents || [];

  const counts = {
    QB: all.filter(p => p.position === "QB").length,
    RB: all.filter(p => p.position === "RB").length,
    WR: all.filter(p => p.position === "WR").length,
    TE: all.filter(p => p.position === "TE").length
  };

  const trending =
    all.filter(p => Number(p.trending_adds || 0) > 0).length;

  const projected =
    all.filter(p => p.projection != null).length;

  const injured =
    all.filter(p => p.injury_status).length;

  $("waiverSummary").innerHTML = `
    <span>${all.length} available</span>
    <span>QB ${counts.QB}</span>
    <span>RB ${counts.RB}</span>
    <span>WR ${counts.WR}</span>
    <span>TE ${counts.TE}</span>
    <span>${projected} projected</span>
    <span>${trending} trending</span>
    <span>${injured} injury designations</span>
  `;

  $("waiverCountBadge").textContent =
    all.length.toLocaleString();
}

/* ---------- TRADE MARKET ---------- */

const POSITION_DEPTH = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1
};

function projectedPlayers(t, pos) {
  return (t.players || [])
    .filter(
      p =>
        p.position === pos &&
        !p.reserve &&
        p.projection != null
    )
    .sort(
      (a, b) =>
        Number(b.projection || 0) -
        Number(a.projection || 0)
    );
}

function positionStrength(t, pos) {
  const n = POSITION_DEPTH[pos] || 1;

  const players =
    projectedPlayers(t, pos).slice(0, n);

  if (!players.length) {
    return 0;
  }

  return players.reduce(
    (sum, p) =>
      sum + Number(p.projection || 0),
    0
  ) / n;
}

function median(values) {
  const nums =
    values
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

  if (!nums.length) return 0;

  const mid =
    Math.floor(nums.length / 2);

  if (nums.length % 2) {
    return nums[mid];
  }

  return (nums[mid - 1] + nums[mid]) / 2;
}

function leagueMedians() {
  const out = {};

  POSITIONS.forEach(pos => {
    out[pos] =
      median(
        snapshot.teams.map(
          t => positionStrength(t, pos)
        )
      );
  });

  return out;
}

function teamNeeds(t, medians) {
  return POSITIONS
    .map(pos => {
      const strength =
        positionStrength(t, pos);

      const med =
        medians[pos] || 1;

      const ratio =
        strength / med;

      return {
        position: pos,
        strength,
        median: med,
        ratio,
        deficit: Math.max(
          0,
          med - strength
        )
      };
    })
    .filter(x => x.ratio < 0.94)
    .sort(
      (a, b) =>
        a.ratio - b.ratio
    );
}

function teamSurpluses(t, medians) {
  return POSITIONS
    .map(pos => ({
      position: pos,
      strength: positionStrength(t, pos),
      median: medians[pos]
    }))
    .filter(
      x =>
        x.median > 0 &&
        x.strength >
          x.median * 1.08
    )
    .sort(
      (a, b) =>
        (b.strength / b.median) -
        (a.strength / a.median)
    );
}

function myTeam() {
  return (
    snapshot.my_team ||
    snapshot.teams.find(
      t =>
        [t.username, t.display_name]
          .some(
            v =>
              String(v || "").toLowerCase() ===
              MY_USERNAME
          ) ||
        String(t.team_name || "").toLowerCase() ===
          MY_TEAM_NAME.toLowerCase()
    )
  );
}

function myStarterFloor(pos) {
  const mine = myTeam();

  const samePositionStarters =
    (mine?.starters || [])
      .filter(
        p =>
          p.position === pos &&
          p.projection != null
      )
      .map(
        p => Number(p.projection || 0)
      );

  if (samePositionStarters.length) {
    return Math.min(
      ...samePositionStarters
    );
  }

  const rosterPlayers =
    projectedPlayers(
      mine,
      pos
    );

  return rosterPlayers.length
    ? Number(rosterPlayers[0].projection || 0)
    : 0;
}

function boomtownTradeAssets(partnerNeeds) {
  const mine = myTeam();

  if (!mine) return [];

  const starterIds =
    new Set(
      (mine.starters || [])
        .map(p => String(p.player_id))
    );

  let assets =
    (mine.players || [])
      .filter(
        p =>
          POSITIONS.includes(p.position) &&
          !p.reserve &&
          !p.taxi &&
          !starterIds.has(
            String(p.player_id)
          )
      );

  const needPositions =
    new Set(
      partnerNeeds.map(
        n => n.position
      )
    );

  assets.sort((a, b) => {
    const aNeed =
      needPositions.has(a.position)
        ? 1
        : 0;

    const bNeed =
      needPositions.has(b.position)
        ? 1
        : 0;

    if (aNeed !== bNeed) {
      return bNeed - aNeed;
    }

    return (
      Number(b.projection || 0) -
      Number(a.projection || 0)
    );
  });

  return assets;
}

function tradeFitScore(
  target,
  partner,
  boomNeeds,
  partnerNeeds,
  boomSurpluses
) {
  const posNeed =
    boomNeeds.find(
      n =>
        n.position ===
        target.position
    );

  const improvement =
    Math.max(
      0,
      Number(target.projection || 0) -
      myStarterFloor(target.position)
    );

  let score = 45;

  score +=
    improvement * 4;

  if (posNeed) {
    score +=
      Math.min(
        18,
        posNeed.deficit * 2
      );
  }

  const partnerNeedPositions =
    new Set(
      partnerNeeds.map(
        x => x.position
      )
    );

  const boomSurplusPositions =
    new Set(
      boomSurpluses.map(
        x => x.position
      )
    );

  const matchCount =
    [...partnerNeedPositions]
      .filter(
        p =>
          boomSurplusPositions.has(p)
      ).length;

  score +=
    matchCount * 6;

  if (
    target.age != null &&
    target.age <= 25
  ) {
    score += 4;
  }

  if (target.injury_status) {
    score -= 5;
  }

  return Math.max(
    1,
    Math.min(
      99,
      Math.round(score)
    )
  );
}

function buildTradeRecommendations() {
  const mine = myTeam();

  if (!mine) {
    return [];
  }

  const medians =
    leagueMedians();

  let boomNeeds =
    teamNeeds(mine, medians);

  if (!boomNeeds.length) {
    boomNeeds =
      POSITIONS
        .map(pos => ({
          position: pos,
          strength: positionStrength(mine, pos),
          median: medians[pos],
          ratio:
            positionStrength(mine, pos) /
            (medians[pos] || 1),
          deficit:
            Math.max(
              0,
              (medians[pos] || 0) -
              positionStrength(mine, pos)
            )
        }))
        .sort(
          (a, b) =>
            a.ratio - b.ratio
        );
  }

  const boomNeedPositions =
    new Set(
      boomNeeds
        .slice(0, 3)
        .map(x => x.position)
    );

  const boomSurpluses =
    teamSurpluses(
      mine,
      medians
    );

  const ideas = [];

  snapshot.teams
    .filter(
      t =>
        String(t.roster_id) !==
        String(mine.roster_id)
    )
    .forEach(partner => {

      const partnerNeeds =
        teamNeeds(
          partner,
          medians
        );

      const candidates =
        (partner.players || [])
          .filter(
            p =>
              POSITIONS.includes(p.position) &&
              !p.reserve &&
              p.projection != null &&
              boomNeedPositions.has(
                p.position
              )
          )
          .sort(
            (a, b) =>
              Number(b.projection || 0) -
              Number(a.projection || 0)
          );

      candidates
        .slice(0, 4)
        .forEach(target => {

          const baseline =
            myStarterFloor(
              target.position
            );

          const improvement =
            Number(target.projection || 0) -
            baseline;

          if (improvement < 1.0) {
            return;
          }

          const assets =
            boomtownTradeAssets(
              partnerNeeds
            );

          const mainAsset =
            assets[0] || null;

          const secondAsset =
            assets.find(
              p =>
                !mainAsset ||
                p.player_id !==
                  mainAsset.player_id
            ) || null;

          const fit =
            tradeFitScore(
              target,
              partner,
              boomNeeds,
              partnerNeeds,
              boomSurpluses
            );

          ideas.push({
            partner,
            target,
            improvement,
            fit,
            partnerNeeds,
            mainAsset,
            secondAsset
          });
        });
    });

  ideas.sort((a, b) =>
    b.fit - a.fit ||
    b.improvement - a.improvement ||
    Number(b.target.projection || 0) -
    Number(a.target.projection || 0)
  );

  const teamCounts = {};
  const seenTargets =
    new Set();

  return ideas.filter(idea => {

    const id =
      String(
        idea.target.player_id
      );

    const rid =
      String(
        idea.partner.roster_id
      );

    if (seenTargets.has(id)) {
      return false;
    }

    if ((teamCounts[rid] || 0) >= 2) {
      return false;
    }

    seenTargets.add(id);

    teamCounts[rid] =
      (teamCounts[rid] || 0) + 1;

    return true;

  }).slice(0, 15);
}

function needText(needs) {
  if (!needs.length) {
    return "No major positional deficiency detected";
  }

  return needs
    .slice(0, 3)
    .map(n => n.position)
    .join(", ");
}

function openingFramework(idea) {
  if (!idea.mainAsset) {
    return "Use future draft capital or a depth package as the opening framework.";
  }

  const partnerNeed =
    idea.partnerNeeds.some(
      n =>
        n.position ===
        idea.mainAsset.position
    );

  if (partnerNeed) {
    return `${idea.mainAsset.full_name} + value adjustment`;
  }

  if (idea.secondAsset) {
    return `${idea.mainAsset.full_name} + ${idea.secondAsset.full_name} as a package framework`;
  }

  return `${idea.mainAsset.full_name} + value adjustment`;
}

function tradeCard(idea, index) {
  const target =
    idea.target;

  const partner =
    idea.partner;

  return `
    <article class="panel trade-card">

      <div class="trade-card-top">

        <div>
          <span class="trade-rank">
            #${index + 1} TRADE TARGET
          </span>

          <h3>${target.full_name}</h3>

          <div class="player-meta">
            ${
              [
                target.position,
                target.team,
                target.age
                  ? `Age ${target.age}`
                  : null,
                target.injury_status
              ]
              .filter(Boolean)
              .join(" &bull; ")
            }
          </div>

          <div class="trade-owner">
            <span>OWNER</span>
            <strong>${partner.team_name || partner.display_name || "Team"}</strong>
          </div>

        </div>

        <div class="trade-fit">
          <span>FIT</span>
          <strong>${idea.fit}</strong>
        </div>

      </div>

      <div class="trade-metrics">

        <div>
          <span>PROJ</span>
          <strong>
            ${Number(target.projection || 0).toFixed(2)}
          </strong>
        </div>

        <div>
          <span>LINEUP GAIN</span>
          <strong class="${idea.improvement > 0 ? "positive" : ""}">
            +${idea.improvement.toFixed(2)}
          </strong>
        </div>

      </div>

      <div class="trade-detail">

        <span class="trade-detail-label">
          THEIR NEEDS
        </span>

        <span>
          ${needText(idea.partnerNeeds)}
        </span>

      </div>

      <div class="trade-detail">

        <span class="trade-detail-label">
          OPENING FRAMEWORK
        </span>

        <strong>
          ${openingFramework(idea)}
        </strong>

      </div>

      <p class="trade-note">
        This framework identifies roster fit only. Dynasty market value,
        player news and exact pick compensation should be validated before sending.
      </p>

      <button
        class="analyze-trade-btn"
        data-target="${target.player_id}"
        data-roster="${partner.roster_id}"
      >
        Analyze This Trade
      </button>

    </article>
  `;
}

function renderTradeMarket() {
  if (!snapshot) return;

  const mine =
    myTeam();

  const medians =
    leagueMedians();

  const boomNeeds =
    teamNeeds(
      mine,
      medians
    );

  let ideas =
    buildRealisticTradeRecommendations();

  if (tradePosition !== "ALL") {
    ideas =
      ideas.filter(
        x =>
          x.target.position ===
          tradePosition
      );
  }

  const topNeed =
    boomNeeds[0];

  $("boomtownTopNeed").textContent =
    topNeed?.position ||
    "Balanced";

  $("boomtownNeedDetail").textContent =
    topNeed
      ? `Projected positional strength trails the league median`
      : "No major projection deficit detected";

  $("bestTradePartner").textContent =
    ideas[0]?.partner?.team_name || "-";

  $("bestPartnerDetail").textContent =
    ideas[0]
      ? `Needs: ${needText(ideas[0].partnerNeeds)}`
      : "No strong match detected";

  $("topTradeTarget").textContent =
    ideas[0]?.target?.full_name || "-";

  $("topTargetDetail").textContent =
    ideas[0]
      ? `${ideas[0].target.position} | +${ideas[0].improvement.toFixed(2)} projected lineup gain`
      : "No target detected";

  $("tradeRecommendations").innerHTML =
    ideas.length
      ? ideas
          .map(tradeCard)
          .join("")
      : `
        <article class="panel empty-trades">
          No trade targets matched the current filter.
        </article>
      `;

  document
    .querySelectorAll(
      ".analyze-trade-btn"
    )
    .forEach(btn => {

      btn.onclick = () => {

        const partner =
          snapshot.teams.find(
            t =>
              String(t.roster_id) ===
              String(btn.dataset.roster)
          );

        const target =
          partner?.players?.find(
            p =>
              String(p.player_id) ===
              String(btn.dataset.target)
          );

        if (!partner || !target) {
          return;
        }

        launchAnalysis(
          tradePrompt(
            partner,
            target
          )
        );
      };
    });
}

/* ---------- NAVIGATION / PROMPTS ---------- */

function switchView(view) {
  currentView = view;

  $("rostersView").hidden =
    view !== "rosters";

  $("waiversView").hidden =
    view !== "waivers";

  $("tradesView").hidden =
    view !== "trades";

  $("analyzeMyTeamBtn")
    .classList
    .toggle(
      "active",
      view === "rosters"
    );

  $("analyzeWaiversBtn")
    .classList
    .toggle(
      "active",
      view === "waivers"
    );

  $("analyzeTradesBtn")
    .classList
    .toggle(
      "active",
      view === "trades"
    );

  if (view === "rosters") {
    renderRosters();
  }

  if (view === "waivers") {
    renderWaivers();
  }

  if (view === "trades") {
    renderTradeMarket();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function snapUrl() {
  return `${location.origin}${location.pathname.replace(/\/[^/]*$/, "/")}snapshot.json`;
}

function basePrompt() {
  return `You are my dynasty fantasy football GM and trade analyst.

Sleeper league ID: ${LEAGUE_ID}
My Sleeper username: ${MY_USERNAME}
My team: ${MY_TEAM_NAME}

Goal: build the strongest possible contender THIS season while still respecting long-term dynasty value.

Use the latest league snapshot here:
${snapUrl()}

Treat that snapshot as the source of truth for league settings, scoring, rosters, available players, records, picks, projections, injury designations, Sleeper trending adds and recent transactions.

Use current NFL news, injuries, usage, depth-chart changes and dynasty/redraft market information where relevant.`;
}

function setPrompt(x) {
  $("promptBox").value = x;
  $("copyPromptBtn").disabled = false;
  $("copyStatus").textContent = "Prompt ready.";
}

async function launchAnalysis(prompt) {
  setPrompt(prompt);

  try {
    await navigator.clipboard.writeText(prompt);

    $("copyStatus").textContent =
      "Prompt copied. Paste it into ChatGPT.";

    showToast(
      "Trade analysis prompt copied - paste it into ChatGPT."
    );
  } catch (err) {
    $("copyStatus").textContent =
      "Prompt ready. Copy it manually if needed.";

    showToast(
      "ChatGPT opened - copy the trade prompt below and paste it into ChatGPT."
    );
  }

  window.open(
    "https://chatgpt.com/",
    "_blank",
    "noopener"
  );
}

function waiverPrompt() {
  return `${basePrompt()}

Analyze the entire unrostered player pool in snapshot.free_agents specifically for Boomtown Splash Hogs.

Compare the available QB, RB, WR and TE pool against my actual roster.

Pay special attention to injuries, opportunity changes, projections, Sleeper trending adds, recent role changes, snap share, carries, targets, routes, red-zone usage and young breakout candidates.

For every meaningful player classify him:
CLAIM NOW
WATCH
IGNORE

For each CLAIM NOW player tell me exactly which Boomtown player I should drop.

Finish with:
- Top 10 waiver targets
- Top 5 speculative dynasty stashes
- Top injury-away RBs
- Best immediate starter
- Best long-term upside claim`;
}


function tradePrompt(partner, target) {
  return `${basePrompt()}

I am specifically considering trading with:

Team: ${partner.team_name || partner.display_name}
Target player: ${target.full_name}
Position: ${target.position}
NFL team: ${target.team || "N/A"}
Age: ${target.age ?? "N/A"}
Current projection: ${target.projection ?? "N/A"}

Compare Boomtown Splash Hogs against this team's actual roster.

Determine:
- whether ${target.full_name} meaningfully improves my 2026 starting lineup
- what this manager needs
- which Boomtown players would appeal to them
- the best realistic opening offer
- two alternative offers
- the absolute maximum price I should pay
- whether I should pursue or walk away

Use current NFL news and dynasty market context in addition to the snapshot.`;
}
$("waiverAnalyzeTopBtn").onclick =
  () => {
    setPrompt(
      waiverPrompt()
    );
  };


$("analyzeSelectedBtn").onclick =
  () => {

    const t =
      snapshot.teams.find(
        x =>
          String(x.roster_id) ===
          String(selectedRosterId)
      );

    if (t) {
      setPrompt(`${basePrompt()}

Analyze trade possibilities specifically with ${t.team_name} (@${t.username || t.display_name}).

Compare our rosters, classify their competitive timeline, identify mutual needs, then give at least five realistic trades that improve my 2026 lineup and explain why each side might accept.`);
    }
  };

$("copyPromptBtn").onclick =
  async () => {
    await navigator.clipboard.writeText(
      $("promptBox").value
    );

    $("copyStatus").textContent =
      "Copied. Open ChatGPT and paste it.";

    showToast(
      "Prompt copied to clipboard."
    );
  };

$("searchInput").oninput =
  renderRosters;

$("sortSelect").onchange =
  renderRosters;

$("waiverSearchInput").oninput =
  () => {
    waiverDisplayLimit = 100;
    renderWaivers();
  };

$("waiverSortSelect").onchange =
  () => {
    waiverDisplayLimit = 100;
    renderWaivers();
  };

$("tradePositionFilter").onchange =
  () => {
    tradePosition =
      $("tradePositionFilter").value;

    renderTradeMarket();
  };
$("analyzeMyTeamBtn").onclick =
  () =>
    switchView("rosters");

$("analyzeWaiversBtn").onclick =
  () =>
    switchView("waivers");

$("analyzeTradesBtn").onclick =
  () =>
    switchView("trades");

document
  .querySelectorAll(".position-filter")
  .forEach(btn => {

    btn.onclick = () => {

      waiverPosition =
        btn.dataset.position;

      waiverDisplayLimit = 100;

      document
        .querySelectorAll(
          ".position-filter"
        )
        .forEach(
          b =>
            b.classList.remove(
              "active"
            )
        );

      btn.classList.add(
        "active"
      );

      renderWaivers();
    };
  });

$("showMoreWaiversBtn").onclick =
  () => {
    waiverDisplayLimit += 100;
    renderWaivers();
  };

(async () => {
  try {

    const r =
      await fetch(
        `snapshot.json?ts=${Date.now()}`
      );

    snapshot =
      await r.json();

    $("leagueName").textContent =
      snapshot.league?.name ||
      "Sleeper League";

    $("leagueSize").textContent =
      `${snapshot.league?.total_rosters || snapshot.teams?.length || 0} teams | ${snapshot.league?.season || ""}`;

    $("leagueMeta").textContent =
      `${snapshot.league?.name || "Sleeper League"} | ${snapshot.league?.season || ""} | Week ${snapshot.current_week || ""}`;

    const mine =
      myTeam();

    $("myTeamName").textContent =
      mine?.team_name ||
      MY_TEAM_NAME;

    $("myRecord").textContent =
      mine
        ? `${recordText(mine)} | ${pointsFor(mine).toFixed(1)} PF`
        : "Roster not found";

    $("updatedAt").textContent =
      snapshot.generated_at
        ? new Date(
            snapshot.generated_at
          ).toLocaleString()
        : "Unknown";

    renderRosters();
    renderWaivers();
    renderTradeMarket();

  } catch (e) {

    $("teamsGrid").innerHTML = `
      <div class="panel error-panel">
        Run the GitHub Action once to generate league data.
        <br>
        <span class="muted">${e.message}</span>
      </div>
    `;

  }
})();

/* ---------- REALISTIC TRADEABILITY ENGINE ---------- */

function leaguePositionPool(pos) {
  return snapshot.teams
    .flatMap(t =>
      (t.players || []).map(p => ({
        ...p,
        roster_id: t.roster_id
      }))
    )
    .filter(
      p =>
        p.position === pos &&
        p.projection != null
    )
    .sort(
      (a, b) =>
        Number(b.projection || 0) -
        Number(a.projection || 0)
    );
}

function positionalRank(player) {
  const pool =
    leaguePositionPool(player.position);

  const index =
    pool.findIndex(
      p =>
        String(p.player_id) ===
        String(player.player_id)
    );

  return index >= 0
    ? index + 1
    : 999;
}

function positionalPercentile(player) {
  const pool =
    leaguePositionPool(player.position);

  if (pool.length <= 1) {
    return 0;
  }

  const rank =
    positionalRank(player);

  if (rank === 999) {
    return 0;
  }

  return 1 -
    ((rank - 1) / (pool.length - 1));
}

function isStarterForTeam(player, team) {
  return new Set(
    (team.starters || [])
      .map(p => String(p.player_id))
  ).has(
    String(player.player_id)
  );
}

function positionDepthCount(team, pos) {
  return (team.players || [])
    .filter(
      p =>
        p.position === pos &&
        !p.reserve &&
        p.projection != null
    )
    .length;
}

function coreAgeLimit(pos) {
  if (pos === "QB") {
    return 30;
  }

  if (pos === "TE") {
    return 28;
  }

  return 27;
}

function veteranAge(pos) {
  if (pos === "QB") {
    return 32;
  }

  if (pos === "TE") {
    return 29;
  }

  if (pos === "WR") {
    return 29;
  }

  return 28;
}

function tradeabilityProfile(player, owner, medians) {
  const rank =
    positionalRank(player);

  const percentile =
    positionalPercentile(player);

  const age =
    Number(player.age || 0);

  const starter =
    isStarterForTeam(
      player,
      owner
    );

  const depth =
    positionDepthCount(
      owner,
      player.position
    );

  const normalDepth =
    POSITION_DEPTH[player.position] || 1;

  const ownerStrength =
    positionStrength(
      owner,
      player.position
    );

  const medianStrength =
    medians[player.position] || 0;

  const surplus =
    medianStrength > 0 &&
    ownerStrength >
      medianStrength * 1.12 &&
    depth > normalDepth;

  const youngCore =
    age > 0 &&
    age <= coreAgeLimit(
      player.position
    );

  const veteran =
    age >= veteranAge(
      player.position
    );

  /*
    Truly elite assets should almost never appear as
    routine trade recommendations.
  */

  if (rank <= 3 && !veteran) {
    return {
      eligible: false,
      score: 5,
      label: "CORNERSTONE",
      reason:
        `Top-${rank} projected ${player.position} and still in core age range`
    };
  }

  if (
    percentile >= 0.90 &&
    youngCore &&
    starter
  ) {
    return {
      eligible: false,
      score: 10,
      label: "CORNERSTONE",
      reason:
        `Elite young starting ${player.position}`
    };
  }

  /*
    Extremely strong prime-age assets aren't impossible
    to trade for, but shouldn't be presented as routine
    targets unless the owner has obvious surplus.
  */

  if (
    percentile >= 0.94 &&
    starter &&
    !veteran &&
    !surplus
  ) {
    return {
      eligible: false,
      score: 20,
      label: "VERY UNLIKELY",
      reason:
        `Owner lacks enough positional surplus to justify moving an elite starter`
    };
  }

  let score = 45;
  const reasons = [];

  if (!starter) {
    score += 22;
    reasons.push("not currently starting");
  }

  if (surplus) {
    score += 18;
    reasons.push(
      `owner has ${player.position} depth`
    );
  }

  if (veteran) {
    score += 13;
    reasons.push(
      "productive veteran"
    );
  }

  if (
    percentile >= 0.75 &&
    percentile < 0.90
  ) {
    score += 4;
    reasons.push(
      "strong but non-elite asset"
    );
  }

  if (
    percentile >= 0.90 &&
    starter
  ) {
    score -= 15;
    reasons.push(
      "high-end starter"
    );
  }

  if (
    youngCore &&
    percentile >= 0.80
  ) {
    score -= 12;
    reasons.push(
      "young core asset"
    );
  }

  if (player.injury_status) {
    score += 3;
    reasons.push(
      "injury may reduce acquisition cost"
    );
  }

  score =
    Math.max(
      1,
      Math.min(
        99,
        Math.round(score)
      )
    );

  let label = "AVAILABLE";

  if (score >= 75) {
    label = "REALISTIC";
  } else if (score >= 55) {
    label = "POSSIBLE";
  } else {
    label = "DIFFICULT";
  }

  return {
    eligible: score >= 42,
    score,
    label,
    rank,
    percentile,
    starter,
    surplus,
    veteran,
    reason:
      reasons.join(", ") ||
      "normal trade market"
  };
}

function buildRealisticTradeRecommendations() {
  const mine =
    myTeam();

  if (!mine) {
    return [];
  }

  const medians =
    leagueMedians();

  let boomNeeds =
    teamNeeds(
      mine,
      medians
    );

  if (!boomNeeds.length) {
    boomNeeds =
      POSITIONS
        .map(pos => ({
          position: pos,
          strength:
            positionStrength(
              mine,
              pos
            ),
          median:
            medians[pos],
          ratio:
            positionStrength(
              mine,
              pos
            ) /
            (medians[pos] || 1),
          deficit:
            Math.max(
              0,
              (medians[pos] || 0) -
              positionStrength(
                mine,
                pos
              )
            )
        }))
        .sort(
          (a, b) =>
            a.ratio - b.ratio
        );
  }

  const boomNeedPositions =
    new Set(
      boomNeeds
        .slice(0, 3)
        .map(x => x.position)
    );

  const boomSurpluses =
    teamSurpluses(
      mine,
      medians
    );

  const ideas = [];

  snapshot.teams
    .filter(
      partner =>
        String(partner.roster_id) !==
        String(mine.roster_id)
    )
    .forEach(partner => {

      const partnerNeeds =
        teamNeeds(
          partner,
          medians
        );

      const candidates =
        (partner.players || [])
          .filter(
            p =>
              POSITIONS.includes(
                p.position
              ) &&
              !p.reserve &&
              p.projection != null &&
              boomNeedPositions.has(
                p.position
              )
          );

      candidates.forEach(target => {

        const tradeability =
          tradeabilityProfile(
            target,
            partner,
            medians
          );

        /*
          Hard stop for cornerstone / unrealistic targets.
        */

        if (!tradeability.eligible) {
          return;
        }

        const baseline =
          myStarterFloor(
            target.position
          );

        const improvement =
          Number(
            target.projection || 0
          ) - baseline;

        /*
          Don't bother recommending lateral moves.
        */

        if (improvement < 1.5) {
          return;
        }

        const assets =
          boomtownTradeAssets(
            partnerNeeds
          );

        const mainAsset =
          assets[0] || null;

        const secondAsset =
          assets.find(
            p =>
              !mainAsset ||
              p.player_id !==
                mainAsset.player_id
          ) || null;

        /*
          Original roster-fit score.
        */

        const rosterFit =
          tradeFitScore(
            target,
            partner,
            boomNeeds,
            partnerNeeds,
            boomSurpluses
          );

        /*
          Final score now includes how realistically
          obtainable the player appears.
        */

        const realisticFit =
          Math.round(
            rosterFit * 0.68 +
            tradeability.score * 0.32
          );

        /*
          Give an additional boost when the opposing
          manager has a need that Boomtown can fill.
        */

        const boomAssetPositions =
          new Set(
            assets
              .slice(0, 5)
              .map(
                p => p.position
              )
          );

        const partnerNeedPositions =
          new Set(
            partnerNeeds.map(
              p => p.position
            )
          );

        const mutualFit =
          [...boomAssetPositions]
            .some(
              pos =>
                partnerNeedPositions.has(
                  pos
                )
            );

        const finalFit =
          Math.min(
            99,
            realisticFit +
            (mutualFit ? 6 : 0)
          );

        /*
          Require a reasonably compelling overall match.
        */

        if (finalFit < 55) {
          return;
        }

        ideas.push({
          partner,
          target,
          improvement,
          fit: finalFit,
          partnerNeeds,
          mainAsset,
          secondAsset,
          tradeability,
          mutualFit
        });

      });
    });

  ideas.sort((a, b) => {

    /*
      Prefer realistic acquisition probability first,
      then overall trade fit and lineup improvement.
    */

    return (
      b.tradeability.score -
        a.tradeability.score ||
      b.fit -
        a.fit ||
      b.improvement -
        a.improvement
    );
  });

  const teamCounts = {};
  const seenTargets =
    new Set();

  return ideas
    .filter(idea => {

      const playerId =
        String(
          idea.target.player_id
        );

      const rosterId =
        String(
          idea.partner.roster_id
        );

      if (
        seenTargets.has(playerId)
      ) {
        return false;
      }

      /*
        Don't let one roster dominate the entire board.
      */

      if (
        (teamCounts[rosterId] || 0) >= 2
      ) {
        return false;
      }

      seenTargets.add(
        playerId
      );

      teamCounts[rosterId] =
        (teamCounts[rosterId] || 0) + 1;

      return true;

    })
    .slice(0, 15);
}
