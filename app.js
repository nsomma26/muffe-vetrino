// The page is the glass. Six moulds, one for each channel.
// A mould grows with the number of case studies in its folder.

const MAX_COUNT = 15;
const MAX_AREA = 8200 * 8200;

function mouldSize(count, nativeW, nativeH) {
  // Grow with cases; soft floor so sparse channels aren't tiny on the slide.
  const weight = count <= 2 ? count + 3 : count <= 5 ? count + 1.5 : count;
  const scale = Math.sqrt((MAX_AREA * (weight / MAX_COUNT)) / (nativeW * nativeH));
  return { w: nativeW * scale, h: nativeH * scale };
}

function placed(src, nativeW, nativeH, count, cx, cy, cards, rot = 0) {
  const size = mouldSize(count, nativeW, nativeH);
  return {
    src,
    x: cx - size.w / 2,
    y: cy - size.h / 2,
    w: size.w,
    h: size.h,
    cards,
    rot,
  };
}

function layoutSize(spec) {
  const rot = (((spec.rot || 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  return swap ? { w: spec.h, h: spec.w } : { w: spec.w, h: spec.h };
}

// Coloured body of each colony — includes cyan/green rings, not only the pale core.
const INTERIOR = {
  "assets/muffa-04.png": { x: 4.0, y: 8.0, w: 76.0, h: 84.0 },
  "assets/muffa-03.png": { x: 24.0, y: 8.0, w: 72.0, h: 78.0 },
  "assets/muffa-07.png": { x: 4.5, y: 8.0, w: 84.0, h: 70.0 },
  "assets/muffa-06.png": { x: 4.5, y: 10.0, w: 76.0, h: 80.0 },
  "assets/muffa-05.png": { x: 3.5, y: 8.0, w: 88.0, h: 78.0 },
  "assets/muffa-02.png": { x: 5.0, y: 4.5, w: 88.0, h: 90.0 },
};

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unitRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cardBoxes(spec) {
  const count = spec.cards.length;
  const raw = INTERIOR[spec.src];
  // Inset so the muffa rim stays visible around every photo.
  const inset = 7;
  const frame = {
    x: raw.x + inset,
    y: raw.y + inset,
    w: Math.max(8, raw.w - inset * 2),
    h: Math.max(8, raw.h - inset * 2),
  };
  const rand = unitRandom(hashString(`${spec.src}:spread-v5`));
  const aspect = spec.w / spec.h;
  // Photo-only cards (16:9) — slightly larger, muffa still visible between them.
  const photoRatio = 9 / 16;
  const heightOf = (width) => width * aspect * photoRatio;
  const gap = 2.2;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spin = rand() * Math.PI * 2;

  // Spread across the coloured body — leave muffa texture between cards.
  const seeds = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.28 : (i + 0.45) / count;
    const reach = Math.sqrt(0.12 + 0.82 * t);
    const ang = spin + i * golden + (rand() - 0.5) * 0.35;
    const rx = frame.w * 0.44 * (0.96 + rand() * 0.06);
    const ry = frame.h * 0.44 * (0.96 + rand() * 0.06);
    seeds.push({
      ox: frame.x + frame.w / 2 + Math.cos(ang) * reach * rx,
      oy: frame.y + frame.h / 2 + Math.sin(ang) * reach * ry,
      weight: 0.96 + rand() * 0.06,
    });
  }

  const areaScale = seeds.reduce((sum, seed) => sum + seed.weight * seed.weight, 0);
  const fill = count <= 2 ? 0.36 : count <= 6 ? 0.4 : count <= 11 ? 0.42 : 0.44;
  let base = Math.sqrt((frame.w * frame.h * fill) / (aspect * photoRatio * areaScale));

  const place = (baseWidth) => seeds.map((seed) => {
    const w = baseWidth * seed.weight;
    const h = heightOf(w);
    return { cx: seed.ox, cy: seed.oy, w, h };
  });

  const clamp = (card) => {
    card.cx = Math.min(frame.x + frame.w - card.w / 2, Math.max(frame.x + card.w / 2, card.cx));
    card.cy = Math.min(frame.y + frame.h - card.h / 2, Math.max(frame.y + card.h / 2, card.cy));
  };

  const separate = (cards) => {
    for (let pass = 0; pass < 90; pass += 1) {
      let moved = false;
      for (let i = 0; i < count; i += 1) {
        for (let j = i + 1; j < count; j += 1) {
          const a = cards[i];
          const b = cards[j];
          const dx = b.cx - a.cx;
          const dy = b.cy - a.cy;
          const minX = (a.w + b.w) / 2 + gap;
          const minY = (a.h + b.h) / 2 + gap;
          const overlapX = minX - Math.abs(dx);
          const overlapY = minY - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          if (overlapX < overlapY) {
            const push = (overlapX / 2) * (Math.sign(dx) || 1);
            a.cx -= push;
            b.cx += push;
          } else {
            const push = (overlapY / 2) * (Math.sign(dy) || 1);
            a.cy -= push;
            b.cy += push;
          }
          moved = true;
        }
      }
      for (const card of cards) clamp(card);
      if (!moved) break;
    }
  };

  const colliding = (cards) => {
    for (let i = 0; i < count; i += 1) {
      const a = cards[i];
      if (a.cx - a.w / 2 < frame.x - 0.05) return true;
      if (a.cy - a.h / 2 < frame.y - 0.05) return true;
      if (a.cx + a.w / 2 > frame.x + frame.w + 0.05) return true;
      if (a.cy + a.h / 2 > frame.y + frame.h + 0.05) return true;
      for (let j = i + 1; j < count; j += 1) {
        const b = cards[j];
        if (Math.abs(b.cx - a.cx) < (a.w + b.w) / 2 + gap * 0.85
          && Math.abs(b.cy - a.cy) < (a.h + b.h) / 2 + gap * 0.85) {
          return true;
        }
      }
    }
    return false;
  };

  let cards = place(base);
  separate(cards);
  for (let guard = 0; colliding(cards) && guard < 36; guard += 1) {
    base *= 0.94;
    cards = place(base);
    separate(cards);
  }

  return cards.map((card) => ({
    left: `${card.cx - card.w / 2}%`,
    top: `${card.cy - card.h / 2}%`,
    width: `${card.w}%`,
  }));
}

function arrangeSpecimens() {
  // Centripetal: larger muffe, full boxes clear of each other.
  const gap = 140;
  const center = SPECIMENS[5];
  const cLay = layoutSize(center);
  center.x = -cLay.w / 2;
  center.y = -cLay.h / 2;
  const ring = [3, 2, 1, 0, 4];
  let radius = 0;
  for (const index of ring) {
    const spec = SPECIMENS[index];
    const lay = layoutSize(spec);
    const need =
      (cLay.w + lay.w) * 0.5 + (cLay.h + lay.h) * 0.06 + gap;
    radius = Math.max(radius, need);
  }
  const chordFactor = 2 * Math.sin(Math.PI / ring.length);
  for (let i = 0; i < ring.length; i += 1) {
    const a = layoutSize(SPECIMENS[ring[i]]);
    const b = layoutSize(SPECIMENS[ring[(i + 1) % ring.length]]);
    const minChord = (a.w + b.w) * 0.5 + (a.h + b.h) * 0.05 + gap;
    radius = Math.max(radius, minChord / chordFactor);
  }
  for (let i = 0; i < ring.length; i += 1) {
    const ang = -Math.PI / 2 + 0.18 + (i * 2 * Math.PI) / ring.length;
    const spec = SPECIMENS[ring[i]];
    const lay = layoutSize(spec);
    spec.x = Math.cos(ang) * radius - lay.w / 2;
    spec.y = Math.sin(ang) * radius - lay.h / 2;
  }
}

const SPECIMENS = [
  placed("assets/muffa-04.png", 473.876, 354.826, 2, 1180, 250, [
    {
      src: "FACEBOOK/COMMUNITY TO GOOD TO GO SU FACBOOK.png",
      title: "Community Too Good To Go su Facebook",
      kind: "Facebook",
    },
    {
      src: "FACEBOOK/messaggio antispreco .jpg",
      title: "Messaggi antispreco di un retailer",
      kind: "Facebook",
    },
  ]),
  placed("assets/muffa-03.png", 460.406, 586.007, 5, 520, 1520, [
    {
      src: "TV/TASTE THE WASTE.jpg",
      title: "Taste the Waste",
      kind: "Documentario",
    },
    {
      src: "TV/HUGH'S.png",
      title: "Hugh's War on Waste",
      kind: "Tv",
    },
    {
      src: "TV/STORIA DI UNA FRAGOLA.jpg",
      title: "Storia di una fragola",
      kind: "Tv",
    },
    {
      src: "TV/CCTV CRITICA I MUKBANG.jpeg",
      title: "CCTV critica i mukbang",
      kind: "Tv",
    },
    {
      src: "TV/APPELLO CINA CLEAN YOUR PLATE.jpg",
      title: "Clean Your Plate",
      kind: "Campagna",
    },
  ]),
  placed("assets/muffa-07.png", 576.855, 480.239, 6, 1960, 1580, [
    {
      src: "TIKTOK/EMILY MARIKO.png",
      title: "Emily Mariko: salmon rice bowl",
      kind: "TikTok",
    },
    {
      src: "TIKTOK/WHAT I EAT IN A DAY.jpg",
      title: "Analisi di video What I Eat in a Day",
      kind: "TikTok",
    },
    {
      src: "TIKTOK/food diary.jpg",
      title: "Esperimento di esposizione a food diary",
      kind: "TikTok",
    },
    {
      src: "TIKTOK/ALLY LA BAG.avif",
      title: "Ally: la bag con torta",
      kind: "TikTok",
    },
    {
      src: "TIKTOK/BAG DI SALMONE.jpg",
      title: "Ellie: bag di salmone Whole Foods",
      kind: "TikTok",
    },
    {
      src: "TIKTOK/UNBOXING E TUTORIAL.jpg",
      title: "Unboxing e tutorial come marketing",
      kind: "TikTok",
    },
  ]),
  placed("assets/muffa-06.png", 542.211, 613.265, 10, 430, 680, [
    {
      src: "YOUTUBE E LIVESTREAM/YOUTUBERS REACT TO MUKBANG.png",
      title: "YouTubers React to Mukbang",
      kind: "YouTube",
    },
    {
      src: "YOUTUBE E LIVESTREAM/FAST FOOD PIZZA.png",
      title: "Epic Meal Time: Fast Food Pizza",
      kind: "YouTube",
    },
    {
      src: "YOUTUBE E LIVESTREAM/WHAT I EAT IN A DAY.png",
      title: "Blogilates: What I Eat in a Day",
      kind: "YouTube",
    },
    {
      src: "YOUTUBE E LIVESTREAM/SOCIAL EATING.jpg",
      title: "Twitch riconosce Social Eating",
      kind: "Livestream",
    },
    {
      src: "YOUTUBE E LIVESTREAM/10 CONFEZIONI DI NOODLES.png",
      title: "Mizijun: dieci confezioni di noodles",
      kind: "YouTube",
    },
    {
      src: "YOUTUBE E LIVESTREAM/BUZZFEED.png",
      title: "BuzzFeed: una settimana senza sprecare cibo",
      kind: "YouTube",
    },
    {
      src: "YOUTUBE E LIVESTREAM/TO GOOD TO GO UNBOXED.png",
      title: "Too Good To Go: Food Unboxed",
      kind: "YouTube",
    },
    {
      src: "YOUTUBE E LIVESTREAM/MUKBANG SU YOUTUBE.webp",
      title: "Ricezione del mukbang su YouTube e Reddit",
      kind: "YouTube",
    },
    {
      src: "YOUTUBE E LIVESTREAM/AVVISI E SANZIONI SULLE PIATTAFROME.webp",
      title: "Avvisi e sanzioni delle piattaforme",
      kind: "YouTube",
    },
    {
      src: "YOUTUBE E LIVESTREAM/emily solo avanzi per 24 ore.png",
      title: "Emily Canham e le 24 ore di avanzi",
      kind: "YouTube",
    },
  ]),
  placed("assets/muffa-05.png", 446.305, 601.343, 11, 2050, 760, [
    {
      src: "muffa grande WEB/WRAP THE FOOD WASTE.png",
      title: "WRAP: The Food Waste",
      kind: "Stampa",
    },
    {
      src: "muffa grande WEB/INTERMARCHE.webp",
      title: "Intermarché: Inglorious Fruits and Vegetables",
      kind: "Campagna",
    },
    {
      src: "muffa grande WEB/TGTG SETTIMANA ZERO SPRECHI.avif",
      title: "Too Good To Go: Settimana Zero Sprechi",
      kind: "Campagna online",
    },
    {
      src: "muffa grande WEB/LOVE FOOD HATE WASTE.jpg",
      title: "Love Food Hate Waste",
      kind: "Stampa",
    },
    {
      src: "muffa grande WEB/CRYING PEAR.jpg",
      title: "Love Food Hate Waste: Crying Pear",
      kind: "Campagna online",
    },
    {
      src: "muffa grande WEB/THINK.HATE.SAVE.png",
      title: "Think.Eat.Save",
      kind: "Web istituzionale",
    },
    {
      src: "muffa grande WEB/UNEP DOVE SI GENERA LO SPRECO.jpg",
      title: "UNEP: dove si genera lo spreco",
      kind: "Web istituzionale",
    },
    {
      src: "muffa grande WEB/WASTE WATCHER ITALIA.jpg",
      title: "Waste Watcher: serie italiana",
      kind: "Report",
    },
    {
      src: "muffa grande WEB/REVISIONE DEGLI STUDI SULLE CAMPAGNE SOCIAL.png",
      title: "Revisione degli studi sulle campagne social",
      kind: "Report",
    },
    {
      src: "muffa grande WEB/LEGGE CINESE CONTRO LO SPRECO ALIMENTARE.webp",
      title: "Legge cinese contro lo spreco alimentare",
      kind: "Web istituzionale",
    },
    {
      src: "muffa grande WEB/MODELLO RECUPERO O SPOSTAMENTO DELLO SPRECO.jpg",
      title: "Recupero o spostamento dello spreco?",
      kind: "Report",
    },
  ]),
  placed("assets/muffa-02.png", 794.996, 825.547, 15, 1180, 980, [
    {
      src: "APP E MARKET PLACE/LANCIO MARKETPLACE TGTG.png",
      title: "Lancio del marketplace Too Good To Go",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/TGTG ARRIVA IN ITALIA.png",
      title: "Too Good To Go arriva in Italia",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/TGTG ITALIA REPORT.jpg",
      title: "Dati Too Good To Go Italia sul 2025",
      kind: "Report",
    },
    {
      src: "APP E MARKET PLACE/WUR MAGIC BOX.png",
      title: "WUR: studio sulle Magic Box",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/WUR MANGIARE, CONSERVARE, CONDIVIDERE, SCARTARE.webp",
      title: "WUR: mangiare, conservare, condividere, scartare",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/DALLA BAG AL BENEFICIO AMBIENTALE.jpg",
      title: "Dalla bag al beneficio ambientale",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/whole foods market x to good to go.jpg",
      title: "Whole Foods: rollout nazionale con TGTG",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/sconti pre scadenza amazon fresh.jpg",
      title: "Amazon Fresh sconta prodotti a breve scadenza",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/AMAZON FRESH DIVERSIONE ORGANICA NEI NEGOZI.jpg",
      title: "Amazon Fresh: diversione organica nei negozi",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/AMAZON FRESH ADEIRSCE AL FOOD WASTE PACT.jpg",
      title: "Amazon Fresh aderisce al Food Waste Pact",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/SPESA ONLINE IN AUSTRALIA.png",
      title: "Spesa online e spreco domestico in Australia",
      kind: "App",
    },
    {
      src: "APP E MARKET PLACE/23.png",
      title: "Un pasto filmato in cucina",
      kind: "Video",
    },
    {
      src: "APP E MARKET PLACE/007wkUAqly1ghp4h6ezycj30u00pcwsp_meitu_2.webp",
      title: "Mukbang sulle piattaforme cinesi",
      kind: "Social video",
    },
  ]),
];

arrangeSpecimens();

function normTitle(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

const SHEET_ALIAS = {
  [normTitle("WRAP: The Food Waste")]: normTitle("WRAP: The Food We Waste"),
  [normTitle("Love Food Hate Waste")]: normTitle("Love Food Hate Waste: nuove creatività"),
  [normTitle("Dalla bag al beneficio ambientale")]: normTitle(
    "Modello aziendale: dalla bag al beneficio ambientale"
  ),
  [normTitle("Recupero o spostamento dello spreco?")]: normTitle(
    "Modello: recupero o spostamento dello spreco?"
  ),
};

const SHEET_FILES = [
  "AF01_Amazon_Fresh_sconta_prodotti_a_breve_scadenza.svg",
  "AF02_Amazon_Fresh_diversione_organica_nei_negozi.svg",
  "AF03_Amazon_Fresh_aderisce_al_Food_Waste_Pact.svg",
  "AU01_Spesa_online_e_spreco_domestico_in_Australia.svg",
  "U01_Love_Food_Hate_Waste_Crying_Pear.svg",
  "U02_WRAP_The_Food_We_Waste.svg",
  "U03_Love_Food_Hate_Waste_nuove_creativit.svg",
  "U04_Epic_Meal_Time_Fast_Food_Pizza.svg",
  "U05_Taste_the_Waste.svg",
  "U07_Think_Eat_Save.svg",
  "U08_Blogilates_What_I_Eat_in_a_Day.svg",
  "U09_Intermarch_Inglorious_Fruits_and_Vegetables.svg",
  "U10_YouTubers_React_to_Mukbang.svg",
  "U12_Lancio_del_marketplace_Too_Good_To_Go.svg",
  "U14_Twitch_riconosce_Social_Eating.svg",
  "U15_Mizijun_dieci_confezioni_di_noodles.svg",
  "U16_Messaggi_antispreco_di_un_retailer.svg",
  "U17_BuzzFeed_una_settimana_senza_sprecare_cibo.svg",
  "U18_Too_Good_To_Go_arriva_in_Italia.svg",
  "U19_Emily_Canham_e_le_24_ore_di_avanzi.svg",
  "U20_WUR_studio_sulle_Magic_Box.svg",
  "U21_Ricezione_del_mukbang_su_YouTube_e_Reddit.svg",
  "U23_Too_Good_To_Go_Food_Unboxed.svg",
  "U24_Legge_cinese_contro_lo_spreco_alimentare.svg",
  "U25_Emily_Mariko_salmon_rice_bowl.svg",
  "U26_Community_Too_Good_To_Go_su_Facebook.svg",
  "U28_Unboxing_e_tutorial_come_marketing.svg",
  "U29_Revisione_degli_studi_sulle_campagne_social.svg",
  "U30_Ally_la_bag_con_torta.svg",
  "U32_Analisi_di_video_What_I_Eat_in_a_Day.svg",
  "U33_Whole_Foods_rollout_nazionale_con_TGTG.svg",
  "U34_Esperimento_di_esposizione_a_food_diary.svg",
  "U35_Modello_aziendale_dalla_bag_al_beneficio_ambientale.svg",
  "U36_UNEP_dove_si_genera_lo_spreco.svg",
  "U37_Too_Good_To_Go_Settimana_Zero_Sprechi.svg",
  "U38_Modello_recupero_o_spostamento_dello_spreco.svg",
  "U39_WUR_mangiare_conservare_condividere_scartare.svg",
  "U40_Ellie_bag_di_salmone_Whole_Foods.svg",
  "U41_Waste_Watcher_serie_italiana.svg",
  "U42_Dati_Too_Good_To_Go_Italia_sul_2025.svg",
  "U48_Avvisi_e_sanzioni_delle_piattaforme.svg",
];

const SHEET_BY_KEY = {};
for (const file of SHEET_FILES) {
  const stem = file.replace(/\.svg$/i, "");
  const named = stem.replace(/^[A-Z]+\d+_/, "").replace(/_/g, " ");
  SHEET_BY_KEY[normTitle(named)] = `etichette di ogni foto/${file}`;
}
// Explicit title keys from the SVG <title> bodies.
SHEET_BY_KEY[normTitle("WRAP: The Food We Waste")] = "etichette di ogni foto/U02_WRAP_The_Food_We_Waste.svg";
SHEET_BY_KEY[normTitle("Love Food Hate Waste: Crying Pear")] =
  "etichette di ogni foto/U01_Love_Food_Hate_Waste_Crying_Pear.svg";
SHEET_BY_KEY[normTitle("Love Food Hate Waste: nuove creatività")] =
  "etichette di ogni foto/U03_Love_Food_Hate_Waste_nuove_creativit.svg";
SHEET_BY_KEY[normTitle("Intermarché: Inglorious Fruits and Vegetables")] =
  "etichette di ogni foto/U09_Intermarch_Inglorious_Fruits_and_Vegetables.svg";
SHEET_BY_KEY[normTitle("Modello aziendale: dalla bag al beneficio ambientale")] =
  "etichette di ogni foto/U35_Modello_aziendale_dalla_bag_al_beneficio_ambientale.svg";
SHEET_BY_KEY[normTitle("Modello: recupero o spostamento dello spreco?")] =
  "etichette di ogni foto/U38_Modello_recupero_o_spostamento_dello_spreco.svg";

function sheetForTitle(title) {
  const key = normTitle(title);
  const aliased = SHEET_ALIAS[key] || key;
  if (SHEET_BY_KEY[aliased]) return SHEET_BY_KEY[aliased];
  if (SHEET_BY_KEY[key]) return SHEET_BY_KEY[key];
  for (const [candidate, path] of Object.entries(SHEET_BY_KEY)) {
    if (candidate.includes(key) || key.includes(candidate)) return path;
  }
  return "";
}

// Earliest year found in each SVG etichetta (2008 → 2026).
const SHEET_YEARS = {
  "etichette di ogni foto/AF01_Amazon_Fresh_sconta_prodotti_a_breve_scadenza.svg": [2023],
  "etichette di ogni foto/AF02_Amazon_Fresh_diversione_organica_nei_negozi.svg": [2023],
  "etichette di ogni foto/AF03_Amazon_Fresh_aderisce_al_Food_Waste_Pact.svg": [2024],
  "etichette di ogni foto/AU01_Spesa_online_e_spreco_domestico_in_Australia.svg": [2023],
  "etichette di ogni foto/U01_Love_Food_Hate_Waste_Crying_Pear.svg": [2012],
  "etichette di ogni foto/U02_WRAP_The_Food_We_Waste.svg": [2008],
  "etichette di ogni foto/U03_Love_Food_Hate_Waste_nuove_creativit.svg": [2009],
  "etichette di ogni foto/U04_Epic_Meal_Time_Fast_Food_Pizza.svg": [2010, 2011],
  "etichette di ogni foto/U05_Taste_the_Waste.svg": [2011],
  "etichette di ogni foto/U06_Tristram_Stuart_The_Global_Food_Waste_Scandal.svg": [2012],
  "etichette di ogni foto/U07_Think_Eat_Save.svg": [2013],
  "etichette di ogni foto/U08_Blogilates_What_I_Eat_in_a_Day.svg": [2014],
  "etichette di ogni foto/U09_Intermarch_Inglorious_Fruits_and_Vegetables.svg": [2014],
  "etichette di ogni foto/U10_YouTubers_React_to_Mukbang.svg": [2015],
  "etichette di ogni foto/U12_Lancio_del_marketplace_Too_Good_To_Go.svg": [2016],
  "etichette di ogni foto/U14_Twitch_riconosce_Social_Eating.svg": [2016],
  "etichette di ogni foto/U15_Mizijun_dieci_confezioni_di_noodles.svg": [2016],
  "etichette di ogni foto/U16_Messaggi_antispreco_di_un_retailer.svg": [2017],
  "etichette di ogni foto/U17_BuzzFeed_una_settimana_senza_sprecare_cibo.svg": [2018],
  "etichette di ogni foto/U18_Too_Good_To_Go_arriva_in_Italia.svg": [2019],
  "etichette di ogni foto/U19_Emily_Canham_e_le_24_ore_di_avanzi.svg": [2019],
  "etichette di ogni foto/U20_WUR_studio_sulle_Magic_Box.svg": [2019],
  "etichette di ogni foto/U21_Ricezione_del_mukbang_su_YouTube_e_Reddit.svg": [2020],
  "etichette di ogni foto/U23_Too_Good_To_Go_Food_Unboxed.svg": [2020],
  "etichette di ogni foto/U24_Legge_cinese_contro_lo_spreco_alimentare.svg": [2021],
  "etichette di ogni foto/U25_Emily_Mariko_salmon_rice_bowl.svg": [2021],
  "etichette di ogni foto/U26_Community_Too_Good_To_Go_su_Facebook.svg": [2022],
  "etichette di ogni foto/U27_Subry_bag_tra_Milano_e_Amsterdam.svg": [2022],
  "etichette di ogni foto/U28_Unboxing_e_tutorial_come_marketing.svg": [2022],
  "etichette di ogni foto/U29_Revisione_degli_studi_sulle_campagne_social.svg": [2022],
  "etichette di ogni foto/U30_Ally_la_bag_con_torta.svg": [2023],
  "etichette di ogni foto/U31_Use-up_day_e_ricette_flessibili.svg": [2023],
  "etichette di ogni foto/U32_Analisi_di_video_What_I_Eat_in_a_Day.svg": [2023],
  "etichette di ogni foto/U33_Whole_Foods_rollout_nazionale_con_TGTG.svg": [2024],
  "etichette di ogni foto/U34_Esperimento_di_esposizione_a_food_diary.svg": [2024],
  "etichette di ogni foto/U35_Modello_aziendale_dalla_bag_al_beneficio_ambientale.svg": [2022, 2023, 2024],
  "etichette di ogni foto/U36_UNEP_dove_si_genera_lo_spreco.svg": [2024],
  "etichette di ogni foto/U37_Too_Good_To_Go_Settimana_Zero_Sprechi.svg": [2024],
  "etichette di ogni foto/U38_Modello_recupero_o_spostamento_dello_spreco.svg": [2025],
  "etichette di ogni foto/U39_WUR_mangiare_conservare_condividere_scartare.svg": [2025],
  "etichette di ogni foto/U40_Ellie_bag_di_salmone_Whole_Foods.svg": [2025],
  "etichette di ogni foto/U41_Waste_Watcher_serie_italiana.svg": [2024, 2025],
  "etichette di ogni foto/U42_Dati_Too_Good_To_Go_Italia_sul_2025.svg": [2024, 2025, 2026],
  "etichette di ogni foto/U48_Avvisi_e_sanzioni_delle_piattaforme.svg": [2020],
};

const TIME_START = 2008;
const TIME_END = 2026;

for (const spec of SPECIMENS) {
  for (const card of spec.cards) {
    card.sheet = sheetForTitle(card.title);
    card.years = card.sheet && SHEET_YEARS[card.sheet] ? SHEET_YEARS[card.sheet].slice() : [];
  }
}

const HOVER_SHOW_MS = 420;
const HOVER_HIDE_MS = 480;
// Native etichette SVG are 285×112 — keep sheet size tied to the photo card.
const SHEET_NATIVE_W = 285;
const SHEET_NATIVE_H = 112;
const SHEET_ASPECT = SHEET_NATIVE_W / SHEET_NATIVE_H;

function rememberLabelLayout(label) {
  if (label._baseLayout) return;
  label._baseLayout = {
    left: label.style.left,
    top: label.style.top,
    width: label.style.width,
    height: label.style.height || "",
  };
}

function restoreLabelLayout(label) {
  if (!label._baseLayout) return;
  label.style.left = label._baseLayout.left;
  label.style.top = label._baseLayout.top;
  label.style.width = label._baseLayout.width;
  label.style.height = label._baseLayout.height;
  label.style.aspectRatio = "";
  label._baseLayout = null;
}

function layoutLabelSheet(label) {
  rememberLabelLayout(label);
  // Slightly larger than the photo only — never bigger than the muffa.
  const colony = label.closest(".colony") || label.parentElement;
  const colonyW = colony.clientWidth || 1;
  const colonyH = colony.clientHeight || 1;
  const slideRect = slide.getBoundingClientRect();
  const cardW = label.getBoundingClientRect().width || 1;

  let sheetW = cardW * 1.18;
  sheetW = Math.min(sheetW, colonyW * 0.42, slide.clientWidth * 0.36);
  sheetW = Math.max(sheetW, cardW);
  const sheetH = sheetW / SHEET_ASPECT;
  const maxH = colonyH * 0.38;
  const finalH = Math.min(sheetH, maxH);
  const finalW = finalH * SHEET_ASPECT;

  const curLeft = parseFloat(label._baseLayout.left) || 0;
  const curTop = parseFloat(label._baseLayout.top) || 0;
  label.style.aspectRatio = "auto";
  label.style.left = `${curLeft}%`;
  label.style.top = `${curTop}%`;
  label.style.width = `${(finalW / colonyW) * 100}%`;
  label.style.height = `${(finalH / colonyH) * 100}%`;

  const after = label.getBoundingClientRect();
  const pad = 10;
  let dx = 0;
  let dy = 0;
  if (after.right > slideRect.right - pad) dx = slideRect.right - pad - after.right;
  if (after.left + dx < slideRect.left + pad) dx = slideRect.left + pad - after.left;
  if (after.bottom > slideRect.bottom - pad) dy = slideRect.bottom - pad - after.bottom;
  if (after.top + dy < slideRect.top + pad) dy = slideRect.top + pad - after.top;
  if (dx || dy) {
    const colonyRect = colony.getBoundingClientRect();
    label.style.left = `${((after.left + dx - colonyRect.left) / colonyW) * 100}%`;
    label.style.top = `${((after.top + dy - colonyRect.top) / colonyH) * 100}%`;
  }
}

function ensureMedia(el) {
  // img.src is always an absolute URL — check the attribute, not the property.
  if (!el || !el.dataset.src || el.getAttribute("src")) return;
  el.src = el.dataset.src;
}

function ensureLabelMedia(label) {
  ensureMedia(label.querySelector(".label-photo"));
  ensureMedia(label.querySelector(".label-sheet-img"));
}

function showLabelSheet(label) {
  if (label.classList.contains("is-sheet")) return;
  const sheetImg = label.querySelector(".label-sheet-img");
  // Only real SVG etichette — no fallback table.
  if (!sheetImg) return;
  ensureLabelMedia(label);
  layoutLabelSheet(label);
  label.classList.add("is-sheet");
  if (sheetImg.dataset.src && !sheetImg.getAttribute("src")) {
    sheetImg.src = sheetImg.dataset.src;
  }
}

function clearLabelSheet(label) {
  const wasSheet = label.classList.contains("is-sheet");
  label.classList.remove("is-sheet");
  if (wasSheet) restoreLabelLayout(label);
  if (label._showTimer) {
    clearTimeout(label._showTimer);
    label._showTimer = 0;
  }
  if (label._hideTimer) {
    clearTimeout(label._hideTimer);
    label._hideTimer = 0;
  }
}

function bindLabelHover(label) {
  label.addEventListener("pointerdown", (event) => {
    if (!label.classList.contains("is-hot")) return;
    event.stopPropagation();
  });
  label.addEventListener("pointerenter", () => {
    if (!label.classList.contains("is-hot")) return;
    ensureLabelMedia(label);
    if (label._hideTimer) {
      clearTimeout(label._hideTimer);
      label._hideTimer = 0;
    }
    if (label.classList.contains("is-sheet")) return;
    label._showTimer = setTimeout(() => {
      showLabelSheet(label);
      label._showTimer = 0;
    }, HOVER_SHOW_MS);
  });
  label.addEventListener("pointerleave", () => {
    if (label._showTimer) {
      clearTimeout(label._showTimer);
      label._showTimer = 0;
    }
    if (!label.classList.contains("is-sheet")) return;
    label._hideTimer = setTimeout(() => {
      clearLabelSheet(label);
    }, HOVER_HIDE_MS);
  });
}

// Fit = 4× base. Max magnifier = 14×. Photos appear from 8×.
const VIEW_FILL = 0.98;
const LOW_POWER = 4;
const HIGH_POWER = 14;
const LABEL_POWER = 8;

const slide = document.querySelector("#slide");
const stage = document.querySelector("#stage");
const mag = document.querySelector("#mag");
const hint = document.querySelector("#hint");

const bounds = SPECIMENS.reduce((box, spec) => {
  const lay = layoutSize(spec);
  return {
    x: Math.min(box.x, spec.x),
    y: Math.min(box.y, spec.y),
    right: Math.max(box.right, spec.x + lay.w),
    bottom: Math.max(box.bottom, spec.y + lay.h),
  };
}, { x: Infinity, y: Infinity, right: -Infinity, bottom: -Infinity });
bounds.w = bounds.right - bounds.x;
bounds.h = bounds.bottom - bounds.y;

const MOTION = [
  { z: 36, lift: 15, drift: 6, speed: 0.31, tilt: 2.1, weight: 0.56, baseX: 4, baseY: -1.6 },
  { z: 46, lift: 18, drift: 9, speed: 0.38, tilt: 2.6, weight: 0.7, baseX: 5, baseY: -2.4 },
  { z: 52, lift: 19, drift: 9, speed: 0.34, tilt: 2.7, weight: 0.76, baseX: 5.6, baseY: 2.1 },
  { z: 72, lift: 24, drift: 12, speed: 0.42, tilt: 3.3, weight: 0.9, baseX: 6.8, baseY: -3.6 },
  { z: 28, lift: 18, drift: 8, speed: 0.36, tilt: 2.5, weight: 0.64, baseX: 4.8, baseY: 2.4 },
  { z: 18, lift: 10, drift: 4, speed: 0.24, tilt: 1.3, weight: 0.36, baseX: 2.4, baseY: 0.8 },
];

const STAINS = [
  "rgba(140, 154, 32, 0.14)",
  "rgba(48, 156, 160, 0.16)",
  "rgba(42, 162, 168, 0.16)",
  "rgba(162, 176, 40, 0.15)",
  "rgba(36, 158, 172, 0.16)",
  "rgba(52, 166, 150, 0.14)",
];

const colonies = SPECIMENS.map((spec, index) => {
  const lay = layoutSize(spec);
  const el = document.createElement("div");
  el.className = "colony";
  const spin = document.createElement("div");
  spin.className = "colony-spin";
  if (spec.rot) {
    spin.style.transform = `translate(-50%, -50%) rotate(${spec.rot}deg)`;
  } else {
    spin.style.transform = "translate(-50%, -50%)";
  }
  const shadow = document.createElement("div");
  shadow.className = "shadow";
  const img = new Image();
  img.src = spec.src;
  img.alt = "";
  img.draggable = false;
  img.decoding = "async";
  spin.appendChild(shadow);
  spin.appendChild(img);
  el.appendChild(spin);
  // Labels stay upright on the colony — never rotate with the muffa art.
  const boxes = cardBoxes(spec);
  spec.cards.forEach((card, cardIndex) => {
    const label = document.createElement("article");
    label.className = "label";
    label.style.left = boxes[cardIndex].left;
    label.style.top = boxes[cardIndex].top;
    label.style.width = boxes[cardIndex].width;
    const photo = new Image();
    photo.className = "label-photo";
    photo.dataset.src = encodeURI(card.src);
    photo.alt = card.title;
    photo.draggable = false;
    photo.decoding = "async";
    const sheet = document.createElement("div");
    sheet.className = "label-sheet";
    if (card.sheet) {
      const sheetImg = new Image();
      sheetImg.className = "label-sheet-img";
      sheetImg.dataset.src = encodeURI(card.sheet);
      sheetImg.alt = card.title;
      sheetImg.draggable = false;
      sheetImg.decoding = "async";
      sheet.appendChild(sheetImg);
    }
    label.dataset.years = (card.years || []).join(",");
    label.append(photo, sheet);
    bindLabelHover(label);
    el.appendChild(label);
  });
  stage.appendChild(el);
  return {
    spec,
    el,
    spin,
    img,
    shadow,
    layW: lay.w,
    layH: lay.h,
    motion: { ...MOTION[index], phase: index * 2.15 },
    stain: STAINS[index],
    floatX: 0,
    floatY: 0,
    x: spec.x + lay.w / 2,
    y: spec.y + lay.h / 2,
    homeX: spec.x + lay.w / 2,
    homeY: spec.y + lay.h / 2,
    hw: lay.w * 0.5,
    hh: lay.h * 0.5,
    nudgeX: 0,
    nudgeY: 0,
  };
});

const SEPARATION = 100;

function separateColonies() {
  for (let pass = 0; pass < 48; pass += 1) {
    let moved = false;
    for (let i = 0; i < colonies.length; i += 1) {
      for (let j = i + 1; j < colonies.length; j += 1) {
        const a = colonies[i];
        const b = colonies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minX = a.hw + b.hw + SEPARATION;
        const minY = a.hh + b.hh + SEPARATION;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const push = (overlapX / 2) * (Math.sign(dx) || 1);
          a.x -= push;
          b.x += push;
        } else {
          const push = (overlapY / 2) * (Math.sign(dy) || 1);
          a.y -= push;
          b.y += push;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

separateColonies();
for (const colony of colonies) {
  colony.homeX = colony.x;
  colony.homeY = colony.y;
}

function refreshBounds() {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const colony of colonies) {
    const pad = 16;
    minX = Math.min(minX, colony.homeX - colony.layW / 2 - pad);
    minY = Math.min(minY, colony.homeY - colony.layH / 2 - pad);
    maxX = Math.max(maxX, colony.homeX + colony.layW / 2 + pad);
    maxY = Math.max(maxY, colony.homeY + colony.layH / 2 + pad);
  }
  bounds.x = minX;
  bounds.y = minY;
  bounds.right = maxX;
  bounds.bottom = maxY;
  bounds.w = maxX - minX;
  bounds.h = maxY - minY;
}

refreshBounds();

const images = colonies.map((colony) => colony.img);

let zoom = 1;
let panX = 0;
let panY = 0;
let atFit = true;
let laidOutZoom = -1;
let selectedYear = null; // null = tutti gli anni
let anchorX = 0;
let anchorY = 0;
const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const pointers = new Map();
let drag = null;
let pinch = null;

function currentFit() {
  const vw = slide.clientWidth || window.innerWidth;
  const vh = slide.clientHeight || window.innerHeight;
  return Math.min((vw * VIEW_FILL) / bounds.w, (vh * VIEW_FILL) / bounds.h);
}

function currentPower() {
  return LOW_POWER * (zoom / currentFit());
}

function zoomLimits() {
  const fit = currentFit();
  return {
    min: fit, // 4×
    max: fit * (HIGH_POWER / LOW_POWER), // 12×
  };
}

function fade(value, start, end) {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function labelMatchesYear(label, year) {
  if (year == null) return true;
  const raw = label.dataset.years || "";
  if (!raw) return false;
  return raw.split(",").some((value) => Number(value) === year);
}

function refreshLabelVisibility() {
  laidOutZoom = -1;
  paint();
}

function paint() {
  stage.style.transform = `translate3d(${panX}px, ${panY}px, 0)`;

  if (zoom !== laidOutZoom) {
    const zoomingOut = zoom < laidOutZoom;
    laidOutZoom = zoom;
    for (const colony of colonies) {
      const width = colony.layW * zoom;
      const height = colony.layH * zoom;
      colony.el.style.width = `${width}px`;
      colony.el.style.height = `${height}px`;
      colony.spin.style.width = `${colony.spec.w * zoom}px`;
      colony.spin.style.height = `${colony.spec.h * zoom}px`;
      const power = currentPower();
      for (const label of colony.el.querySelectorAll(".label")) {
        // Photos visible from 8× — filtered by timeline year when active.
        const yearOk = labelMatchesYear(label, selectedYear);
        const photo = yearOk ? fade(power, LABEL_POWER - 0.35, LABEL_POWER) : 0;
        label.style.opacity = photo.toFixed(3);
        const hot = photo > 0.5;
        label.classList.toggle("is-hot", hot);
        if (power >= LABEL_POWER - 0.8 && yearOk) ensureLabelMedia(label);
        if (!hot || zoomingOut || atFit) clearLabelSheet(label);
        else if (label.classList.contains("is-sheet")) layoutLabelSheet(label);
      }
    }
  }
  for (const colony of colonies) {
    colony.el.style.left = `${(colony.x - colony.layW / 2) * zoom}px`;
    colony.el.style.top = `${(colony.y - colony.layH / 2) * zoom}px`;
  }

  mag.textContent = `${currentPower().toFixed(1)}×`;

  const vw = slide.clientWidth || window.innerWidth;
  const vh = slide.clientHeight || window.innerHeight;
  anchorX = (vw / 2 - panX) / zoom;
  anchorY = (vh / 2 - panY) / zoom;
}

function clampPan() {
  const vw = slide.clientWidth;
  const vh = slide.clientHeight;
  const marginX = Math.min(140, vw * 0.3);
  const marginY = Math.min(140, vh * 0.3);
  const left = panX + bounds.x * zoom;
  const top = panY + bounds.y * zoom;
  const right = left + bounds.w * zoom;
  const bottom = top + bounds.h * zoom;

  if (right < marginX) panX += marginX - right;
  if (left > vw - marginX) panX -= left - (vw - marginX);
  if (bottom < marginY) panY += marginY - bottom;
  if (top > vh - marginY) panY -= top - (vh - marginY);
}

function apply() {
  clampPan();
  paint();
}

function zoomAt(clientX, clientY, next) {
  const limits = zoomLimits();
  const z = Math.min(limits.max, Math.max(limits.min, next));
  if (Math.abs(z - zoom) < 1e-4) return;

  const rect = slide.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const worldX = (x - panX) / zoom;
  const worldY = (y - panY) / zoom;

  zoom = z;
  panX = x - worldX * zoom;
  panY = y - worldY * zoom;
  atFit = false;
  apply();
  hideHint();
}

function zoomBy(factor) {
  zoomAt(pointer.x, pointer.y, zoom * factor);
}

function openSlide() {
  const focus = colonies.reduce((best, colony) =>
    colony.spec.w * colony.spec.h > best.spec.w * best.spec.h ? colony : best
  );
  const vw = slide.clientWidth || window.innerWidth;
  const vh = slide.clientHeight || window.innerHeight;
  const label = focus.el.querySelector(".label");
  const cardWorld = focus.spec.w * (parseFloat(label.style.width) / 100);
  const readable = 176 / cardWorld;
  const fillWidth = (vw * 0.94) / focus.spec.w;
  const limits = zoomLimits();
  zoom = Math.min(
    limits.max,
    Math.max(limits.min, Math.min(Math.max(readable, fillWidth), 210 / cardWorld))
  );
  panX = vw / 2 - focus.homeX * zoom;
  panY = vh / 2 - focus.homeY * zoom;
  atFit = false;
  apply();
}

function fit() {
  zoom = currentFit();
  const vw = slide.clientWidth;
  const vh = slide.clientHeight;
  panX = (vw - bounds.w * zoom) / 2 - bounds.x * zoom;
  panY = (vh - bounds.h * zoom) / 2 - bounds.y * zoom;
  atFit = true;
  apply();
}

let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  hint.classList.add("is-hidden");
}

function rememberPointer(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
}

slide.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  slide.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  rememberPointer(event);
  hideHint();

  if (pointers.size === 1) {
    drag = {
      x: event.clientX - panX,
      y: event.clientY - panY,
      moved: false,
      sx: event.clientX,
      sy: event.clientY,
    };
    pinch = null;
    document.body.classList.add("is-dragging");
  } else {
    drag = null;
    pinch = capturePinch();
    document.body.classList.remove("is-dragging");
  }
});

slide.addEventListener("pointermove", (event) => {
  rememberPointer(event);
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size >= 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const limits = zoomLimits();
    const next = Math.min(limits.max, Math.max(limits.min, pinch.zoom * (dist / pinch.dist)));
    const rect = slide.getBoundingClientRect();
    zoom = next;
    panX = midX - rect.left - pinch.worldX * zoom;
    panY = midY - rect.top - pinch.worldY * zoom;
    atFit = false;
    apply();
    return;
  }

  if (!drag) return;
  if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) > 3) drag.moved = true;
  panX = event.clientX - drag.x;
  panY = event.clientY - drag.y;
  if (drag.moved) atFit = false;
  apply();
});

function endPointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size >= 2) {
    pinch = capturePinch();
    return;
  }
  if (pointers.size === 1) {
    const [remaining] = [...pointers.values()];
    drag = {
      x: remaining.x - panX,
      y: remaining.y - panY,
      moved: true,
      sx: remaining.x,
      sy: remaining.y,
    };
    pinch = null;
    document.body.classList.add("is-dragging");
    return;
  }
  drag = null;
  pinch = null;
  document.body.classList.remove("is-dragging");
}

