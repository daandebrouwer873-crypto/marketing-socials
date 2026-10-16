# Pellens marketing

De marketing-app van Restaurant Pellens en Brouwerij de Brouwer. Daan, Mila en Beau
zien hier wat er vandaag en deze week te doen is, plannen posts, spreken teksten in
en zetten foto's en video's direct in de BEELDBANK op Google Drive.

De app volgt het marketingplan oktober 2026 – maart 2027:

- **Overzicht:** op laptop en groot scherm de startpagina, met een zijbalk. Alles op één scherm:
  wat aandacht vraagt, de cijfers met verschil en verloop, een contentkalender van twee weken,
  de pijplijn van posts, het team vandaag, de weektaken, grafieken van gasten en volgers,
  de doelen met "op schema of niet", reserveringen per bron, thema's, kanalen en de beeldbank.
  Op de telefoon staat het onder "Meer".
- **Vandaag:** de vaste routines per persoon en per dag, met een streak en een voortgangsring.
- **Week:** maximaal drie taken per week. Wat niet af is, schuift door en telt mee.
- **Posts:** de planning per merk (Pellens of Brouwerij). Daan spreekt de tekst in
  (dicteren of spraakmemo) en keurt hem goed. Alleen Daan kan goedkeuren, de database dwingt dat af.
  De app schrijft zelf geen tekst: er gaat geen AI-tekst online.
- **Beeldbank:** foto's en video's kiezen, onderwerp aantikken, en ze staan in de juiste map.
- **Doelen, Cijfers, Maandagkwartier en Plan:** onder "Meer".

Zonder instellingen draait de app in **demomodus**: je kunt alles bekijken en uitproberen,
maar er wordt niets opgeslagen buiten je eigen browser.

## Eenmalig instellen

### 1. Supabase (database en inloggen)

De app draait in hetzelfde Supabase-project als de team-app van Pellens. Daan, Mila en Beau
loggen dus in met hun bestaande Pellens-account en wachtwoord. Een wachtwoord vergeten of een
eerste wachtwoord kiezen gaat via de team-app.

1. Open in dat project de **SQL Editor** en voer achter elkaar uit:
   1. `supabase/migrations/001_marketing_app.sql`
   2. `supabase/migrations/002_spraakmemos.sql`
   3. `supabase/seed.sql`
2. De laatste query toont wie er gekoppeld is: Daan als eigenaar, Mila als social, Beau als manager.
   De koppeling loopt via hun profiel in de team-app (`app_memberships.profile_id`).

Alles heeft het voorvoegsel `marketing_` en raakt geen bestaande tabellen. Toegang vraagt
drie dingen: een actief Pellens-account, een zelf gekozen wachtwoord en een plek op de
marketinglijst. Iemand toevoegen of weghalen:

```sql
insert into public.marketing_teamleden (email, naam, rol) values ('naam@pellens.nl', 'Naam', 'social');
update public.marketing_teamleden set actief = false where email = 'naam@pellens.nl';
```

Rollen: `eigenaar` (Daan), `social` (Mila), `manager` (Beau).

### 2. Google Drive (uploaden naar de beeldbank)

Deze stap kan later. Zolang hij niet is gedaan, opent de app bij Beeldbank de juiste map
in Google Drive en upload je via de Drive-app. Na deze stap uploadt de app zelf, rechtstreeks
in de goede map, met naam en datum in de bestandsnaam.

De app uploadt via een serviceaccount: een apart Google-account alleen voor de app.

