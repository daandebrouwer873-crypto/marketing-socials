-- Startgegevens. Koppelt de bestaande Pellens-accounts van Daan, Mila en Beau
-- (hun profiel in de team-app) aan hun rol in de marketing-app. Er staan geen
-- e-mailadressen in: die komen uit de accounts zelf. Opnieuw uitvoeren mag.

insert into public.marketing_teamleden (email, naam, rol)
select lower(u.email), v.naam, v.rol
from (values
  ('daan', 'Daan', 'eigenaar'),
  ('mila', 'Mila', 'social'),
  ('beau', 'Beau', 'manager')
) as v (profiel, naam, rol)
join public.app_memberships m on m.profile_id = v.profiel and m.active
join auth.users u on u.id = m.user_id
on conflict (email) do update set naam = excluded.naam, rol = excluded.rol, actief = true;

-- Doelen uit het marketingplan (oktober 2026 - maart 2027) en het plan tot januari met Bar Brioche.
-- Daan kan ze in de app aanpassen.
insert into public.marketing_doelen (metric, label, start_waarde, doel_december, doel_maart, volgorde) values
  ('gasten_diner',              'Gasten per diner',                 31,   33,   35,   1),
  ('gasten_lunch',              'Gasten per lunch',                  9,   15,   27,   2),
  ('ig_volgers_pellens',        'Instagram-volgers Pellens',      3769, 4500, 6000,   3),
  ('google_reviews',            'Google-reviews Pellens',          232,  275,  320,   5),
  ('emailadressen',             'E-mailadressen van gasten',         0,  150,  400,   6),
  ('ig_volgers_barbrioche',     'Instagram-volgers Bar Brioche',  null, 1500, null,  10),
  ('google_reviews_barbrioche', 'Google-reviews Bar Brioche',        0,   20, null,  11),
  ('kerstpakketten',            'Kerstpakketten',                    0,  200, null,  12),
  ('ig_volgers_brouwerij',      'Instagram-volgers Brouwerij',    null, null, null,  13)
on conflict (metric) do update
  set label = excluded.label,
      start_waarde = excluded.start_waarde,
      doel_december = excluded.doel_december,
      doel_maart = excluded.doel_maart,
      volgorde = excluded.volgorde;

-- Controle: wie is er gekoppeld?
select naam, rol, email from public.marketing_teamleden order by rol;
