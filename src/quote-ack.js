/* ============================================
   TUGA HARDWARE: Quote acknowledgement helpers

   The pure parts of the "we have your quote request" email: the price
   table and the discount tier wording, both derived from the same
   catalogue and tiers the checkout charges from, so the email can never
   quote a price the basket would not.
   ============================================ */

/** Pence to a pounds string: 34900 becomes £349, 4999 becomes £49.99. */
export const pounds = (pence) => {
  const value = Number(pence) / 100;
  return `£${Number.isInteger(value) ? value : value.toFixed(2)}`;
};

/**
 * One row per sellable device, in catalogue order: base models first, then
 * the scanner versions, exactly as PRODUCTS lists them. Accessories,
 * warranties and upgrades are left out; a quote starts from the devices.
 */
export function devicePriceRows(products) {
  return Object.entries(products)
    .filter(([, p]) => p.device)
    .map(([id, p]) => ({ id, name: p.name, price: pounds(p.price) }));
}

/**
 * The automatic team discount in the words the site uses, built from the
 * tiers themselves so the two cannot drift apart: "3% off at 2 devices,
 * 5% at 3 to 4, 8% at 5 to 9 and 10% at 10 or more".
 */
export function discountTierLines(tiers) {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  return sorted.map((tier, i) => {
    const next = sorted[i + 1];
    const range = !next
      ? `${tier.min} or more`
      : next.min - tier.min === 1
        ? `${tier.min}`
        : `${tier.min} to ${next.min - 1}`;
    const unit = i === 0 ? ' devices' : '';
    return `${tier.percent}%${i === 0 ? ' off' : ''} at ${range}${unit}`;
  });
}

/** Join tier lines the way a sentence would: "a, b, c and d". */
export function discountSentence(tiers) {
  const lines = discountTierLines(tiers);
  if (lines.length < 2) return lines.join('');
  return `${lines.slice(0, -1).join(', ')} and ${lines[lines.length - 1]}`;
}

/** Resend accepts a free-form idempotency key; keep it short and plain. */
export const idempotencyKeyFor = (...parts) =>
  parts.join('-').replace(/[^A-Za-z0-9-]+/g, '-').slice(0, 200);