slide.addEventListener("pointerup", endPointer);
slide.addEventListener("pointercancel", endPointer);

function capturePinch() {
  const [a, b] = [...pointers.values()];
  const rect = slide.getBoundingClientRect();
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  return {
    dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    zoom,
    worldX: (midX - rect.left - panX) / zoom,
    worldY: (midY - rect.top - panY) / zoom,
  };
}

window.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= slide.clientHeight;
    const factor = Math.pow(2, -delta / 260);
    rememberPointer(event);
    zoomAt(event.clientX, event.clientY, zoom * factor);
  },
  { passive: false }
);

window.addEventListener("gesturestart", (event) => event.preventDefault());
window.addEventListener("gesturechange", (event) => event.preventDefault());

slide.addEventListener("dblclick", (event) => {
  const { max } = zoomLimits();
  if (zoom >= max * 0.92) fit();
  else zoomAt(event.clientX, event.clientY, zoom * 2.15);
});

document.querySelector("#zoomIn").addEventListener("click", () => zoomBy(1.28));
document.querySelector("#zoomOut").addEventListener("click", () => zoomBy(1 / 1.28));
document.querySelector("#fitAll").addEventListener("click", () => {
  fit();
  hideHint();
});

window.addEventListener("keydown", (event) => {
  if (document.body.classList.contains("is-entering")) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const step = event.shiftKey ? 140 : 64;
  switch (event.key) {
    case "+":
    case "=":
      event.preventDefault();
      zoomBy(1.28);
      break;
    case "-":
    case "_":
      event.preventDefault();
      zoomBy(1 / 1.28);
      break;
    case "0":
    case "Home":
    case "Escape":
      event.preventDefault();
      fit();
      break;
    case "ArrowLeft":
      event.preventDefault();
      panX += step;
      atFit = false;
      apply();
      hideHint();
      break;
    case "ArrowRight":
      event.preventDefault();
      panX -= step;
      atFit = false;
      apply();
      hideHint();
      break;
    case "ArrowUp":
      event.preventDefault();
      panY += step;
      atFit = false;
      apply();
      hideHint();
      break;
    case "ArrowDown":
      event.preventDefault();
      panY -= step;
      atFit = false;
      apply();
      hideHint();
      break;
    default:
      break;
  }
});

