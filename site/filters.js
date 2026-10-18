// SignalFeed filters: keyword search, topics and regions.
// Topics and regions work by matching words in each story's headline and summary.
// To tune one, edit its word list below (lowercase, no accents).
(function (root) {
  'use strict';

  // ---------- TOPICS ----------
  const TOPICS = {
    cyber: [
      { id: 'impact', label: 'Victims & impact', hint: 'Companies, governments or services hit by attacks: breaches, stolen data, disruption, extortion',
        re: /(\bhit by\b|\bbreach(es|ed)?\b|cyber ?attacks?\b|ransomware attack|\battack(s|ed)? (on|against)\b|(disrupts|disrupted) (its |their )?(systems|operations|services|it)|(systems|operations|services) (disrupted|down|offline)|\boutages?\b|\boffline\b|data (theft|stolen|leak|exposed|exposure)|\bstole\b|\bstolen\b|exfiltrat|\bextort|\bcompromised\b|\bhacked\b|backdoor(s|ed)? [\w-]+ (servers|systems|devices|networks)|web shells?|took (remote )?control|\bvictims?\b|customers? (data|notified|affected|information)|(security|cyber) incident|\bleak(ed|s)?\b|\bexposed?\b|\bexposes\b|throw food away|\bspoil)/,
        // Police or company actions against criminals are not "victims" stories.
        not: /^[^.]*\b(arrests?|charges|charged|indicts?|sentenced|seiz(es|ed)|takedown|dismantl|disrupts \d* ?\b(phishing|botnets?|kits?|networks?|markets?|gangs?)\b|shuts down [\w ]*\b(farms?|botnets?|markets?|forums?|kits?)\b)/ },
      { id: 'vulns', label: 'New vulnerabilities', hint: 'Newly disclosed flaws, CVEs, zero-days and patches',
        re: /(\bcve-\d|vulnerabilit|\bflaws?\b|zero[- ]?days?\b|\b0-days?\b|\bpatch(es|ed)?\b|patch tuesday|security update|\badvisor|\brce\b|remote code execution|code execution|privilege escalation|auth(entication)? bypass|\bbugs?\b)/ },
      { id: 'exploited', label: 'Actively exploited', hint: 'Flaws attackers are already using: in-the-wild exploitation, CISA KEV, zero-day attacks',
        re: /(\bexploited\b|\bexploiting\b|in the wild|actively|under attack|\bkev\b|known exploited|zero[- ]?day attacks?|exploit(ation)? attempts?|weaponi[sz]ed|mass exploitation)/ },
      { id: 'ransomware', label: 'Ransomware & extortion', hint: 'Ransomware gangs, data-theft extortion, leak sites',
        re: /(ransom|\bextort|shinyhunters|lockbit|\bcl0p\b|\bclop\b|\bakira\b|\bqilin\b|scattered spider|leak site|blackcat|alphv|\bmedusa\b|killsec|warlock)/ },
      { id: 'nation', label: 'Nation-state & espionage', hint: 'State-backed hackers and APT groups (China, Russia, North Korea, Iran…)',
        re: /(\bapt ?\d|\bapts?\b|state[- ](sponsored|backed|linked)|nation[- ]state|espionage|\bspy\b|\bspies\b|\bspying\b|china[- ]linked|chinese (hackers|state)|russia[- ]linked|russian (hackers|spies|intelligence|military|state)|north korea|\bdprk\b|iran[- ]linked|iranian (hackers|state)|\btyphoon\b|lazarus|kimsuky|sandworm|fancy bear|cozy bear|\bturla\b|blizzard\b|\bunc\d|\bgru\b|\bfsb\b)/ },
      { id: 'law', label: 'Arrests & takedowns', hint: 'Arrests, charges, sentences, infrastructure seizures and takedowns',
        re: /(\barrest|\bcharged\b|\bcharges\b|\bindict|\bsentenc|extradit|takedown|taken down|\bseiz|dismantl|\bdisrupts\b|europol|interpol|\bfbi\b|\bdoj\b|department of justice|\bpolice\b|pleads? guilty|\bprison\b|convicted|reward for|most wanted)/ },
      { id: 'infra', label: 'Critical infrastructure & OT', hint: 'Industrial systems, energy, water, health, transport, telecoms',
        re: /(\bics\b|\bscada\b|\bplcs?\b|industrial|critical infrastructure|\benergy\b|power grid|\bgrid\b|\butilit|\bwater\b|hospital|healthcare|\bmedical\b|manufactur|refrigerat|\bfridges?\b|freezer|building management|\bhvac\b|pipeline|airport|aviation|air traffic|railway|\brail\b|telecom|satellite|\bports?\b|shipping|oil and gas|\bnuclear\b|\bot\b)/ },
      { id: 'ai', label: 'AI security', hint: 'AI used in attacks, AI products with flaws, AI agents',
        re: /(\bai\b|artificial intelligence|\bllms?\b|chatgpt|openai|anthropic|\bclaude\b|gemini|copilot|machine learning|agentic|ai agents?|deepfake|\bgpt)/ },
      { id: 'phishing', label: 'Phishing & scams', hint: 'Phishing, fraud, social engineering, fake sites and apps',
        re: /(phish|\bscams?\b|scammer|\bfraud|social engineering|smishing|vishing|\bbec\b|business email compromise|impersonat|fake (login|site|app|website|page)|clickfix|malvertis)/ },
      { id: 'supply', label: 'Supply chain', hint: 'Poisoned packages, compromised vendors and open-source projects',
        re: /(supply[- ]chain|\bnpm\b|\bpypi\b|github actions|open[- ]source|\bpackages?\b|dependenc|third[- ]party|docker hub|vs code|\bextensions?\b|\bvendor\b)/ },
      { id: 'regulation', label: 'Regulation & fines', hint: 'Fines, regulators, GDPR, NIS2, DORA, lawsuits and new rules',
        re: /(\bfined?\b|\bfines\b|\bgdpr\b|regulat|\bnis2\b|\bdora\b|directive|\bsec\b|lawsuit|\bsued?\b|\bcourt\b|compliance|data protection|privacy (law|regulator|watchdog)|watchdog|\bban(s|ned)?\b|legislation|\blaws?\b)/ },
    ],
    geo: [
      { id: 'conflict', label: 'Conflict & war', hint: 'Wars, strikes, military operations, ceasefires',
        re: /(guerre|guerra|frappes?\b|\braid\b|bombard|armee|esercito|soldats?|soldati|militaire|militar|\btues?\b|uccis|\bmorts\b|\bmorti\b|offensiv|combats?\b|combattiment|missil|cessez-le-feu|cessate il fuoco|tregua|attaque|attacco|\bdrones?\b|\bdroni\b|\bwars?\b|\bconflicts?\b|\bfighters\b|\brebels?\b|airstrikes?|\bstrikes?\b|missile|\bdrones?\b|\btroops\b|military|shelling|invasion|offensive|\bkilled\b|bombing|\bbombs?\b|\barmy\b|front ?line|militia|fighting|clashes|\battack(s|ed)?\b|ceasefire|soldiers?|\bnavy\b|weapons?)/ },
      { id: 'diplomacy', label: 'Diplomacy & talks', hint: 'Negotiations, summits, treaties, alliances',
        re: /(negocia|negozia|sommet|vertice|accordo?\b|accords?\b|diplomat|ambassad|ministre des affaires etrangeres|ministro degli esteri|\bonu\b|\botan\b|pourparlers|colloqui|\btalks\b|summit|negotiat|ceasefire|treaty|agreement|\bdeals?\b|diplomat|\benvoy\b|security council|united nations|\bnato\b|\bg7\b|\bg20\b|foreign minister|ambassador|bilateral|alliance)/ },
      { id: 'sanctions', label: 'Sanctions & trade', hint: 'Sanctions, tariffs, export controls, trade disputes',
        re: /(sanzion|sanctions?|droits de douane|\bdazi\b|commerce|commercio|embargo|sanction|tariff|\btrade\b|export control|embargo|\bcustoms\b|\bwto\b|supply chains?|\bimports?\b|\bexports?\b)/ },
      { id: 'elections', label: 'Elections & politics', hint: 'Elections, parliaments, protests, political crises',
        re: /(election|elezion|\bvote\b|\bvoto\b|scrutin|parlement|parlamento|presidentiel|presidenzial|manifestation|manifestant|manifestazion|proteste|gouvernement|governo|premier ministre|primo ministro|gilets? jaunes|election|\bvotes?\b|\bvoting\b|\bpolls?\b|parliament|prime minister|presidential|coalition|campaign|referendum|opposition|protest|lawmakers|congress|\bsenate\b|\bcabinet\b|impeach)/ },
      { id: 'cybertech', label: 'Cyber & tech', hint: 'Cyberattacks, AI, chips, surveillance and disinformation in world politics',
        re: /(cyber|\bhack|\bai\b|artificial intelligence|semiconductor|\bchips?\b|technology|\btech\b|surveillance|disinformation|misinformation|propaganda|spyware|internet (shutdown|blackout)|starlink|data cent(re|er))/ },
      { id: 'energy', label: 'Energy & resources', hint: 'Oil, gas, minerals, food and nuclear power',
        re: /(petrole|petrolio|\bgaz\b|energie|energia|gasdotto|gazoduc|nucleaire|nucleare|\boil\b|\bgas\b|\benergy\b|pipeline|\blng\b|\bopec\b|mineral|\bmining\b|lithium|rare earth|\bgrain\b|food (security|prices)|nuclear (power|plant|reactor)|electricity|\bfuel\b)/ },
      { id: 'humanitarian', label: 'Humanitarian & migration', hint: 'Refugees, migration, aid and humanitarian crises',
        re: /(refugi|rifugiat|migrant|humanitaire|umanitari|famine|carestia|deplace|sfollat|refugee|\bmigra|humanitarian|famine|\baid\b|displaced|asylum|hunger|evacuat|civilians)/ },
      { id: 'terror', label: 'Terrorism & coups', hint: 'Terror attacks, extremism, hostages, coups',
        re: /(terroris|attentat|otage|ostagg|coup d'etat|colpo di stato|golpe|djihad|jihadist|terror|extremis|jihad|hostage|\bmilitants?\b|assassinat|\bcoup\b|insurgen|\bisis\b|islamic state|al-qaeda|al-shabab)/ },
    ],
    eu: [
      { id: 'eupolitics', label: 'Politics & elections', hint: 'Governments, parliaments, elections, protests',
        re: /(election|elezion|\bvote\b|\bvoto\b|scrutin|parlement|parlamento|presidentiel|presidenzial|manifestation|manifestant|manifestazion|proteste|gouvernement|governo|premier ministre|primo ministro|gilets? jaunes|election|\bvotes?\b|\bvoting\b|\bpolls?\b|parliament|prime minister|presidential|coalition|campaign|referendum|opposition|protest|lawmakers|congress|\bsenate\b|\bcabinet\b|impeach)/ },
      { id: 'euworld', label: 'World & war', hint: 'Wars, conflicts and international crises',
        re: /(guerre|guerra|frappes?\b|\braid\b|bombard|armee|esercito|soldats?|soldati|militaire|militar|\btues?\b|uccis|\bmorts\b|\bmorti\b|offensiv|combats?\b|combattiment|missil|cessez-le-feu|cessate il fuoco|tregua|attaque|attacco|\bdrones?\b|\bdroni\b|\bwars?\b|\bconflicts?\b|\bfighters\b|\brebels?\b|airstrikes?|\bstrikes?\b|missile|\bdrones?\b|\btroops\b|military|shelling|invasion|offensive|\bkilled\b|bombing|\bbombs?\b|\barmy\b|front ?line|militia|fighting|clashes|\battack(s|ed)?\b|ceasefire|soldiers?|\bnavy\b|weapons?)/ },
      { id: 'eudiplomacy', label: 'Diplomacy & EU', hint: 'Summits, treaties, EU decisions, NATO',
        re: /(\bue\b|\beu\b|union europeenne|unione europea|commission europeenne|commissione europea|bruxelles|brussels|\botan\b|\bnato\b|negocia|negozia|sommet|vertice|accordo?\b|accords?\b|diplomat|ambassad|ministre des affaires etrangeres|ministro degli esteri|\bonu\b|\botan\b|pourparlers|colloqui|\btalks\b|summit|negotiat|ceasefire|treaty|agreement|\bdeals?\b|diplomat|\benvoy\b|security council|united nations|\bnato\b|\bg7\b|\bg20\b|foreign minister|ambassador|bilateral|alliance)/ },
      { id: 'eueconomy', label: 'Economy & business', hint: 'Budget, taxes, jobs, companies, markets',
        re: /(economi|budget|bilancio|manovra|impots?|tasse|fiscal|inflation|inflazione|salaires?|stipendi|chomage|disoccupazione|emploi|lavoro|entreprises?|aziend|imprese|bourse|borsa|banques?|banca|pensions?|pensioni|retraites?|croissance|crescita|\bpil\b|\bpib\b|industri)/ },
      { id: 'eusociety', label: 'Society & justice', hint: 'Courts, crime, schools, health, immigration',
        re: /(justice|giustizia|tribunal|processo|proces\b|condamn|condann|police|polizia|carabinieri|enquete|indagin|meurtre|omicidio|ecoles?|scuola|universit|sante|sanita|hopital|ospedale|immigration|immigrazione|logement|\bcasa\b|violences?|violenza|femminicidio|feminicide)/ },
      { id: 'euclimate', label: 'Climate & environment', hint: 'Climate, weather, disasters, environment',
        re: /(climat|clima\b|climatic|environnement|ambiente|ecolog|meteo|inondation|alluvion|canicule|caldo record|incendi|siccita|secheresse|seisme|terremoto|rechauffement|riscaldamento|emissions?|emissioni)/ },
      { id: 'euculture', label: 'Culture', hint: 'Cinema, books, music, art, TV',
        re: /(cinema|\bfilm\b|musique|musica|concert|livres?|libro|libri|romans?\b|romanzo|festival|exposition|mostra|musee|museo|theatre|teatro|serie tv|television|televisione|artiste|artista|culture|cultura)/ },
      { id: 'eusport', label: 'Sport', hint: 'Football, tennis, cycling, Formula 1 and more',
        re: /(sport|football|calcio|ligue 1|serie a|champions league|ligue des champions|coupe du monde|mondiali|tennis|rugby|formula 1|formule 1|\bf1\b|tour de france|giro d'italia|ciclismo|cyclisme|olympi|olimpi|\bpsg\b|juventus|inter\b|milan\b|\bnapoli\b|\broma\b|lazio)/ },
    ],
    fin: [
      { id: 'markets', label: 'Markets', hint: 'Stocks, bonds, currencies, investors',
        re: /(\bstocks?\b|\bshares?\b|equit|\bbonds?\b|\byields?\b|treasur|\bmarkets?\b|wall street|\bindex\b|s&p|nasdaq|\bdow\b|ftse|nikkei|\bdax\b|investors?|sell-?off|\brally\b|\bdollar\b|\beuro\b|\byen\b|currenc|hedge fund|valuation)/ },
      { id: 'rates', label: 'Central banks & rates', hint: 'Fed, ECB, Bank of England and other central bank decisions',
        re: /(central bank|\bfed\b|federal reserve|\becb\b|bank of england|\bboe\b|bank of japan|\bboj\b|interest rates?|rate (cut|hike|rise|hold)|monetary policy|powell|warsh|lagarde|bailey|basis points)/ },
      { id: 'macro', label: 'Inflation & growth', hint: 'Inflation, GDP, jobs, recession, public debt',
        re: /(inflation|\bcpi\b|\bppi\b|\bgdp\b|recession|\bgrowth\b|economy|economic|unemployment|\bjobs\b|payrolls|labou?r market|wages|cost of living|\bdebt\b|deficit|budget|\bimf\b|world bank|fiscal|\btax(es)?\b)/ },
      { id: 'trade', label: 'Trade & tariffs', hint: 'Tariffs, trade deals, sanctions, supply chains',
        re: /(tariff|\btrade\b|export|import|sanction|supply chains?|\bwto\b|protectionis|customs|dumping)/ },
      { id: 'companies', label: 'Companies & deals', hint: 'Earnings, mergers, takeovers, IPOs, layoffs',
        re: /(earnings|profits?\b|revenue|quarterly|results|merger|acquisition|acquire|takeover|\bbuys?\b|\bdeal\b|\bipo\b|listing|layoffs?|job cuts|\bceo\b|bankrupt|insolven|valuation|startup|unicorn)/ },
      { id: 'banking', label: 'Banks & finance', hint: 'Banks, lenders, regulation, private credit, insurance',
        re: /(\bbanks?\b|banking|lenders?|\bcredit\b|private equity|insur|regulator|\bsec\b|financial stability|capital rules|basel|asset manag|pension)/ },
      { id: 'energyfin', label: 'Energy & commodities', hint: 'Oil, gas, metals, food and commodity prices',
        re: /(\boil\b|\bgas\b|\bopec\b|\bbrent\b|commodit|\bgold\b|copper|lithium|\bmetals?\b|\bwheat\b|\bgrain\b|\bfood prices\b|energy prices|\bsulphur\b|\bcoal\b|\blng\b)/ },
      { id: 'techbiz', label: 'Tech & AI business', hint: 'Big tech, AI investment, chips',
        re: /(\bai\b|artificial intelligence|nvidia|openai|\bchips?\b|semiconductor|big tech|apple|microsoft|alphabet|google|amazon|\bmeta\b|tesla|data cent(re|er)|tech (stocks|giants))/ },
      { id: 'crypto', label: 'Crypto', hint: 'Bitcoin, stablecoins, digital currencies',
        re: /(crypto|bitcoin|ethereum|stablecoin|blockchain|digital currenc|\bcbdc\b|\btoken)/ },
    ],
  };

  // ---------- REGIONS (for both columns) ----------
  const REGIONS = [
    { id: 'europe', label: 'Europe',
      re: /(allemagne|germania|italie|italia|\bfrancia\b|espagne|spagna|royaume-uni|regno unito|bruxelles|\bue\b|europee|europeen|pologne|polonia|europe|\beu\b|\bfrance\b|\bfrench\b|german|\buk\b|britain|british|\bengland\b|\bital(y|ian)|\bspain\b|spanish|poland|polish|netherlands|\bdutch\b|belgi|nordic|swed(en|ish)|norw(ay|egian)|denmark|danish|finland|finnish|romania|moldova|greece|greek|portugal|ireland|irish|austria|switzerland|swiss|czech|hungar|baltic|estonia|latvia|lithuania|brussels|london|paris|berlin|madrid|rome|warsaw|serbia|balkan)/ },
    { id: 'russia-ukraine', label: 'Russia & Ukraine',
      re: /(russie|ucraina|ukraine|moscou|mosca|\bkiev\b|poutine|zelensky|bielorussie|bielorussia|russia|ukrain|kremlin|putin|zelensk|\bkyiv\b|moscow|crimea|donbas|belarus)/ },
    { id: 'middle-east', label: 'Middle East',
      re: /(israel|cisjordanie|cisgiordania|liban|libano|syrie|siria|irak|\biran\b|arabie|arabia saudita|egypte|egitto|palestin|israel|\bgaza\b|\biran|\biraq|\bsyria|lebanon|yemen|houthi|saudi|qatar|\buae\b|emirates|turkiye|turkey|jordan|\begypt|palestin|hamas|hezbollah|west bank|tehran)/ },
    { id: 'asia-pacific', label: 'Asia-Pacific',
      re: /(chine|\bcina\b|japon|giappone|coree|corea|\binde\b|pakistan|afghanistan|asie|\basia\b|taiwan|china|chinese|beijing|taiwan|japan|korea|\bindia\b|indian|pakistan|indonesia|philippines|vietnam|thailand|\bthai\b|australia|\basia|pacific|singapore|malaysia|myanmar|cambodia|bangladesh|hong kong|new zealand)/ },
    { id: 'americas', label: 'Americas',
      re: /(etats-unis|stati uniti|\busa\b|americain|americano|bresil|brasile|mexique|messico|amerique latine|america latina|united states|\bu\.s\.|\bus (government|military|president|officials|navy|army|congress|senate|state)|american|washington|white house|\btrump\b|canada|canadian|mexic|brazil|venezuela|colombia|argentin|\bchile|\bcuba|latin america|caribbean|\bperu\b|ecuador)/ },
    { id: 'africa', label: 'Africa',
      re: /(afrique|africa|soudan|\bsudan\b|congo|nigeria|libye|libia|africa|nigeria|sudan|ethiopia|kenya|congo|\bdrc\b|sahel|\bmali\b|somalia|\begypt|libya|niger\b|ghana|senegal|uganda|rwanda|mozambique|zimbabwe|cameroon|tunisia|morocco|algeria)/ },
  ];

  // ---------- TEXT ----------
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const STOP = new Set(['the', 'a', 'an', 'of', 'on', 'in', 'and', 'or', 'for', 'to', 'by', 'with', 'at', 'from', 'is', 'are', 'was', 'were', 'about', 'into', 'its', 'it', 'as', 'be', 'news']);

  // Crude word root, so "attacks" also finds "attack", "attackers", "cyberattack";
  // "supermarkets" finds "supermarket"; "vulnerabilities" finds "vulnerability".
  function stem(w) {
    if (w.length <= 4 || /\d/.test(w)) return w;
    for (const [suffix, cut] of [['ies', 3], ['ers', 3], ['ing', 3], ['ed', 2], ['es', 2], ['s', 1]]) {
      if (w.endsWith(suffix) && w.length - cut >= 4) return w.slice(0, -cut);
    }
    return w;
  }

  // "french supermarket attacks" -> every word must appear (in any order).
  // Text in "double quotes" must appear exactly as typed.
  function parseQuery(q) {
    const tokens = [];
    let rest = norm(q).replace(/"([^"]+)"/g, (_, p) => { p = p.trim(); if (p) tokens.push({ phrase: true, text: p }); return ' '; });
    for (const w of rest.split(/[^a-z0-9.-]+/)) {
      const word = w.replace(/^[.-]+|[.-]+$/g, '');
      if (word.length < 2 || STOP.has(word)) continue;
      tokens.push({ phrase: false, text: stem(word) });
    }
    return tokens;
  }

  function tokenRe(t) {
    if (t.phrase) return escRe(t.text);
    return (t.text.length <= 3 ? '\\b' : '') + escRe(t.text);
  }

  function matchQuery(text, tokens) {
    for (const t of tokens) {
      if (t.phrase || t.text.length > 3) { if (!text.includes(t.text)) return false; }
      else if (!new RegExp('\\b' + escRe(t.text)).test(text)) return false;
    }
    return true;
  }

  // Wraps matched words in <mark>; escapes everything else.
  function highlight(raw, tokens, esc) {
    if (!tokens.length) return esc(raw);
    const re = new RegExp('(' + tokens.map(t => tokenRe(t) + (t.phrase ? '' : '[\\w-]*')).join('|') + ')', 'gi');
    return String(raw || '').split(re).map((part, i) => i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)).join('');
  }

  function classify(item) {
    const title = norm(item.title);
    const text = norm(item.title + ' ' + (item.description || ''));
    return {
      text,
      topics: (TOPICS[item.category] || []).filter(t => t.re.test(text) && !(t.not && t.not.test(title))).map(t => t.id),
      regions: REGIONS.filter(r => r.re.test(text)).map(r => r.id),
    };
  }

  root.SF = { TOPICS, REGIONS, norm, stem, parseQuery, matchQuery, highlight, classify };
})(typeof window !== 'undefined' ? window : globalThis);
