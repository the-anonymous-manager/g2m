import type { feesEn } from './en';

export const feesEs: typeof feesEn = {
  title: 'Las comisiones de las tarjetas cripto, explicadas',
  description:
    'Las comisiones que puede cobrar una tarjeta cripto (anual, cambio, recarga, por compra, compras pequeñas, cajero), lo que cuestan en un mes de gasto y cómo compararlas.',
  tile: 'Cada comisión y lo que cuesta en un mes de gasto',
  eyebrow: 'guía',
  lead: 'Una tarjeta cripto puede parecer gratis y aun así costar un pequeño porcentaje de todo lo que gastas. Aquí está cada comisión, lo habitual que es entre las {n} tarjetas de G2M y lo que suman las comisiones en un mismo mes de gasto.',
  hAnnual: 'Cuota anual o mensual',
  pAnnual:
    'Una suscripción a la tarjeta o a su nivel. {free} de las {total} tarjetas que publican una tienen un nivel de entrada gratis; las de pago cobran de {min} a {max} al año. Los niveles superiores suelen cambiar la cuota por un token que mantienes o haces staking, cuyo precio puede variar. ',
  noAnnualLink: 'Tarjetas sin cuota anual',
  hFx: 'Comisión de cambio de divisa',
  pFx: 'Un porcentaje que se añade cuando pagas en una moneda en la que la tarjeta no factura. La mayoría de las tarjetas cripto facturan en dólares, así que quien paga en rupias, dírhams o libras la paga en casa en cada compra, no solo en el extranjero. Entre las {count} tarjetas que la publican, va de {min} a {max} (mediana {median}). ',
  noFxLink: 'Tarjetas sin comisión de cambio',
  hTopUp: 'Comisión de recarga',
  pTopUp:
    'Un porcentaje por cargar la tarjeta, por ejemplo al pasarle stablecoins o cripto. {free} de las {total} tarjetas que la publican no cobran nada; la más alta es {max}. Se aplica a todo lo que cargas, así que funciona como una comisión en cada compra.',
  hPurchase: 'Comisión en cada compra',
  pPurchase:
    'Un porcentaje o un importe fijo en cada pago, a veces llamado comisión de conversión o de spread. {n} de las {total} tarjetas cobran una. Una comisión fija pesa sobre todo en compras pequeñas y frecuentes.',
  hSmall: 'Comisión por compras pequeñas',
  pSmall: 'Una comisión fija en compras por debajo de cierto importe. {n} de las {total} tarjetas cobran una{foreign}{free}. Suma en cafés y otras compras pequeñas y frecuentes.',
  smallForeign: '; {n} solo en compras en una moneda distinta de la de la tarjeta',
  smallFreeOne: '; {n} da algunas gratis cada mes',
  smallFreeMany: '; {n} dan algunas gratis cada mes',
  hAtm: 'Comisiones en cajeros',
  pAtm: 'Una comisión fija, un porcentaje o ambos, a menudo con un importe gratis cada mes en los niveles superiores. La ficha de cada tarjeta indica sus condiciones en cajeros.',
  hMonth: 'Lo que cuestan las comisiones en un mes de {x}',
  pMonth:
    'Cada tarjeta gasta la misma cesta de prueba de G2M: {x} en {purchases} compras de {a} a {b}. La primera columna es el gasto en la moneda de la tarjeta; la segunda, el mismo mes en otra moneda, con la comisión de cambio y las comisiones solo para el extranjero. No se incluyen cuotas anuales ni cashback.',
  thCard: 'Tarjeta',
  thHome: 'En su propia moneda',
  thAbroad: 'En otra moneda',
  thAnnual: 'Cuota anual',
  foot: 'Nivel de entrada de cada tarjeta. «No publicado» significa que el emisor no indica una comisión que el mes necesita. Datos de las tarjetas comprobados por última vez el {date}. ',
  basketLink: 'Cómo funciona la cesta de prueba',
  q1: '¿Qué comisiones cobran las tarjetas cripto?',
  a1: 'Hasta seis tipos: una cuota anual o mensual, una comisión de cambio, una comisión de recarga, una comisión en cada compra, una comisión por compras pequeñas y comisiones en cajeros. La mayoría de las tarjetas solo cobran algunas.',
  q2: '¿Cuál es una comisión de cambio normal en una tarjeta cripto?',
  a2: 'Entre las {count} tarjetas de G2M que publican una, la comisión de cambio va de {min} a {max}, con una mediana de {median}. {zero} no cobran ninguna.',
  q3: '¿Qué tarjeta cripto es la más barata de usar?',
  a3: 'En un mes de {x} gastados en una moneda en la que la tarjeta no factura, las comisiones más bajas en G2M son las de {list}. La cuota anual va aparte; la calculadora de recompensas añade el cashback y calcula el año completo.',
  calcLine: '{link} junta el cashback y cada comisión para tu propio gasto.',
  calcLink: 'La calculadora de recompensas'
};
