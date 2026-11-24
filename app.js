// The page is the glass. Six moulds, one for each channel.
// A mould grows with the number of case studies in its folder.

const MAX_COUNT = 15;
const MAX_AREA = 4800 * 4800;

function mouldSize(count, nativeW, nativeH) {
  const scale = Math.sqrt((MAX_AREA * (count / MAX_COUNT)) / (nativeW * nativeH));
  return { w: nativeW * scale, h: nativeH * scale };
}

function placed(src, nativeW, nativeH, count, cx, cy, cards) {
  const size = mouldSize(count, nativeW, nativeH);
  return {
    src,
    x: cx - size.w / 2,
    y: cy - size.h / 2,
    w: size.w,
    h: size.h,
    cards,
  };
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
  const frame = INTERIOR[spec.src];
  const rand = unitRandom(hashString(`${spec.src}:spread-v2`));
  const aspect = spec.w / spec.h;
  // Wider photo + short caption — closer to etichetta landscape so they share one scale.
  const cardRatio = 0.78;
  const heightOf = (width) => cardRatio * width * aspect;
  const gap = 0.28;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spin = rand() * Math.PI * 2;

  // Seeds across the whole coloured body — rim first, no pale-core clump.
  const seeds = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.22 : (i + 0.55) / (count + 0.05);
    const reach = Math.sqrt(0.18 + 0.82 * t);
    const ang = spin + i * golden + (rand() - 0.5) * 0.5;
    const rx = frame.w * 0.485 * (0.96 + rand() * 0.08);
    const ry = frame.h * 0.485 * (0.96 + rand() * 0.08);
    seeds.push({
      ox: frame.x + frame.w / 2 + Math.cos(ang) * reach * rx,
      oy: frame.y + frame.h / 2 + Math.sin(ang) * reach * ry,
      weight: 0.98 + rand() * 0.06,
    });
  }

  const areaScale = seeds.reduce((sum, seed) => sum + seed.weight * seed.weight, 0);
  // Fill the mould surface; shrink only if packing fails.
  const fill = count <= 2 ? 1.1 : count <= 6 ? 1.22 : count <= 11 ? 1.32 : 1.4;
  let base = Math.sqrt((frame.w * frame.h * fill) / (cardRatio * aspect * areaScale));

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
    for (let pass = 0; pass < 80; pass += 1) {
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
          // Prefer spreading apart along the longer free axis.
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
      if (a.cx - a.w / 2 < frame.x - 0.15) return true;
      if (a.cy - a.h / 2 < frame.y - 0.15) return true;
      if (a.cx + a.w / 2 > frame.x + frame.w + 0.15) return true;
      if (a.cy + a.h / 2 > frame.y + frame.h + 0.15) return true;
      for (let j = i + 1; j < count; j += 1) {
        const b = cards[j];
        if (Math.abs(b.cx - a.cx) < (a.w + b.w) / 2 + gap * 0.55
          && Math.abs(b.cy - a.cy) < (a.h + b.h) / 2 + gap * 0.55) {
          return true;
        }
      }
    }
    return false;
  };

  let cards = place(base);
  separate(cards);
  for (let guard = 0; colliding(cards) && guard < 28; guard += 1) {
    base *= 0.96;
    cards = place(base);
    separate(cards);
  }

  // Keep cards large even when packing is tight — spread first, shrink last.
  const minWidth = count <= 2 ? 40 : count <= 6 ? 32 : count <= 11 ? 27 : 25;
  if (base < minWidth) {
    base = minWidth;
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
  // Pack muffe almost touching — denser cluster = larger on screen at fit (less white).
  const center = SPECIMENS[5];
  center.x = -center.w / 2;
  center.y = -center.h / 2;
  const ring = [
    [3, -2.35],
    [2, -1.15],
    [1, 0.15],
    [0, 1.45],
    [4, 2.65],
  ];
  for (const [index, ang] of ring) {
    const spec = SPECIMENS[index];
    const dist = (center.w + spec.w) * 0.175 + (center.h + spec.h) * 0.04;
    spec.x = Math.cos(ang) * dist - spec.w / 2;
    spec.y = Math.sin(ang) * dist - spec.h / 2;
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

for (const spec of SPECIMENS) {
  for (const card of spec.cards) {
    card.sheet = sheetForTitle(card.title);
  }
}

const HOVER_SHOW_MS = 1800;
const HOVER_HIDE_MS = 650;
// Native etichette SVG are 285×112 — keep sheet size tied to the photo card.
const SHEET_NATIVE_W = 285;
const SHEET_NATIVE_H = 112;
const SHEET_ASPECT = SHEET_NATIVE_W / SHEET_NATIVE_H;

function buildFallbackSheet(card) {
  const wrap = document.createElement("div");
  wrap.className = "label-sheet-fallback";
  const head = document.createElement("p");
  head.className = "sheet-head";
  head.textContent = card.title;
  const rows = [
    ["Media", card.kind || "—"],
    ["Paese", card.country || "—"],
    ["Anno", card.year || "—"],
    ["Impatto sul pubblico", card.impact || "Scheda caso studio."],
  ];
  wrap.appendChild(head);
  for (const [key, value] of rows) {
    const row = document.createElement("div");
    row.className = "sheet-row";
    const k = document.createElement("p");
    k.className = "sheet-key";
    k.textContent = key;
    const v = document.createElement("p");
    v.className = "sheet-val";
    v.textContent = value;
    row.append(k, v);
    wrap.appendChild(row);
  }
  return wrap;
}

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
  label._baseLayout = null;
}

function layoutLabelSheet(label) {
  rememberLabelLayout(label);
  const colony = label.parentElement;
  const colonyW = colony.clientWidth || 1;
  const colonyH = colony.clientHeight || 1;
  const vw = slide.clientWidth || window.innerWidth;
  const rect = label.getBoundingClientRect();
  const cardW = rect.width || 1;
  const cardH = rect.height || 1;

  // Same case, same scale: width stays with the photo, height becomes the table.
  let sheetW = cardW * 1.06;
  const fromHeight = cardH * SHEET_ASPECT * 0.98;
  sheetW = Math.max(sheetW, Math.min(fromHeight, cardW * 1.22));
  sheetW = Math.min(sheetW, colonyW * 0.9, vw * 0.68, 460);
  sheetW = Math.max(sheetW, Math.min(cardW, 300));
  const sheetH = sheetW / SHEET_ASPECT;

  // Keep the photo's top-left so the etichetta feels like the same card opening.
  const curLeft = parseFloat(label.style.left) || 0;
  const curTop = parseFloat(label.style.top) || 0;
  const wPct = (sheetW / colonyW) * 100;
  const hPct = (sheetH / colonyH) * 100;
  const left = Math.max(0.4, Math.min(99.2 - wPct, curLeft));
  const top = Math.max(0.4, Math.min(99.2 - hPct, curTop));

  label.style.left = `${left}%`;
  label.style.top = `${top}%`;
  label.style.width = `${wPct}%`;
  label.style.height = `${hPct}%`;
}

function showLabelSheet(label) {
  if (label.classList.contains("is-sheet")) return;
  layoutLabelSheet(label);
  label.classList.add("is-sheet");
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

const VIEW_FILL = 0.94;
const LOW_POWER = 4;

const slide = document.querySelector("#slide");
const stage = document.querySelector("#stage");
const mag = document.querySelector("#mag");
const hint = document.querySelector("#hint");

const bounds = SPECIMENS.reduce(
  (box, spec) => ({
    x: Math.min(box.x, spec.x),
    y: Math.min(box.y, spec.y),
    right: Math.max(box.right, spec.x + spec.w),
    bottom: Math.max(box.bottom, spec.y + spec.h),
  }),
  { x: Infinity, y: Infinity, right: -Infinity, bottom: -Infinity }
);
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
  const el = document.createElement("div");
  el.className = "colony";
  const shadow = document.createElement("div");
  shadow.className = "shadow";
  const img = new Image();
  img.src = spec.src;
  img.alt = "";
  img.draggable = false;
  img.decoding = "async";
  el.appendChild(shadow);
  el.appendChild(img);
  const boxes = cardBoxes(spec);
  spec.cards.forEach((card, cardIndex) => {
    const label = document.createElement("article");
    label.className = "label";
    label.style.left = boxes[cardIndex].left;
    label.style.top = boxes[cardIndex].top;
    label.style.width = boxes[cardIndex].width;
    const photo = new Image();
    photo.className = "label-photo";
    photo.src = encodeURI(card.src);
    photo.alt = "";
    photo.draggable = false;
    photo.decoding = "async";
    const title = document.createElement("p");
    title.className = "label-title";
    title.textContent = card.title;
    const kind = document.createElement("p");
    kind.className = "label-kind";
    kind.textContent = card.kind;
    const sheet = document.createElement("div");
    sheet.className = "label-sheet";
    if (card.sheet) {
      const sheetImg = new Image();
      sheetImg.className = "label-sheet-img";
      sheetImg.src = encodeURI(card.sheet);
      sheetImg.alt = card.title;
      sheetImg.draggable = false;
      sheetImg.decoding = "async";
      sheet.appendChild(sheetImg);
    } else {
      sheet.appendChild(buildFallbackSheet(card));
    }
    label.append(photo, title, kind, sheet);
    bindLabelHover(label);
    el.appendChild(label);
  });
  stage.appendChild(el);
  return {
    spec,
    el,
    img,
    shadow,
    motion: { ...MOTION[index], phase: index * 2.15 },
    stain: STAINS[index],
    floatX: 0,
    floatY: 0,
    x: spec.x + spec.w / 2,
    y: spec.y + spec.h / 2,
    homeX: spec.x + spec.w / 2,
    homeY: spec.y + spec.h / 2,
    hw: spec.w * 0.5 * 0.5,
    hh: spec.h * 0.5 * 0.5,
    nudgeX: 0,
    nudgeY: 0,
  };
});

