// Antwoorden en herkomstcontrole voor de serverfuncties.

function header(event, naam) {
  const headers = (event && event.headers) || {};
  const gevonden = Object.keys(headers).find(k => k.toLowerCase() === naam);
  return gevonden ? headers[gevonden] : '';
}

function extraHerkomsten() {
  return String(process.env.APP_ORIGINS || '')
    .split(',')
    .map(v => v.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

// De app roept zijn eigen functie aan: de herkomst moet dezelfde site zijn,
// of expliciet zijn toegestaan via APP_ORIGINS (bijvoorbeeld voor lokaal testen).
export function toegestaneHerkomst(event) {
  const herkomst = String(header(event, 'origin') || '').replace(/\/$/, '');
  if (!herkomst) return '';
  const host = header(event, 'x-forwarded-host') || header(event, 'host');
  if (host && herkomst === `https://${host}`) return herkomst;
  if (extraHerkomsten().includes(herkomst)) return herkomst;
  return '';
}

export function json(event, statusCode, body) {
  const herkomst = toegestaneHerkomst(event);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (herkomst) {
    headers['Access-Control-Allow-Origin'] = herkomst;
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return { statusCode, headers, body: JSON.stringify(body) };
}

export function voorcontrole(event) {
  if (!toegestaneHerkomst(event)) return json(event, 403, { error: 'Herkomst niet toegestaan.' });
  return { ...json(event, 204, {}), body: '' };
}

export function bearer(event) {
  const match = /^Bearer\s+(\S+)$/i.exec(String(header(event, 'authorization') || ''));
  return match ? match[1] : null;
}
