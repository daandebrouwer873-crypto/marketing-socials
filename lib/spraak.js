// Inspreken: live dicteren (je eigen woorden worden tekst) of een spraakmemo opnemen.
// Er wordt niets herschreven of bedacht; de tekst is precies wat je zegt.

export function dicterenKan() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startDicteren({ opTekst, opStop, opFout }) {
  const Herkenning = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Herkenning();
  rec.lang = 'nl-NL';
  rec.continuous = true;
  rec.interimResults = true;
  let gestopt = false;

  rec.onresult = e => {
    let definitief = '';
    let voorlopig = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const stuk = e.results[i][0].transcript;
      if (e.results[i].isFinal) definitief += stuk; else voorlopig += stuk;
    }
    opTekst(definitief, voorlopig);
  };
  rec.onerror = e => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    opFout(e.error === 'not-allowed'
      ? 'Geef de app toegang tot je microfoon in de instellingen.'
      : 'Dicteren lukt nu niet. Gebruik het microfoontje van je toetsenbord.');
  };
  // Sommige telefoons stoppen na een stilte: dan stoppen we netjes.
  rec.onend = () => { if (!gestopt) { gestopt = true; opStop(); } };
  rec.start();

  return () => {
    if (!gestopt) {
      gestopt = true;
      rec.stop();
      opStop();
    }
  };
}

export function memoKan() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

function kiesType() {
  const opties = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return opties.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}

export async function startMemo({ opNiveau }) {
  const stroom = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = kiesType();
  const recorder = new MediaRecorder(stroom, type ? { mimeType: type } : undefined);
  const stukken = [];
  recorder.ondataavailable = e => e.data.size && stukken.push(e.data);

  // Niveaumeter voor de golfjes op het scherm.
  const Context = window.AudioContext || window.webkitAudioContext;
  const audio = Context ? new Context() : null;
  let frame = 0;
  if (audio) {
    const bron = audio.createMediaStreamSource(stroom);
    const meter = audio.createAnalyser();
    meter.fftSize = 512;
    bron.connect(meter);
    const buffer = new Uint8Array(meter.fftSize);
    const meet = () => {
      meter.getByteTimeDomainData(buffer);
      let som = 0;
      for (const v of buffer) som += ((v - 128) / 128) ** 2;
      opNiveau(Math.min(1, Math.sqrt(som / buffer.length) * 4));
      frame = requestAnimationFrame(meet);
    };
    meet();
  }

  recorder.start(250);
  const opruimen = () => {
    cancelAnimationFrame(frame);
    stroom.getTracks().forEach(t => t.stop());
    if (audio) audio.close();
  };

  return {
    stop: () => new Promise(ok => {
      recorder.onstop = () => {
        opruimen();
        ok(new Blob(stukken, { type: recorder.mimeType || type || 'audio/webm' }));
      };
      recorder.stop();
    }),
    annuleer: () => {
      recorder.onstop = opruimen;
      recorder.stop();
    },
  };
}