window.addEventListener("resize", () => {
  if (atFit) {
    fit();
    return;
  }
  const heldX = anchorX;
  const heldY = anchorY;
  const limits = zoomLimits();
  zoom = Math.min(limits.max, Math.max(limits.min, zoom));
  panX = slide.clientWidth / 2 - heldX * zoom;
  panY = slide.clientHeight / 2 - heldY * zoom;
  apply();
});

const backCanvas = document.querySelector("#spores-back");
const frontCanvas = document.querySelector("#spores-front");
const backCtx = backCanvas.getContext("2d");
const frontCtx = frontCanvas.getContext("2d");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = random(20261122);
const CYAN = [
  [0, 168, 176],
  [12, 196, 186],
  [64, 176, 158],
  [8, 124, 122],
  [96, 186, 168],
];
const YELLOW = [
  [176, 188, 34],
  [146, 160, 26],
  [108, 128, 22],
  [198, 206, 68],
  [86, 108, 26],
];
const OLIVE = [
  [54, 92, 30],
  [32, 68, 24],
  [92, 120, 38],
  [20, 48, 20],
  [124, 146, 48],
];

function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

const dust = [];
const span = Math.max(bounds.w, bounds.h);
// Keep spore on-screen size stable when the world span changes (fit zoom ≈ 1/span).
const SPORE_SPAN_REF = 3200;
const sporeWorld = span / SPORE_SPAN_REF;
// Square glass large enough for wide viewports at fit and minimum zoom.
const glass = {
  x: bounds.x + bounds.w / 2 - span * 1.6,
  y: bounds.y + bounds.h / 2 - span * 1.6,
  w: span * 3.2,
  h: span * 3.2,
};
const CORE = [
  [232, 240, 226],
  [220, 232, 198],
  [244, 246, 228],
];
const RIM = [
  [22, 64, 26],
  [36, 84, 30],
  [14, 48, 22],
  [58, 96, 34],
];
const FUZZ = [
  [150, 196, 176],
  [186, 206, 120],
  [120, 168, 112],
  [168, 210, 186],
];

