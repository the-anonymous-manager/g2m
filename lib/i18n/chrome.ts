// The few words of the header and footer on translated pages. Kept apart from the page dictionaries because these
// are sent to the browser (the header is a client component), and the page text is not.

export type Chrome = {
  ranking: string; // link to the translated home page
  english: string; // link to the English site
  languages: string; // label of the language list
  language: string; // the language button in the header
  guides: string; // link to the translated guides
  finder: string; // English: "Card finder"
  calculator: string; // English: "Rewards calculator"
  wallet: string; // English: "Wallet builder"
  compare: string; // English: "Compare"
  methodology: string; // English: "Methodology"
  updates: string; // English: "Updates" (card news and offers, /updates)
  cta: string; // English: "Find your best card"
  about: string; // English: "Spend your bags better. From on-chain to checkout. Independent crypto card rankings, built from published card terms."
  allCards: string; // English: "All cards"
  receipt: string; // English: "Swipe receipt"
  corridors: string; // English: "Corridor finder"
  submit: string; // English: "Submit a card"
  checked: string; // English: "Data last checked {date}."
  notFound: string; // 404 heading
  disclaimer: string;
  skip: string;
};

export const CHROME: Record<string, Chrome> = {
  de: {
    ranking: 'Rangliste',
    english: 'English',
    languages: 'Sprachen',
    language: 'Sprache',
    guides: 'Ratgeber',
    finder: "Kartenfinder",
    calculator: "Prämienrechner",
    wallet: "Wallet-Planer",
    compare: "Vergleichen",
    methodology: "Methodik",
    updates: "News",
    cta: "Beste Karte finden",
    about: "Gib deine Coins klüger aus. Von On-Chain bis zur Kasse. Unabhängige Ranglisten für Krypto-Karten, erstellt aus den veröffentlichten Kartenbedingungen.",
    allCards: "Alle Karten",
    receipt: "Echter Kartenbeleg",
    corridors: "Korridor-Finder",
    submit: "Karte einreichen",
    checked: "Daten zuletzt geprüft am {date}.",
    notFound: "Diese Seite gibt es nicht",
    disclaimer:
      'Keine Finanzberatung. Kartenbedingungen ändern sich oft: Prüfe die Website des Anbieters, bevor du eine Karte beantragst. Für manche Links erhält G2M eine Empfehlungsprovision; sie ändert nie die Platzierung einer Karte.',
    skip: 'Zum Inhalt springen'
  },
  fr: {
    ranking: 'Classement',
    english: 'English',
    languages: 'Langues',
    language: 'Langue',
    guides: 'Guides',
    finder: "Trouver sa carte",
    calculator: "Calculateur",
    wallet: "Portefeuille",
    compare: "Comparer",
    methodology: "Méthode",
    updates: "Actus",
    cta: "Trouver ma carte",
    about: "Dépensez vos cryptos plus malin. De la blockchain à la caisse. Des classements indépendants de cartes crypto, établis d'après les conditions publiées des cartes.",
    allCards: "Toutes les cartes",
    receipt: "Le vrai ticket de caisse",
    corridors: "Trouver un corridor",
    submit: "Proposer une carte",
    checked: "Données vérifiées le {date}.",
    notFound: "Cette page n'existe pas",
    disclaimer:
      "Ceci n'est pas un conseil financier. Les conditions des cartes changent souvent : vérifiez le site de l'émetteur avant de faire une demande. Certains liens peuvent rapporter une commission de parrainage à G2M ; cela ne change jamais le classement d'une carte.",
    skip: 'Aller au contenu'
  },
  es: {
    ranking: "Ranking",
    english: 'English',
    languages: 'Idiomas',
    language: 'Idioma',
    guides: 'Guías',
    finder: "Buscador",
    calculator: "Calculadora",
    wallet: "Cartera",
    compare: "Comparar",
    methodology: "Método",
    updates: "Noticias",
    cta: "Encuentra tu tarjeta",
    about: "Gasta tus criptos con cabeza. De la blockchain a la caja. Rankings independientes de tarjetas cripto, hechos con las condiciones publicadas de cada tarjeta.",
    allCards: "Todas las tarjetas",
    receipt: "Ticket real de compra",
    corridors: "Buscador de corredores",
    submit: "Enviar una tarjeta",
    checked: "Datos comprobados por última vez el {date}.",
    notFound: "Esta página no existe",
    disclaimer:
      'Esto no es asesoramiento financiero. Las condiciones de las tarjetas cambian a menudo: consulta la web del emisor antes de solicitarla. Algunos enlaces pueden dar a G2M una comisión por recomendación; eso nunca cambia la posición de una tarjeta.',
    skip: 'Ir al contenido'
  },
  pl: {
    ranking: 'Ranking',
    english: 'English',
    languages: 'Języki',
    language: 'Język',
    guides: 'Poradniki',
    finder: "Wyszukiwarka",
    calculator: "Kalkulator nagród",
    wallet: "Portfel",
    compare: "Porównaj",
    methodology: "Metodologia",
    updates: "Nowości",
    cta: "Znajdź kartę",
    about: "Wydawaj krypto mądrzej. Od blockchaina do kasy. Niezależne rankingi kart krypto oparte na opublikowanych warunkach kart.",
    allCards: "Wszystkie karty",
    receipt: "Prawdziwy paragon",
    corridors: "Wyszukiwarka korytarzy",
    submit: "Zgłoś kartę",
    checked: "Dane sprawdzone {date}.",
    notFound: "Ta strona nie istnieje",
    disclaimer:
      'To nie jest porada finansowa. Warunki kart często się zmieniają: przed złożeniem wniosku sprawdź stronę wydawcy. Za niektóre linki G2M może otrzymać prowizję za polecenie; nigdy nie wpływa to na miejsce karty w rankingu.',
    skip: 'Przejdź do treści'
  },
  tr: {
    ranking: 'Sıralama',
    english: 'English',
    languages: 'Diller',
    language: 'Dil',
    guides: 'Rehberler',
    finder: "Kart bulucu",
    calculator: "Ödül hesaplayıcı",
    wallet: "Cüzdan oluşturucu",
    compare: "Karşılaştır",
    methodology: "Yöntem",
    updates: "Haberler",
    cta: "Kartını bul",
    about: "Kriptonuzu daha akıllıca harcayın. Zincirden kasaya. Yayımlanmış kart koşullarından hazırlanan bağımsız kripto kart sıralamaları.",
    allCards: "Tüm kartlar",
    receipt: "Gerçek alışveriş fişi",
    corridors: "Koridor bulucu",
    submit: "Kart gönder",
    checked: "Veriler en son {date} tarihinde kontrol edildi.",
    notFound: "Bu sayfa bulunamadı",
    disclaimer:
      'Yatırım tavsiyesi değildir. Kart koşulları sık değişir: başvurmadan önce kartı çıkaran şirketin sitesini kontrol edin. Bazı bağlantılar G2M’ye tavsiye komisyonu kazandırabilir; bu, bir kartın sırasını asla değiştirmez.',
    skip: 'İçeriğe geç'
  },
  ru: {
    ranking: 'Рейтинг',
    english: 'English',
    languages: 'Языки',
    language: 'Язык',
    guides: 'Гайды',
    finder: "Подбор карты",
    calculator: "Калькулятор",
    wallet: "Набор карт",
    compare: "Сравнить",
    methodology: "Методика",
    updates: "Новости",
    cta: "Подобрать карту",
    about: "Тратьте криптовалюту с умом. От блокчейна до кассы. Независимые рейтинги криптокарт на основе опубликованных условий карт.",
    allCards: "Все карты",
    receipt: "Настоящий чек покупки",
    corridors: "Подбор коридора",
    submit: "Добавить карту",
    checked: "Данные последний раз проверены {date}",
    notFound: "Такой страницы нет",
    disclaimer:
      'Это не финансовая рекомендация. Условия карт часто меняются: перед оформлением проверьте сайт эмитента. По некоторым ссылкам G2M может получать реферальное вознаграждение; на место карты в рейтинге это никогда не влияет.',
    skip: 'Перейти к содержанию'
  },
  ar: {
    ranking: 'الترتيب',
    english: 'English',
    languages: 'اللغات',
    language: 'اللغة',
    guides: 'الأدلة',
    finder: "أداة اختيار البطاقة",
    calculator: "حاسبة المكافآت",
    wallet: "منشئ المحفظة",
    compare: "قارن",
    methodology: "المنهجية",
    updates: "المستجدات",
    cta: "اعثر على أفضل بطاقة لك",
    about: "أنفق عملاتك بذكاء أكبر. من البلوكتشين إلى نقطة الدفع. تصنيفات مستقلة لبطاقات الكريبتو مبنية على شروط البطاقات المنشورة.",
    allCards: "كل البطاقات",
    receipt: "إيصال الشراء الحقيقي",
    corridors: "أداة الممرات",
    submit: "أرسل بطاقة",
    checked: "آخر تحقق من البيانات: {date}.",
    notFound: "هذه الصفحة غير موجودة",
    disclaimer:
      'هذه ليست نصيحة مالية. شروط البطاقات تتغير كثيرًا: راجع موقع الجهة المصدرة قبل التقديم. قد يحصل G2M على عمولة إحالة من بعض الروابط، وهذا لا يغيّر ترتيب أي بطاقة أبدًا.',
    skip: 'انتقل إلى المحتوى'
  },
  'zh-hk': {
    ranking: '排名',
    english: 'English',
    languages: '語言',
    language: '語言',
    guides: '指南',
    finder: "選卡工具",
    calculator: "回贈計算器",
    wallet: "錢包組合工具",
    compare: "比較",
    methodology: "評分方法",
    updates: "最新消息",
    cta: "尋找最適合你的卡",
    about: "更聰明地花你的加密貨幣。從鏈上到收銀台。根據各卡公佈條款編製的獨立加密卡排名。",
    allCards: "所有卡",
    receipt: "真實消費收據",
    corridors: "匯款通道工具",
    submit: "提交新卡",
    checked: "資料最後核對日期：{date}。",
    notFound: "找不到此頁面",
    disclaimer: '本頁內容並非財務建議。卡片條款經常變動，申請前請先查看發卡機構的網站。部分連結可能令 G2M 獲得推薦佣金，但絕不影響任何卡片的排名。',
    skip: '跳至內容'
  }
};
