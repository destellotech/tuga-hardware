/* ============================================
   TUGA HARDWARE — Local currency hint
   Prices are set and charged in GBP. A visitor outside the UK sees an
   approximate local price next to each one ("about €453"), worked out from
   the visitor's country (Cloudflare's request.cf.country) and the European
   Central Bank's daily reference rates. Checkout then shows the exact amount
   in their currency through Stripe Adaptive Pricing (src/api.js).
   ============================================ */

const RATES_URL = 'https://api.frankfurter.dev/v1/latest?base=GBP';
const RATES_KEY = 'fx:GBP';
const DAY = 24 * 60 * 60 * 1000;
// Refetch once the stored rates are this old; stop showing a hint at all
// once they are older than STALE (the rate source has been down for days).
const FRESH = 1 * DAY;
const STALE = 7 * DAY;

/**
 * The currency each country pays in, for the currencies the ECB publishes a
 * rate for. A country missing here (or paying in GBP) gets no hint, only
 * the pound price and the exact total at checkout.
 */
const CURRENCY_COUNTRIES = {
  EUR: ['AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
    'AD', 'MC', 'SM', 'VA', 'ME', 'XK', 'AX', 'GF', 'GP', 'MQ', 'RE', 'YT', 'PM', 'BL', 'MF'],
  USD: ['US', 'PR', 'GU', 'VG', 'TC', 'BQ', 'EC', 'SV', 'TL', 'PA'],
  AUD: ['AU'], BRL: ['BR'], CAD: ['CA'], CHF: ['CH', 'LI'], CNY: ['CN'], CZK: ['CZ'],
  DKK: ['DK', 'FO', 'GL'], HKD: ['HK'], HUF: ['HU'], IDR: ['ID'], ILS: ['IL'], INR: ['IN'],
  ISK: ['IS'], JPY: ['JP'], KRW: ['KR'], MXN: ['MX'], MYR: ['MY'], NOK: ['NO'], NZD: ['NZ', 'CK'],
  PHP: ['PH'], PLN: ['PL'], RON: ['RO'], SEK: ['SE'], SGD: ['SG'], THB: ['TH'], TRY: ['TR'], ZAR: ['ZA'],
};

const COUNTRY_CURRENCY = Object.fromEntries(
  Object.entries(CURRENCY_COUNTRIES).flatMap(([cur, countries]) => countries.map((c) => [c, cur]))
);

export const currencyFor = (country) => COUNTRY_CURRENCY[country] || null;

/** Fetch today's rates and store them. Returns the stored document. */
export async function refreshRates(env, fetchImpl = fetch) {
  const res = await fetchImpl(RATES_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Rates fetch failed: ${res.status}`);
  const data = await res.json();
  if (data.base !== 'GBP' || !data.rates) throw new Error('Rates response has no GBP rates');
  const doc = { date: data.date, rates: data.rates, fetchedAt: Date.now() };
  await env.ORDERS.put(RATES_KEY, JSON.stringify(doc));
  return doc;
}

/** Stored rates, refreshed when a day old. Null when none are usable. */
export async function getRates(env, fetchImpl = fetch, now = Date.now()) {
  let doc = null;
  try {
    doc = JSON.parse((await env.ORDERS.get(RATES_KEY)) || 'null');
  } catch {
    doc = null;
  }
  if (!doc || now - doc.fetchedAt > FRESH) {
    try {
      doc = await refreshRates(env, fetchImpl);
    } catch (err) {
      console.warn('Could not refresh exchange rates:', err.message);
    }
  }
  return doc && now - doc.fetchedAt <= STALE ? doc : null;
}

/**
 * What /api/locale answers: the visitor's currency and the GBP rate for it,
 * or currency null when there is nothing to convert to.
 */
export function localeFor(country, rates) {
  const currency = currencyFor(country);
  const rate = currency && rates?.rates?.[currency];
  return rate ? { country, currency, rate, date: rates.date } : { country: country || null, currency: null };
}

export async function handleLocale(request, env) {
  const country = request.cf?.country || null;
  const body = currencyFor(country) ? localeFor(country, await getRates(env)) : localeFor(country, null);
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      // Per visitor: never shared through a cache, fine to reuse for an hour.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