function bakeSpore(size, family) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: true });
  const cx = size / 2;
  const cy = size / 2;
  const reach = size * 0.36;
  const body = family === 0 ? CYAN : family === 1 ? YELLOW : OLIVE;
  const lobes = 5 + Math.floor(rand() * 4);
  const lobe = [];
  for (let i = 0; i < lobes; i += 1) lobe.push(0.78 + rand() * 0.34);

  const edge = (angle) => {
    const t = ((angle / (Math.PI * 2)) * lobes) % lobes;
    const i = Math.floor(t);
    const f = t - i;
    return lobe[i] * (1 - f) + lobe[(i + 1) % lobes] * f;
  };

  const dot = (x, y, color, s) => {
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(x | 0, y | 0, s, s);
  };

  const bodyCount = Math.round(reach * reach * 1.6);
  for (let i = 0; i < bodyCount; i += 1) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * reach * edge(angle);
    const shade = dist > reach * 0.72 ? pick(RIM) : pick(body);
    dot(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, shade, 1);
  }

  const fuzzCount = Math.round(reach * 7);
  for (let i = 0; i < fuzzCount; i += 1) {
    const angle = rand() * Math.PI * 2;
    const dist = reach * edge(angle) * (0.86 + rand() * 0.28);
    dot(
      cx + Math.cos(angle) * dist,
      cy + Math.sin(angle) * dist,
      rand() > 0.45 ? pick(FUZZ) : pick(RIM),
      rand() > 0.8 ? 2 : 1
    );
  }

  if (size > 56 && rand() > 0.3) {
    const core = reach * (0.12 + rand() * 0.1);
    const coreCount = Math.round(core * core * 1.8);
    for (let i = 0; i < coreCount; i += 1) {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * core;
      dot(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, pick(CORE), 1);
    }
  }

  return canvas;
}

