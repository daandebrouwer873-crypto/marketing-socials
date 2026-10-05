// Start een upload naar de BEELDBANK op Google Drive.
// De browser krijgt een upload-adres terug en stuurt het bestand daar zelf naartoe,
// zodat grote video's niet door deze functie hoeven.
import { json, toegestaneHerkomst, voorcontrole } from '../lib/http.js';
import { controleerTeamlid } from '../lib/auth.js';
import { googleToken, startUpload, vindOfMaakMap } from '../lib/google.js';
import { BEELDBANK_MAP, MAPPEN_OP_NAAM, VASTE_MAPPEN } from '../lib/drive-mappen.js';
import { bestandsnaam } from '../lib/bestandsnaam.js';
import { onderwerp as zoekOnderwerp } from '../../public/lib/onderwerpen.js';

const MAX_GROOTTE = 5 * 1024 ** 3;
const MIME = /^(image|video)\/[A-Za-z0-9.+-]{1,60}$/;

export const handler = async event => {
  if (event.httpMethod === 'OPTIONS') return voorcontrole(event);
  if (event.httpMethod !== 'POST') return json(event, 405, { error: 'Alleen POST.' });

  const herkomst = toegestaneHerkomst(event);
  if (!herkomst) return json(event, 403, { error: 'Herkomst niet toegestaan.' });

  const lid = await controleerTeamlid(event);
  if (lid.response) return lid.response;

  let invoer;
  try {
    invoer = JSON.parse(event.body || '{}');
  } catch {
    return json(event, 400, { error: 'Ongeldige aanvraag.' });
  }

  const onderwerp = zoekOnderwerp(invoer.onderwerp);
  const grootte = Number(invoer.grootte);
  const origineel = String(invoer.naam || '').slice(0, 200);
  if (!onderwerp) return json(event, 400, { error: 'Kies een onderwerp.' });
  if (!MIME.test(String(invoer.mime || ''))) return json(event, 400, { error: 'Alleen foto\'s en video\'s.' });
  if (!Number.isInteger(grootte) || grootte < 1 || grootte > MAX_GROOTTE) {
    return json(event, 400, { error: 'Dit bestand is te groot (maximaal 5 GB).' });
  }

  try {
    const token = await googleToken();
    const map = VASTE_MAPPEN[onderwerp.key]
      || await vindOfMaakMap(token, MAPPEN_OP_NAAM[onderwerp.key] || onderwerp.label, BEELDBANK_MAP);
    const naam = bestandsnaam({ naam: lid.naam, onderwerp: onderwerp.label, origineel });
    const uploadUrl = await startUpload(token, {
      naam,
      map,
      mime: invoer.mime,
      grootte,
      herkomst,
      beschrijving: `Geüpload door ${lid.naam} via de marketing-app.`,
    });
    return json(event, 200, { uploadUrl, bestandsnaam: naam });
  } catch (fout) {
    console.error('Upload starten mislukt:', fout.message);
    const configuratie = fout.message === 'GOOGLE_CONFIG_ONTBREEKT';
    return json(event, configuratie ? 500 : 502, {
      error: configuratie
        ? 'De koppeling met Google Drive is nog niet ingesteld.'
        : 'Google Drive reageert niet zoals verwacht. Probeer het zo nog eens.',
    });
  }
};
