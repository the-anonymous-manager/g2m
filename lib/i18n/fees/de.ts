import type { feesEn } from './en';

export const feesDe: typeof feesEn = {
  title: 'Gebühren von Krypto-Karten erklärt',
  description:
    'Welche Gebühren eine Krypto-Karte verlangen kann (Jahresgebühr, Fremdwährung, Aufladen, pro Einkauf, kleine Einkäufe, Geldautomat), was sie in einem Monat kosten und wie du sie vergleichst.',
  tile: 'Jede Gebühr und was sie in einem Ausgabemonat kostet',
  eyebrow: 'Ratgeber',
  lead: 'Eine Krypto-Karte kann kostenlos aussehen und trotzdem ein paar Prozent von allem kosten, was du ausgibst. Hier ist jede Gebühr, wie verbreitet sie unter den {n} Karten auf G2M ist und was die Gebühren im selben Ausgabemonat zusammen kosten.',
  hAnnual: 'Jahres- oder Monatsgebühr',
  pAnnual:
    'Ein Abo für die Karte oder ihre Stufe. {free} der {total} Karten, die eine nennen, haben eine kostenlose Einstiegsstufe; die kostenpflichtigen verlangen {min} bis {max} im Jahr. Höhere Stufen ersetzen die Gebühr oft durch einen Token, den du hältst oder stakst und dessen Preis schwanken kann. ',
  noAnnualLink: 'Karten ohne Jahresgebühr',
  hFx: 'Fremdwährungsgebühr',
  pFx: 'Ein Prozentsatz, der anfällt, wenn du in einer Währung bezahlst, in der die Karte nicht abrechnet. Die meisten Krypto-Karten rechnen in US-Dollar ab, also zahlt jemand, der in Rupien, Dirham oder Pfund bezahlt, sie bei jedem Einkauf zu Hause, nicht nur im Ausland. Bei den {count} Karten, die sie veröffentlichen, reicht sie von {min} bis {max} (Median {median}). ',
  noFxLink: 'Karten ohne Fremdwährungsgebühr',
  hTopUp: 'Aufladegebühr',
  pTopUp:
    'Ein Prozentsatz fürs Aufladen der Karte, zum Beispiel wenn du Stablecoins oder Krypto darauf überträgst. {free} der {total} Karten, die sie nennen, verlangen nichts; die höchste liegt bei {max}. Sie gilt für alles, was du einzahlst, und wirkt deshalb wie eine Gebühr auf jeden Einkauf.',
  hPurchase: 'Gebühr auf jeden Einkauf',
  pPurchase:
    'Ein Prozentsatz oder fester Betrag auf jede Zahlung, manchmal Umrechnungs- oder Spread-Gebühr genannt. {n} der {total} Karten verlangen eine. Eine feste Gebühr trifft vor allem kleine, häufige Einkäufe.',
  hSmall: 'Gebühr für kleine Einkäufe',
  pSmall: 'Eine feste Gebühr auf Einkäufe unter einem bestimmten Betrag. {n} der {total} Karten verlangen eine{foreign}{free}. Sie summiert sich bei Kaffee und anderen kleinen, häufigen Einkäufen.',
  smallForeign: '; {n} nur bei Einkäufen in einer anderen Währung als der der Karte',
  smallFreeOne: '; {n} gibt jeden Monat einige frei',
  smallFreeMany: '; {n} geben jeden Monat einige frei',
  hAtm: 'Geldautomatengebühren',
  pAtm: 'Eine feste Gebühr, ein Prozentsatz oder beides, auf höheren Stufen oft mit einem freien Betrag pro Monat. Die Bewertung jeder Karte nennt ihre Bedingungen am Geldautomaten.',
  hMonth: 'Was die Gebühren in einem Monat mit {x} kosten',
  pMonth:
    'Jede Karte gibt denselben G2M-Testkorb aus: {x} in {purchases} Einkäufen von {a} bis {b}. Die erste Spalte sind Ausgaben in der eigenen Währung der Karte; die zweite ist derselbe Monat in einer anderen Währung, also mit Fremdwährungsgebühr und Gebühren nur für Auslandseinkäufe. Jahresgebühren und Cashback sind nicht enthalten.',
  thCard: 'Karte',
  thHome: 'In ihrer eigenen Währung',
  thAbroad: 'In einer anderen Währung',
  thAnnual: 'Jahresgebühr',
  foot: 'Einstiegsstufe jeder Karte. „Nicht veröffentlicht“ heißt, der Anbieter nennt eine Gebühr nicht, die der Monat braucht. Kartendaten zuletzt geprüft am {date}. ',
  basketLink: 'So funktioniert der Testkorb',
  q1: 'Welche Gebühren verlangen Krypto-Karten?',
  a1: 'Bis zu sechs Arten: eine Jahres- oder Monatsgebühr, eine Fremdwährungsgebühr, eine Aufladegebühr, eine Gebühr auf jeden Einkauf, eine Gebühr für kleine Einkäufe und Geldautomatengebühren. Die meisten Karten verlangen nur einige davon.',
  q2: 'Wie hoch ist eine normale Fremdwährungsgebühr bei einer Krypto-Karte?',
  a2: 'Bei den {count} Karten auf G2M, die eine veröffentlichen, reicht die Fremdwährungsgebühr von {min} bis {max}, mit einem Median von {median}. {zero} verlangen keine.',
  q3: 'Welche Krypto-Karte ist am günstigsten im Gebrauch?',
  a3: 'In einem Monat mit {x} Ausgaben in einer Währung, in der die Karte nicht abrechnet, haben auf G2M diese Karten die niedrigsten Gebühren: {list}. Die Jahresgebühr kommt dazu; der Prämienrechner rechnet das Cashback ein und berechnet das ganze Jahr.',
  calcLine: '{link} bringt Cashback und jede Gebühr für deine eigenen Ausgaben zusammen.',
  calcLink: 'Der Prämienrechner'
};
