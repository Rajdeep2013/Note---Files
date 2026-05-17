window.Notepilot = window.Notepilot || {};
window.Notepilot._moduleInitializers = [];
window.Notepilot.registerModule = function (initFn) {
  if (typeof initFn === "function") {
    window.Notepilot._moduleInitializers.push(initFn);
  }
};
window.Notepilot.start = function () {
  window.Notepilot._moduleInitializers.forEach((initFn) => {
    try {
      initFn();
    } catch (error) {
      console.error("Notepilot module failed to initialize:", error);
    }
  });
};

const AUTH_SESSION_KEY = "notepilot:auth:active-user:v1";
const LEGACY_USERNAME_KEY = "username";

function getActiveUser() {
  return localStorage.getItem(AUTH_SESSION_KEY);
}

function requireAuthSession() {
  const activeUser = getActiveUser();
  if (!activeUser) {
    window.location.href = "login.html";
    return null;
  }
  localStorage.setItem(LEGACY_USERNAME_KEY, activeUser);
  return activeUser;
}

const savedUsername = requireAuthSession();
const ACTIVE_USER_SLUG = (savedUsername || "guest")
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, "_");

function getUserScopedKey(baseKey) {
  return `notepilot:user:${ACTIVE_USER_SLUG}:${baseKey}`;
}

function safeParseStoredArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const FileDatabase = (() => {
  const DB_NAME = `notepilot-files-db:${ACTIVE_USER_SLUG}`;
  const STORE_NAME = "fileRecords";
  let dbPromise = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getDb() {
    if (!dbPromise) {
      dbPromise = openDatabase();
    }
    return dbPromise;
  }

  async function saveFileData(key, record) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ key, ...record });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function getFileData(key) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function deleteFileData(key) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  return {
    saveFileData,
    getFileData,
    deleteFileData
  };
})();

function escapeText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes))) {
    return "0 B";
  }
  const size = Number(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / (1024 * 102.4)) / 10} MB`;
}

function getFileExtension(fileName) {
  if (!fileName || typeof fileName !== "string") return "";
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return parts.pop().toLowerCase();
}

function getFileIconSvg(extension) {
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return `
      <svg viewBox="0 0 24 24">
        <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M8 16l2.5-2.5L13 16l2-2 2 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
  if (["pdf"].includes(extension)) {
    return `
      <svg viewBox="0 0 24 24">
        <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M8 17h8M8 13h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
  if (["doc", "docx", "txt", "rtf"].includes(extension)) {
    return `
      <svg viewBox="0 0 24 24">
        <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M8 12h8M8 16h8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
  if (["zip", "rar", "7z"].includes(extension)) {
    return `
      <svg viewBox="0 0 24 24">
        <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M11 10h2v2h-2zm0 3h2v2h-2zm0 3h2v2h-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24">
      <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function cleanText(text) {
  return String(text || "")
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSentences(text) {
  const normalized = String(text || "")
    .replace(/([.!?])(?=[A-Z0-9])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0) || [];
}

function countWords(text) {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean).length;
}

function getStopwords() {
  return new Set([
    "the","and","for","that","with","this","from","your","have","are","was","were","but","not","you","about","into","their","they","them","will","can","has","had","our","its","also","use","using","been","more","than","then","very","just","such","over","some","much","many","only","even","when","what","where","while","because","could","would","should","there","here","those","these","after","before","between","through","under","again","each","both","same","any","all","out","too","may","might","must","shall","able","like","well","make","made","does","did","doing","done","get","gets","got"
  ]);
}

function tokenizeMeaningfulWords(text) {
  const stopwords = getStopwords();
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));
}

function buildFrequencyMap(text) {
  const words = tokenizeMeaningfulWords(text);
  const map = {};
  words.forEach((word) => {
    map[word] = (map[word] || 0) + 1;
  });
  const maxFrequency = Math.max(...Object.values(map), 1);
  Object.keys(map).forEach((word) => {
    map[word] = map[word] / maxFrequency;
  });
  return map;
}

function scoreSentences(sentences, frequencyMap) {
  return sentences.map((sentence, index) => {
    const tokens = tokenizeMeaningfulWords(sentence);
    const tokenCount = tokens.length || 1;
    let score = 0;
    tokens.forEach((token) => {
      score += frequencyMap[token] || 0;
    });
    const densityScore = score / tokenCount;
    const lengthPenalty = tokenCount > 32 ? 0.86 : 1;
    const positionBoost = index === 0 || index === sentences.length - 1 ? 1.08 : 1;
    return {
      index,
      sentence,
      tokens,
      score: densityScore * lengthPenalty * positionBoost
    };
  });
}

function getTargetSummarySentenceCount(totalSentences) {
  if (totalSentences <= 4) return 1;
  if (totalSentences <= 10) return 2;
  if (totalSentences <= 18) return 3;
  return 4;
}

function sentenceSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlap = 0;
  setA.forEach((token) => {
    if (setB.has(token)) overlap += 1;
  });
  return overlap / Math.min(setA.size, setB.size);
}

function selectBestSentences(ranked, targetCount) {
  const byScore = [...ranked].sort((a, b) => b.score - a.score);
  const selected = [];
  byScore.forEach((candidate) => {
    if (selected.length >= targetCount) return;
    const tooSimilar = selected.some((picked) => sentenceSimilarity(candidate.tokens, picked.tokens) > 0.72);
    if (!tooSimilar) {
      selected.push(candidate);
    }
  });
  if (selected.length < targetCount) {
    byScore.forEach((candidate) => {
      if (selected.length >= targetCount) return;
      if (!selected.find((item) => item.index === candidate.index)) {
        selected.push(candidate);
      }
    });
  }
  return selected
    .sort((a, b) => a.index - b.index)
    .map((item) => trimSentence(item.sentence));
}

function trimSentence(sentence) {
  return String(sentence || "")
    .replace(/^\s*(and|but|so|because)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFinalSummary(sentences) {
  if (!sentences.length) return "";
  return sentences.join(" ");
}

function getTopKeywords(text, limit = 5) {
  const counts = {};
  tokenizeMeaningfulWords(text).forEach((word) => {
    counts[word] = (counts[word] || 0) + 1;
  });
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, limit);
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.Notepilot.Auth = {
  requireAuthSession,
  getActiveUser,
  savedUsername,
  ACTIVE_USER_SLUG,
  getUserScopedKey
};
window.Notepilot.Storage = {
  safeParseStoredArray
};
window.Notepilot.FileDatabase = FileDatabase;
window.Notepilot.utils = {
  escapeText,
  formatBytes,
  getFileExtension,
  getFileIconSvg,
  cleanText,
  splitIntoSentences,
  countWords,
  getStopwords,
  tokenizeMeaningfulWords,
  buildFrequencyMap,
  scoreSentences,
  getTargetSummarySentenceCount,
  sentenceSimilarity,
  selectBestSentences,
  trimSentence,
  buildFinalSummary,
  getTopKeywords,
  escapeHtml
};

if (savedUsername) {
  const welcomeText = document.getElementById("welcomeText");
  if (welcomeText) {
    welcomeText.textContent = `Welcome, ${savedUsername}`;
  }
}
