// Bestandsnaam in de beeldbank: datum_naam_onderwerp_origineel.ext

export function datumAmsterdam(moment = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment);
}

function veilig(tekst, max) {
  return String(tekst || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, max);
}

export function bestandsnaam({ moment = new Date(), naam, onderwerp, origineel }) {
  const basis = String(origineel || '').split(/[\\/]/).pop();
  const punt = basis.lastIndexOf('.');
  const extensie = punt > 0 ? veilig(basis.slice(punt + 1), 10).toLowerCase() : '';
  const stam = veilig(punt > 0 ? basis.slice(0, punt) : basis, 60) || 'bestand';
  const delen = [datumAmsterdam(moment), veilig(naam, 30) || 'team', veilig(onderwerp, 40), stam].filter(Boolean);
  return extensie ? `${delen.join('_')}.${extensie}` : delen.join('_');
}
