window.BT = window.BT || {};

function isConnected(grid) {
  const rows = grid.length, cols = grid[0].length;
  let start = null;
  let totalFilled = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) {
        totalFilled++;
        if (!start) start = [r, c];
      }
    }
  }
  if (!start) return false;

  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const queue = [start];
  visited[start[0]][start[1]] = true;
  let count = 1;
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] && !visited[nr][nc]) {
        visited[nr][nc] = true;
        queue.push([nr, nc]);
        count++;
      }
    }
  }
  return count === totalFilled;
}

function isSymmetric(grid) {
  const cols = grid[0].length;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < Math.floor(cols / 2); c++) {
      if (grid[r][c] !== grid[r][cols - 1 - c]) return false;
    }
  }
  return true;
}

function generateSymmetricFigure() {
  const grid = Array.from({ length: 5 }, () => new Array(5).fill(false));
  const fillTarget = 5 + Math.floor(Math.random() * 4);
  let filled = 0;
  let attempts = 0;

  while (filled < fillTarget && attempts < 200) {
    const row = Math.floor(Math.random() * 5);
    const col = Math.floor(Math.random() * 3);
    attempts++;
    if (grid[row][col]) continue;
    grid[row][col] = true;
    const mirror = 4 - col;
    if (mirror !== col) grid[row][mirror] = true;
    filled++;
  }

  if (!isConnected(grid)) return generateSymmetricFigure();
  return grid;
}

function generateAsymmetricFigure() {
  const grid = generateSymmetricFigure();

  const candidates = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 2; c++) {
      if (grid[r][c] && grid[r][4 - c]) candidates.push([r, c]);
    }
  }

  if (candidates.length === 0) return generateAsymmetricFigure();

  const perturbs = 1 + Math.floor(Math.random() * Math.min(2, candidates.length));
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  for (let i = 0; i < perturbs; i++) {
    const [r, c] = shuffled[i];
    grid[r][4 - c] = false;
  }

  if (isSymmetric(grid)) return generateAsymmetricFigure();
  if (!isConnected(grid)) return generateAsymmetricFigure();
  return grid;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

window.BT.CWMEngine = {
  defaultSettings() {
    return {
      type: 'spatial',
      level: 3,
      decisionsPerRound: 4,
      trialTime: 4000,
      advanceThreshold: 85,
      fallbackThreshold: 50,
      fallbackCount: 3,
      feedback: true,
      adaptive: true,
      keyYes: 'A',
      keyNo: 'L',
    };
  },

  generateSession(settings) {
    const { type, level, decisionsPerRound } = settings;
    const rounds = [];

    const usedPositions = [];
    const usedLetters = [];
    const availableLetters = shuffle([...window.BT.CWM_LETTERS]);
    const gridSize = 16;

    for (let r = 0; r < level; r++) {
      const decisions = [];
      for (let d = 0; d < decisionsPerRound; d++) {
        if (type === 'spatial') {
          const sym = Math.random() < 0.5;
          decisions.push({
            figure: sym ? generateSymmetricFigure() : generateAsymmetricFigure(),
            isSymmetric: sym,
          });
        } else {
          const pair = window.BT.CWMWords[Math.floor(Math.random() * window.BT.CWMWords.length)];
          const showCorrect = Math.random() < 0.5;
          decisions.push({
            word: showCorrect ? pair.correct : pair.misspelled,
            isCorrect: showCorrect,
          });
        }
      }

      let rememberItem;
      if (type === 'spatial') {
        let pos;
        do {
          pos = Math.floor(Math.random() * gridSize);
        } while (usedPositions.includes(pos) && usedPositions.length < gridSize);
        usedPositions.push(pos);
        rememberItem = pos;
      } else {
        rememberItem = availableLetters[r % availableLetters.length];
        usedLetters.push(rememberItem);
      }

      rounds.push({ decisions, rememberItem });
    }

    return rounds;
  },

  computeScores(rounds, decisionResponses, recallResponses, level) {
    let correctDecisions = 0;
    let totalDecisions = 0;

    for (const resp of decisionResponses) {
      totalDecisions++;
      if (resp.correct) correctDecisions++;
    }

    const decisionAccuracy = totalDecisions > 0 ? correctDecisions / totalDecisions : 0;

    let correctRecalls = 0;
    const expectedItems = rounds.map(r => r.rememberItem);
    for (let i = 0; i < Math.min(recallResponses.length, expectedItems.length); i++) {
      if (recallResponses[i] === expectedItems[i]) correctRecalls++;
    }
    const recallAccuracy = level > 0 ? correctRecalls / level : 0;

    const combined = 0.4 * decisionAccuracy + 0.6 * recallAccuracy;

    return { decisionAccuracy, recallAccuracy, correctRecalls, combined, totalDecisions, correctDecisions };
  },

  adaptLevel(currentLevel, combined, settings) {
    if (combined >= settings.advanceThreshold / 100) return currentLevel + 1;
    if (combined <= settings.fallbackThreshold / 100) return Math.max(2, currentLevel - 1);
    return currentLevel;
  }
};
