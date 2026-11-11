// The few words of the header and footer on translated pages. Kept apart from the page dictionaries because these
// are sent to the browser (the header is a client component), and the page text is not.

export type Chrome = {
  ranking: string; // link to the translated home page
  tools: string; // link to the English tools
  english: string; // link to the English site
  languages: string; // label of the language list
  language: string; // the language button in the header
  guides: string; // link to the translated guides
  disclaimer: string;
  skip: string;
};

export const CHROME: Record<string, Chrome> = {
  de: {
    ranking: 'Rangliste',
    tools: 'Rechner & Tools (Englisch)',
    english: 'English',
    languages: 'Sprachen',
    language: 'Sprache',
    guides: 'Ratgeber',
    disclaimer:
      'Keine Finanzberatung. Kartenbedingungen ändern sich oft: Prüfe die Website des Anbieters, bevor du eine Karte beantragst. Für manche Links erhält G2M eine Empfehlungsprovision; sie ändert nie die Platzierung einer Karte.',
    skip: 'Zum Inhalt springen'
  },
  fr: {
    ranking: 'Classement',
    tools: 'Calculateur et outils (en anglais)',
    english: 'English',
    languages: 'Langues',
    language: 'Langue',
    guides: 'Guides',
    disclaimer:
      "Ceci n'est pas un conseil financier. Les conditions des cartes changent souvent : vérifiez le site de l'émetteur avant de faire une demande. Certains liens peuvent rapporter une commission de parrainage à G2M ; cela ne change jamais le classement d'une carte.",
    skip: 'Aller au contenu'
  },
  es: {
    ranking: 'Clasificación',
    tools: 'Calculadora y herramientas (en inglés)',
    english: 'English',
    languages: 'Idiomas',
    language: 'Idioma',
    guides: 'Guías',
    disclaimer:
      'Esto no es asesoramiento financiero. Las condiciones de las tarjetas cambian a menudo: consulta la web del emisor antes de solicitarla. Algunos enlaces pueden dar a G2M una comisión por recomendación; eso nunca cambia la posición de una tarjeta.',
    skip: 'Ir al contenido'
  },
  pl: {
    ranking: 'Ranking',
    tools: 'Kalkulator i narzędzia (po angielsku)',
    english: 'English',
    languages: 'Języki',
    language: 'Język',
    guides: 'Poradniki',
    disclaimer:
      'To nie jest porada finansowa. Warunki kart często się zmieniają: przed złożeniem wniosku sprawdź stronę wydawcy. Za niektóre linki G2M może otrzymać prowizję za polecenie; nigdy nie wpływa to na miejsce karty w rankingu.',
    skip: 'Przejdź do treści'
  },
  tr: {
    ranking: 'Sıralama',
    tools: 'Hesaplayıcı ve araçlar (İngilizce)',
    english: 'English',
    languages: 'Diller',
    language: 'Dil',
    guides: 'Rehberler',
    disclaimer:
      'Yatırım tavsiyesi değildir. Kart koşulları sık değişir: başvurmadan önce kartı çıkaran şirketin sitesini kontrol edin. Bazı bağlantılar G2M’ye tavsiye komisyonu kazandırabilir; bu, bir kartın sırasını asla değiştirmez.',
    skip: 'İçeriğe geç'
  },
  ru: {
    ranking: 'Рейтинг',
    tools: 'Калькулятор и инструменты (на английском)',
    english: 'English',
    languages: 'Языки',
    language: 'Язык',
    guides: 'Гайды',
    disclaimer:
      'Это не финансовая рекомендация. Условия карт часто меняются: перед оформлением проверьте сайт эмитента. По некоторым ссылкам G2M может получать реферальное вознаграждение; на место карты в рейтинге это никогда не влияет.',
    skip: 'Перейти к содержанию'
  },
  ar: {
    ranking: 'الترتيب',
    tools: 'الحاسبة والأدوات (بالإنجليزية)',
    english: 'English',
    languages: 'اللغات',
    language: 'اللغة',
    guides: 'الأدلة',
    disclaimer:
      'هذه ليست نصيحة مالية. شروط البطاقات تتغير كثيرًا: راجع موقع الجهة المصدرة قبل التقديم. قد يحصل G2M على عمولة إحالة من بعض الروابط، وهذا لا يغيّر ترتيب أي بطاقة أبدًا.',
    skip: 'انتقل إلى المحتوى'
  },
  'zh-hk': {
    ranking: '排名',
    tools: '計算機及工具（英文）',
    english: 'English',
    languages: '語言',
    language: '語言',
    guides: '指南',
    disclaimer: '本頁內容並非財務建議。卡片條款經常變動，申請前請先查看發卡機構的網站。部分連結可能令 G2M 獲得推薦佣金，但絕不影響任何卡片的排名。',
    skip: '跳至內容'
  }
};