// Reuse a tiny sprite pool — baking one canvas per spore blocked startup for minutes.
const SPORE_SPRITES = [];
for (let family = 0; family < 3; family += 1) {
  for (const size of [48, 64, 80, 96]) {
    SPORE_SPRITES.push({ family, size, canvas: bakeSpore(size, family) });
  }
}

function pickSporeSprite(radius, family) {
  const want = Math.max(48, Math.min(96, Math.round(radius * 0.55)));
  let best = SPORE_SPRITES[0];
  let bestScore = Infinity;
  for (const sprite of SPORE_SPRITES) {
    if (sprite.family !== family) continue;
    const score = Math.abs(sprite.size - want);
    if (score < bestScore) {
      best = sprite;
      bestScore = score;
    }
  }
  return best.canvas;
}

const field = {
  x: bounds.x - bounds.w * 0.28,
  y: bounds.y - bounds.h * 0.28,
  w: bounds.w * 1.56,
  h: bounds.h * 1.56,
};
const cover = {
  x: bounds.x + bounds.w / 2 - span * 1.15,
  y: bounds.y + bounds.h / 2 - span * 1.15,
  w: span * 2.3,
  h: span * 2.3,
};
const patches = [];
for (let n = 0; n < 1600; n += 1) {
  const roll = rand();
  // Slightly smaller spores — keep the field dense, just a touch lighter.
  const baseR = roll < 0.58 ? 19 + rand() * 23 : roll < 0.88 ? 42 + rand() * 32 : 74 + rand() * 38;
  const radius = baseR * sporeWorld;
  const family = rand() < 0.42 ? 0 : rand() < 0.72 ? 1 : 2;
  const pickBox = rand();
  const box = pickBox < 0.7 ? cover : pickBox < 0.9 ? field : glass;
  const x = box.x + rand() * box.w;
  const y = box.y + rand() * box.h;
  patches.push({
    x,
    y,
    ox: x,
    oy: y,
    vx: (rand() - 0.5) * 8,
    vy: (rand() - 0.5) * 8,
    sway: 8 + rand() * 16,
    freq: 0.14 + rand() * 0.22,
    phase: rand() * Math.PI * 2,
    radius,
    aspect: 0.84 + rand() * 0.3,
    sprite: pickSporeSprite(radius, family),
  });
}

