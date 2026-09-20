#!/usr/bin/env node
/**
 * Dev-time snapshot generator for the weekend flight-deals page.
 *
 * Queries Ryanair's keyless farfnd v4 `roundTripFares` endpoint for the next N
 * Friday -> Monday weekends from an origin, applies the Fri/Mon and price rules
 * via `src/core/deals.js`, and writes `data/deals.json`.
 *
 * Usage:
 *   node scripts/fetch-deals.mjs [--origin ATH] [--weekends 4] [--max 100]
 *                                [--market en-gb] [--reference 2026-09-20]
 *                                [--out data/deals.json]
 *
 * No third-party dependencies; Node 18 global `fetch` is used.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_MAX_TOTAL, DEFAULT_ORIGIN, buildSnapshot } from '../src/core/deals.js';
import { upcomingFridays, weekendPair } from '../src/core/weekend.js';

const API = 'https://www.ryanair.com/api/farfnd/v4/roundTripFares';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * Parse `--key value` / `--flag` command-line arguments.
 * @param {string[]} argv
 * @returns {Record<string, string|boolean>}
 */
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch all fares for one Friday -> Monday window.
 * @param {{ origin: string, friday: string, monday: string, maxTotal: number, market: string }} opts
 * @returns {Promise<any[]>}
 */
export async function fetchWeekend({ origin, friday, monday, maxTotal, market }) {
  const params = new URLSearchParams({
    departureAirportIataCode: origin,
    outboundDepartureDateFrom: friday,
    outboundDepartureDateTo: friday,
    inboundDepartureDateFrom: monday,
    inboundDepartureDateTo: monday,
    priceValueTo: String(maxTotal),
    limit: '20',
    offset: '0',
    market,
    currency: 'EUR',
  });
  const url = `${API}?${params.toString()}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Ryanair API ${response.status} for ${friday}`);
  const body = await response.json();
  return Array.isArray(body.fares) ? body.fares : [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const origin = String(args.origin || DEFAULT_ORIGIN).toUpperCase();
  const weeks = Number(args.weekends || 4);
  const maxTotal = Number(args.max || DEFAULT_MAX_TOTAL);
  const market = String(args.market || 'en-gb');
  const reference = String(args.reference || todayISO());
  const outFile = resolve(ROOT, String(args.out || 'data/deals.json'));

  const fridays = upcomingFridays(reference, weeks);
  const fares = [];

  for (const friday of fridays) {
    const { monday } = weekendPair(friday);
    process.stdout.write(`- ${origin} ${friday} -> ${monday} ... `);
    const batch = await fetchWeekend({ origin, friday, monday, maxTotal, market });
    process.stdout.write(`${batch.length} fares\n`);
    fares.push(...batch);
  }

  const snapshot = buildSnapshot(fares, {
    origin,
    weekends: fridays,
    maxTotal,
    generatedAt: new Date().toISOString(),
  });

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${snapshot.deals.length} deals to ${outFile}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`fetch-deals failed: ${error.message}`);
    process.exitCode = 1;
  });
}
