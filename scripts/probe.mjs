import { parseFeed } from './fetch-feeds.mjs';
import { writeFile } from 'node:fs/promises';
const C = {
  'FT home': 'https://www.ft.com/rss/home',
  'FT world': 'https://www.ft.com/world?format=rss',
  'FT global economy': 'https://www.ft.com/global-economy?format=rss',
  'FT markets': 'https://www.ft.com/markets?format=rss',
  'Economist finance': 'https://www.economist.com/finance-and-economics/rss.xml',
  'Economist business': 'https://www.economist.com/business/rss.xml',
  'Economist leaders': 'https://www.economist.com/leaders/rss.xml',
  'Economist briefing': 'https://www.economist.com/briefing/rss.xml',
  'BBC Business': 'https://feeds.bbci.co.uk/news/business/rss.xml',
  'Guardian business': 'https://www.theguardian.com/business/rss',
  'Guardian economics': 'https://www.theguardian.com/business/economics/rss',
  'CNBC economy': 'https://www.cnbc.com/id/20910258/device/rss/rss.html',
  'CNBC finance': 'https://www.cnbc.com/id/10000664/device/rss/rss.html',
  'MarketWatch': 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
  'ECB': 'https://www.ecb.europa.eu/rss/press.html',
  'Federal Reserve': 'https://www.federalreserve.gov/feeds/press_all.xml',
  'IMF': 'https://www.imf.org/en/News/rss?language=eng',
  'France 24 business': 'https://www.france24.com/en/business/rss',
  'DW business': 'https://rss.dw.com/rdf/rss-en-bus',
  'Nikkei Asia': 'https://asia.nikkei.com/rss/feed/nar',
  'Yahoo Finance': 'https://finance.yahoo.com/news/rssindex',
  'Al Jazeera economy': 'https://www.aljazeera.com/xml/rss/all.xml',
};
const out = {};
await Promise.all(Object.entries(C).map(async ([name, url]) => {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20000) });
    const txt = await r.text();
    let items = parseFeed(txt);
    if (name === 'Al Jazeera economy') items = items.filter(i => /\/economy\//.test(i.link));
    const dates = items.map(i => +new Date(i.date)).filter(Boolean);
    out[name] = { status: r.status, count: items.length, newestHoursAgo: dates.length ? +((Date.now() - Math.max(...dates)) / 36e5).toFixed(1) : null,
      withDesc: items.filter(i => i.description).length,
      sample: items.slice(0, 3).map(i => ({ t: i.title, l: i.link, d: i.description.slice(0, 140), date: i.date })) };
  } catch (e) { out[name] = { error: String(e.message || e) }; }
}));
await writeFile('probe.json', JSON.stringify(out, null, 1));