// Push spores off muffe bodies only — skip pairwise O(n²) separation (was multi-minute).
for (let pass = 0; pass < 3; pass += 1) {
  for (const patch of patches) {
    const reach = patch.radius * 0.72;
    for (const colony of colonies) {
      const dx = patch.ox - colony.homeX;
      const dy = patch.oy - colony.homeY;
      const rx = colony.spec.w * 0.4 + reach;
      const ry = colony.spec.h * 0.4 + reach;
      const nx = dx / rx;
      const ny = dy / ry;
      const n = Math.hypot(nx, ny);
      if (n >= 1 || n < 0.0001) continue;
      patch.ox = colony.homeX + dx / n;
      patch.oy = colony.homeY + dy / n;
    }
  }
}
for (const patch of patches) {
  patch.x = patch.ox;
  patch.y = patch.oy;
}

let canvasKey = "";
function syncCanvases() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = slide.clientWidth;
  const h = slide.clientHeight;
  const key = `${w}x${h}@${dpr}`;
  if (key === canvasKey || !w || !h) return dpr;
  canvasKey = key;
  for (const canvas of [backCanvas, frontCanvas]) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  return dpr;
}

let prevPointerX = pointer.x;
let prevPointerY = pointer.y;
let glassX = 0;
let glassY = 0;

