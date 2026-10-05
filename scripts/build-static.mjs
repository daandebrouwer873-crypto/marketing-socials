// Bouwt de statische app in dist/ en schrijft config.js met alleen publieke instellingen.
// Zonder Supabase-instellingen draait de app in demomodus, zodat je hem al kunt bekijken.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(resolve(root, 'public'), out, { recursive: true });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const config = {
  supabaseUrl,
  supabaseAnonKey,
  demo: !(supabaseUrl && supabaseAnonKey),
  // Alleen of de Google-koppeling is ingesteld, nooit de sleutel zelf.
  driveUpload: Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
  planUrl: process.env.PLAN_URL || '',
};

await writeFile(
  resolve(out, 'config.js'),
  `window.APP_CONFIG = Object.freeze(${JSON.stringify(config)});\n`,
  'utf8',
);

// Elke build krijgt een eigen cache-versie, zodat telefoons de nieuwe app ophalen.
const versie = (process.env.COMMIT_REF || Date.now().toString(36)).slice(0, 12);
const swPad = resolve(out, 'sw.js');
const sw = await readFile(swPad, 'utf8');
await writeFile(swPad, sw.replace('__VERSIE__', versie), 'utf8');

console.log(
  config.demo
    ? 'Build klaar in dist/ (demomodus: SUPABASE_URL en SUPABASE_ANON_KEY ontbreken).'
    : 'Build klaar in dist/.',
);
