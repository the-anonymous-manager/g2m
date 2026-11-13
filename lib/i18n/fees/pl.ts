import type { feesEn } from './en';

export const feesPl: typeof feesEn = {
  title: 'Opłaty kart krypto w prostych słowach',
  description:
    'Jakie opłaty może pobierać karta krypto (roczna, przewalutowanie, doładowanie, od zakupu, małe zakupy, bankomat), ile kosztują w miesiącu wydatków i jak je porównać.',
  tile: 'Każda opłata i ile kosztuje w miesiącu wydatków',
  eyebrow: 'poradnik',
  lead: 'Karta krypto może wyglądać na darmową, a i tak kosztować kilka procent wszystkiego, co wydajesz. Oto każda opłata, jak często występuje wśród {n} kart w G2M i ile opłaty kosztują razem w tym samym miesiącu wydatków.',
  hAnnual: 'Opłata roczna lub miesięczna',
  pAnnual:
    'Abonament za kartę lub jej poziom. {free} z {total} kart, które ją podają, ma bezpłatny poziom podstawowy; płatne kosztują od {min} do {max} rocznie. Wyższe poziomy często zastępują opłatę tokenem, który trzymasz lub stakujesz, a jego cena może się zmieniać. ',
  noAnnualLink: 'Karty bez opłaty rocznej',
  hFx: 'Opłata za przewalutowanie',
  pFx: 'Procent doliczany, gdy płacisz w walucie, w której karta się nie rozlicza. Większość kart krypto rozlicza się w dolarach, więc ktoś płacący w rupiach, dirhamach czy funtach płaci ją w kraju przy każdym zakupie, nie tylko za granicą. Wśród {count} kart, które ją podają, wynosi od {min} do {max} (mediana {median}). ',
  noFxLink: 'Karty bez opłaty za przewalutowanie',
  hTopUp: 'Opłata za doładowanie',
  pTopUp:
    'Procent za zasilenie karty, np. gdy przenosisz na nią stablecoiny lub krypto. {free} z {total} kart, które ją podają, nic nie pobiera; najwyższa to {max}. Dotyczy wszystkiego, co wpłacasz, więc działa jak opłata od każdego zakupu.',
  hPurchase: 'Opłata od każdego zakupu',
  pPurchase:
    'Procent lub stała kwota od każdej płatności, czasem nazywana opłatą za przeliczenie lub spreadem. {n} z {total} kart ją pobiera. Stała opłata najbardziej obciąża małe, częste zakupy.',
  hSmall: 'Opłata za małe zakupy',
  pSmall: 'Stała opłata od zakupów poniżej określonej kwoty. {n} z {total} kart ją pobiera{foreign}{free}. Sumuje się przy kawie i innych małych, częstych zakupach.',
  smallForeign: '; {n} tylko od zakupów w innej walucie niż waluta karty',
  smallFreeOne: '; {n} daje kilka darmowych w miesiącu',
  smallFreeMany: '; {n} daje kilka darmowych w miesiącu',
  hAtm: 'Opłaty w bankomatach',
  pAtm: 'Stała opłata, procent albo oba, często z darmową kwotą w miesiącu na wyższych poziomach. Recenzja każdej karty podaje jej warunki w bankomatach.',
  hMonth: 'Ile kosztują opłaty w miesiącu za {x}',
  pMonth:
    'Każda karta wydaje ten sam koszyk testowy G2M: {x} w {purchases} zakupach od {a} do {b}. Pierwsza kolumna to wydatki w walucie karty; druga to ten sam miesiąc w innej walucie, więc dochodzi opłata za przewalutowanie i opłaty za zakupy zagraniczne. Opłaty roczne i cashback nie są wliczone.',
  thCard: 'Karta',
  thHome: 'W jej walucie',
  thAbroad: 'W innej walucie',
  thAnnual: 'Opłata roczna',
  foot: 'Poziom podstawowy każdej karty. „Nieopublikowane” oznacza, że wydawca nie podaje opłaty potrzebnej do obliczenia. Dane kart sprawdzone {date}. ',
  basketLink: 'Jak działa koszyk testowy',
  q1: 'Jakie opłaty pobierają karty krypto?',
  a1: 'Do sześciu rodzajów: opłata roczna lub miesięczna, opłata za przewalutowanie, opłata za doładowanie, opłata od każdego zakupu, opłata za małe zakupy i opłaty w bankomatach. Większość kart pobiera tylko niektóre z nich.',
  q2: 'Jaka jest normalna opłata za przewalutowanie w karcie krypto?',
  a2: 'Wśród {count} kart w G2M, które ją podają, opłata za przewalutowanie wynosi od {min} do {max}, z medianą {median}. Bez tej opłaty: {zero}.',
  q3: 'Która karta krypto jest najtańsza w użyciu?',
  a3: 'W miesiącu z wydatkami {x} w walucie, w której karta się nie rozlicza, najniższe opłaty w G2M mają: {list}. Opłata roczna dochodzi osobno; kalkulator nagród dolicza cashback i liczy cały rok.',
  calcLine: '{link} łączy cashback i każdą opłatę dla Twoich wydatków.',
  calcLink: 'Kalkulator nagród'
};
