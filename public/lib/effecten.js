// Kleine beloningen: confetti in vuurkleuren, een tikje trilling en meldingen.

const KLEUREN = ['#FF5A1F', '#FF9F1C', '#FFD166', '#B6F36A', '#7EE0FF', '#F4F1EA'];
const rustig = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function tril(ms = 12) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

export function confetti({ x = window.innerWidth / 2, y = window.innerHeight / 2, aantal = 90, kracht = 1 } = {}) {
  if (rustig()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const deeltjes = Array.from({ length: aantal }, () => {
    const hoek = Math.random() * Math.PI * 2;
    const snelheid = (4 + Math.random() * 9) * kracht;
    return {
      x, y,
      vx: Math.cos(hoek) * snelheid,
      vy: Math.sin(hoek) * snelheid - 7 * kracht,
      grootte: 4 + Math.random() * 6,
      draai: Math.random() * Math.PI,
      vd: (Math.random() - 0.5) * 0.4,
      kleur: KLEUREN[Math.floor(Math.random() * KLEUREN.length)],
      rond: Math.random() < 0.35,
    };
  });

  const begin = performance.now();
  const teken = nu => {
    const t = nu - begin;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const d of deeltjes) {
      d.vy += 0.32;
      d.vx *= 0.985;
      d.x += d.vx;
      d.y += d.vy;
      d.draai += d.vd;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 1700);
      ctx.translate(d.x, d.y);
      ctx.rotate(d.draai);
      ctx.fillStyle = d.kleur;
      if (d.rond) {
        ctx.beginPath();
        ctx.arc(0, 0, d.grootte / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-d.grootte / 2, -d.grootte / 4, d.grootte, d.grootte / 2);
      }
      ctx.restore();
    }
    if (t < 1700) requestAnimationFrame(teken); else canvas.remove();
  };
  requestAnimationFrame(teken);
}

export function confettiBij(element, opties = {}) {
  const r = element.getBoundingClientRect();
  confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, aantal: 40, kracht: 0.7, ...opties });
}

let toastTimer = 0;
export function melding(tekst, soort = 'ok') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = tekst;
  el.className = `toast toast-${soort} zichtbaar`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('zichtbaar'), soort === 'fout' ? 5000 : 2600);
}