const SEPARATION = 4;

function separateColonies() {
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    for (let i = 0; i < colonies.length; i += 1) {
      for (let j = i + 1; j < colonies.length; j += 1) {
        const a = colonies[i];
        const b = colonies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minX = a.hw + b.hw + SEPARATION;
        const minY = a.hh + b.hh + SEPARATION;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX >= minX || absY >= minY) continue;
        const overlapX = minX - absX;
        const overlapY = minY - absY;
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
    const pad = 90;
    minX = Math.min(minX, colony.homeX - colony.spec.w / 2 - pad);
    minY = Math.min(minY, colony.homeY - colony.spec.h / 2 - pad);
    maxX = Math.max(maxX, colony.homeX + colony.spec.w / 2 + pad);
    maxY = Math.max(maxY, colony.homeY + colony.spec.h / 2 + pad);
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
let anchorX = 0;
let anchorY = 0;
const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const pointers = new Map();
let drag = null;
let pinch = null;

function currentFit() {
  const vw = slide.clientWidth || window.innerWidth;
  const vh = slide.clientHeight || window.innerHeight;
  // Cover the viewport (immersive) instead of letterboxing into a white frame.
  return Math.max((vw * VIEW_FILL) / bounds.w, (vh * VIEW_FILL) / bounds.h);
}

function zoomLimits() {
  const fit = currentFit();
  return {
    min: fit * 0.62,
    max: Math.max(fit * 1.2, Math.min(5.2, fit * 14)),
  };
}

function fade(value, start, end) {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function paint() {
  stage.style.transform = `translate3d(${panX}px, ${panY}px, 0)`;

  if (zoom !== laidOutZoom) {
    const zoomingOut = zoom < laidOutZoom;
    laidOutZoom = zoom;
    for (const colony of colonies) {
      const width = colony.spec.w * zoom;
      colony.el.style.width = `${width}px`;
      colony.el.style.height = `${colony.spec.h * zoom}px`;
      for (const label of colony.el.querySelectorAll(".label")) {
        const cardCss = width * (parseFloat(label.style.width) / 100);
        const photo = fade(cardCss, 42, 78);
        const text = fade(cardCss, 130, 200);
        label.style.opacity = photo.toFixed(3);
        label.style.fontSize = `${Math.min(14, Math.max(11, cardCss * 0.042))}px`;
        const hot = photo > 0.5;
        label.classList.toggle("is-hot", hot);
        if (!hot || zoomingOut || atFit) clearLabelSheet(label);
        for (const line of label.querySelectorAll(".label-title, .label-kind")) {
          line.style.display = text > 0.04 && !label.classList.contains("is-sheet") ? "block" : "none";
          line.style.opacity = text.toFixed(3);
        }
      }
    }
  }
  for (const colony of colonies) {
    colony.el.style.left = `${(colony.x - colony.spec.w / 2) * zoom}px`;
    colony.el.style.top = `${(colony.y - colony.spec.h / 2) * zoom}px`;
  }

  const power = LOW_POWER * (zoom / currentFit());
  mag.textContent = `${power.toFixed(1)}×`;

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
  zoom = Math.min(Math.max(readable, fillWidth), 210 / cardWorld);
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

function bakeSpore(radius, family) {
  const size = Math.max(48, Math.min(128, Math.round(radius * 2)));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
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

  const bodyCount = Math.round(reach * reach * 2.4);
  for (let i = 0; i < bodyCount; i += 1) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * reach * edge(angle);
    const shade = dist > reach * 0.72 ? pick(RIM) : pick(body);
    dot(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, shade, 1);
  }

  const fuzzCount = Math.round(reach * 10);
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

  if (radius > 34 && rand() > 0.3) {
    const core = reach * (0.12 + rand() * 0.1);
    const coreCount = Math.round(core * core * 2.2);
    for (let i = 0; i < coreCount; i += 1) {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * core;
      dot(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, pick(CORE), 1);
    }
  }

  return canvas;
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
for (let n = 0; n < 2600; n += 1) {
  const roll = rand();
  const baseR = roll < 0.58 ? 22 + rand() * 26 : roll < 0.88 ? 48 + rand() * 36 : 84 + rand() * 44;
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
    sprite: bakeSpore(radius, family),
  });
}

for (let pass = 0; pass < 8; pass += 1) {
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
  for (let i = 0; i < patches.length; i += 1) {
    for (let j = i + 1; j < patches.length; j += 1) {
      const a = patches[i];
      const b = patches[j];
      const dx = b.ox - a.ox;
      const dy = b.oy - a.oy;
      const ra = a.radius * 0.8 * Math.max(a.aspect, 1);
      const rb = b.radius * 0.8 * Math.max(b.aspect, 1);
      const min = ra + rb;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist >= min) continue;
      const push = (min - dist) * 0.5;
      const ux = dx / dist;
      const uy = dy / dist;
      a.ox -= ux * push;
      a.oy -= uy * push;
      b.ox += ux * push;
      b.oy += uy * push;
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
    colony.el.style.left = `${(colony.x - colony.spec.w / 2) * zoom}px`;
    colony.el.style.top = `${(colony.y - colony.spec.h / 2) * zoom}px`;
    colony.img.style.transform = "none";
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
    const left = panX + (colony.x - colony.spec.w / 2) * zoom;
    const top = panY + (colony.y - colony.spec.h / 2) * zoom;
    backCtx.drawImage(colony.img, left, top, colony.spec.w * zoom, colony.spec.h * zoom);
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
const entryVoid = document.querySelector(".entry-void");
const entryCaption = document.querySelector(".entry-caption");
const entrySkip = document.querySelector("#entrySkip");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function buildEntryMap() {
  if (!entryMap) return;
  entryMap.replaceChildren();
  const pad = 0.06;
  const spanW = bounds.w || 1;
  const spanH = bounds.h || 1;
  for (const colony of colonies) {
    const img = new Image();
    img.src = colony.spec.src;
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    const left = pad * 100 + ((colony.homeX - colony.spec.w / 2 - bounds.x) / spanW) * (100 - pad * 200);
    const top = pad * 100 + ((colony.homeY - colony.spec.h / 2 - bounds.y) / spanH) * (100 - pad * 200);
    const width = (colony.spec.w / spanW) * (100 - pad * 200);
    const height = (colony.spec.h / spanH) * (100 - pad * 200);
    img.style.left = `${left}%`;
    img.style.top = `${top}%`;
    img.style.width = `${width}%`;
    img.style.height = `${height}%`;
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

  const pad = 0.06;
  const mapFrac = 0.78;
  const mapOrigin = (1 - mapFrac) / 2;
  const spanW = bounds.w || 1;
  const spanH = bounds.h || 1;
  const usable = mapFrac * (1 - pad * 2);

  const toCanvas = (wx, wy) => ({
    x: (mapOrigin + (pad + ((wx - bounds.x) / spanW) * (1 - pad * 2)) * mapFrac) * size,
    y: (mapOrigin + (pad + ((wy - bounds.y) / spanH) * (1 - pad * 2)) * mapFrac) * size,
  });

  const limit = (size * 0.485) ** 2;
  const cx = size / 2;
  const cy = size / 2;

  const drawSporeAt = (patch, x, y, dw) => {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy > limit) return;
    const dh = dw * patch.aspect;
    ctx.drawImage(patch.sprite, x - dw / 2, y - dh / 2, dw, dh);
  };

  for (const patch of patches) {
    const point = toCanvas(patch.ox, patch.oy);
    const dw = Math.max(1.2, (patch.radius * 2 / spanW) * usable * size);
    drawSporeAt(patch, point.x, point.y, dw);
  }

  // Fill the rest of the circular glass, not only the central bounds square.
  const rim = 520;
  for (let i = 0; i < rim; i += 1) {
    const patch = patches[i % patches.length];
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * size * 0.47;
    const dw = Math.max(1.4, 3 + rand() * 16);
    drawSporeAt(patch, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, dw);
  }

  ctx.globalCompositeOperation = "destination-out";
  for (const colony of colonies) {
    const leftTop = toCanvas(colony.homeX - colony.spec.w / 2, colony.homeY - colony.spec.h / 2);
    const width = (colony.spec.w / spanW) * usable * size;
    const height = (colony.spec.h / spanH) * usable * size;
    if (colony.img.complete && colony.img.naturalWidth) {
      ctx.drawImage(colony.img, leftTop.x, leftTop.y, width, height);
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function hexMix(a, b, t) {
  const parse = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const A = parse(a);
  const B = parse(b);
  const c = A.map((v, i) => Math.round(mix(v, B[i], t)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

let entryDone = false;
let entryRaf = 0;
let entryProgress = 0;
let entrySkipping = false;

function finishEntry() {
  if (entryDone) return;
  entryDone = true;
  entryProgress = 1;
  if (entryRaf) cancelAnimationFrame(entryRaf);
  paintEntry(1);
  document.body.classList.remove("is-entering");
  document.body.classList.add("is-live");
  slide.classList.add("is-ready");
  if (entry) entry.classList.add("is-done");
  fit();
  setTimeout(hideHint, 7000);
  setTimeout(() => {
    if (entry && entry.parentNode) entry.remove();
  }, 900);
}

function paintEntry(progress) {
  if (!entryRig) return;
  entryProgress = progress;
  // Hold the side view, then rise to top, then open into the live slide.
  const hold = 0.18;
  const riseEnd = 0.78;
  const riseT = progress <= hold ? 0 : Math.min(1, (progress - hold) / (riseEnd - hold));
  const lift = easeInOut(riseT);
  const open = easeInOut(Math.max(0, (progress - 0.7) / 0.3));
  const rotateX = mix(72, 0, lift);
  const rotateY = mix(-22, 0, lift);
  const rotateZ = mix(10, 0, lift);
  const scale = mix(0.84, mix(1.05, 1.62, open), lift);
  const raise = mix(48, 0, lift);
  const sway = progress < hold ? Math.sin(progress * 18) * 1.2 : 0;
  entryRig.style.transform =
    `translate3d(0, ${raise}px, 0) rotateX(${rotateX + sway}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`;

  if (entryVoid) {
    const soft = easeInOut(Math.max(0, (progress - 0.5) / 0.5));
    entryVoid.style.background =
      `radial-gradient(ellipse 75% 58% at 50% 46%, ${hexMix("#1a221c", "#ffffff", soft)} 0%, ${hexMix("#0c100e", "#ffffff", soft)} 58%, ${hexMix("#070908", "#ffffff", soft)} 100%)`;
  }
  if (entryCaption) entryCaption.style.opacity = String(Math.max(0, 1 - Math.max(0, progress - 0.12) * 1.6));
  const band = document.querySelector(".entry-band");
  const shadow = document.querySelector(".entry-shadow");
  // Thickness rim only while the disc is still seen from the side.
  if (band) band.style.opacity = String(Math.max(0, (1 - lift) ** 2.2 * 0.95));
  if (shadow) shadow.style.opacity = String(Math.max(0, 0.9 - open) * (1 - lift * 0.35));
}

function playEntry() {
  buildEntryMap();
  if (reduceMotion || !entry || !entryRig) {
    finishEntry();
    return;
  }

  const duration = 6400;
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
}

function skipEntry() {
  if (entryDone || entrySkipping) return;
  entrySkipping = true;
  if (entryRaf) cancelAnimationFrame(entryRaf);
  const start = performance.now();
  const from = entryProgress;
  const step = (now) => {
    if (entryDone) return;
    const t = Math.min(1, (now - start) / 480);
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
  new Promise((resolve) => setTimeout(resolve, 2500)),
]).then(() => {
  playEntry();
});

requestAnimationFrame(tick);
