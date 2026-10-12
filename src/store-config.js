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

/** We deliver to UK addresses only. Checkout refuses anything else. */
export const SHIPPING_COUNTRIES = ['GB'];

/**
 * Devices are shipped to us in the UK first and sent on from here, so we are
 * the importer and customers never pay charges on delivery. Keep every
 * delivery promise on the site, in the API and in emails pointed at these
 * strings.
 */
export const DELIVERY = {
  days: '7 to 10 working days',
  summary:
    'Delivery is free to UK addresses on every order, with no minimum. Devices come to us in the UK first and we send them on, typically 7 to 10 working days from order, with no customs or import charges to pay on delivery. We email a tracking number when your order is on its way.',
  short: 'Free UK delivery in 7 to 10 working days',
};

/**
 * Most business buyers want a quote, a proforma invoice and a bank transfer
 * rather than a card checkout. Product pages link to the contact form with
 * this topic preselected.
 */
export const QUOTE_TOPIC = 'Business quote or proforma invoice';
export const quoteUrl = (productName) =>
  `/contact?quote=${encodeURIComponent(productName)}#enquiry`;
