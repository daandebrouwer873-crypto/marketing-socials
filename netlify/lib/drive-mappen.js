// Drive-mappen van de BEELDBANK (gedeelde Drive "PELLENS Beeldbank").
// De vaste map-id's staan bij de onderwerpen; mappen zonder vaste id worden bij de
// eerste upload op naam gezocht of aangemaakt.
import { BEELDBANK_MAP_ID, ONDERWERPEN } from '../../public/lib/onderwerpen.js';

export const BEELDBANK_MAP = process.env.BEELDBANK_MAP_ID || BEELDBANK_MAP_ID;

export const VASTE_MAPPEN = Object.freeze(
  Object.fromEntries(ONDERWERPEN.filter(o => o.map).map(o => [o.key, o.map])),
);

export const MAPPEN_OP_NAAM = Object.freeze({
  nieuw: 'Nieuw - te sorteren',
  brouwerij: 'Brouwerij de Brouwer',
});