function poseColonies(time, dt) {
  const vw = slide.clientWidth || 1;
  const vh = slide.clientHeight || 1;
  const nx = pointer.x / vw - 0.5;
  const ny = pointer.y / vh - 0.5;
  const still = motionQuery.matches;
  const rect = slide.getBoundingClientRect();
  const worldX = (pointer.x - rect.left - panX) / zoom;
  const worldY = (pointer.y - rect.top - panY) / zoom;
  const pointerDx = (pointer.x - prevPointerX) / zoom;
  const pointerDy = (pointer.y - prevPointerY) / zoom;
  const swayX = still ? 0 : Math.cos(time * 0.15) * 70;
  const swayY = still ? 0 : Math.sin(time * 0.11) * 46;
  glassX = swayX;
  glassY = swayY;
  const ease = 1 - Math.exp(-1.35 * dt);

  for (const colony of colonies) {
    const motion = colony.motion;
    const t = time * 0.22 + motion.phase;
    let tx = colony.homeX + swayX;
    let ty = colony.homeY + swayY;
    if (!still) {
      tx += Math.cos(t) * 22;
      ty += Math.sin(t * 0.76) * 16;
    }

    colony.nudgeX *= Math.exp(-1.15 * dt);
    colony.nudgeY *= Math.exp(-1.15 * dt);
    if (!drag) {
      const dx = worldX - colony.x;
      const dy = worldY - colony.y;
      const dist = Math.hypot(dx, dy);
      const reach = Math.max(colony.hw, colony.hh) * 1.25;
      if (dist < reach) {
        const influence = 1 - dist / reach;
        colony.nudgeX += pointerDx * influence * 1.6;
        colony.nudgeY += pointerDy * influence * 1.6;
        const nudge = Math.hypot(colony.nudgeX, colony.nudgeY);
        if (nudge > 58) {
          colony.nudgeX *= 58 / nudge;
          colony.nudgeY *= 58 / nudge;
        }
        tx += (dx / (dist || 1)) * influence * 36;
        ty += (dy / (dist || 1)) * influence * 36;
      }
    }
    tx += colony.nudgeX;
    ty += colony.nudgeY;

    colony.x += (tx - colony.x) * ease;
    colony.y += (ty - colony.y) * ease;
    colony.tiltX = motion.baseX * 0.45 + (still ? 0 : Math.sin(t) * motion.tilt * 0.45) - ny * 5 * motion.weight;
    colony.tiltY = motion.baseY * 0.45 + (still ? 0 : Math.cos(t * 0.8) * motion.tilt * 0.35) + nx * 6 * motion.weight;
  }
  separateColonies();
  for (const colony of colonies) {
    colony.floatX = (colony.x - colony.homeX) * zoom;
    colony.floatY = (colony.y - colony.homeY) * zoom;
    colony.el.style.left = `${(colony.x - colony.layW / 2) * zoom}px`;
    colony.el.style.top = `${(colony.y - colony.layH / 2) * zoom}px`;
    const rot = colony.spec.rot || 0;
    colony.spin.style.transform = rot
      ? `translate(-50%, -50%) rotate(${rot}deg)`
      : "translate(-50%, -50%)";
    colony.shadow.style.opacity = "0";
  }
}

function stepSpores() {
  prevPointerX = pointer.x;
  prevPointerY = pointer.y;
}

function sporeShift(x, y) {
  let pullX = 0;
  let pullY = 0;
  let weight = 0;
  for (const colony of colonies) {
    const dist = Math.hypot(x - colony.homeX, y - colony.homeY);
    const reach = Math.max(colony.hw, colony.hh) * 2.6;
    if (dist >= reach) continue;
    const influence = (1 - dist / reach) ** 2;
    pullX += (colony.x - colony.homeX - glassX) * influence;
    pullY += (colony.y - colony.homeY - glassY) * influence;
    weight += influence;
  }
  if (weight === 0) return [glassX, glassY];
  return [glassX + pullX / weight, glassY + pullY / weight];
}

function drawSpores() {
  const dpr = syncCanvases();
  const vw = slide.clientWidth;
  const vh = slide.clientHeight;

  for (const [ctx, canvas] of [
    [backCtx, backCanvas],
    [frontCtx, frontCanvas],
  ]) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  backCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  backCtx.imageSmoothingEnabled = false;

  for (const patch of patches) {
    const [shiftX, shiftY] = sporeShift(patch.ox, patch.oy);
    const sx = panX + (patch.ox + shiftX) * zoom;
    const sy = panY + (patch.oy + shiftY) * zoom;
    const dw = patch.radius * 2 * zoom;
    const dh = dw * patch.aspect;
    if (sx < -dw || sy < -dh || sx > vw + dw || sy > vh + dh) continue;
    backCtx.drawImage(patch.sprite, sx - dw / 2, sy - dh / 2, dw, dh);
  }

  backCtx.globalCompositeOperation = "destination-out";
  for (const colony of colonies) {
    const left = panX + (colony.x - colony.layW / 2) * zoom;
    const top = panY + (colony.y - colony.layH / 2) * zoom;
    const dw = colony.layW * zoom;
    const dh = colony.layH * zoom;
    const rot = colony.spec.rot || 0;
    if (rot) {
      backCtx.save();
      backCtx.translate(left + dw / 2, top + dh / 2);
      backCtx.rotate((rot * Math.PI) / 180);
      backCtx.drawImage(
        colony.img,
        (-colony.spec.w * zoom) / 2,
        (-colony.spec.h * zoom) / 2,
        colony.spec.w * zoom,
        colony.spec.h * zoom
      );
      backCtx.restore();
    } else {
      backCtx.drawImage(colony.img, left, top, dw, dh);
    }
  }
  backCtx.globalCompositeOperation = "source-over";
}

let lastFrame = 0;
function tick(now) {
  const time = now / 1000;
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
  lastFrame = now;
  poseColonies(time, dt);
  stepSpores();
  drawSpores();
  requestAnimationFrame(tick);
}

function fitWhenReady() {
  if (!slide.clientWidth || !slide.clientHeight) {
    requestAnimationFrame(fitWhenReady);
    return;
  }
  fit();
}

fitWhenReady();

const entry = document.querySelector("#entry");
const entryRig = document.querySelector("#entryRig");
const entryMap = document.querySelector("#entryMap");
const entrySpores = document.querySelector("#entrySpores");
const entryDistance = document.querySelector("#entryDistance");
const entrySkip = document.querySelector("#entrySkip");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let entryDone = false;
let entryRaf = 0;
let entryProgress = 0;
let entrySkipping = false;

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function setEntryDistance(progress) {
  if (!entryDistance) return;
  const level = Math.min(4, Math.max(1, 1 + Math.floor(progress * 3.99)));
  entryDistance.textContent = `distanza 0${level}`;
}

function buildEntryMap() {
  if (!entryMap) return;
  entryMap.replaceChildren();
  const pad = 0.08;
  const spanW = bounds.w || 1;
  const spanH = bounds.h || 1;
  for (const colony of colonies) {
    const img = new Image();
    img.src = colony.spec.src;
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    const left = pad * 100 + ((colony.homeX - colony.layW / 2 - bounds.x) / spanW) * (100 - pad * 200);
    const top = pad * 100 + ((colony.homeY - colony.layH / 2 - bounds.y) / spanH) * (100 - pad * 200);
    const width = (colony.layW / spanW) * (100 - pad * 200);
    const height = (colony.layH / spanH) * (100 - pad * 200);
    img.style.left = `${left}%`;
    img.style.top = `${top}%`;
    img.style.width = `${width}%`;
    img.style.height = `${height}%`;
    if (colony.spec.rot) img.style.transform = `rotate(${colony.spec.rot}deg)`;
    entryMap.appendChild(img);
  }
  paintEntrySpores();
}

