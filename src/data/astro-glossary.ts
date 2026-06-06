export interface AstroElement {
  key: string;
  name: string;
  signs: string[];
  meaning: string;
}

export interface AstroModality {
  key: string;
  name: string;
  signs: string[];
  meaning: string;
}

export interface AstroSign {
  key: string;
  name: string;
  symbol: string;
  dates: string;
  ruler: string;
  element: string;
  modality: string;
  keyword: string;
  meaning: string;
}

export interface AstroPlanet {
  key: string;
  name: string;
  symbol: string;
  represents: string;
  keywords: string[];
  meaning: string;
  isGenerational?: boolean;
}

export interface AstroHouse {
  number: number;
  area: string;
  keyword: string;
}

export interface AstroAspect {
  key: string;
  name: string;
  angle: number;
  orb: number;
  type: "güçlü" | "hafif" | "yumuşak" | "sert" | "uyumsuz";
  meaning: string;
}

export interface AstroFixedStar {
  key: string;
  name: string;
  aliases?: string[];
  constellation: string;
  nature: string;
  meaning: string;
}

export interface AstroConstellation {
  key: string;
  latin: string;
  tr: string;
  meaning: string;
  brightestStar: string;
  signKey?: string;
  aliases?: string[];
}

export interface AstroGlossary {
  sourceTitle: string;
  sourceFetchedAt: string;
  disclaimer: string;
  basicConcepts: Array<{ key: string; name: string; meaning: string }>;
  elements: AstroElement[];
  modalities: AstroModality[];
  signs: AstroSign[];
  planets: AstroPlanet[];
  houses: AstroHouse[];
  aspects: AstroAspect[];
  fixedStars: AstroFixedStar[];
  constellations: AstroConstellation[];
  usage: {
    systemLayer: string;
    skyLayer: string;
    rule: string;
  };
}

export const ASTRO_DISCLAIMER =
  "Astrolojik yorumlar kültürel/sembolik gelenektir; eğlence amaçlıdır.";

