// Drive-mappen van de BEELDBANK (gedeelde Drive "PELLENS Beeldbank").
// Mappen zonder vaste id worden bij de eerste upload op naam gezocht of aangemaakt.

export const BEELDBANK_MAP = process.env.BEELDBANK_MAP_ID || '1CPgrC9ULe5qR9n-LPCrrvXMlwegjhQ1c';

export const VASTE_MAPPEN = Object.freeze({
  gerechten: '1DkqZT9LFm6uDekhgZ4HBbC_ULJ56BwoM',
  mensen: '1I2VMvdXPJnqTnVFZ8ieWKnifuKT-AvgP',
  akker: '18KX5xUP53GBgilAkRE4aH7pDq9MkHeb-',
  keuken: '1MKWfoC5ooo7HZwkdBY2xYRTtdYCIZ_8m',
  vuur: '1bLSrFJwEroiG9S9gT_cAYXARkWpy0FAw',
  zaal: '1JwDrlOhzYb5JkE2g-D06ncqdvAF-BGcn',
  producten: '1DSeJGgoeww9L7go7IEq1QZrQS7xO9pfD',
  dranken: '1FEgheKnwo3RMrCjC73HQHHO14DCmpfM3',
  pand: '19UFdCk6FVwDR3lSMc64-m0mIQgyTkfBt',
  huisstijl: '1u3tfd0blUFOwdw3RRej1SJ_agzWeNsul',
  evenementen: '1kqJAx9Vu64Ji0oQlxOehSR_rjArnVEHw',
  overig: '1dtpK9te6dQVIXhpjs7MsB1f6itcSaExd',
});

export const MAPPEN_OP_NAAM = Object.freeze({
  nieuw: 'Nieuw - te sorteren',
  brouwerij: 'Brouwerij de Brouwer',
});
