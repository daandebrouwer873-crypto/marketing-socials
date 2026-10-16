// Start de serverfunctie in Supabase. Alles zit in plaatsen.js: gewone JavaScript, ook getest met Node
// (tests/meta-plaatsen.test.js). Live zetten gaat vanzelf via .github/workflows/plaatsen-functie.yml.
import { behandel } from './plaatsen.js';

Deno.serve(verzoek => behandel(verzoek, Deno.env.toObject()));
