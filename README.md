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

1. Maak een gratis project aan op [supabase.com](https://supabase.com).
2. Open **SQL Editor** en voer achter elkaar uit:
   1. `supabase/migrations/001_marketing_app.sql`
   2. `supabase/migrations/002_spraakmemos.sql`
   3. `supabase/seed.sql`, nadat je daarin de drie e-mailadressen hebt vervangen door de echte.
3. Ga naar **Authentication → URL Configuration** en zet de **Site URL** op het adres van de app
   (zie stap 3, bijvoorbeeld `https://pellens-hub.netlify.app`).
4. Ga naar **Authentication → Users → Invite user** en nodig Daan, Mila en Beau uit.
   Ze krijgen een mail, tikken op de link en kiezen in de app hun wachtwoord.
5. Noteer onder **Project Settings → API** de **Project URL** en de **anon public key**.

Iemand toevoegen of weghalen doe je in de SQL Editor:

```sql
insert into public.teamleden (email, naam, rol) values ('nieuw@voorbeeld.nl', 'Naam', 'social');
update public.teamleden set actief = false where email = 'oud@voorbeeld.nl';
```

Rollen: `eigenaar` (Daan), `social` (Mila), `manager` (Beau).

### 2. Google Drive (uploaden naar de beeldbank)

De app uploadt via een serviceaccount: een apart Google-account alleen voor de app.

1. Open [console.cloud.google.com](https://console.cloud.google.com) en maak een project, bijvoorbeeld "Pellens marketing".
2. Zoek **Google Drive API** en klik op **Inschakelen**.
3. Ga naar **IAM en beheer → Serviceaccounts → Serviceaccount maken**, noem hem `pellens-hub-upload`.
4. Open het serviceaccount → **Sleutels → Sleutel toevoegen → JSON**. Er wordt een bestand gedownload.
   Bewaar het goed en deel het met niemand.
5. Open in Google Drive de gedeelde drive waar **PELLENS Beeldbank** in staat, kies **Leden beheren**
   en voeg het e-mailadres van het serviceaccount toe (eindigt op `iam.gserviceaccount.com`) als **Inhoudsbeheerder**.

De vaste onderwerpmappen staan in `netlify/lib/drive-mappen.js`. De mappen "Nieuw - te sorteren"
en "Brouwerij de Brouwer" maakt de app zelf aan in de BEELDBANK bij de eerste upload.

### 3. Netlify (de website)

1. Kies op [netlify.com](https://app.netlify.com) **Add new site → Import an existing project**
   en kies deze repository, branch `main`. De instellingen staan al in `netlify.toml`.
2. Zet onder **Site configuration → Environment variables**:

   | Naam | Waarde |
   | --- | --- |
   | `SUPABASE_URL` | De Project URL uit stap 1 |
   | `SUPABASE_ANON_KEY` | De anon public key uit stap 1 |
   | `GOOGLE_CLIENT_EMAIL` | `client_email` uit het JSON-bestand van stap 2 |
   | `GOOGLE_PRIVATE_KEY` | `private_key` uit hetzelfde bestand, inclusief `-----BEGIN` en `-----END` |
   | `PLAN_URL` | Optioneel: link naar het volledige marketingplan |

3. Start een nieuwe deploy. Zet daarna het Netlify-adres als Site URL in Supabase (stap 1.3).

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
