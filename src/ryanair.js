export const RYANAIR_BASE = 'https://services-api.ryanair.com/farfnd/v4/roundTripFares';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdayName(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : WEEKDAYS[d.getUTCDay()];
}

export function buildRyanairUrl({
  origin,
  destination,
  outboundFrom,
  outboundTo,
  inboundFrom,
  inboundTo,
  maxPrice,
  currency = 'EUR',
  market = 'el-gr',
} = {}) {
  if (!origin) throw new Error('origin is required');
  if (!outboundFrom || !outboundTo || !inboundFrom || !inboundTo) {
    throw new Error('outbound and inbound date ranges are required');
  }
  const params = new URLSearchParams();
  params.set('departureAirportIataCode', String(origin).toUpperCase());
  if (destination) params.set('arrivalAirportIataCode', String(destination).toUpperCase());
  params.set('outboundDepartureDateFrom', outboundFrom);
  params.set('outboundDepartureDateTo', outboundTo);
  params.set('inboundDepartureDateFrom', inboundFrom);
  params.set('inboundDepartureDateTo', inboundTo);
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    params.set('priceValueTo', String(maxPrice));
  }
  params.set('currency', currency);
  params.set('market', market);
  return `${RYANAIR_BASE}?${params.toString()}`;
}

export function normalizeFares(json, { currency = 'EUR' } = {}) {
  const fares = Array.isArray(json?.fares) ? json.fares : [];
  return fares
    .map((fare) => {
      const out = fare.outbound || {};
      const back = fare.inbound || {};
      const outboundDate = String(out.departureDate || '').slice(0, 10);
      const inboundDate = String(back.departureDate || '').slice(0, 10);
      return {
        destination: out.arrivalAirport?.iataCode || '',
        destinationName: out.arrivalAirport?.name || '',
        country: out.arrivalAirport?.countryName || '',
        countryCode: out.arrivalAirport?.city?.countryCode || '',
        outboundDate,
        outboundWeekday: weekdayName(outboundDate),
        outboundDeparture: out.departureDate || '',
        outboundArrival: out.arrivalDate || '',
        outboundFlight: out.flightNumber || '',
        inboundDate,
        inboundWeekday: weekdayName(inboundDate),
        inboundDeparture: back.departureDate || '',
        inboundArrival: back.arrivalDate || '',
        inboundFlight: back.flightNumber || '',
        outboundPrice: out.price?.value ?? null,
        inboundPrice: back.price?.value ?? null,
        totalPrice: fare.summary?.price?.value ?? null,
        currency: fare.summary?.price?.currencyCode || currency,
        durationDays: fare.summary?.tripDurationDays ?? null,
      };
    })
    .filter((deal) => deal.destination && typeof deal.totalPrice === 'number');
}

export function filterDeals(deals, { maxPrice, outboundWeekday, inboundWeekday } = {}) {
  const cap = maxPrice === '' || maxPrice === undefined || maxPrice === null ? null : Number(maxPrice);
  return deals.filter((deal) => {
    if (cap !== null && deal.totalPrice > cap) return false;
    if (outboundWeekday && deal.outboundWeekday !== outboundWeekday) return false;
    if (inboundWeekday && deal.inboundWeekday !== inboundWeekday) return false;
    return true;
  });
}

export function sortDeals(deals) {
  return [...deals].sort((a, b) => a.totalPrice - b.totalPrice);
}

export function parseFares(json, opts = {}) {
  return sortDeals(filterDeals(normalizeFares(json, opts), opts));
}
