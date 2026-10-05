// Controleert of de aanvrager is ingelogd met een Pellens-account én op de marketinglijst staat.
// De database weigert de rij als het account niet actief is of nog een eigen wachtwoord moet kiezen.
import { bearer, json } from './http.js';

export async function controleerTeamlid(event) {
  const token = bearer(event);
  if (!token) return { response: json(event, 401, { error: 'Log eerst in.' }) };

  const url = process.env.SUPABASE_URL;
  const sleutel = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !sleutel) {
    console.error('SUPABASE_URL of de publieke Supabase-sleutel ontbreekt.');
    return { response: json(event, 500, { error: 'De inlogconfiguratie ontbreekt.' }) };
  }

  const headers = { apikey: sleutel, Authorization: `Bearer ${token}` };

  const gebruikerAntwoord = await fetch(`${url}/auth/v1/user`, { headers });
  if (!gebruikerAntwoord.ok) {
    return { response: json(event, 401, { error: 'Je sessie is verlopen. Log opnieuw in.' }) };
  }
  const gebruiker = await gebruikerAntwoord.json();
  const email = String(gebruiker.email || '').toLowerCase();
  if (!email) return { response: json(event, 401, { error: 'Je sessie is verlopen. Log opnieuw in.' }) };

  const lidAntwoord = await fetch(
    `${url}/rest/v1/marketing_teamleden?select=naam,rol,actief&email=eq.${encodeURIComponent(email)}`,
    { headers },
  );
  if (!lidAntwoord.ok) {
    console.error('Teamcontrole mislukt:', lidAntwoord.status);
    return { response: json(event, 502, { error: 'Teamcontrole mislukt. Probeer het zo nog eens.' }) };
  }
  const [lid] = await lidAntwoord.json();
  if (!lid || !lid.actief) {
    return { response: json(event, 403, { error: 'Dit account hoort niet bij het team.' }) };
  }

  return { email, naam: lid.naam, rol: lid.rol };
}
