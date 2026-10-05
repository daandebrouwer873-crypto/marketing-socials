# Pellens marketing

De marketing-app van Restaurant Pellens en Brouwerij de Brouwer. Daan, Mila en Beau
zien hier wat er vandaag en deze week te doen is, plannen posts, spreken teksten in
en zetten foto's en video's direct in de BEELDBANK op Google Drive.

De app volgt het marketingplan oktober 2026 – maart 2027:

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

### 3. Netlify (de website)

1. Kies op [netlify.com](https://app.netlify.com) **Add new site → Import an existing project**
   en kies deze repository, branch `main`. De instellingen staan al in `netlify.toml`.
2. Zet onder **Site configuration → Environment variables**:

   | Naam | Waarde |
   | --- | --- |
   | `SUPABASE_URL` | Dezelfde als bij de team-app en Rails |
   | `SUPABASE_PUBLISHABLE_KEY` | Dezelfde publieke sleutel als bij de team-app en Rails |
   | `GOOGLE_CLIENT_EMAIL` | `client_email` uit het JSON-bestand van stap 2 |
   | `GOOGLE_PRIVATE_KEY` | `private_key` uit hetzelfde bestand, inclusief `-----BEGIN` en `-----END` |
   | `PLAN_URL` | Optioneel: link naar het volledige marketingplan |

3. Start een nieuwe deploy.

### 4. Op de telefoon

Open het adres in Safari of Chrome en kies **Deel → Zet op beginscherm**. De app opent dan
schermvullend, met een eigen icoon.

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
