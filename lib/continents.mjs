// The world region each country is listed under on card pages, so long country lists read in groups.

const GROUPS = {
  Europe:
    'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK',
  'Middle East': 'AE BH IL IQ IR JO KW LB OM PS QA SA SY TR YE',
  Asia:
    'AF AM AZ BD BN BT CN GE HK ID IN IO JP KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN',
  Africa:
    'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW',
  'North America and the Caribbean':
    'AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI',
  'South America': 'AR BO BR CL CO EC FK GF GY PE PY SR UY VE',
  Oceania: 'AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS',
  Antarctica: 'AQ BV GS TF'
};

/** Region names in display order. */
export const REGIONS = Object.keys(GROUPS);

/** @type {Record<string, string>} country code -> region name */
export const REGION_OF = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([region, codes]) => codes.split(' ').map((cc) => [cc, region]))
);
