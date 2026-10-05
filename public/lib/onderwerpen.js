// Onderwerpen van de beeldbank, met hun map in de BEELDBANK op Google Drive.
// Gedeeld door de app en de uploadfunctie. Een map-id geeft alleen toegang aan wie
// al rechten op de gedeelde Drive heeft, dus hij mag in de app staan.

export const BEELDBANK_MAP_ID = '1CPgrC9ULe5qR9n-LPCrrvXMlwegjhQ1c';

export const ONDERWERPEN = Object.freeze([
  { key: 'gerechten', label: 'Gerechten', map: '1DkqZT9LFm6uDekhgZ4HBbC_ULJ56BwoM' },
  { key: 'vuur', label: 'Vuur en grill', map: '1bLSrFJwEroiG9S9gT_cAYXARkWpy0FAw' },
  { key: 'akker', label: 'Boerderij en akker', map: '18KX5xUP53GBgilAkRE4aH7pDq9MkHeb-' },
  { key: 'keuken', label: 'Keuken', map: '1MKWfoC5ooo7HZwkdBY2xYRTtdYCIZ_8m' },
  { key: 'mensen', label: 'Mensen', map: '1I2VMvdXPJnqTnVFZ8ieWKnifuKT-AvgP' },
  { key: 'zaal', label: 'Zaal en interieur', map: '1JwDrlOhzYb5JkE2g-D06ncqdvAF-BGcn' },
  { key: 'producten', label: 'Producten', map: '1DSeJGgoeww9L7go7IEq1QZrQS7xO9pfD' },
  { key: 'dranken', label: 'Dranken', map: '1FEgheKnwo3RMrCjC73HQHHO14DCmpfM3' },
  { key: 'pand', label: 'Pand en buiten', map: '19UFdCk6FVwDR3lSMc64-m0mIQgyTkfBt' },
  { key: 'huisstijl', label: 'Huisstijl en drukwerk', map: '1u3tfd0blUFOwdw3RRej1SJ_agzWeNsul' },
  { key: 'evenementen', label: 'Evenementen', map: '1kqJAx9Vu64Ji0oQlxOehSR_rjArnVEHw' },
  // Deze twee mappen maakt de uploadfunctie zelf aan in de BEELDBANK.
  { key: 'brouwerij', label: 'Brouwerij de Brouwer', map: null },
  { key: 'overig', label: 'Overig', map: '1dtpK9te6dQVIXhpjs7MsB1f6itcSaExd' },
  { key: 'nieuw', label: 'Nieuw, nog sorteren', map: null },
]);

export function onderwerp(key) {
  return ONDERWERPEN.find(o => o.key === key) || null;
}

// Link om de map in Google Drive te openen (op de telefoon opent dat de Drive-app).
// Onderwerpen zonder vaste map openen de BEELDBANK zelf.
export function driveMapUrl(key) {
  const o = onderwerp(key);
  return `https://drive.google.com/drive/folders/${(o && o.map) || BEELDBANK_MAP_ID}`;
}