export const ASTRO_GLOSSARY: AstroGlossary = {
  sourceTitle: "Gökkubbe — Astroloji Sözlüğü",
  sourceFetchedAt: "2026-06-06T06:20:18.346Z",
  disclaimer:
    "Astrolojik yorumlar kültürel/sembolik gelenektir; eğlence ve ilham amaçlıdır, bilimsel iddia değildir.",
  basicConcepts: [
    {
      key: "zodiac",
      name: "Zodyak (Burçlar Kuşağı)",
      meaning:
        "Güneş'in yıl boyunca gökyüzünde izlediği yol (ekliptik) etrafındaki kuşak. 30'ar derecelik 12 eşit dilime bölünür; her dilim bir burçtur."
    },
    {
      key: "ecliptic",
      name: "Ekliptik",
      meaning:
        "Güneş'in gök küresinde izlediği görünür yıl yolu. Gezegenler ve Ay da bu yola yakın hareket eder."
    },
    {
      key: "tropical-vs-sidereal",
      name: "Tropikal vs Sidereal Zodyak",
      meaning:
        "Batı astrolojisi tropikal zodyağı kullanır; 0° Koç ilkbahar ekinoksuna bağlıdır. Sidereal zodyak gerçek takımyıldız konumlarına göre hizalanır. Gökkubbe'deki yıldız konumları astronomiktir; astrolojik yorumlar tropikal sisteme dayanır."
    },
    {
      key: "ascendant",
      name: "Yükselen (Ascendant / ASC)",
      meaning: "Doğum anında doğu ufkunda yükselen burç. Dış görünüş ve hayata bakış."
    },
    {
      key: "midheaven",
      name: "Tepe Noktası (Midheaven / MC)",
      meaning: "Doğum anında tam tepede olan nokta. Kariyer ve toplumsal kimlik."
    },
    {
      key: "retrograde",
      name: "Retro (Gerileme)",
      meaning:
        "Bir gezegenin Dünya'dan bakıldığında geriye gidiyormuş gibi görünmesi. O gezegenin enerjisinin içe dönük, gözden geçiren bir biçimde çalıştığına işaret eder."
    }
  ],
  elements: [
    {
      key: "fire",
      name: "Ateş",
      signs: ["Koç", "Aslan", "Yay"],
      meaning: "Tutku, enerji, cesaret, ilham, eylem. Coşkulu ve girişken."
    },
    {
      key: "earth",
      name: "Toprak",
      signs: ["Boğa", "Başak", "Oğlak"],
      meaning: "Pratiklik, istikrar, somutluk, güven, dayanıklılık. Maddi dünyaya kök salar."
    },
    {
      key: "air",
      name: "Hava",
      signs: ["İkizler", "Terazi", "Kova"],
      meaning: "Zihin, iletişim, fikirler, sosyallik, nesnellik. Düşünce ve ilişki odaklı."
    },
    {
      key: "water",
      name: "Su",
      signs: ["Yengeç", "Akrep", "Balık"],
      meaning: "Duygu, sezgi, derinlik, empati, hayal gücü. Hisler ve bağlanma."
    }
  ],
  modalities: [
    {
      key: "cardinal",
      name: "Öncü",
      signs: ["Koç", "Yengeç", "Terazi", "Oğlak"],
      meaning: "Başlatır, harekete geçer, inisiyatif alır. Mevsim başlangıçları."
    },
    {
      key: "fixed",
      name: "Sabit",
      signs: ["Boğa", "Aslan", "Akrep", "Kova"],
      meaning: "Sürdürür, kararlı ve istikrarlıdır, direnir. Mevsim ortaları."
    },
    {
      key: "mutable",
      name: "Değişken",
      signs: ["İkizler", "Başak", "Yay", "Balık"],
      meaning: "Uyum sağlar, dönüştürür, esnektir. Mevsim sonları."
    }
  ],
  signs: [
    {
      key: "aries",
      name: "Koç",
      symbol: "♈",
      dates: "21 Mart–19 Nisan",
      ruler: "Mars",
      element: "Ateş",
      modality: "Öncü",
      keyword: "Ben varım.",
      meaning:
        "Cesaret, öncülük, girişkenlik, dürtüsellik, rekabet. Yeni başlangıçların savaşçısı; bazen sabırsız ve aceleci."
    },
    {
      key: "taurus",
      name: "Boğa",
      symbol: "♉",
      dates: "20 Nisan–20 Mayıs",
      ruler: "Venüs",
      element: "Toprak",
      modality: "Sabit",
      keyword: "Sahibim.",
      meaning:
        "İstikrar, güven, hazlar, dayanıklılık, sadakat. Konfor ve güzellik sever; bazen inatçı ve değişime dirençli."
    },
    {
      key: "gemini",
      name: "İkizler",
      symbol: "♊",
      dates: "21 Mayıs–20 Haziran",
      ruler: "Merkür",
      element: "Hava",
      modality: "Değişken",
      keyword: "Düşünürüm.",
      meaning:
        "İletişim, merak, çok yönlülük, zekâ, sosyallik. Hızlı ve uyarlanabilir; bazen dağınık ve kararsız."
    },
    {
      key: "cancer",
      name: "Yengeç",
      symbol: "♋",
      dates: "21 Haziran–22 Temmuz",
      ruler: "Ay",
      element: "Su",
      modality: "Öncü",
      keyword: "Hissederim.",
      meaning:
        "Duygusallık, koruyuculuk, yuva, sezgi, şefkat. Derin bağlar kurar; bazen alıngan ve içine kapanık."
    },
    {
      key: "leo",
      name: "Aslan",
      symbol: "♌",
      dates: "23 Temmuz–22 Ağustos",
      ruler: "Güneş",
      element: "Ateş",
      modality: "Sabit",
      keyword: "İsterim/Yaratırım.",
      meaning:
        "Özgüven, yaratıcılık, cömertlik, liderlik, sahne. Işıldamayı sever; bazen gururlu ve ilgi açlığı çeker."
    },
    {
      key: "virgo",
      name: "Başak",
      symbol: "♍",
      dates: "23 Ağustos–22 Eylül",
      ruler: "Merkür",
      element: "Toprak",
      modality: "Değişken",
      keyword: "Analiz ederim.",
      meaning:
        "Titizlik, hizmet, pratik akıl, sağlık, mükemmeliyetçilik. Detay ustası; bazen aşırı eleştirel ve kaygılı."
    },
    {
      key: "libra",
      name: "Terazi",
      symbol: "♎",
      dates: "23 Eylül–22 Ekim",
      ruler: "Venüs",
      element: "Hava",
      modality: "Öncü",
      keyword: "Dengelerim.",
      meaning:
        "Uyum, adalet, ilişkiler, estetik, diplomasi. Denge ve güzellik arar; bazen kararsız ve onay bağımlısı."
    },
    {
      key: "scorpio",
      name: "Akrep",
      symbol: "♏",
      dates: "23 Ekim–21 Kasım",
      ruler: "Plüton (klasik: Mars)",
      element: "Su",
      modality: "Sabit",
      keyword: "Dönüşürüm.",
      meaning:
        "Yoğunluk, tutku, derinlik, güç, gizem, yeniden doğuş. Sınırları zorlar; bazen kıskanç ve kontrolcü."
    },
    {
      key: "sagittarius",
      name: "Yay",
      symbol: "♐",
      dates: "22 Kasım–21 Aralık",
      ruler: "Jüpiter",
      element: "Ateş",
      modality: "Değişken",
      keyword: "Görürüm/Ararım.",
      meaning:
        "Özgürlük, macera, felsefe, iyimserlik, keşif. Ufuk genişletir; bazen patavatsız ve sorumsuz."
    },
    {
      key: "capricorn",
      name: "Oğlak",
      symbol: "♑",
      dates: "22 Aralık–19 Ocak",
      ruler: "Satürn",
      element: "Toprak",
      modality: "Öncü",
      keyword: "Kullanırım/Başarırım.",
      meaning:
        "Disiplin, hırs, sorumluluk, dayanıklılık, otorite. Zirveye tırmanır; bazen katı ve fazla ciddi."
    },
    {
      key: "aquarius",
      name: "Kova",
      symbol: "♒",
      dates: "20 Ocak–18 Şubat",
      ruler: "Uranüs (klasik: Satürn)",
      element: "Hava",
      modality: "Sabit",
      keyword: "Bilirim.",
      meaning:
        "Yenilik, özgünlük, topluluk, isyan, ileri görüşlülük. Geleceği düşünür; bazen mesafeli ve inatçı."
    },
    {
      key: "pisces",
      name: "Balık",
      symbol: "♓",
      dates: "19 Şubat–20 Mart",
      ruler: "Neptün (klasik: Jüpiter)",
      element: "Su",
      modality: "Değişken",
      keyword: "İnanırım/Hayal ederim.",
      meaning:
        "Empati, hayal gücü, ruhsallık, şefkat, sezgi. Sınırları erir; bazen kaçışçı ve gerçeklikten kopuk."
    }
  ],
  planets: [
    {
      key: "sun",
      name: "Güneş",
      symbol: "☉",
      represents: "Öz benlik, ego, yaşam enerjisi",
      keywords: ["kimlik", "irade", "canlılık", "amaç"],
      meaning: "Öz benlik, ego, yaşam enerjisi, kimlik ve amaç. Temelde kim olduğun."
    },
    {
      key: "moon",
      name: "Ay",
      symbol: "☽",
      represents: "Duygular, iç dünya",
      keywords: ["his", "sezgi", "ihtiyaçlar", "anne", "alışkanlık"],
      meaning: "Duygular, iç dünya, sezgi, ihtiyaçlar ve alışkanlıklar. Nasıl hissettiğin."
    },
    {
      key: "mercury",
      name: "Merkür",
      symbol: "☿",
      represents: "Zihin, iletişim",
      keywords: ["düşünce", "konuşma", "öğrenme", "mantık"],
      meaning: "Zihin, iletişim, düşünme ve öğrenme. Bilgiyi işleme ve konuşma tarzın."
    },
    {
      key: "venus",
      name: "Venüs",
      symbol: "♀",
      represents: "Aşk, değerler",
      keywords: ["ilişkiler", "güzellik", "haz", "sanat", "para"],
      meaning: "Aşk, değerler, ilişkiler, güzellik, haz, sanat ve para. Neyi ve nasıl sevdiğin."
    },
    {
      key: "mars",
      name: "Mars",
      symbol: "♂",
      represents: "Eylem, enerji",
      keywords: ["tutku", "cesaret", "dürtü", "öfke", "rekabet"],
      meaning: "Eylem, enerji, tutku, cesaret, dürtü, öfke ve rekabet. Nasıl harekete geçtiğin."
    },
    {
      key: "jupiter",
      name: "Jüpiter",
      symbol: "♃",
      represents: "Genişleme, şans",
      keywords: ["bolluk", "bilgelik", "büyüme", "iyimserlik"],
      meaning: "Genişleme, şans, bolluk, bilgelik, büyüme ve iyimserlik. Nasıl büyüdüğün."
    },
    {
      key: "saturn",
      name: "Satürn",
      symbol: "♄",
      represents: "Disiplin, sınırlar",
      keywords: ["sorumluluk", "olgunluk", "yapı", "zaman", "ders"],
      meaning: "Disiplin, sınırlar, sorumluluk, olgunluk, yapı, zaman ve hayat dersleri.",
    },
    {
      key: "uranus",
      name: "Uranüs",
      symbol: "♅",
      represents: "Devrim, değişim (kuşak)",
      keywords: ["özgürlük", "yenilik", "ani kırılmalar", "isyan"],
      meaning: "Devrim, değişim, özgürlük, yenilik, ani kırılmalar ve isyan.",
      isGenerational: true
    },
    {
      key: "neptune",
      name: "Neptün",
      symbol: "♆",
      represents: "Hayaller, ilham (kuşak)",
      keywords: ["ruhsallık", "illüzyon", "sanat", "şefkat", "kaçış"],
      meaning: "Hayaller, ilham, ruhsallık, illüzyon, sanat, şefkat ve kaçış.",
      isGenerational: true
    },
    {
      key: "pluto",
      name: "Plüton",
      symbol: "♇",
      represents: "Dönüşüm, güç (kuşak)",
      keywords: ["yeniden doğuş", "yoğunluk", "ölüm-yeniden doğuş"],
      meaning: "Dönüşüm, güç, yeniden doğuş ve yoğunluk.",
      isGenerational: true
    }
  ],
  houses: [
    { number: 1, area: "Benlik, görünüş, kişilik", keyword: "Ben" },
    { number: 2, area: "Para, değerler, sahip olunanlar", keyword: "Değer veririm" },
    { number: 3, area: "İletişim, kardeşler, yakın çevre, öğrenme", keyword: "Konuşurum" },
    { number: 4, area: "Yuva, aile, kökler, anne-baba", keyword: "Hissederim" },
    { number: 5, area: "Yaratıcılık, aşk, çocuklar, eğlence", keyword: "Yaratırım" },
    { number: 6, area: "İş, sağlık, günlük rutin, hizmet", keyword: "Hizmet ederim" },
    { number: 7, area: "Ortaklıklar, evlilik, ilişkiler", keyword: "İlişki kurarım" },
    { number: 8, area: "Dönüşüm, ortak kaynaklar, cinsellik, ölüm-doğum", keyword: "Dönüşürüm" },
    { number: 9, area: "Felsefe, yüksek öğrenim, uzak yolculuk, inanç", keyword: "Anlarım" },
    { number: 10, area: "Kariyer, toplumsal statü, hedefler", keyword: "Başarırım" },
    { number: 11, area: "Arkadaşlar, topluluk, umutlar, idealler", keyword: "Umut ederim" },
    { number: 12, area: "Bilinçaltı, gizlilik, ruhsallık, geri çekilme", keyword: "Çözülürüm" }
  ],
  aspects: [
    {
      key: "conjunction",
      name: "Kavuşum",
      angle: 0,
      orb: 8,
      type: "güçlü",
      meaning: "Enerjiler birleşir ve yoğunlaşır; iki tema iç içe geçer."
    },
    {
      key: "semi-sextile",
      name: "Yarım Altmışlık",
      angle: 30,
      orb: 2,
      type: "hafif",
      meaning: "Hafif, fark edilmesi gereken bir gerilim/uyum; yan yana ama birbirini tam görmez."
    },
    {
      key: "sextile",
      name: "Altmışlık",
      angle: 60,
      orb: 5,
      type: "yumuşak",
      meaning: "Akıcı, destekleyici; fırsat ve kolay işbirliği."
    },
    {
      key: "square",
      name: "Kare",
      angle: 90,
      orb: 7,
      type: "sert",
      meaning: "Gerilim ve meydan okuma; sürtünme büyümeye ve eyleme iter."
    },
    {
      key: "trine",
      name: "Üçgen",
      angle: 120,
      orb: 8,
      type: "yumuşak",
      meaning: "En akıcı açı; doğal yetenek, zahmetsiz uyum."
    },
    {
      key: "quincunx",
      name: "Quincunx (İnconjunct)",
      angle: 150,
      orb: 3,
      type: "uyumsuz",
      meaning: "İki tema birbirini anlamaz; sürekli ayar gerektirir."
    },
    {
      key: "opposition",
      name: "Karşıt",
      angle: 180,
      orb: 8,
      type: "sert",
      meaning: "Karşıt kutuplar; denge ve farkındalık ekseni, ilişkilerde yansır."
    }
  ],
  fixedStars: [
    {
      key: "aldebaran",
      name: "Aldebaran",
      constellation: "Boğa",
      nature: "Mars",
      meaning:
        "Doğu'nun bekçisi. Onur, cesaret, zekâ ve liderlik. Koşul: dürüst kalmak; dürüstlükten saparsa kazanımlar yıkılır."
    },
    {
      key: "regulus",
      name: "Regulus",
      constellation: "Aslan",
      nature: "Mars/Jüpiter",
      meaning: "Kuzey'in bekçisi. Kral yapan yıldız: liderlik, başarı ve şan. Uyarı: kibir ve intikam yıkıma götürür."
    },
    {
      key: "antares",
      name: "Antares",
      constellation: "Akrep",
      nature: "Mars/Jüpiter",
      meaning: "Batı'nın bekçisi. Savaş, tutku, yoğunluk, yıkım ve yeniden inşa. Öfkeyi ve yıkıcı dürtüleri kontrol etmeyi ister."
    },
    {
      key: "fomalhaut",
      name: "Fomalhaut",
      constellation: "Güney Balığı",
      nature: "Venüs/Merkür",
      meaning: "Güney'in bekçisi. İdealizm, ilham ve karizma. Yozlaşırsa düşüşe geçer."
    },
    {
      key: "sirius",
      name: "Sirius",
      constellation: "Büyük Köpek",
      nature: "Jüpiter/Mars",
      meaning: "Gökyüzünün en parlak yıldızı; başarı, ün, onur ve koruyuculuk."
    },
    {
      key: "spica",
      name: "Spica",
      constellation: "Başak",
      nature: "Venüs/Mars",
      meaning: "En şanslı yıldızlardan; yetenek, parlaklık, koruma ve bereket. Koşulsuz olumlu."
    },
    {
      key: "vega",
      name: "Vega",
      constellation: "Lir (Çalgı)",
      nature: "Venüs/Merkür",
      meaning: "Karizma, sanatsallık, incelik ve ilham; ilahi arp."
    },
    {
      key: "algol",
      name: "Algol",
      constellation: "Perseus",
      nature: "Satürn/Jüpiter",
      meaning: "En zorlu yıldız; yoğunluk ve tehlike. Dönüştürülürse büyük güç."
    },
    {
      key: "betelgeuse",
      name: "Betelgeuse",
      constellation: "Avcı",
      nature: "Mars/Merkür",
      meaning: "Askeri/atılgan başarı ve onurlar."
    },
    {
      key: "rigel",
      name: "Rigel",
      constellation: "Avcı",
      nature: "Jüpiter/Satürn",
      meaning: "Onur, zenginlik, ihtişam, teknik ve öğretici yetenek."
    },
    {
      key: "arcturus",
      name: "Arcturus",
      constellation: "Çoban",
      nature: "Jüpiter/Mars",
      meaning: "Emekle gelen refah, liderlik ve yol göstericilik."
    },
    {
      key: "capella",
      name: "Capella",
      constellation: "Arabacı",
      nature: "Mars/Merkür",
      meaning: "Merak, öğrenme sevgisi ve onurlar."
    },
    {
      key: "pollux",
      name: "Pollux",
      constellation: "İkizler",
      nature: "Mars",
      meaning: "Atılganlık, ruhsal güç; sertleşebilen mizaç."
    },
    {
      key: "castor",
      name: "Castor",
      constellation: "İkizler",
      nature: "Merkür",
      meaning: "Zekâ, yazı, iletişim; ani yükseliş/düşüş."
    },
    {
      key: "canopus",
      name: "Canopus",
      constellation: "Carina",
      nature: "Satürn/Jüpiter",
      meaning: "Yolculuklar, navigasyon ve liderlik."
    },
    {
      key: "polaris",
      name: "Polaris",
      aliases: ["Kutup Yıldızı"],
      constellation: "Küçük Ayı",
      nature: "Satürn/Venüs",
      meaning: "Yön bulma, rehberlik ve sabit hedef."
    }
  ],
  constellations: [
    {
      key: "aries",
      latin: "Aries",
      tr: "Koç",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Koç burcunun öncü, ateşli başlangıç enerjisine bağlanır.",
      brightestStar: "Hamal",
      signKey: "aries"
    },
    {
      key: "taurus",
      latin: "Taurus",
      tr: "Boğa",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Boğa burcunun istikrar, güven ve somut değer temasına bağlanır.",
      brightestStar: "Aldebaran",
      signKey: "taurus"
    },
    {
      key: "gemini",
      latin: "Gemini",
      tr: "İkizler",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı İkizler burcunun iletişim, merak ve çok yönlülük temasına bağlanır.",
      brightestStar: "Pollux",
      signKey: "gemini"
    },
    {
      key: "cancer",
      latin: "Cancer",
      tr: "Yengeç",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Yengeç burcunun yuva, sezgi ve koruyuculuk temasına bağlanır.",
      brightestStar: "Tarf",
      signKey: "cancer"
    },
    {
      key: "leo",
      latin: "Leo",
      tr: "Aslan",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Aslan burcunun yaratıcılık, liderlik ve görünür olma temasına bağlanır.",
      brightestStar: "Regulus",
      signKey: "leo"
    },
    {
      key: "virgo",
      latin: "Virgo",
      tr: "Başak",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Başak burcunun analiz, hizmet ve pratik akıl temasına bağlanır.",
      brightestStar: "Spica",
      signKey: "virgo"
    },
    {
      key: "libra",
      latin: "Libra",
      tr: "Terazi",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Terazi burcunun denge, ilişki ve estetik temasına bağlanır.",
      brightestStar: "Zubeneschamali",
      signKey: "libra"
    },
    {
      key: "scorpio",
      latin: "Scorpius",
      tr: "Akrep",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Akrep burcunun yoğunluk, dönüşüm ve derinlik temasına bağlanır.",
      brightestStar: "Antares",
      signKey: "scorpio",
      aliases: ["Scorpio"]
    },
    {
      key: "sagittarius",
      latin: "Sagittarius",
      tr: "Yay",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Yay burcunun keşif, özgürlük ve felsefe temasına bağlanır.",
      brightestStar: "Kaus Australis",
      signKey: "sagittarius"
    },
    {
      key: "capricorn",
      latin: "Capricornus",
      tr: "Oğlak",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Oğlak burcunun disiplin, sorumluluk ve hedef temasına bağlanır.",
      brightestStar: "Deneb Algedi",
      signKey: "capricorn",
      aliases: ["Capricorn"]
    },
    {
      key: "aquarius",
      latin: "Aquarius",
      tr: "Kova",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Kova burcunun yenilik, topluluk ve özgünlük temasına bağlanır.",
      brightestStar: "Sadalsuud",
      signKey: "aquarius"
    },
    {
      key: "pisces",
      latin: "Pisces",
      tr: "Balık",
      meaning: "Zodyak takımyıldızı; astrolojik anlamı Balık burcunun empati, hayal gücü ve sezgi temasına bağlanır.",
      brightestStar: "Alpherg",
      signKey: "pisces"
    },
    {
      key: "orion",
      latin: "Orion",
      tr: "Avcı",
      meaning:
        "Dev avcı; Mısır'da Osiris. Güç, cesaret, atılganlık (Mars/Merkür doğası). Gökyüzünün en tanınan deseni.",
      brightestStar: "Rigel"
    },
    {
      key: "ursa-major",
      latin: "Ursa Major",
      tr: "Büyük Ayı",
      meaning:
        "Callisto miti. Ptolemy'ye göre Mars-vari: ihtiyat, sebat, koruyuculuk. Büyük Kepçe ile Kutup Yıldızı'nı gösterir.",
      brightestStar: "Alioth"
    },
    {
      key: "ursa-minor",
      latin: "Ursa Minor",
      tr: "Küçük Ayı",
      meaning: "Kutup Yıldızı'nı barındırır; yön ve rehberlik sembolü.",
      brightestStar: "Polaris"
    },
    {
      key: "cygnus",
      latin: "Cygnus",
      tr: "Kuğu",
      meaning: "Düşünceli, hayalperest, kültürlü, uyumlu bir doğa. Kuzey Haçı asterizmi.",
      brightestStar: "Deneb"
    },
    {
      key: "lyra",
      latin: "Lyra",
      tr: "Lir (Çalgı)",
      meaning: "Orpheus'un liri; uyum, müzik, sanat. Parlak yıldızı Vega.",
      brightestStar: "Vega"
    },
    {
      key: "pegasus",
      latin: "Pegasus",
      tr: "Kanatlı At",
      meaning: "Medusa'nın kanından doğan at; ilham, hırs, yolculuk, yükseliş.",
      brightestStar: "Enif"
    },
    {
      key: "andromeda",
      latin: "Andromeda",
      tr: "Zincirli Prenses",
      meaning: "Kurtarılan prenses; özgürleşme, kaderden kurtuluş teması.",
      brightestStar: "Alpheratz"
    },
    {
      key: "perseus",
      latin: "Perseus",
      tr: "Kahraman",
      meaning: "Medusa'yı yenen kahraman; cesaret, zafer (Medusa'nın başı = Algol).",
      brightestStar: "Mirfak"
    },
    {
      key: "cassiopeia",
      latin: "Cassiopeia",
      tr: "Kraliçe",
      meaning: "Kibirli kraliçe; gurur, güzellik, statü teması. W şeklinde.",
      brightestStar: "Schedar"
    },
    {
      key: "centaurus",
      latin: "Centaurus",
      tr: "Erboğa (Kentaur)",
      meaning: "Bilge kentaur Chiron; bilgelik, öğretmenlik, şifa.",
      brightestStar: "Alpha Centauri"
    },
    {
      key: "draco",
      latin: "Draco",
      tr: "Ejderha",
      meaning: "Bahçeyi koruyan ejderha; bekçilik, gizli bilgi, dayanıklılık.",
      brightestStar: "Eltanin"
    },
    {
      key: "canis-major",
      latin: "Canis Major",
      tr: "Büyük Köpek",
      meaning: "Avcı'nın köpeği; sadakat. En parlak yıldızı Sirius.",
      brightestStar: "Sirius"
    }
  ],
  usage: {
    systemLayer:
      "Gezegene tıklayınca burç+derece konumu, Dünya'dan km uzaklığı, Güneş'le açı ve gezegenin anlamı gösterilir.",
    skyLayer:
      "Parlak yıldıza tıklanınca olgusal HYG bilgileri ve varsa sabit yıldız anlamı; takımyıldıza tıklanınca Latince/Türkçe ad, mitoloji ve anlam gösterilir.",
    rule: "Gezegen = NE, Burç = NASIL, Ev = NEREDE, Açı = İLİŞKİ."
  }
} as const;

export function normalizeAstroKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findGlossaryPlanetByName(name: string): AstroPlanet | undefined {
  const key = normalizeAstroKey(name);
  return ASTRO_GLOSSARY.planets.find((planet) => normalizeAstroKey(planet.name) === key || planet.key === key);
}

export function findGlossarySignByName(name: string): AstroSign | undefined {
  const key = normalizeAstroKey(name);
  return ASTRO_GLOSSARY.signs.find((sign) => normalizeAstroKey(sign.name) === key || sign.key === key);
}

export function findGlossaryFixedStar(name: string): AstroFixedStar | undefined {
  const key = normalizeAstroKey(name);
  return ASTRO_GLOSSARY.fixedStars.find((star) => {
    const names = [star.key, star.name, ...(star.aliases ?? [])].map(normalizeAstroKey);
    return names.includes(key);
  });
}

export function findGlossaryConstellation(nameOrKey: string): AstroConstellation | undefined {
  const key = normalizeAstroKey(nameOrKey);
  return ASTRO_GLOSSARY.constellations.find((constellation) => {
    const names = [
      constellation.key,
      constellation.latin,
      constellation.tr,
      ...(constellation.aliases ?? [])
    ].map(normalizeAstroKey);
    return names.includes(key);
  });
}
