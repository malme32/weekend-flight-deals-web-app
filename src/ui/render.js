/**
 * DOM rendering for the deal results and page metadata.
 */

import { datePart, formatDateRange, formatPrice } from '../core/format.js';

/**
 * Small element factory.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Render one flight leg row.
 * @param {string} label
 * @param {object} leg
 * @returns {HTMLElement}
 */
function renderLeg(label, leg) {
  const wrap = el('div', 'leg');
  wrap.appendChild(el('span', 'leg__label', label));
  wrap.appendChild(el('span', 'leg__date', datePart(leg.date)));
  wrap.appendChild(el('span', 'leg__time', `${leg.departureTime}\u2013${leg.arrivalTime}`));
  wrap.appendChild(el('span', 'leg__flight', leg.flightNumber));
  wrap.appendChild(el('span', 'leg__price', formatPrice(leg.price)));
  return wrap;
}

/**
 * Render one deal card.
 * @param {object} deal
 * @returns {HTMLElement}
 */
export function renderDeal(deal) {
  const item = el('li', 'deal');
  item.dataset.destination = deal.destination;
  item.dataset.weekend = deal.weekendKey;

  const head = el('div', 'deal__head');
  const route = el('div', 'deal__route');
  route.appendChild(el('span', 'deal__code', deal.origin));
  route.appendChild(el('span', 'deal__arrow', '\u2192'));
  route.appendChild(el('span', 'deal__code', deal.destination));
  head.appendChild(route);

  const total = el('div', 'deal__total', formatPrice(deal.totalPrice));
  total.setAttribute('aria-label', `Total round trip ${formatPrice(deal.totalPrice)}`);
  head.appendChild(total);
  item.appendChild(head);

  item.appendChild(el('p', 'deal__cities', `${deal.originName} \u2192 ${deal.destinationName}`));
  item.appendChild(el('p', 'deal__dates', formatDateRange(deal.outbound.date, deal.inbound.date)));

  const legs = el('div', 'deal__legs');
  legs.appendChild(renderLeg('Out', deal.outbound));
  legs.appendChild(renderLeg('Back', deal.inbound));
  item.appendChild(legs);

  return item;
}

/**
 * Render the result list, or an empty state.
 * @param {HTMLElement} container
 * @param {object[]} deals
 * @param {{ origin?: string }} [options]
 */
export function renderDeals(container, deals, { origin = '' } = {}) {
  if (!container) return;
  container.textContent = '';
  if (!deals.length) {
    const empty = el('p', 'empty');
    empty.textContent = origin
      ? `No deals from ${origin} match these filters.`
      : 'No deals match these filters.';
    container.appendChild(empty);
    return;
  }
  const list = el('ul', 'deals');
  for (const deal of deals) list.appendChild(renderDeal(deal));
  container.appendChild(list);
}

/**
 * Render the snapshot metadata line.
 * @param {HTMLElement} node
 * @param {object} snapshot
 */
export function renderMeta(node, snapshot) {
  if (!node || !snapshot) return;
  const when = datePart(snapshot.generatedAt);
  const count = snapshot.deals?.length ?? 0;
  node.textContent = when ? `Prices snapshotted ${when} \u00b7 ${count} deals` : `${count} deals`;
}

/**
 * Render the origin name next to the tagline.
 * @param {HTMLElement} node
 * @param {string} origin
 * @param {object[]} deals
 */
export function renderOriginLabel(node, origin, deals) {
  if (!node) return;
  const match = (deals || []).find((deal) => deal.origin === origin);
  node.textContent = match ? `${match.originName} (${match.origin})` : origin || '';
}
