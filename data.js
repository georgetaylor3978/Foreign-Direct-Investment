/**
 * data.js — Capital Flight Dashboard
 * Loads and parses the Stats Canada CSV at runtime.
 * Source: Table 36-10-0025-01 (Quarterly FDI Flows, CAD Millions)
 *
 * Sign convention:
 *   "Canadian direct investment abroad" = OUTFLOW  (flip sign for Net)
 *   "Foreign direct investment in Canada" = INFLOW  (positive)
 *   Net = Inflow − Outflow
 */

const CSV_PATH = 'CapFlightData/3610002501_databaseLoadingData.csv';

// Month code → Quarter label
const MONTH_TO_Q = { '01': 'Q1', '04': 'Q2', '07': 'Q3', '10': 'Q4' };

/**
 * Parse one CSV line respecting quoted fields.
 */
function parseCsvLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  result.push(cur.trim());
  return result;
}

/**
 * Load and parse the CSV. Returns a structured data object:
 * {
 *   quarterly: Map< `${type}|${country}|${flowType}` → Map<`${year}-${Q}` → value> >,
 *   years: number[],
 *   quarters: string[]
 * }
 */
async function loadData() {
  const resp = await fetch(CSV_PATH);
  const text = await resp.text();
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  const quarterly = new Map();
  const yearsSet = new Set();
  const quartersSet = new Set();

  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 13) continue;

    const refDate  = cols[0];   // e.g. "2023-01"
    const invType  = cols[3];   // "Canadian direct investment abroad" | "Foreign direct investment in Canada"
    const country  = cols[4];   // "All countries" | "United States" | "All other countries"
    const flowType = cols[5];   // "Total net flows" | "Mergers and acquisitions" | ...
    const rawVal   = cols[12];  // numeric value

    const val = rawVal === '' || rawVal === '..' ? null : parseFloat(rawVal);
    if (val === null) continue;

    const parts = refDate.split('-');
    if (parts.length !== 2) continue;
    const year  = parseInt(parts[0], 10);
    const month = parts[1];
    const qKey  = MONTH_TO_Q[month];
    if (!qKey) continue;

    const qLabel = `${year}-${qKey}`;
    yearsSet.add(year);
    quartersSet.add(qLabel);

    const mapKey = `${invType}|${country}|${flowType}`;
    if (!quarterly.has(mapKey)) quarterly.set(mapKey, new Map());
    quarterly.get(mapKey).set(qLabel, val);
  }

  const years = [...yearsSet].sort((a, b) => a - b);

  // Build sorted quarter list
  const quarters = [];
  for (const y of years) {
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
      const lbl = `${y}-${q}`;
      if (quartersSet.has(lbl)) quarters.push(lbl);
    }
  }

  return { quarterly, years, quarters };
}

// ── AGGREGATION HELPERS ───────────────────────────────────────────────────────

const TYPE_ABROAD = 'Canadian direct investment abroad';
const TYPE_INCA   = 'Foreign direct investment in Canada';
const FLOW_TOTAL  = 'Total net flows';
const FLOW_MA     = 'Mergers and acquisitions';
const FLOW_RE     = 'Reinvested earnings';
const FLOW_OTHER  = 'Other flows';

const FLOW_TYPES  = [FLOW_TOTAL, FLOW_MA, FLOW_RE, FLOW_OTHER];
const COUNTRIES   = ['All countries', 'United States', 'All other countries'];

/** Sum all quarterly values for a given year from a value map */
function sumYear(valueMap, year) {
  let total = 0, count = 0;
  for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
    const v = valueMap?.get(`${year}-${q}`);
    if (v != null) { total += v; count++; }
  }
  return count > 0 ? total : null;
}

/**
 * Build annual rows: { year, outflow, inflow, net }
 *   outflow = Canadian abroad (positive = leaving)
 *   inflow  = Foreign in Canada (positive = entering)
 *   net     = inflow - outflow
 */
function buildAnnualRows(quarterly, years, country = 'All countries', flowType = FLOW_TOTAL) {
  const outMap = quarterly.get(`${TYPE_ABROAD}|${country}|${flowType}`);
  const inMap  = quarterly.get(`${TYPE_INCA}|All countries|${FLOW_TOTAL}`);

  return years.map(year => {
    const outflow = sumYear(outMap, year);
    const inflow  = sumYear(inMap, year);
    const net = (outflow != null && inflow != null) ? inflow - outflow : null;
    return { year, outflow, inflow, net };
  });
}

/**
 * Build quarterly rows: { quarter, outflow, inflow, net }
 */
function buildQuarterlyRows(quarterly, quarters, country = 'All countries', flowType = FLOW_TOTAL) {
  const outMap = quarterly.get(`${TYPE_ABROAD}|${country}|${flowType}`);
  const inMap  = quarterly.get(`${TYPE_INCA}|All countries|${FLOW_TOTAL}`);

  return quarters.map(q => {
    const outflow = outMap?.get(q) ?? null;
    const inflow  = inMap?.get(q)  ?? null;
    const net = (outflow != null && inflow != null) ? inflow - outflow : null;
    return { quarter: q, outflow, inflow, net };
  }).filter(r => r.outflow != null || r.inflow != null);
}

/**
 * Build annual component breakdown (abroad only):
 * { year, outTotal, outMA, outRE, outOther, inflow, net }
 */
function buildComponentRows(quarterly, years) {
  const maps = {};
  for (const ft of FLOW_TYPES) {
    maps[ft] = quarterly.get(`${TYPE_ABROAD}|All countries|${ft}`);
  }
  const inMap = quarterly.get(`${TYPE_INCA}|All countries|${FLOW_TOTAL}`);

  return years.map(year => {
    const outTotal = sumYear(maps[FLOW_TOTAL], year);
    const inflow   = sumYear(inMap, year);
    return {
      year,
      outTotal,
      outMA:    sumYear(maps[FLOW_MA], year),
      outRE:    sumYear(maps[FLOW_RE], year),
      outOther: sumYear(maps[FLOW_OTHER], year),
      inflow,
      net: (outTotal != null && inflow != null) ? inflow - outTotal : null
    };
  });
}

/**
 * Build annual component breakdown (inflows only):
 * { year, inTotal, inMA, inRE, inOther }
 */
function buildInflowComponentRows(quarterly, years) {
  const maps = {};
  for (const ft of FLOW_TYPES) {
    maps[ft] = quarterly.get(`${TYPE_INCA}|All countries|${ft}`);
  }

  return years.map(year => ({
    year,
    inTotal: sumYear(maps[FLOW_TOTAL], year),
    inMA:    sumYear(maps[FLOW_MA],    year),
    inRE:    sumYear(maps[FLOW_RE],    year),
    inOther: sumYear(maps[FLOW_OTHER], year),
  }));
}

/**
 * Build annual inflow source breakdown: U.S. vs All other countries
 * { year, inUS, inROW }
 */
function buildInflowSourceRows(quarterly, years) {
  const usMap  = quarterly.get(`${TYPE_INCA}|United States|${FLOW_TOTAL}`);
  const rowMap = quarterly.get(`${TYPE_INCA}|All other countries|${FLOW_TOTAL}`);

  return years.map(year => ({
    year,
    inUS:  sumYear(usMap,  year),
    inROW: sumYear(rowMap, year),
  }));
}
