const fs = require('fs');

const VALUES_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv';
const IDS_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function num(v) {
  if (v == null || v === '' || v === 'NA') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function text(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'mettlers-dynasty-dashboard/2.0' } });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

(async () => {
  const snapshot = JSON.parse(fs.readFileSync('snapshot.json', 'utf8'));
  const [valuesText, idsText] = await Promise.all([text(VALUES_URL), text(IDS_URL)]);
  const values = parseCsv(valuesText);
  const ids = parseCsv(idsText);

  const fpToSleeper = new Map(
    ids.filter(x => x.fantasypros_id && x.fantasypros_id !== 'NA' && x.sleeper_id && x.sleeper_id !== 'NA')
      .map(x => [String(x.fantasypros_id), String(x.sleeper_id)])
  );

  const marketBySleeper = new Map();
  const pickValues = [];
  let scrapeDate = null;

  for (const row of values) {
    if (row.scrape_date && (!scrapeDate || row.scrape_date > scrapeDate)) scrapeDate = row.scrape_date;
    if (row.pos === 'PICK') {
      pickValues.push({
        label: row.player,
        value_1qb: num(row.value_1qb),
        value_2qb: num(row.value_2qb),
        ecr_1qb: num(row.ecr_1qb),
        ecr_2qb: num(row.ecr_2qb)
      });
      continue;
    }
    const sleeperId = fpToSleeper.get(String(row.fp_id || ''));
    if (!sleeperId) continue;
    marketBySleeper.set(sleeperId, {
      dynasty_value_1qb: num(row.value_1qb),
      dynasty_value_2qb: num(row.value_2qb),
      dynasty_ecr_1qb: num(row.ecr_1qb),
      dynasty_ecr_2qb: num(row.ecr_2qb),
      dynasty_pos_ecr: num(row.ecr_pos)
    });
  }

  const enrich = p => Object.assign(p, marketBySleeper.get(String(p.player_id)) || {});
  for (const team of snapshot.teams || []) {
    for (const group of ['players', 'starters', 'reserve', 'taxi']) {
      for (const p of team[group] || []) enrich(p);
    }
  }
  for (const p of snapshot.free_agents || []) enrich(p);
  if (snapshot.my_team) {
    for (const group of ['players', 'starters', 'reserve', 'taxi']) {
      for (const p of snapshot.my_team[group] || []) enrich(p);
    }
  }

  snapshot.dynasty_market = {
    source: 'DynastyProcess / FantasyPros ECR-derived market values',
    scrape_date: scrapeDate,
    format: '1QB',
    matched_players: marketBySleeper.size,
    pick_values: pickValues
  };

  fs.writeFileSync('snapshot.json', JSON.stringify(snapshot, null, 2));
  console.log(`Dynasty market values: ${marketBySleeper.size} Sleeper IDs matched; source date ${scrapeDate || 'unknown'}`);
})().catch(err => { console.error(err); process.exit(1); });
