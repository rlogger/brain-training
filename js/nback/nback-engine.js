window.BT = window.BT || {};

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const COLORS = ['#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316'];
const SHAPES = ['circle','square','triangle','diamond','pentagon','hexagon','star','cross'];

const MODALITY_POOLS = {
  position: { size: 9, gen: () => Math.floor(Math.random() * 9) },
  audio:    { size: CONSONANTS.length, gen: () => CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)] },
  color:    { size: COLORS.length, gen: () => COLORS[Math.floor(Math.random() * COLORS.length)] },
  shape:    { size: SHAPES.length, gen: () => SHAPES[Math.floor(Math.random() * SHAPES.length)] },
  number:   { size: 9, gen: () => Math.floor(Math.random() * 9) + 1 },
};

function randomExcluding(pool, exclude) {
  let v;
  let tries = 0;
  do {
    v = pool.gen();
    tries++;
  } while (v === exclude && tries < 50);
  return v;
}

function zScore(p) {
  if (p <= 0.01) return -2.33;
  if (p >= 0.99) return 2.33;
  if (p < 0.5) return -zScore(1 - p);
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

window.BT.NBackEngine = {
  CONSONANTS,
  COLORS,
  SHAPES,

  defaultSettings() {
    return {
      n: 2,
      modalities: ['position', 'audio'],
      trialCount: 20,
      matchPct: 25,
      trialTime: 2500,
      isi: 500,
      adaptive: true,
    };
  },

  generateSequence(settings) {
    const { n, modalities, trialCount, matchPct } = settings;
    const seqLen = trialCount + n;
    const matchableCount = trialCount;

    const modalValues = {};
    const modalMatches = {};

    for (const mod of modalities) {
      const pool = MODALITY_POOLS[mod];
      const matchCount = Math.round(matchableCount * matchPct / 100);
      const matchFlags = new Array(matchableCount).fill(false);
      const indices = Array.from({ length: matchableCount }, (_, i) => i);
      shuffle(indices);
      for (let i = 0; i < matchCount; i++) matchFlags[indices[i]] = true;

      const values = new Array(seqLen);
      for (let i = 0; i < n; i++) values[i] = pool.gen();
      for (let i = n; i < seqLen; i++) {
        const mi = i - n;
        if (matchFlags[mi]) {
          values[i] = values[i - n];
        } else {
          values[i] = randomExcluding(pool, values[i - n]);
        }
      }

      modalValues[mod] = values;
      modalMatches[mod] = matchFlags;
    }

    const sequence = [];
    for (let i = 0; i < seqLen; i++) {
      const stim = { index: i, matches: {} };
      for (const mod of modalities) {
        stim[mod] = modalValues[mod][i];
        if (i >= n) {
          stim.matches[mod] = modalMatches[mod][i - n];
        }
      }
      sequence.push(stim);
    }
    return sequence;
  },

  computeScores(sequence, responses, n, modalities) {
    const scores = {};
    for (const mod of modalities) {
      let hits = 0, misses = 0, falseAlarms = 0, correctRejections = 0;
      for (let i = n; i < sequence.length; i++) {
        const isMatch = sequence[i].matches[mod];
        const responded = responses[i] && responses[i][mod];
        if (isMatch && responded) hits++;
        else if (isMatch && !responded) misses++;
        else if (!isMatch && responded) falseAlarms++;
        else correctRejections++;
      }
      const total = hits + misses + falseAlarms + correctRejections;
      let hitRate = total > 0 ? hits / (hits + misses || 1) : 0;
      let faRate = total > 0 ? falseAlarms / (falseAlarms + correctRejections || 1) : 0;
      hitRate = Math.max(0.01, Math.min(0.99, hitRate));
      faRate = Math.max(0.01, Math.min(0.99, faRate));
      const dPrime = zScore(hitRate) - zScore(faRate);
      const accuracy = total > 0 ? (hits + correctRejections) / total : 0;

      scores[mod] = { hits, misses, falseAlarms, correctRejections, hitRate, faRate, dPrime, accuracy };
    }

    const avgDPrime = modalities.reduce((s, m) => s + scores[m].dPrime, 0) / modalities.length;
    const avgAccuracy = modalities.reduce((s, m) => s + scores[m].accuracy, 0) / modalities.length;
    return { perModality: scores, avgDPrime, avgAccuracy };
  },

  adaptLevel(currentN, avgDPrime) {
    if (avgDPrime >= 3.0) return currentN + 1;
    if (avgDPrime <= 1.5) return Math.max(1, currentN - 1);
    return currentN;
  }
};
