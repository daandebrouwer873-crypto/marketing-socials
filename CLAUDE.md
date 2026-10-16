# Pellens marketing: werkafspraken voor Claude

De marketing-app van Restaurant Pellens (Breda) en Brouwerij de Brouwer. Daan (eigenaar), Mila
(social media manager, 8 uur per week) en Beau (restaurantmanager) volgen hier het marketingplan
van oktober 2026 tot en met maart 2027. Live op https://daandebrouwer873-crypto.github.io/marketing-socials/

## Met Daan werken

- Schrijf in het Nederlands, kort en in gewone taal. Daan is geen programmeur.
- Doe zoveel mogelijk zelf: aanpassen, testen, op `main` zetten. Vraag alleen wat echt een keuze van Daan is.
- Laat na afloop in een paar zinnen zien wat er veranderd is en waar hij het in de app ziet.

## Huisregels voor de app

- **Geen AI-teksten voor posts.** Daan schrijft en spreekt alle posttekst zelf in. De app stelt nooit
  zelf een tekst voor en vult niets aan. Alleen de eigenaar keurt teksten goed (de database dwingt dat af).
- **Geen gedachtestreepjes** (— of – midden in een zin) en **geen emoji's** in teksten in de app.
  Een streepje in een datumbereik ("5–11 okt") mag.
- **Pellens-huisstijl:** navy, crème en goud; koppen in Fraunces, tekst in DM Sans; het dP-monogram.
  Drie weergaven (donker, licht, groen), net als de team-app. Kleuren als variabelen in `public/app.css`.
- **Grafieken:** alleen `--g1` (goud) en `--g2` (blauw), in die volgorde. Die zijn per weergave
  gecontroleerd op contrast en kleurenblindheid. Goud naast groen is niet uit elkaar te houden.
  Elke grafiek heeft een tooltip en een tabelweergave (`public/lib/grafiek.js`).
- **Telefoon en laptop:** onder 1024 pixels breed een balk onderin, daarboven een zijbalk en het
  Overzicht als startpagina. Controleer een wijziging op beide breedtes.
- Spreek over personen met "die" of "hun" als je hun voornaamwoorden niet weet.

## Hoe de code in elkaar zit

- Gewone JavaScript-modules zonder framework en zonder npm-pakketten.
- `public/app.js`: alle schermen, acties en formulieren.
- `public/lib/plan.js`: de inhoud van het plan (maanden, spelregels, ritme, routines, thema's, cijfers).
  Teksten in de app aanpassen begint meestal hier.
- `public/lib/logica.js`: rekenregels (datums, weken, drie-takenregel, reeksen, op schema).
- `public/lib/opslag.js`: Supabase in het echt, of de demo met voorbeeldgegevens (`?demo` in de URL).
  Verander je de vorm van de demogegevens, verhoog dan `DEMO_SLEUTEL`.
- `netlify/functions/drive-upload.js`: direct uploaden naar Google Drive. Werkt alleen op Netlify;
  op GitHub Pages opent de app de juiste map in Drive.
- `scripts/meta-cijfers.mjs`: haalt elke ochtend de volgers op bij Meta (GitHub Actions,
  `.github/workflows/meta-cijfers.yml`) en schrijft ze met de secret key in `marketing_metingen`.
  Zulke rijen hebben een lege `ingevuld_door`; daaraan ziet de app "via Meta".
- `scripts/google-cijfers.mjs`: hetzelfde voor het Google-bedrijfsprofiel (maandcijfers en reviews,
  `.github/workflows/google-cijfers.yml`). De `bron` van een cijfer in `plan.js` bepaalt het label.
- `supabase/functions/marketing-plaatsen/`: de knop Plaatsen (Instagram en Facebook, Graph API v26.0).
  Supabase Edge Function met de inlog van de eigenaar; de regels staan in de database (migratie 003).
  `index.ts` start alleen `plaatsen.js`; alles is gewone JavaScript en getest met nep-Meta in
  `tests/meta-plaatsen.test.js`. Live zetten gaat vanzelf via `.github/workflows/plaatsen-functie.yml`.
- `supabase/functions/marketing-plaatsen/regels.js`: wat Meta per soort post neemt. De build kopieert
  hem naar `dist/lib/plaatsregels.js`, zodat de app dezelfde regels gebruikt. In `public/lib/` staat hij
  dus niet. `public/lib/plaatsmedia.js` zet foto's om naar JPEG en snijdt ze bij.

## Database

- Hetzelfde Supabase-project als de team-app van Pellens. Inloggen gaat met het Pellens-account.
- Raak alleen tabellen, functies en opslag met het voorvoegsel `marketing_` aan. De rest is van de
  team-app, de kassa en Rails.
- Toegang vraagt een actief lidmaatschap in `app_memberships`, een zelf gekozen wachtwoord en een
  plek in `marketing_teamleden`. Rijbeveiliging regelt dat in de database, niet alleen in de app.
- Wijzigingen: een nieuwe, herhaalbare migratie in `supabase/migrations/`, en tests in
  `supabase/tests/rls_test.sql`. Nooit bestaande gegevens weggooien zonder dat Daan het vraagt.
- Zet nooit geheimen in de repository. De Supabase-URL en de publishable key zijn bewust publiek.

## Testen en live zetten

```bash
npm test               # rekenregels, grafieken, uploadfunctie (draait overal)
npm run build          # bouwt dist/ (zonder Supabase-variabelen: demomodus)
npm run test:browser   # klikt door de app op telefoon- en laptopbreedte (Playwright, na de build)
npm run test:db        # migraties en rijbeveiliging tegen een lokale Postgres (alleen Linux)
```

- Voor `test:browser` op een eigen laptop: eenmalig `npx playwright install chromium`.
- Live zetten gaat vanzelf: alles wat op `main` komt, test en publiceert de GitHub Actions-workflow
  `Publiceren` (`.github/workflows/publiceren.yml`) naar de branch `gh-pages`. Kijk na een push onder
  Actions of hij groen is. Zet nooit met de hand iets in `gh-pages`.
- Werk op een eigen branch en open een pull request. Merge als de tests slagen en Daan heeft gezegd
  dat het mag. Een kleine tekstwijziging waar Daan om vraagt, mag direct op `main`.
