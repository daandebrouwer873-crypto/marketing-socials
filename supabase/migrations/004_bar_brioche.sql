-- Bar Brioche (Boschstraat 45, open 1 december 2026) als merk naast Pellens en Brouwerij de Brouwer,
-- en de doelen uit het plan tot januari (docs/plan-tot-januari.md). Opnieuw uitvoeren mag.

-- Posts kunnen ook over Bar Brioche gaan. De oude regel heeft een naam die Postgres zelf koos,
-- dus zoek hem op in plaats van hem bij naam te noemen.
do $$
declare
  regel record;
begin
  for regel in
    select conname from pg_constraint
    where conrelid = 'public.marketing_posts'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%merk%'
  loop
    execute format('alter table public.marketing_posts drop constraint %I', regel.conname);
  end loop;
end
$$;

alter table public.marketing_posts add constraint marketing_posts_merk_check
  check (merk in ('pellens', 'barbrioche', 'brouwerij'));

-- Doelen voor Bar Brioche. Zonder startwaarde telt de eerste meting als start.
insert into public.marketing_doelen (metric, label, start_waarde, doel_december, doel_maart, volgorde) values
  ('ig_volgers_barbrioche',     'Instagram-volgers Bar Brioche', null, 1500, null, 10),
  ('google_reviews_barbrioche', 'Google-reviews Bar Brioche',       0,   20, null, 11),
  ('kerstpakketten',            'Kerstpakketten',                   0,  200, null, 12)
on conflict (metric) do nothing;

-- Pellens: 4.500 Instagram-volgers op 31 december (was 4.800). Alleen als Daan het nog niet zelf aanpaste.
update public.marketing_doelen set doel_december = 4500
where metric = 'ig_volgers_pellens' and doel_december = 4800;

update public.marketing_doelen set label = 'Google-reviews Pellens'
where metric = 'google_reviews' and label = 'Google-reviews';

-- De Brouwerij hoort bij Bar Brioche en komt daar achteraan.
update public.marketing_doelen set volgorde = 13
where metric = 'ig_volgers_brouwerij' and volgorde = 4;
