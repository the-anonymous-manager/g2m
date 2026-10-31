// Converts card data between the G2M Google Sheet and data/cards.json + data/sponsor.json + data/picks.json.
// Plain Node, no dependencies, so the hourly sync can check for changes before installing anything.
//
// The sheet has one tab per kind of row. A card's tiers, sources and country list point at it by its
// "Card ID" (the slug). Empty cell = not published (null). Lists inside one cell are one item per line,
// except country codes, card forms and assets, which are separated by commas.

import { createHash } from 'node:crypto';

export const TABS = ['Cards', 'Tiers', 'Country lists', 'Sources', 'Sponsor', 'Picks'];

/** Where the site keeps a card's downloaded picture. Named after the link, so a new link means a new file. */
export const imageFile = (slug, source) =>
  `/card-images/${slug}-${createHash('sha1').update(source).digest('hex').slice(0, 8)}.webp`;

// ---------- Cell helpers ----------

class CellError extends Error {}

const str = (v) => (v ?? '').toString().trim();
const lines = (v) =>
  str(v)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const commas = (v) =>
  str(v)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

function num(v) {
  const s = str(v).replace(/[$,%\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new CellError(`"${str(v)}" is not a number`);
  return n;
}
function bool(v) {
  const s = str(v).toLowerCase();
  if (!s) return null;
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0'].includes(s)) return false;
  throw new CellError(`"${str(v)}" should be yes, no or empty`);
}
const showNum = (n) => (n == null ? '' : String(n));
const showBool = (b) => (b == null ? '' : b ? 'yes' : 'no');
const optText = (v) => str(v) || undefined;
const optList = (a) => (a.length ? a : undefined);

// A welcome rate needs both its % and its number of days, e.g. 2 and 30.
function intro(pctCell, daysCell) {
  const pct = num(pctCell);
  const days = num(daysCell);
  if (pct == null && days == null) return undefined;
  if (pct == null || days == null) throw new CellError('fill in both "Intro cashback %" and "Intro offer days", or neither');
  return { pct, days };
}

// Blocked nationalities, e.g. "US; KP; IR". "none" = none; empty = not published.
function passports(v) {
  const s = str(v);
  if (!s) return undefined;
  if (/^none$/i.test(s)) return [];
  return s
    .split(/[;,]/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
}

// Bank rails, e.g. "EUR_SEPA in+out (free); GBP_FPS out (1.95 GBP); SWIFT in". "none" = the issuer offers none.
const RAIL_ITEM = /^((?:[A-Z]{3}_[A-Z]+)|SWIFT)\s+(in\+out|in|out)(?:\s*\(([^()]{1,80})\))?$/i;
function showRails(list) {
  if (list == null) return '';
  if (!list.length) return 'none';
  return list.map((r) => `${r.rail} ${r.in && r.out ? 'in+out' : r.in ? 'in' : 'out'}${r.fee ? ` (${r.fee})` : ''}`).join('; ');
}
function rails(v) {
  const s = str(v);
  if (!s) return undefined;
  if (/^none$/i.test(s)) return [];
  return s
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(RAIL_ITEM);
      if (!m) throw new CellError(`"${p}" should look like "EUR_SEPA in+out (free)" or "SWIFT out ($25)"`);
      const dir = m[2].toLowerCase();
      return { rail: m[1].toUpperCase(), in: dir !== 'out', out: dir !== 'in', ...(m[3] ? { fee: m[3].trim() } : {}) };
    });
}

// Currencies with no (or a lower) FX fee, e.g. "USD 0; EUR 0.2".
function showRates(map) {
  return map ? Object.entries(map).map(([cur, p]) => `${cur} ${p}`).join('; ') : '';
}
function rates(v) {
  const parts = str(v)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  const out = {};
  for (const p of parts) {
    const m = p.match(/^([A-Za-z]{3})\s*([\d.]+)\s*%?$/);
    if (!m) throw new CellError(`"${p}" should look like "USD 0" or "EUR 0.2"`);
    out[m[1].toUpperCase()] = Number(m[2]);
  }
  return out;
}

// Tier cashback that changes with monthly spend, e.g. "2.5% up to $10000; 2%".
function showBands(bands) {
  if (!bands) return '';
  return bands.map((b) => (b.uptoUsd == null ? `${b.pct}%` : `${b.pct}% up to $${b.uptoUsd}`)).join('; ');
}
function bands(v) {
  const parts = str(v)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  return parts.map((p) => {
    const m = p.match(/^([\d.]+)\s*%?\s*(?:up to\s*\$?\s*([\d,.]+))?$/i);
    if (!m) throw new CellError(`"${p}" should look like "2.5% up to $10000" or "2%"`);
    return { uptoUsd: m[2] ? Number(m[2].replace(/,/g, '')) : null, pct: Number(m[1]) };
  });
}

// ---------- Columns ----------
// Each column: header shown in the sheet, how to show a card's value, how to read it back.

const CARD_COLUMNS = [
  ['Card ID', (c) => c.slug],
  ['Name', (c) => c.name],
  ['Brand', (c) => c.brand],
  ['Issuer (bank)', (c) => c.issuer ?? ''],
  ['Network', (c) => c.network],
  ['Type', (c) => c.type],
  ['Forms', (c) => c.forms.join(', ')],
  ['Custody', (c) => c.custody],
  ['Card colour', (c) => c.metal],
  ['Card image', (c) => c.image?.source ?? ''],
  ['Summary', (c) => c.summary],
  ['Base cashback %', (c) => showNum(c.cashback.basePct)],
  ['Max cashback %', (c) => showNum(c.cashback.maxPct)],
  ['Cashback paid in', (c) => c.cashback.payout ?? ''],
  ['Cashback note', (c) => c.cashback.note ?? ''],
  ['Intro cashback %', (c) => showNum(c.cashback.intro?.pct ?? null)],
  ['Intro offer days', (c) => showNum(c.cashback.intro?.days ?? null)],
  ['Max cashback per purchase $', (c) => showNum(c.cashback.maxPerTxUsd ?? null)],
  ['Annual fee $', (c) => showNum(c.fees.annualUsd)],
  ['FX fee %', (c) => showNum(c.fees.fxPct)],
  ['FX note', (c) => c.fees.fxNote ?? ''],
  ['No-FX currencies', (c) => showRates(c.fees.fxByCurrency)],
  ['Billed in your own currency', (c) => (c.fees.fxHome ? 'yes' : '')],
  ['Top-up fee %', (c) => showNum(c.fees.topUpPct)],
  ['Fee on every purchase %', (c) => (c.fees.txPct ? showNum(c.fees.txPct) : '')],
  ['Fee on every purchase $', (c) => (c.fees.txFlatUsd ? showNum(c.fees.txFlatUsd) : '')],
  ['Small-purchase fee $', (c) => showNum(c.fees.smallPurchase?.feeUsd)],
  ['Small purchase = under $', (c) => showNum(c.fees.smallPurchase?.underUsd)],
  ['Small-purchase fee foreign only', (c) => (c.fees.smallPurchase ? showBool(c.fees.smallPurchase.foreignOnly) : '')],
  ['Small purchase limit included', (c) => (c.fees.smallPurchase ? showBool(c.fees.smallPurchase.inclusive) : '')],
  ['Free small purchases a month', (c) => (c.fees.smallPurchase?.freePerMonth ? String(c.fees.smallPurchase.freePerMonth) : '')],
  ['Card activation fee $', (c) => showNum(c.fees.cardFeeUsd)],
  ['Physical card cost $ (issuance + shipping)', (c) => showNum(c.fees.physicalCardFeeUsd)],
  ['ATM', (c) => c.fees.atm ?? ''],
  ['Other fees', (c) => c.fees.other.join('\n')],
  ['Number of countries', (c) => showNum(c.coverage.countries)],
  ['Where it works', (c) => c.coverage.scope],
  ['Example countries', (c) => c.coverage.examples.join(', ')],
  ['India', (c) => c.coverage.markets.IN],
  ['UAE', (c) => c.coverage.markets.AE],
  ['US', (c) => c.coverage.markets.US],
  ['UK', (c) => c.coverage.markets.GB],
  ['EU / EEA', (c) => c.coverage.markets.EU],
  ['Apple Pay', (c) => showBool(c.wallets.applePay)],
  ['Google Pay', (c) => showBool(c.wallets.googlePay)],
  ['IBAN / bank account', (c) => c.ecosystem?.iban ?? ''],
  ['Bank payout currencies', (c) => showNum(c.ecosystem?.payoutCorridors)],
  ['Fiat on/off-ramp', (c) => c.ecosystem?.ramps ?? ''],
  ['Crypto-backed credit', (c) => showBool(c.ecosystem?.credit)],
  ['Yield on balance', (c) => showBool(c.ecosystem?.yield)],
  ['Banking rails', (c) => showRails(c.bankRails)],
  ['Bank account for non-residents', (c) => showBool(c.bankForNonResidents ?? null)],
  ['KYC eligibility rule', (c) => c.kycRule ?? ''],
  ['Restricted passports', (c) => (c.restrictedPassports == null ? '' : c.restrictedPassports.length ? c.restrictedPassports.join('; ') : 'none')],
  ['Assets', (c) => c.assets.join(', ')],
  ['Perks', (c) => c.perks.join('\n')],
  ['Pros', (c) => c.pros.join('\n')],
  ['Cons', (c) => c.cons.join('\n')],
  ['Official link', (c) => c.links.official],
  ['Referral link', (c) => c.links.affiliate ?? ''],
  ['Last checked', (c) => c.lastChecked],
  ['No ID check', (c) => c.noIdCheck ?? '']
];

const TIER_COLUMNS = [
  ['Card ID', (c) => c.slug],
  ['Tier', (c, t) => t.name],
  ['Cost per year $', (c, t) => showNum(t.feeUsdYear)],
  ['Cost note', (c, t) => t.feeNote ?? ''],
  ['Cashback %', (c, t) => showNum(t.cashbackPct)],
  ['Cashback by monthly spend', (c, t) => showBands(t.bands)],
  ['Monthly cashback cap $', (c, t) => showNum(t.capMonthlyUsd)],
  ['FX fee % (if different)', (c, t) => showNum(t.fxPct)],
  ['Requirement', (c, t) => t.requirement ?? ''],
  ['Stake token', (c, t) => t.stake?.token ?? ''],
  ['Stake amount', (c, t) => showNum(t.stake?.amount)],
  ['Stake CoinGecko ID', (c, t) => t.stake?.coingeckoId ?? ''],
  ['Perks', (c, t) => (t.perks ?? []).join('\n')],
  ['Coming soon', (c, t) => (t.comingSoon ? 'yes' : '')],
  ['Only in countries', (c, t) => (t.countries ?? []).join(', ')],
  ['All countries except', (c, t) => (t.exceptCountries ?? []).join(', ')]
];

const LIST_COLUMNS = [
  ['Card ID', (c) => c.slug],
  ['Available in', (c) => c.coverage.countryList.yes.join(', ')],
  ['Not available in', (c) => (c.coverage.countryList.no ?? []).join(', ')],
  ['Unclear', (c) => (c.coverage.countryList.unclear ?? []).join(', ')],
  ['All other countries', (c) => c.coverage.countryList.others]
];

const SOURCE_COLUMNS = [
  ['Card ID', (c) => c.slug],
  ['Label', (c, s) => s.label],
  ['Link', (c, s) => s.url],
  ['Verified on', (c, s) => s.verified ?? '']
];

// The home page's top spot: Type is "Featured" (paid; needs both dates; empty also means Featured) or "Our pick".
const SPONSOR_COLUMNS = ['Card ID', 'Start', 'End', 'Type'];
// Home page "Our picks": Type is "Our pick" or "Featured" (paid; "Sponsored" also accepted); dates are needed for
// Featured, optional otherwise.
const PICK_COLUMNS = ['Slot', 'Card ID', 'Type', 'Why (one line)', 'Start', 'End'];
const PICK_TYPE = { pick: 'Our pick', sponsored: 'Featured' };

// ---------- cards.json -> sheet ----------

/** @returns {Record<string, string[][]>} each tab as rows of cells, header row first */
export function cardsToTables(cards, sponsor, picks = []) {
  const head = (cols) => cols.map(([h]) => h);
  return {
    Cards: [head(CARD_COLUMNS), ...cards.map((c) => CARD_COLUMNS.map(([, get]) => get(c)))],
    Tiers: [head(TIER_COLUMNS), ...cards.flatMap((c) => c.tiers.map((t) => TIER_COLUMNS.map(([, get]) => get(c, t))))],
    'Country lists': [
      head(LIST_COLUMNS),
      ...cards.filter((c) => c.coverage.countryList).map((c) => LIST_COLUMNS.map(([, get]) => get(c)))
    ],
    Sources: [head(SOURCE_COLUMNS), ...cards.flatMap((c) => c.sources.map((s) => SOURCE_COLUMNS.map(([, get]) => get(c, s))))],
    Sponsor: [SPONSOR_COLUMNS, [sponsor.slug ?? '', sponsor.start ?? '', sponsor.end ?? '', sponsor.slug ? PICK_TYPE[sponsor.type ?? 'sponsored'] : '']],
    Picks: [PICK_COLUMNS, ...picks.map((p) => [String(p.slot), p.slug, PICK_TYPE[p.type], p.note ?? '', p.start ?? '', p.end ?? ''])]
  };
}

// ---------- sheet -> cards.json ----------

/**
 * Read the tabs back into cards and the sponsor booking. Never throws: problems come back as plain
 * messages naming the tab, row and column, and `cards` is null when there are any.
 * @param {Record<string, string[][]>} tables
 */
/**
 * `previous` (the cards now on the site) carries over each card's addedOn, the day it was first listed: a card that
 * is not on the site yet gets `today`, so it shows as "New on G2M" with nobody typing a date.
 */
export function tablesToCards(tables, previous = null, today = null) {
  const errors = [];
  const listed = new Map((previous ?? []).map((c) => [c.slug, c.addedOn]));

  // Rows as objects keyed by header, skipping blank rows; remembers the sheet row number for messages.
  const read = (tab, cols) => {
    const rows = tables[tab];
    if (!rows || !rows.length) {
      errors.push(`The "${tab}" tab is missing or empty.`);
      return [];
    }
    const header = rows[0].map(str);
    for (const h of cols) if (!header.includes(h)) errors.push(`The "${tab}" tab has no "${h}" column.`);
    const found = rows
      .slice(1)
      .map((cells, i) => ({ row: i + 2, get: (h) => cells[header.indexOf(h)] ?? '' }))
      .filter((r) => header.some((h) => str(r.get(h))));
    // Text starting with = or + is read by Google as a formula; a broken one shows as #ERROR! and similar.
    for (const r of found)
      for (const h of header)
        if (/^#(ERROR!|REF!|N\/A|VALUE!|NAME\?|DIV\/0!|NUM!|NULL!)/.test(str(r.get(h))))
          errors.push(`${tab} row ${r.row}, column "${h}": shows ${str(r.get(h))}. Text starting with + or = needs an apostrophe in front, e.g. '+1% back.`);
    return found;
  };
  // Runs one field's conversion, turning a bad cell into a message instead of an exception.
  const cell = (tab, r, col, fn) => {
    try {
      return fn(r.get(col));
    } catch (e) {
      if (!(e instanceof CellError)) throw e;
      errors.push(`${tab} row ${r.row}, column "${col}": ${e.message}.`);
      return null;
    }
  };

  const cardRows = read('Cards', CARD_COLUMNS.map(([h]) => h));
  const slugs = new Set(cardRows.map((r) => str(r.get('Card ID'))));
  const owned = (tab, rows) =>
    rows.filter((r) => {
      const id = str(r.get('Card ID'));
      if (slugs.has(id)) return true;
      errors.push(`${tab} row ${r.row}: no card with Card ID "${id}" on the Cards tab.`);
      return false;
    });

  const tierRows = owned('Tiers', read('Tiers', TIER_COLUMNS.map(([h]) => h)));
  const listRows = owned('Country lists', read('Country lists', LIST_COLUMNS.map(([h]) => h)));
  const sourceRows = owned('Sources', read('Sources', SOURCE_COLUMNS.map(([h]) => h)));
  const sponsorRows = read('Sponsor', SPONSOR_COLUMNS);
  const pickRows = owned('Picks', read('Picks', PICK_COLUMNS));

  const tier = (r) => {
    const n = (col) => cell('Tiers', r, col, num);
    const token = str(r.get('Stake token'));
    const places = (col) => optList(commas(r.get(col)).map((s) => s.toUpperCase()));
    return {
      name: str(r.get('Tier')),
      feeUsdYear: n('Cost per year $'),
      feeNote: optText(r.get('Cost note')),
      cashbackPct: n('Cashback %'),
      bands: cell('Tiers', r, 'Cashback by monthly spend', bands) ?? undefined,
      capMonthlyUsd: n('Monthly cashback cap $') ?? undefined,
      fxPct: n('FX fee % (if different)') ?? undefined,
      requirement: optText(r.get('Requirement')),
      stake: token
        ? { token, amount: n('Stake amount'), coingeckoId: optText(r.get('Stake CoinGecko ID')) }
        : undefined,
      perks: optList(lines(r.get('Perks'))),
      comingSoon: cell('Tiers', r, 'Coming soon', bool) || undefined,
      countries: places('Only in countries'),
      exceptCountries: places('All countries except')
    };
  };

  const countryList = (r) => {
    const codes = (col) => commas(r.get(col)).map((s) => s.toUpperCase());
    return {
      yes: codes('Available in'),
      no: optList(codes('Not available in')),
      unclear: optList(codes('Unclear')),
      others: str(r.get('All other countries')).toLowerCase() || 'unknown'
    };
  };

  // The five banking features; all empty = no ecosystem data yet (key left out).
  const ecosystem = (r) => {
    const word = (col) => str(r.get(col)).toLowerCase() || null;
    const e = {
      iban: word('IBAN / bank account'),
      payoutCorridors: cell('Cards', r, 'Bank payout currencies', num),
      ramps: word('Fiat on/off-ramp'),
      credit: cell('Cards', r, 'Crypto-backed credit', bool),
      yield: cell('Cards', r, 'Yield on balance', bool)
    };
    return Object.values(e).every((v) => v == null) ? undefined : e;
  };

  const cards = cardRows.map((r) => {
    const slug = str(r.get('Card ID'));
    const n = (col) => cell('Cards', r, col, num);
    const b = (col) => cell('Cards', r, col, bool);
    const market = (col) => str(r.get(col)).toLowerCase();
    const smallFee = n('Small-purchase fee $');
    const smallUnder = n('Small purchase = under $');
    const list = listRows.find((l) => str(l.get('Card ID')) === slug);
    return {
      slug,
      name: str(r.get('Name')),
      brand: str(r.get('Brand')),
      issuer: str(r.get('Issuer (bank)')) || null,
      network: str(r.get('Network')),
      type: str(r.get('Type')),
      forms: commas(r.get('Forms')).map((s) => s.toLowerCase()),
      custody: str(r.get('Custody')),
      summary: str(r.get('Summary')),
      cashback: {
        basePct: n('Base cashback %'),
        maxPct: n('Max cashback %'),
        payout: str(r.get('Cashback paid in')) || null,
        note: optText(r.get('Cashback note')),
        intro: cell('Cards', r, 'Intro cashback %', (v) => intro(v, r.get('Intro offer days'))),
        maxPerTxUsd: n('Max cashback per purchase $') ?? undefined
      },
      fees: {
        annualUsd: n('Annual fee $'),
        fxPct: n('FX fee %'),
        fxNote: optText(r.get('FX note')),
        fxByCurrency: cell('Cards', r, 'No-FX currencies', rates),
        fxHome: b('Billed in your own currency') || undefined,
        topUpPct: n('Top-up fee %'),
        txPct: n('Fee on every purchase %') || undefined,
        txFlatUsd: n('Fee on every purchase $') || undefined,
        smallPurchase:
          smallFee != null || smallUnder != null
            ? {
                feeUsd: smallFee,
                underUsd: smallUnder,
                foreignOnly: b('Small-purchase fee foreign only') ?? false,
                ...(b('Small purchase limit included') ? { inclusive: true } : {}),
                ...(n('Free small purchases a month') ? { freePerMonth: n('Free small purchases a month') } : {})
              }
            : undefined,
        cardFeeUsd: n('Card activation fee $') ?? undefined,
        physicalCardFeeUsd: n('Physical card cost $ (issuance + shipping)') ?? undefined,
        atm: str(r.get('ATM')) || null,
        other: lines(r.get('Other fees'))
      },
      tiers: tierRows.filter((t) => str(t.get('Card ID')) === slug).map(tier),
      coverage: {
        countries: n('Number of countries'),
        scope: str(r.get('Where it works')),
        examples: commas(r.get('Example countries')),
        markets: { IN: market('India'), AE: market('UAE'), US: market('US'), GB: market('UK'), EU: market('EU / EEA') },
        countryList: list ? countryList(list) : undefined
      },
      ecosystem: ecosystem(r),
      bankRails: cell('Cards', r, 'Banking rails', rails),
      bankForNonResidents: b('Bank account for non-residents') ?? undefined,
      kycRule: str(r.get('KYC eligibility rule')).toLowerCase() || undefined,
      restrictedPassports: cell('Cards', r, 'Restricted passports', passports),
      noIdCheck: optText(r.get('No ID check')),
      wallets: { applePay: b('Apple Pay'), googlePay: b('Google Pay') },
      assets: commas(r.get('Assets')),
      perks: lines(r.get('Perks')),
      pros: lines(r.get('Pros')),
      cons: lines(r.get('Cons')),
      links: { official: str(r.get('Official link')), affiliate: optText(r.get('Referral link')) },
      sources: sourceRows
        .filter((s) => str(s.get('Card ID')) === slug)
        .map((s) => ({ label: str(s.get('Label')), url: str(s.get('Link')), verified: optText(s.get('Verified on')) })),
      lastChecked: str(r.get('Last checked')),
      addedOn: previous ? (listed.has(slug) ? listed.get(slug) : (today ?? undefined)) : undefined,
      metal: str(r.get('Card colour')).toLowerCase(),
      image: str(r.get('Card image')) ? { source: str(r.get('Card image')), file: imageFile(slug, str(r.get('Card image'))) } : undefined
    };
  });

  const s = sponsorRows[0];
  const sponsorKind = s ? str(s.get('Type')).toLowerCase() : '';
  const sponsorType =
    sponsorKind === '' || sponsorKind === 'featured' || sponsorKind === 'sponsored' ? 'sponsored' : sponsorKind === 'our pick' || sponsorKind === 'pick' ? 'pick' : null;
  if (!sponsorType) errors.push('Sponsor, column "Type": use "Featured" (paid) or "Our pick".');
  const sponsor = {
    slug: s ? str(s.get('Card ID')) || null : null,
    start: s ? str(s.get('Start')) || null : null,
    end: s ? str(s.get('End')) || null : null,
    type: sponsorType ?? 'sponsored'
  };
  if (sponsor.slug && !slugs.has(sponsor.slug)) errors.push(`Sponsor: no card with Card ID "${sponsor.slug}" on the Cards tab.`);
  if (sponsor.slug && sponsor.type === 'sponsored' && (!sponsor.start || !sponsor.end))
    errors.push('Sponsor: a paid (Featured) booking needs both a Start and an End date. For your own choice, set Type to "Our pick".');

  const picks = pickRows.map((r) => {
    const slot = Number(str(r.get('Slot')));
    if (![1, 2, 3].includes(slot)) errors.push(`Picks row ${r.row}, column "Slot": use 1, 2 or 3.`);
    const kind = str(r.get('Type')).toLowerCase();
    const type = kind === 'featured' || kind === 'sponsored' ? 'sponsored' : kind === '' || kind === 'our pick' || kind === 'pick' ? 'pick' : null;
    if (!type) errors.push(`Picks row ${r.row}, column "Type": use "Our pick" or "Featured".`);
    return { slot, slug: str(r.get('Card ID')), type: type ?? 'pick', note: optText(r.get('Why (one line)')) ?? null, start: str(r.get('Start')) || null, end: str(r.get('End')) || null };
  });

  return errors.length ? { cards: null, sponsor: null, picks: null, errors } : { cards: prune(cards), sponsor, picks, errors };
}

// Drop undefined keys so the JSON matches the hand-written file.
const prune = (v) => JSON.parse(JSON.stringify(v));

// ---------- CSV ----------

/** Parse CSV text (as Google Sheets exports it) into rows of cells. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cellText = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cellText += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cellText += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cellText);
      cellText = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cellText);
      rows.push(row);
      row = [];
      cellText = '';
    } else cellText += ch;
  }
  if (cellText || row.length) {
    row.push(cellText);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows) {
  return rows.map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n') + '\n';
}

// ---------- Writing the JSON files ----------

const inline = (v) =>
  Array.isArray(v)
    ? v.some((x) => x && typeof x === 'object')
      ? `[ ${v.map(inline).join(', ')} ]`
      : `[${v.map(inline).join(', ')}]`
    : v && typeof v === 'object'
      ? Object.keys(v).length
        ? `{ ${Object.entries(v)
            .map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`)
            .join(', ')} }`
        : '{}'
      : JSON.stringify(v);

/** cards.json in its usual layout: one line per field, one line per tier and per source. */
export function formatCards(cards) {
  const card = (c) =>
    Object.entries(c)
      .map(([k, v]) =>
        (k === 'tiers' || k === 'sources') && v.length
          ? `    "${k}": [\n${v.map((x) => `      ${inline(x)}`).join(',\n')}\n    ]`
          : `    "${k}": ${inline(v)}`
      )
      .join(',\n');
  return `[\n${cards.map((c) => `  {\n${card(c)}\n  }`).join(',\n')}\n]\n`;
}

export const formatSponsor = (s) => JSON.stringify(s, null, 2) + '\n';
export const formatPicks = (p) => JSON.stringify(p, null, 2) + '\n';

// ---------- Plain-words validation messages ----------

const FIELD_COLUMNS = {
  slug: 'Card ID', name: 'Name', brand: 'Brand', issuer: 'Issuer (bank)', network: 'Network', type: 'Type',
  forms: 'Forms', custody: 'Custody', metal: 'Card colour', summary: 'Summary',
  'cashback.basePct': 'Base cashback %', 'cashback.maxPct': 'Max cashback %', 'cashback.payout': 'Cashback paid in',
  'cashback.intro.pct': 'Intro cashback %', 'cashback.intro.days': 'Intro offer days',
  bankRails: 'Banking rails', bankForNonResidents: 'Bank account for non-residents',
  kycRule: 'KYC eligibility rule', restrictedPassports: 'Restricted passports', noIdCheck: 'No ID check', 'cashback.maxPerTxUsd': 'Max cashback per purchase $',
  'fees.smallPurchase.freePerMonth': 'Free small purchases a month',
  'fees.annualUsd': 'Annual fee $', 'fees.cardFeeUsd': 'Card activation fee $',
  'fees.physicalCardFeeUsd': 'Physical card cost $ (issuance + shipping)', 'fees.fxPct': 'FX fee %', 'fees.fxByCurrency': 'No-FX currencies', 'fees.topUpPct': 'Top-up fee %',
  'fees.txPct': 'Fee on every purchase %', 'fees.txFlatUsd': 'Fee on every purchase $',
  'fees.smallPurchase.feeUsd': 'Small-purchase fee $', 'fees.smallPurchase.underUsd': 'Small purchase = under $',
  'coverage.countries': 'Number of countries', 'coverage.scope': 'Where it works',
  'coverage.markets.IN': 'India', 'coverage.markets.AE': 'UAE', 'coverage.markets.US': 'US', 'coverage.markets.GB': 'UK',
  'coverage.markets.EU': 'EU / EEA', 'links.official': 'Official link', 'links.affiliate': 'Referral link',
  lastChecked: 'Last checked', 'image.source': 'Card image', tiers: 'Tiers tab', sources: 'Sources tab',
  feeUsdYear: 'Cost per year $', cashbackPct: 'Cashback %', bands: 'Cashback by monthly spend',
  capMonthlyUsd: 'Monthly cashback cap $', fxPct: 'FX fee % (if different)', 'stake.amount': 'Stake amount',
  countries: 'Only in countries', exceptCountries: 'All countries except', label: 'Label', url: 'Link', verified: 'Verified on',
  'coverage.countryList.yes': 'Available in', 'coverage.countryList.no': 'Not available in',
  'coverage.countryList.unclear': 'Unclear', 'coverage.countryList.others': 'All other countries'
};

/**
 * Turn a validator message like "tiers.1.cashbackPct: Expected number" into one that points at the sheet,
 * e.g. 'Tiers tab, tier 2 ("Pro"), column "Cashback %": Expected number'.
 */
export function sheetMessage(card, issue) {
  const m = issue.match(/^([\w.]+): (.*)$/);
  if (!m) return `${card.slug}: ${issue}`;
  const [, path, text] = m;
  const parts = path.split('.');
  const sub = (tab, i, rest) => {
    const what = tab === 'Tiers' ? `tier ${Number(i) + 1} ("${card.tiers?.[i]?.name ?? '?'}")` : `source ${Number(i) + 1}`;
    const col = FIELD_COLUMNS[rest.replace(/\.\d+$/, '')] ?? rest;
    return `${tab} tab, card "${card.slug}", ${what}${col ? `, column "${col}"` : ''}: ${text}`;
  };
  if (parts[0] === 'tiers' && parts.length > 2) return sub('Tiers', parts[1], parts.slice(2).join('.'));
  if (parts[0] === 'sources' && parts.length > 2) return sub('Sources', parts[1], parts.slice(2).join('.'));
  const key = path.replace(/\.\d+$/, '');
  const tab = key.startsWith('coverage.countryList') ? 'Country lists' : 'Cards';
  const col = FIELD_COLUMNS[key];
  return col ? `${tab} tab, card "${card.slug}", column "${col}": ${text}` : `Card "${card.slug}": ${issue}`;
}