function paintEntrySpores() {
  if (!entrySpores) return;
  const size = 1024;
  entrySpores.width = size;
  entrySpores.height = size;
  const ctx = entrySpores.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  const pad = 0.08;
  const mapFrac = 1;
  const spanW = bounds.w || 1;
  const spanH = bounds.h || 1;
  const usable = mapFrac * (1 - pad * 2);
  const cx = size / 2;
  const cy = size / 2;
  const limit = (size * 0.49) ** 2;

  const toCanvas = (wx, wy) => ({
    x: (pad + ((wx - bounds.x) / spanW) * (1 - pad * 2)) * size,
    y: (pad + ((wy - bounds.y) / spanH) * (1 - pad * 2)) * size,
  });

  const drawSporeAt = (patch, x, y, dw) => {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy > limit) return;
    const dh = dw * patch.aspect;
    ctx.drawImage(patch.sprite, x - dw / 2, y - dh / 2, dw, dh);
  };

  for (const patch of patches) {
    const point = toCanvas(patch.ox, patch.oy);
    const dw = Math.max(1.4, (patch.radius * 2 / spanW) * usable * size);
    drawSporeAt(patch, point.x, point.y, dw);
  }

  for (let i = 0; i < 420; i += 1) {
    const patch = patches[i % patches.length];
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * size * 0.48;
    drawSporeAt(patch, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, Math.max(1.6, 4 + rand() * 18));
  }

  ctx.globalCompositeOperation = "destination-out";
  for (const colony of colonies) {
    const leftTop = toCanvas(colony.homeX - colony.layW / 2, colony.homeY - colony.layH / 2);
    const width = (colony.layW / spanW) * usable * size;
    const height = (colony.layH / spanH) * usable * size;
    if (colony.img.complete && colony.img.naturalWidth) {
      const rot = colony.spec.rot || 0;
      if (rot) {
        ctx.save();
        ctx.translate(leftTop.x + width / 2, leftTop.y + height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        const iw = (colony.spec.w / spanW) * usable * size;
        const ih = (colony.spec.h / spanH) * usable * size;
        ctx.drawImage(colony.img, -iw / 2, -ih / 2, iw, ih);
        ctx.restore();
      } else {
        ctx.drawImage(colony.img, leftTop.x, leftTop.y, width, height);
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function paintEntry(progress) {
  if (!entryRig) return;
  entryProgress = progress;
  setEntryDistance(progress);

  // Approach the specimen: float in, then push into the glass.
  const settle = easeInOut(Math.min(1, progress / 0.28));
  const approach = easeInOut(Math.max(0, (progress - 0.18) / 0.62));
  const dissolve = easeInOut(Math.max(0, (progress - 0.78) / 0.22));
  const scale = mix(0.78, mix(1.05, 1.72, approach), settle);
  const driftY = mix(28, mix(0, -18, approach), settle);
  const sway = progress < 0.3 && !reduceMotion ? Math.sin(progress * 22) * 1.4 * (1 - settle) : 0;

  entryRig.style.transform =
    `translate3d(${sway}px, ${driftY}px, 0) scale(${scale})`;
  entryRig.style.opacity = String(1 - dissolve * 0.92);

  const shadow = document.querySelector(".entry-shadow");
  if (shadow) shadow.style.opacity = String(Math.max(0.15, 0.9 - approach * 0.45 - dissolve));
}

function finishEntry() {
  if (entryDone) return;
  entryDone = true;
  if (entryRaf) cancelAnimationFrame(entryRaf);
  paintEntry(1);
  document.body.classList.remove("is-entering");
  document.body.classList.add("is-live");
  slide.classList.add("is-ready");
  if (entry) {
    entry.classList.add("is-done");
    entry.setAttribute("aria-hidden", "true");
  }
  fit();
  setTimeout(hideHint, 7000);
  setTimeout(() => {
    if (entry && entry.parentNode) entry.remove();
  }, 950);
}

function playEntry() {
  buildEntryMap();
  if (!entry || !entryRig || reduceMotion) {
    finishEntry();
    return;
  }

  const duration = 5600;
  const start = performance.now();
  paintEntry(0);

  const step = (now) => {
    if (entryDone || entrySkipping) return;
    const progress = Math.min(1, (now - start) / duration);
    paintEntry(progress);
    if (progress < 1) {
      entryRaf = requestAnimationFrame(step);
      return;
    }
    finishEntry();
  };
  entryRaf = requestAnimationFrame(step);
  // Safety: always enter the live slide even if the animation loop stalls.
  setTimeout(() => {
    if (!entryDone) finishEntry();
  }, duration + 800);
}

function skipEntry() {
  if (entryDone || entrySkipping) return;
  entrySkipping = true;
  if (entryRaf) cancelAnimationFrame(entryRaf);
  const start = performance.now();
  const from = entryProgress;
  const step = (now) => {
    if (entryDone) return;
    const t = Math.min(1, (now - start) / 520);
    paintEntry(mix(from, 1, easeInOut(t)));
    if (t < 1) {
      entryRaf = requestAnimationFrame(step);
      return;
    }
    finishEntry();
  };
  entryRaf = requestAnimationFrame(step);
}

if (entrySkip) {
  entrySkip.addEventListener("click", (event) => {
    event.preventDefault();
    skipEntry();
  });
}
window.addEventListener("keydown", (event) => {
  if (entryDone) return;
  if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    skipEntry();
  }
});

const timeline = document.querySelector("#timeline");
const timelineTrack = document.querySelector("#timelineTrack");
const timelineCursor = document.querySelector("#timelineCursor");
const timelineYears = document.querySelector("#timelineYears");
const timelineReadout = document.querySelector("#timelineReadout");
let timelineDragging = false;

function yearToRatio(year) {
  return (year - TIME_START) / (TIME_END - TIME_START);
}

function ratioToYear(ratio) {
  const t = Math.min(1, Math.max(0, ratio));
  return Math.round(TIME_START + t * (TIME_END - TIME_START));
}

function setTimelineYear(year, activate = true) {
  const next = Math.min(TIME_END, Math.max(TIME_START, year));
  if (activate) selectedYear = next;
  if (timelineCursor) {
    timelineCursor.style.left = `${yearToRatio(next) * 100}%`;
  }
  if (timelineYears) {
    for (const span of timelineYears.querySelectorAll("span")) {
      span.classList.toggle("is-active", Number(span.dataset.year) === next && selectedYear != null);
    }
  }
  if (timelineReadout) {
    timelineReadout.textContent = selectedYear == null ? "tutti" : String(selectedYear);
  }
  refreshLabelVisibility();
}

function timelineRatioFromEvent(event) {
  if (!timelineTrack) return 0;
  const rect = timelineTrack.getBoundingClientRect();
  return (event.clientX - rect.left) / Math.max(1, rect.width);
}

function buildTimeline() {
  if (!timelineYears) return;
  timelineYears.replaceChildren();
  // Every 2 years keeps labels readable; drag still selects any year.
  for (let year = TIME_START; year <= TIME_END; year += 2) {
    const span = document.createElement("span");
    span.textContent = String(year);
    span.dataset.year = String(year);
    // Place each year under its position on the line (no tick marks).
    span.style.position = "absolute";
    span.style.left = `${yearToRatio(year) * 100}%`;
    timelineYears.appendChild(span);
  }
  setTimelineYear(TIME_END, false);
}

if (timelineTrack && timelineCursor) {
  buildTimeline();

  const startDrag = (event) => {
    if (event.button != null && event.button !== 0) return;
    timelineDragging = true;
    timelineCursor.setPointerCapture?.(event.pointerId);
    setTimelineYear(ratioToYear(timelineRatioFromEvent(event)), true);
    event.preventDefault();
  };

  timelineTrack.addEventListener("pointerdown", startDrag);
  timelineCursor.addEventListener("pointerdown", startDrag);
  timelineTrack.addEventListener("dblclick", (event) => {
    event.preventDefault();
    selectedYear = null;
    setTimelineYear(TIME_END, false);
  });
  window.addEventListener("pointermove", (event) => {
    if (!timelineDragging) return;
    setTimelineYear(ratioToYear(timelineRatioFromEvent(event)), true);
  });
  window.addEventListener("pointerup", () => {
    timelineDragging = false;
  });
  window.addEventListener("pointercancel", () => {
    timelineDragging = false;
  });
}

Promise.race([
  Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ),
  new Promise((resolve) => setTimeout(resolve, 900)),
]).then(() => {
  playEntry();
});

requestAnimationFrame(tick);
