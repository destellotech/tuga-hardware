/* ============================================
   TUGA HARDWARE — Store-wide statements
   One source for the claims that must agree everywhere: who the trader is,
   how long delivery takes, the VAT position, and whether orders are open.
   Imported by the Worker (src/) and by the static build (build/), so a
   change here reaches the pages, the API and the emails together.
   ============================================ */

/**
 * Orders are paused while the range moves from manufacturer dropship to
 * UK stock. While true: no Add to basket buttons are built, the checkout
 * endpoints refuse new orders, and structured data and the Google feed
 * report the devices as out of stock. Set to false, rebuild and deploy to
 * reopen.
 */
export const SALES_PAUSED = false;

export const SALES_PAUSED_MESSAGE =
  'We have paused new orders while we move to UK stock. Email support@tugahardware.com and we will tell you as soon as a device is available.';

/** The legal entity behind the Tuga Hardware trading name. */
export const TRADER = {
  tradingName: 'Tuga Hardware',
  legalName: 'Destello Tech Ltd',
  companyNumber: '16595781',
  registeredIn: 'England and Wales',
  address: {
    street: '124 Vicarage Wood',
    town: 'Harlow',
    county: 'Essex',
    postcode: 'CM20 3HH',
    country: 'GB',
  },
};

export const TRADER_ADDRESS_LINE = `${TRADER.address.street}, ${TRADER.address.town}, ${TRADER.address.county} ${TRADER.address.postcode}`;

export const TRADER_STATEMENT = `${TRADER.tradingName} is a trading name of ${TRADER.legalName}, registered in ${TRADER.registeredIn}, company number ${TRADER.companyNumber}. Registered office: ${TRADER_ADDRESS_LINE}.`;

/**
 * Destello Tech Ltd is not VAT registered, so no VAT is charged and the site
 * must never say prices "include VAT". Update this, the Terms and the
 * trader statement together if that changes.
 */
export const VAT_REGISTERED = false;
export const PRICE_NOTE = 'No VAT to add';

/**
 * We deliver worldwide: the supplier ships straight from China to the
 * customer and pays any duty and import tax on the way (DDP). This is every
 * country Stripe Checkout accepts for a delivery address, less Russia and
 * Belarus, which UK sanctions rule out, and the uninhabited territories
 * (AQ, BV, GS, TF) and Stripe's ZZ placeholder. Checkout and PayPal refuse
 * anything else.
 */
export const SHIPPING_COUNTRIES = [
  'AC', 'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AR', 'AT', 'AU',
  'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ',
  'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BW', 'BZ', 'CA', 'CD',
  'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CV', 'CW',
  'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH',
  'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE',
  'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GT', 'GU',
  'GW', 'GY', 'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN',
  'IO', 'IQ', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI',
  'KM', 'KN', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR',
  'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX',
  'MY', 'MZ', 'NA', 'NC', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU',
  'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR',
  'PS', 'PT', 'PY', 'QA', 'RE', 'RO', 'RS', 'RW', 'SA', 'SB', 'SC', 'SD',
  'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SZ', 'TA', 'TC', 'TD', 'TG', 'TH', 'TJ', 'TK', 'TL',
  'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'US', 'UY',
  'UZ', 'VA', 'VC', 'VE', 'VG', 'VN', 'VU', 'WF', 'WS', 'XK', 'YE', 'YT',
  'ZA', 'ZM', 'ZW',
];

/**
 * Keep every delivery promise on the site, in the API and in emails pointed
 * at these strings. Do not claim UK stock or same-day dispatch unless it is
 * true at the time.
 */
export const DELIVERY = {
  days: '7 to 10 working days',
  summary:
    'Delivery is free worldwide on every order, with no minimum. Please allow 7 to 10 working days from order. Any import duty and tax is paid before delivery, so there is nothing to pay on arrival. We email a tracking number when your order is on its way.',
  short: 'Free worldwide delivery in 7 to 10 working days',
};

/**
 * Most business buyers want a quote, a proforma invoice and a bank transfer
 * rather than a card checkout. Product pages link to the contact form with
 * this topic preselected.
 */
export const QUOTE_TOPIC = 'Business quote or proforma invoice';
export const quoteUrl = (productName) =>
  `/contact?quote=${encodeURIComponent(productName)}#enquiry`;
