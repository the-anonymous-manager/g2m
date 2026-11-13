import type { feesEn } from './en';

export const feesTr: typeof feesEn = {
  title: 'Kripto kart ücretleri açıklandı',
  description:
    'Bir kripto kartın alabileceği ücretler (yıllık, döviz, yükleme, alışveriş başı, küçük alışveriş, ATM), bir aylık harcamada neye mal oldukları ve nasıl karşılaştırılacakları.',
  tile: 'Her ücret ve bir aylık harcamada maliyeti',
  eyebrow: 'rehber',
  lead: 'Bir kripto kart ücretsiz görünüp yine de harcadığınız her şeyin birkaç yüzdesine mal olabilir. Burada her ücret, G2M’deki {n} kart arasında ne kadar yaygın olduğu ve aynı harcama ayında ücretlerin toplamı var.',
  hAnnual: 'Yıllık veya aylık ücret',
  pAnnual:
    'Kart veya seviyesi için bir abonelik. Bunu yayımlayan {total} karttan {free} tanesinin ücretsiz giriş seviyesi var; ücretli olanlar yılda {min} ile {max} arası alıyor. Üst seviyeler bu ücreti çoğu zaman tuttuğunuz veya stake ettiğiniz, fiyatı değişebilen bir token ile değiştirir. ',
  noAnnualLink: 'Yıllık ücreti olmayan kartlar',
  hFx: 'Döviz ücreti',
  pFx: 'Kartın faturalamadığı bir para biriminde ödeme yaptığınızda eklenen yüzde. Kripto kartların çoğu ABD doları ile faturalar; bu yüzden rupi, dirhem veya sterlin ile ödeyen biri bunu yalnızca yurt dışında değil, ülkesindeki her alışverişte öder. Bunu yayımlayan {count} kartta {min} ile {max} arasında değişir (medyan {median}). ',
  noFxLink: 'Döviz ücreti olmayan kartlar',
  hTopUp: 'Yükleme ücreti',
  pTopUp:
    'Karta para yüklemenin yüzdesi; örneğin karta stablecoin veya kripto aktardığınızda. Bunu yayımlayan {total} karttan {free} tanesi hiçbir şey almıyor; en yükseği {max}. Yüklediğiniz her şeye uygulandığı için her alışverişte alınan bir ücret gibi çalışır.',
  hPurchase: 'Her alışverişte ücret',
  pPurchase:
    'Her ödemede bir yüzde veya sabit tutar; bazen dönüşüm veya spread ücreti denir. {total} karttan {n} tanesi bunu alıyor. Sabit ücret en çok küçük ve sık alışverişlere dokunur.',
  hSmall: 'Küçük alışveriş ücreti',
  pSmall: 'Belirli bir tutarın altındaki alışverişlerde sabit ücret. {total} karttan {n} tanesi bunu alıyor{foreign}{free}. Kahve ve diğer küçük, sık alışverişlerde birikir.',
  smallForeign: '; {n} tanesi yalnızca kartın para birimi dışındaki alışverişlerde',
  smallFreeOne: '; {n} tanesi her ay bazılarını ücretsiz veriyor',
  smallFreeMany: '; {n} tanesi her ay bazılarını ücretsiz veriyor',
  hAtm: 'ATM ücretleri',
  pAtm: 'Sabit ücret, yüzde ya da ikisi birden; üst seviyelerde çoğu zaman her ay ücretsiz bir tutarla. Her kartın incelemesi ATM koşullarını listeler.',
  hMonth: 'Ayda {x} harcamada ücretlerin maliyeti',
  pMonth:
    'Her kart aynı G2M test sepetini harcar: {a} ile {b} arası {purchases} alışverişte {x}. İlk sütun kartın kendi para birimindeki harcama; ikincisi aynı ayın başka bir para birimindeki hali, yani döviz ücreti ve yalnızca yurt dışına özgü ücretler uygulanır. Yıllık ücretler ve cashback dahil değildir.',
  thCard: 'Kart',
  thHome: 'Kendi para biriminde',
  thAbroad: 'Başka para biriminde',
  thAnnual: 'Yıllık ücret',
  foot: 'Her kartın giriş seviyesi. “Yayımlanmamış”, kart sağlayıcının ay için gereken bir ücreti belirtmediği anlamına gelir. Kart verileri en son {date} tarihinde kontrol edildi. ',
  basketLink: 'Test sepeti nasıl çalışır',
  q1: 'Kripto kartlar hangi ücretleri alır?',
  a1: 'En fazla altı tür: yıllık veya aylık ücret, döviz ücreti, yükleme ücreti, her alışverişte ücret, küçük alışveriş ücreti ve ATM ücretleri. Kartların çoğu bunların yalnızca bazılarını alır.',
  q2: 'Bir kripto kartta normal döviz ücreti ne kadardır?',
  a2: 'G2M’de bunu yayımlayan {count} kartta döviz ücreti {min} ile {max} arasında, medyanı {median}. {zero} kart hiç almıyor.',
  q3: 'Kullanması en ucuz kripto kart hangisi?',
  a3: 'Kartın faturalamadığı bir para biriminde {x} harcanan bir ayda, G2M’de en düşük ücretler şu kartlarda: {list}. Yıllık ücret bunun üstüne eklenir; ödül hesaplayıcı cashback’i ekler ve tüm yılı hesaplar.',
  calcLine: '{link}, kendi harcamanız için cashback’i ve her ücreti bir araya getirir.',
  calcLink: 'Ödül hesaplayıcı'
};
