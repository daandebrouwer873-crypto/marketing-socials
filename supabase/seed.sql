-- Startgegevens. Vervang de drie e-mailadressen door de echte adressen
-- waarmee Daan, Mila en Beau inloggen (kleine letters), en voer dit daarna uit.

insert into public.teamleden (email, naam, rol) values
  ('daan@VERVANG.nl', 'Daan', 'eigenaar'),
  ('mila@VERVANG.nl', 'Mila', 'social'),
  ('beau@VERVANG.nl', 'Beau', 'manager')
on conflict (email) do update set naam = excluded.naam, rol = excluded.rol, actief = true;

-- Doelen uit het marketingplan (oktober 2026 - maart 2027). Daan kan ze in de app aanpassen.
insert into public.doelen (metric, label, start_waarde, doel_december, doel_maart, volgorde) values
  ('gasten_diner',          'Gasten per diner',                 31,   33,   35,   1),
  ('gasten_lunch',          'Gasten per lunch',                  9,   15,   27,   2),
  ('ig_volgers_pellens',    'Instagram-volgers Pellens',      3769, 4800, 6000,   3),
  ('ig_volgers_brouwerij',  'Instagram-volgers Brouwerij',    null, null, null,   4),
  ('google_reviews',        'Google-reviews',                  232,  275,  320,   5),
  ('emailadressen',         'E-mailadressen van gasten',         0,  150,  400,   6)
on conflict (metric) do update
  set label = excluded.label,
      start_waarde = excluded.start_waarde,
      doel_december = excluded.doel_december,
      doel_maart = excluded.doel_maart,
      volgorde = excluded.volgorde;