1. Open [console.cloud.google.com](https://console.cloud.google.com) en maak een project, bijvoorbeeld "Pellens marketing".
2. Zoek **Google Drive API** en klik op **Inschakelen**.
3. Ga naar **IAM en beheer → Serviceaccounts → Serviceaccount maken**, noem hem `pellens-hub-upload`.
4. Open het serviceaccount → **Sleutels → Sleutel toevoegen → JSON**. Er wordt een bestand gedownload.
   Bewaar het goed en deel het met niemand.
5. Open in Google Drive de gedeelde drive waar **PELLENS Beeldbank** in staat, kies **Leden beheren**
   en voeg het e-mailadres van het serviceaccount toe (eindigt op `iam.gserviceaccount.com`) als **Inhoudsbeheerder**.

De vaste onderwerpmappen staan in `public/lib/onderwerpen.js`. De mappen "Nieuw - te sorteren"
en "Brouwerij de Brouwer" maakt de app zelf aan in de BEELDBANK bij de eerste upload.

### 3. Online: GitHub Pages (gaat vanzelf)

De app staat op **https://daandebrouwer873-crypto.github.io/marketing-socials/**.
Elke wijziging op `main` gaat vanzelf live: `.github/workflows/publiceren.yml` draait de tests,
bouwt de app en zet hem in de branch `gh-pages`. Na een paar minuten staat de nieuwe versie online.
Faalt een test, dan blijft de vorige versie staan. Je ziet het verloop onder **Actions** in GitHub;
daar kun je ook met **Run workflow** opnieuw publiceren.

Direct uploaden naar Google Drive werkt alleen op Netlify, omdat daar de uploadfunctie draait.
Op GitHub Pages opent de app de juiste map in Google Drive.

### 4. Netlify (optioneel, voor direct uploaden)

De site `pellens-marketing` staat al in het Netlify-team van Pellens, met `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY` en `PLAN_URL` ingevuld.

1. Open [de site in Netlify](https://app.netlify.com/projects/pellens-marketing) en kies
   **Project configuration → Build & deploy → Link repository**. Kies GitHub, deze repository
   en branch `main`. De bouwinstellingen staan al in `netlify.toml`. Daarna zet Netlify elke
   wijziging op `main` vanzelf online.
2. De variabelen staan onder **Project configuration → Environment variables**:

   | Naam | Waarde |
   | --- | --- |
   | `SUPABASE_URL` | Dezelfde als bij de team-app en Rails |
   | `SUPABASE_PUBLISHABLE_KEY` | Dezelfde publieke sleutel als bij de team-app en Rails |
   | `GOOGLE_CLIENT_EMAIL` | `client_email` uit het JSON-bestand van stap 2 |
   | `GOOGLE_PRIVATE_KEY` | `private_key` uit hetzelfde bestand, inclusief `-----BEGIN` en `-----END` |
   | `PLAN_URL` | Optioneel: link naar het volledige marketingplan |

   Na het toevoegen van de Google-variabelen: **Deploys → Trigger deploy**.

### 5. Op de telefoon

Open het adres in Safari of Chrome en kies **Deel → Zet op beginscherm**. De app opent dan
schermvullend, met een eigen icoon.

### 6. Volgers vanzelf ophalen bij Meta

Elke ochtend om 05:15 (UTC) haalt `.github/workflows/meta-cijfers.yml` de volgers op bij Meta en
zet ze bij Cijfers als cijfer van deze week: Instagram Pellens, Facebook Pellens en Instagram
Brouwerij. In de app staat dan "via Meta" bij het cijfer. Met de hand invullen blijft mogelijk.
Zonder token doet de workflow niets.

1. Maak op [developers.facebook.com](https://developers.facebook.com) een app van het type
   **Business**, gekoppeld aan het bedrijfsportfolio van Pellens. De app blijft in ontwikkelmodus;
   app review is niet nodig, want hij leest alleen de eigen pagina's van de beheerder.
2. In de [Graph API Explorer](https://developers.facebook.com/tools/explorer): kies de app, vraag een
   gebruikerstoken met `pages_show_list`, `pages_read_engagement`, `instagram_basic` en
   `business_management`, verleng hem in de Access Token Tool en vraag daarna
   `me/accounts?fields=name,access_token,instagram_business_account` op. Het `access_token` per
   pagina is een paginatoken dat niet verloopt.
3. Zet in GitHub onder **Settings → Secrets and variables → Actions** deze geheimen:

   | Naam | Waarde |
   | --- | --- |
   | `META_TOKEN_PELLENS` | Paginatoken van de Facebook-pagina Pellens |
   | `META_TOKEN_BROUWERIJ` | Paginatoken van de pagina waar het Brouwerij-Instagram aan hangt (mag later) |
   | `SUPABASE_SECRET_KEY` | Een eigen secret key uit Supabase (**Project Settings → API Keys**), bijvoorbeeld `github-meta-cijfers` |

4. Start de eerste keer zelf: **Actions → Meta-cijfers → Run workflow**.

Faalt de workflow (verlopen token, ander wachtwoord, beheerdersrol kwijt), dan mailt GitHub. Maak dan
een nieuw paginatoken en vervang het geheim. GitHub zet geplande workflows uit als er 60 dagen niets
in de repository verandert; aanzetten kan onder Actions met één klik.

### 7. Google-profielcijfers en reviews vanzelf ophalen

Elke ochtend om 05:30 (UTC) haalt `.github/workflows/google-cijfers.yml` de cijfers van het
Google-bedrijfsprofiel Pellens op en zet ze bij Cijfers als maandcijfer: weergaven (Zoeken en Maps
samen), routeverzoeken, belklikken, websiteklikken, aantal reviews en score. De vorige maand wordt
elke dag opnieuw opgeteld, omdat Google een paar dagen achterloopt. In de app staat "via Google".
Zonder geheimen doet de workflow niets.

1. Google Cloud-project `pellens-marketing` (nummer 682139451223) heeft de Business Profile
   Performance API, Account Management API en Business Information API aan. Google moet de toegang
   goedkeuren (aanvraag van 16 oktober 2026, case 4-9016000041638). Goedgekeurd is als het quotum
   in de Cloud Console van 0 naar 300 per minuut gaat.
2. Na goedkeuring: een OAuth-toestemmingsscherm (extern, status **In production**, anders verloopt
   het refresh token na 7 dagen) en een OAuth-client van het type **Web application** met als
   redirect-URI `https://developers.google.com/oauthplayground`.
3. In de [OAuth Playground](https://developers.google.com/oauthplayground): eigen client-ID en
   -secret invullen, scope `https://www.googleapis.com/auth/business.manage`, inloggen met het
   account dat het profiel beheert en de code inwisselen voor een refresh token.
4. Zet in GitHub onder **Settings → Secrets and variables → Actions**:

   | Naam | Waarde |
   | --- | --- |
   | `GBP_CLIENT_ID` | Client-ID van de OAuth-client |
   | `GBP_CLIENT_SECRET` | Client-secret van de OAuth-client |
   | `GBP_REFRESH_TOKEN` | Refresh token uit de Playground |

   Optioneel, onder **Variables**: `GBP_LOCATIE` met de waarde die de eerste run in de uitvoer
   zet (`accounts/…/locations/…`). Zonder die variabele zoekt het script het profiel "Pellens" op.
5. Start de eerste keer zelf: **Actions → Google-cijfers → Run workflow**.

## Zelf iets veranderen

- **Doelen:** in de app zelf, onder Doelen en dan Aanpassen (alleen de eigenaar).
- **Teksten van het plan** (maandthema's, spelregels, routines): `public/lib/plan.js`. Aanpassen kan
  in GitHub in de browser met het potloodje. Na het opslaan op `main` gaat het vanzelf live.
- **Grotere verbouwingen:** met Claude Code op je eigen laptop (Claude Desktop, tabblad Code, in de
  map van deze repository). Wil je vanaf je telefoon sturen terwijl je laptop het werk doet, start
  dan `claude remote-control` in die map.

## Ontwikkelen en testen

```bash
npm test               # rekenregels, uploadfunctie en bestandsnamen
npm run test:db        # migraties en rijbeveiliging tegen een lokale Postgres
npm run build          # bouwt dist/ (zonder Supabase-variabelen: demomodus)
npm run test:browser   # klikt als telefoon door de hele app (Playwright, na de build)
npm run dev            # bouwt en serveert lokaal op http://localhost:4321
```

## Beveiliging

- Alleen actieve teamleden zien en wijzigen gegevens. Dat regelt de database zelf (rijbeveiliging),
  niet alleen de app.
- Alleen de eigenaar kan teksten goedkeuren. Een gewijzigde tekst moet opnieuw worden goedgekeurd.
- De Google-sleutel staat alleen in Netlify, nooit in de code of in de browser. De browser krijgt
  per upload een eenmalig uploadadres.
- Zet nooit geheimen in deze repository.
