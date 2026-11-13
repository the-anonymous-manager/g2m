import type { feesEn } from './en';

export const feesFr: typeof feesEn = {
  title: 'Les frais des cartes crypto expliqués',
  description:
    "Les frais qu'une carte crypto peut facturer (annuels, change, recharge, par achat, petits achats, distributeur), ce qu'ils coûtent sur un mois de dépenses et comment les comparer.",
  tile: "Chaque frais, et ce qu'il coûte sur un mois de dépenses",
  eyebrow: 'guide',
  lead: "Une carte crypto peut sembler gratuite et coûter pourtant quelques pour cent de tout ce que vous dépensez. Voici chaque frais, sa fréquence parmi les {n} cartes de G2M et ce que les frais représentent sur un même mois de dépenses.",
  hAnnual: 'Frais annuels ou mensuels',
  pAnnual:
    "Un abonnement pour la carte ou son niveau. {free} des {total} cartes qui en publient un ont un niveau d'entrée gratuit ; les payantes coûtent de {min} à {max} par an. Les niveaux supérieurs remplacent souvent ces frais par un token à détenir ou à staker, dont le prix peut varier. ",
  noAnnualLink: 'Cartes sans frais annuels',
  hFx: 'Frais de change',
  pFx: "Un pourcentage ajouté quand vous payez dans une devise que la carte ne facture pas. La plupart des cartes crypto facturent en dollars US : quelqu'un qui paie en roupies, dirhams ou livres le paie chez lui à chaque achat, pas seulement à l'étranger. Parmi les {count} cartes qui le publient, il va de {min} à {max} (médiane {median}). ",
  noFxLink: 'Cartes sans frais de change',
  hTopUp: 'Frais de recharge',
  pTopUp:
    "Un pourcentage pour charger la carte, par exemple quand vous y envoyez des stablecoins ou des cryptos. {free} des {total} cartes qui le publient ne facturent rien ; le plus élevé est de {max}. Il s'applique à tout ce que vous chargez, il fonctionne donc comme un frais sur chaque achat.",
  hPurchase: 'Frais sur chaque achat',
  pPurchase:
    "Un pourcentage ou un montant fixe sur chaque paiement, parfois appelé frais de conversion ou de spread. {n} des {total} cartes en facturent un. Un frais fixe pèse surtout sur les petits achats fréquents.",
  hSmall: 'Frais sur les petits achats',
  pSmall: "Un frais fixe sur les achats sous un certain montant. {n} des {total} cartes en facturent un{foreign}{free}. Il s'accumule sur les cafés et autres petits achats fréquents.",
  smallForeign: ' ; {n} seulement sur les achats dans une autre devise que celle de la carte',
  smallFreeOne: ' ; {n} en offre quelques-uns gratuits chaque mois',
  smallFreeMany: ' ; {n} en offrent quelques-uns gratuits chaque mois',
  hAtm: 'Frais aux distributeurs',
  pAtm: "Un frais fixe, un pourcentage ou les deux, souvent avec un montant gratuit chaque mois sur les niveaux supérieurs. La fiche de chaque carte indique ses conditions aux distributeurs.",
  hMonth: 'Ce que coûtent les frais sur un mois à {x}',
  pMonth:
    "Chaque carte dépense le même panier test de G2M : {x} en {purchases} achats de {a} à {b}. La première colonne correspond aux dépenses dans la devise de la carte ; la seconde au même mois dans une autre devise, avec donc les frais de change et les frais propres à l'étranger. Les frais annuels et le cashback ne sont pas inclus.",
  thCard: 'Carte',
  thHome: 'Dans sa propre devise',
  thAbroad: 'Dans une autre devise',
  thAnnual: 'Frais annuels',
  foot: "Niveau d'entrée de chaque carte. « Non publié » signifie que l'émetteur n'indique pas un frais nécessaire au calcul. Données des cartes vérifiées le {date}. ",
  basketLink: 'Comment fonctionne le panier test',
  q1: 'Quels frais facturent les cartes crypto ?',
  a1: "Jusqu'à six sortes : des frais annuels ou mensuels, des frais de change, des frais de recharge, des frais sur chaque achat, des frais sur les petits achats et des frais aux distributeurs. La plupart des cartes n'en facturent que certains.",
  q2: 'Quels sont des frais de change normaux pour une carte crypto ?',
  a2: "Parmi les {count} cartes de G2M qui en publient, les frais de change vont de {min} à {max}, avec une médiane de {median}. {zero} n'en facturent aucun.",
  q3: 'Quelle carte crypto coûte le moins à utiliser ?',
  a3: "Sur un mois de {x} dépensés dans une devise que la carte ne facture pas, les frais les plus bas sur G2M sont ceux de {list}. Les frais annuels s'ajoutent ; le calculateur de récompenses ajoute le cashback et calcule toute l'année.",
  calcLine: '{link} réunit le cashback et chaque frais pour vos propres dépenses.',
  calcLink: 'Le calculateur de récompenses'
};
