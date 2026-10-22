// Each country's everyday currency (ISO 4217), so the calculator and finder can tell when a visitor's
// spending at home is in a currency their card bills in (no FX fee) or not. Bulgaria uses the euro from 2026.
// Antarctica has no currency of its own.

const GROUPS = {
  USD: 'AS BQ EC FM GU IO MH MP PA PR PW SV TC TL UM US VG VI',
  EUR: 'AD AT AX BE BG BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM TF VA XK YT',
  GBP: 'GB GG GS IM JE',
  AUD: 'AU CC CX HM KI NF NR TV',
  NZD: 'CK NU NZ PN TK',
  DKK: 'DK FO GL',
  NOK: 'BV NO SJ',
  CHF: 'CH LI',
  XCD: 'AG AI DM GD KN LC MS VC',
  XOF: 'BF BJ CI GW ML NE SN TG',
  XAF: 'CF CG CM GA GQ TD',
  XPF: 'NC PF WF',
  XCG: 'CW SX',
  MAD: 'EH MA',
  ILS: 'IL PS'
};

const SINGLE = {
  AE: 'AED', AF: 'AFN', AL: 'ALL', AM: 'AMD', AO: 'AOA', AR: 'ARS', AW: 'AWG', AZ: 'AZN', BA: 'BAM', BB: 'BBD',
  BD: 'BDT', BH: 'BHD', BI: 'BIF', BM: 'BMD', BN: 'BND', BO: 'BOB', BR: 'BRL', BS: 'BSD', BT: 'BTN', BW: 'BWP',
  BY: 'BYN', BZ: 'BZD', CA: 'CAD', CD: 'CDF', CL: 'CLP', CN: 'CNY', CO: 'COP', CR: 'CRC', CU: 'CUP', CV: 'CVE',
  CZ: 'CZK', DJ: 'DJF', DO: 'DOP', DZ: 'DZD', EG: 'EGP', ER: 'ERN', ET: 'ETB', FJ: 'FJD', FK: 'FKP', GE: 'GEL',
  GH: 'GHS', GI: 'GIP', GM: 'GMD', GN: 'GNF', GT: 'GTQ', GY: 'GYD', HK: 'HKD', HN: 'HNL', HT: 'HTG', HU: 'HUF',
  ID: 'IDR', IN: 'INR', IQ: 'IQD', IR: 'IRR', IS: 'ISK', JM: 'JMD', JO: 'JOD', JP: 'JPY', KE: 'KES', KG: 'KGS',
  KH: 'KHR', KM: 'KMF', KP: 'KPW', KR: 'KRW', KW: 'KWD', KY: 'KYD', KZ: 'KZT', LA: 'LAK', LB: 'LBP', LK: 'LKR',
  LR: 'LRD', LS: 'LSL', LY: 'LYD', MD: 'MDL', MG: 'MGA', MK: 'MKD', MM: 'MMK', MN: 'MNT', MO: 'MOP', MR: 'MRU',
  MU: 'MUR', MV: 'MVR', MW: 'MWK', MX: 'MXN', MY: 'MYR', MZ: 'MZN', NA: 'NAD', NG: 'NGN', NI: 'NIO', NP: 'NPR',
  OM: 'OMR', PE: 'PEN', PG: 'PGK', PH: 'PHP', PK: 'PKR', PL: 'PLN', PY: 'PYG', QA: 'QAR', RO: 'RON', RS: 'RSD',
  RU: 'RUB', RW: 'RWF', SA: 'SAR', SB: 'SBD', SC: 'SCR', SD: 'SDG', SE: 'SEK', SG: 'SGD', SH: 'SHP', SL: 'SLE',
  SO: 'SOS', SR: 'SRD', SS: 'SSP', ST: 'STN', SY: 'SYP', SZ: 'SZL', TH: 'THB', TJ: 'TJS', TM: 'TMT', TN: 'TND',
  TO: 'TOP', TR: 'TRY', TT: 'TTD', TW: 'TWD', TZ: 'TZS', UA: 'UAH', UG: 'UGX', UY: 'UYU', UZ: 'UZS', VE: 'VES',
  VN: 'VND', VU: 'VUV', WS: 'WST', YE: 'YER', ZA: 'ZAR', ZM: 'ZMW', ZW: 'ZWG'
};

/** @type {Record<string, string>} country code -> currency code */
export const COUNTRY_CURRENCY = { ...SINGLE };
for (const [cur, list] of Object.entries(GROUPS)) for (const cc of list.split(' ')) COUNTRY_CURRENCY[cc] = cur;

/**
 * The everyday currency of a country, or null when it has none (Antarctica) or the country is unknown.
 * @param {string | null | undefined} cc
 * @returns {string | null}
 */
export const currencyOf = (cc) => (cc && COUNTRY_CURRENCY[cc]) || null;
