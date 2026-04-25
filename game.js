(function () {
  "use strict";

  const STORAGE_KEYS = {
    stars: "frogKing_u4_stars",
    crowns: "frogKing_u4_crowns",
    unlocked: "frogKing_u4_unlocked",
    lastLevel: "frogKing_u4_lastLevel",
    stepIndex: "frogKing_u4_stepIndex",
    levelCheckpoints: "frogKing_u4_levelCheckpoints",
    playerName: "frogKing_u4_playerName",
    leaderboard: "frogKing_u4_leaderboard",
    playerId: "frogKing_u4_playerId",
    cloudUrl: "frogKing_cloud_url",
    cloudKey: "frogKing_cloud_key",
  };
  const CLOUD_CFG = window.FROG_KING_CLOUD || {};
  let SUPABASE_URL = "";
  let SUPABASE_ANON_KEY = "";
  let CLOUD_ENABLED = false;
  const MAX_LEVEL = 18;

  function refreshCloudConfig() {
    const localUrl = (localStorage.getItem(STORAGE_KEYS.cloudUrl) || "").trim();
    const localKey = (localStorage.getItem(STORAGE_KEYS.cloudKey) || "").trim();
    const baseUrl = localUrl || String(CLOUD_CFG.supabaseUrl || "");
    const baseKey = localKey || String(CLOUD_CFG.supabaseAnonKey || "");
    SUPABASE_URL = String(baseUrl || "").replace(/\/+$/, "");
    SUPABASE_ANON_KEY = String(baseKey || "");
    CLOUD_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  }
  refreshCloudConfig();

  const WORDS = [
    { en: "join", zh: "加入", emoji: "🤝", sentenceEn: "Do you want to join us?", sentenceZh: "你想加入我们吗？" },
    { en: "sure", zh: "当然", emoji: "✅", sentenceEn: "Are you sure?", sentenceZh: "你确定吗？" },
    { en: "love", zh: "喜欢", emoji: "❤️", sentenceEn: "I love football.", sentenceZh: "我喜欢足球。" },
    { en: "football", zh: "足球", emoji: "⚽", sentenceEn: "Football looks like fun.", sentenceZh: "足球看起来很有趣。" },
    { en: "just", zh: "只是", emoji: "🎯", sentenceEn: "No thanks... football is just not my thing.", sentenceZh: "不用了……足球不太适合我。" },
    { en: "thing", zh: "事情", emoji: "📦", sentenceEn: "That is not my thing.", sentenceZh: "那不是我的菜。" },
    { en: "fun", zh: "乐趣", emoji: "🎉", sentenceEn: "That looks like fun.", sentenceZh: "看起来很有趣。" },
    { en: "ask", zh: "问", emoji: "❓", sentenceEn: "Can I ask her?", sentenceZh: "我能问她吗？" },
    { en: "her", zh: "她", emoji: "👧", sentenceEn: "Can I join her?", sentenceZh: "我能加入她吗？" },
    { en: "idea", zh: "主意", emoji: "💡", sentenceEn: "That is a good idea.", sentenceZh: "这是个好主意。" },
    { en: "eat", zh: "吃", emoji: "🍽️", sentenceEn: "Do you want to eat?", sentenceZh: "你想吃东西吗？" },
    { en: "together", zh: "一起", emoji: "👫", sentenceEn: "We can eat together.", sentenceZh: "我们可以一起吃。" },
  ];

  const ABC = "abcdefghijklmnopqrstuvwxyz".split("");
  const PRAISE_LINES = ["真棒！", "太厉害啦！", "学术蛙进化中！", "继续保持！", "答得漂亮！"];
  const RETRY_LINES = ["没关系，再试一次就会了！", "你已经很接近了！", "稳住，我们马上答对！", "再想一想，你可以的！", "好样的，坚持就是胜利！"];
  const LEVEL_START_CELEBRATIONS = {
    10: "蛙长出身体啦！",
    11: "蛙长出左手！",
    12: "蛙长出右手！",
    13: "蛙长出左脚！",
    14: "蛙长出右脚！",
    15: "我的蛙终于身体完整了！",
    17: "我的蛙又拿到了一个苹果！",
  };
  const VIDEO_EPISODE_CELEBRATIONS = [
    "记忆蛙 +1！这一集拿下啦！",
    "学术蛙状态拉满，三题全过！",
    "太稳了！你的记忆力正在发光！",
    "精彩！又解锁一段视频记忆！",
  ];

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function tokenizeSentence(text) {
    return (text.match(/\b[\w']+\b|[?.!,]/g) || []).map((x) => x.trim()).filter(Boolean);
  }

  function normalizeSpeechText(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/\.{2,}/g, " ")
      .replace(/[^\w\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshteinDistance(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function calcSpeechSimilarity(targetRaw, spokenRaw) {
    const target = normalizeSpeechText(targetRaw);
    const spoken = normalizeSpeechText(spokenRaw);
    if (!target || !spoken) return 0;
    const maxLen = Math.max(target.length, spoken.length) || 1;
    const editScore = 1 - levenshteinDistance(target, spoken) / maxLen;
    const targetTokens = target.split(" ").filter(Boolean);
    const spokenTokens = spoken.split(" ").filter(Boolean);
    const hit = targetTokens.filter((t) => spokenTokens.includes(t)).length;
    const tokenScore = targetTokens.length ? hit / targetTokens.length : 0;
    return Math.max(0, Math.min(1, Math.max(editScore, tokenScore)));
  }

  function estimateSpeechDurationMs(targetRaw) {
    const text = normalizeSpeechText(targetRaw);
    if (!text) return 1800;
    const words = text.split(" ").filter(Boolean).length;
    const byWords = words * 850 + 500;
    const byChars = text.length * 85 + 700;
    return Math.max(1400, Math.min(7000, Math.round(Math.max(byWords, byChars))));
  }

  async function listenVoiceWithFallback(durationMs) {
    let heard = false;
    let transcript = "";
    let meterTimer = null;
    let meterStream = null;
    let meterCtx = null;
    let meterSource = null;
    let analyser = null;
    let recog = null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        meterStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          meterCtx = new Ctx();
          meterSource = meterCtx.createMediaStreamSource(meterStream);
          analyser = meterCtx.createAnalyser();
          analyser.fftSize = 1024;
          meterSource.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          meterTimer = setInterval(() => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            if (rms > 0.02) heard = true;
          }, 80);
        }
      }
    } catch (_) {
      // 麦克风能量检测失败时继续用语音识别文本兜底
    }

    if (SpeechRecognition) {
      try {
        recog = new SpeechRecognition();
        recog.lang = "en-US";
        recog.interimResults = true;
        recog.continuous = true;
        recog.maxAlternatives = 1;
        recog.onresult = (ev) => {
          let merged = "";
          for (let i = 0; i < ev.results.length; i++) {
            const alt = ev.results[i] && ev.results[i][0];
            if (alt && alt.transcript) merged += " " + alt.transcript;
          }
          transcript = merged.trim();
        };
        recog.start();
      } catch (_) {
        recog = null;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, durationMs));

    try {
      if (recog) recog.stop();
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 180));

    if (meterTimer) clearInterval(meterTimer);
    if (meterStream) meterStream.getTracks().forEach((t) => t.stop());
    try {
      if (meterSource) meterSource.disconnect();
      if (analyser) analyser.disconnect();
      if (meterCtx && meterCtx.state !== "closed") meterCtx.close();
    } catch (_) {}

    return { heard, transcript };
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function loadNumber(key, fallback) {
    const raw = localStorage.getItem(key);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function loadState() {
    return {
      stars: clampStarsToCap(loadNumber(STORAGE_KEYS.stars, 0)),
      crowns: loadNumber(STORAGE_KEYS.crowns, 0),
      unlockedLevel: Math.min(MAX_LEVEL, Math.max(1, loadNumber(STORAGE_KEYS.unlocked, MAX_LEVEL))),
      currentLevel: Math.min(MAX_LEVEL, Math.max(1, loadNumber(STORAGE_KEYS.lastLevel, 1))),
      currentStepIndex: Math.max(0, loadNumber(STORAGE_KEYS.stepIndex, 0)),
    };
  }

  function loadLevelCheckpointsObject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.levelCheckpoints) || "{}";
      const o = JSON.parse(raw);
      return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (_) {
      return {};
    }
  }

  let levelCheckpointById = loadLevelCheckpointsObject();

  function persistLevelCheckpoints() {
    try {
      localStorage.setItem(STORAGE_KEYS.levelCheckpoints, JSON.stringify(levelCheckpointById));
    } catch (_) {}
  }

  function getCheckpointForLevelId(level) {
    const v = levelCheckpointById[String(level)];
    if (v == null) return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  }

  function setCheckpointForLevelId(level, stepIdx) {
    levelCheckpointById[String(level)] = stepIdx;
    persistLevelCheckpoints();
  }

  function clearCheckpointForLevelId(level) {
    delete levelCheckpointById[String(level)];
    persistLevelCheckpoints();
  }

  function clampStepIndexForLevel(level, step) {
    const L = LEVELS[level - 1];
    if (!L || !L.steps || L.steps.length === 0) return 0;
    return Math.min(L.steps.length - 1, Math.max(0, step));
  }

  function resolveStepIndexWhenPickingLevel(targetLevel) {
    const cp = getCheckpointForLevelId(targetLevel);
    if (cp != null) {
      return clampStepIndexForLevel(targetLevel, cp);
    }
    return 0;
  }

  function applyLevelChoiceInUi(targetLevel) {
    if (state.currentLevel === targetLevel) return;
    state.currentLevel = targetLevel;
    state.currentStepIndex = resolveStepIndexWhenPickingLevel(targetLevel);
    currentStepResult = null;
    saveState(state);
    renderCurrentStep();
  }

  function saveState(state) {
    state.stars = clampStarsToCap(state.stars);
    state.unlockedLevel = MAX_LEVEL;
    localStorage.setItem(STORAGE_KEYS.stars, String(state.stars));
    localStorage.setItem(STORAGE_KEYS.crowns, String(state.crowns));
    localStorage.setItem(STORAGE_KEYS.unlocked, String(state.unlockedLevel));
    localStorage.setItem(STORAGE_KEYS.lastLevel, String(state.currentLevel));
    localStorage.setItem(STORAGE_KEYS.stepIndex, String(state.currentStepIndex));
    scheduleCloudPlayerStateSync();
  }

  function loadPlayerName() {
    return (localStorage.getItem(STORAGE_KEYS.playerName) || "").trim();
  }

  function loadPlayerId() {
    const old = (localStorage.getItem(STORAGE_KEYS.playerId) || "").trim();
    if (old) return old;
    const id = "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(STORAGE_KEYS.playerId, id);
    return id;
  }

  function savePlayerId(id) {
    if (!id) return;
    localStorage.setItem(STORAGE_KEYS.playerId, id);
  }

  function savePlayerName(name) {
    localStorage.setItem(STORAGE_KEYS.playerName, name);
  }

  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      let dirty = false;
      const mapped = arr
        .filter((x) => x && typeof x.name === "string")
        .map((x) => {
          const starsRaw = Math.max(0, Number(x.stars) || 0);
          const stars = clampStarsToCap(starsRaw);
          if (stars !== starsRaw) dirty = true;
          return {
            playerId: String(x.playerId || ""),
            name: String(x.name).trim(),
            stars,
            crowns: Math.max(0, Number(x.crowns) || 0),
            updatedAt: Number(x.updatedAt) || Date.now(),
          };
        })
        .filter((x) => x.name);
      const list = mapped.filter((x) => x.stars >= LEADERBOARD_MIN_STARS);
      if (list.length !== mapped.length) dirty = true;
      if (dirty) {
        localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(list));
      }
      return list;
    } catch (_) {
      return [];
    }
  }

  function saveLeaderboard(list) {
    const capped = list
      .map((row) => Object.assign({}, row, { stars: clampStarsToCap(row.stars) }))
      .filter((row) => row.stars >= LEADERBOARD_MIN_STARS);
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(capped));
    return capped;
  }

  function cloudHeaders(extra) {
    return Object.assign(
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      extra || {}
    );
  }

  const dictionaryAudioCache = new Map();
  const resolvedAudioByText = new Map();
  const preloadedAudioObjects = new Map();
  let lastAutoAudioText = "";
  let lastAutoAudioAt = 0;
  const L18_ANSWER_AUDIO_RATE = 1.14;
  const L18_ANSWER_TTS_RATE = 1.12;

  function playAudioUrl(url, playOpts) {
    return new Promise((resolve, reject) => {
      const a = new Audio(url);
      const r = playOpts && Number(playOpts.playbackRate) > 0 ? Number(playOpts.playbackRate) : 1;
      try {
        a.playbackRate = r;
      } catch (_) {
        // ignore
      }
      a.addEventListener("ended", resolve);
      a.addEventListener("error", reject);
      a.play().catch(reject);
    });
  }

  async function fetchDictionaryAudioUrl(word) {
    const w = word.toLowerCase().trim();
    if (!w || /\s/.test(w)) return null;
    if (dictionaryAudioCache.has(w)) return dictionaryAudioCache.get(w);
    try {
      const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w));
      if (!res.ok) return null;
      const data = await res.json();
      const first = data && data[0];
      const aud = (first?.phonetics || []).find((x) => x.audio)?.audio || null;
      if (aud) dictionaryAudioCache.set(w, aud);
      return aud;
    } catch (_) {
      return null;
    }
  }

  function normalizedPhrase(raw) {
    return raw
      .replace(/\.{2,}/g, " ")
      .replace(/[^\w\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function resolveHumanAudioCandidates(text) {
    const raw = (text || "").trim();
    if (!raw) return [];
    const isPhrase = /\s/.test(raw);
    const urls = [];
    if (!isPhrase) {
      const api = await fetchDictionaryAudioUrl(raw);
      if (api) urls.push(api);
      urls.push("https://ssl.gstatic.com/dictionary/static/sounds/20200429/" + encodeURIComponent(raw.toLowerCase()) + "--_us_1.mp3");
      urls.push("https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(raw) + "&type=2");
      urls.push("https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(raw) + "&type=1");
      urls.push("https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=" + encodeURIComponent(raw));
      return urls;
    }
    const clean = normalizedPhrase(raw);
    urls.push("https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(clean || raw) + "&type=2");
    urls.push("https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(clean || raw) + "&type=1");
    urls.push("https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=" + encodeURIComponent(clean || raw));
    return urls;
  }

  async function playEnglishAudio(text, playOpts) {
    const raw = (text || "").trim();
    if (!raw) return null;
    const candidates = resolvedAudioByText.get(raw) || (await resolveHumanAudioCandidates(raw));
    if (!resolvedAudioByText.has(raw)) resolvedAudioByText.set(raw, candidates);
    for (const url of candidates) {
      try {
        await playAudioUrl(url, playOpts);
        return true;
      } catch (_) {
        continue;
      }
    }
    return false;
  }

  function speakFallback(text, opts) {
    if (!window.speechSynthesis) return false;
    const raw = (text || "").trim();
    if (!raw) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(raw);
    u.lang = "en-US";
    u.rate = opts && typeof opts.rate === "number" ? opts.rate : 0.95;
    window.speechSynthesis.speak(u);
    return true;
  }

  function speakChineseTTS(text) {
    if (!window.speechSynthesis) return;
    const raw = String(text || "").trim();
    if (!raw) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(raw);
    u.lang = "zh-CN";
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
  }

  function isLevel16PraiseStepKind(kind) {
    return kind === "L16" || kind === "L16R" || kind === "L16R2" || kind === "L16TF";
  }

  /** 第16关：每选对一小题（中文人声「呱呱」） */
  function speakLevel16SubCorrect() {
    if (state.currentLevel !== 16) return;
    speakChineseTTS("呱呱");
  }

  /** 第16关一大题全对：先「呱呱」再英文「A+」（子题最后一步只走 markCorrect，须在此补 呱呱） */
  function speakLevel16GuaguaThenStepPass() {
    if (!window.speechSynthesis) {
      speakLevel16StepPass();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("呱呱");
    u.lang = "zh-CN";
    u.rate = 0.98;
    const after = () => {
      speakLevel16StepPass();
    };
    u.onend = after;
    u.onerror = after;
    window.speechSynthesis.speak(u);
  }

  /** 第16关一大题全对：仅英文「A+」 */
  function speakLevel16StepPass() {
    speakFallback("A+");
  }

  function getLevel18AnswerSpeakText(step) {
    if (!step) return "";
    if (step.kind === "L18IMG" || step.kind === "L18C") return String(step.target || "").trim();
    if (step.kind === "W3" && step.word) return String(step.word.en || "").trim();
    if (step.kind === "L18F") return String(step.en || "").trim();
    return "";
  }

  /** 第18关每题答对：朗读本题正确答案（略快、启动时已预缓外链） */
  function playLevel18CorrectAnswerAudio(step) {
    const text = getLevel18AnswerSpeakText(step);
    if (!text) return;
    const playOpts = { playbackRate: L18_ANSWER_AUDIO_RATE };
    void (async () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      const ok = await playEnglishAudio(text, playOpts);
      if (!ok) speakFallback(text, { rate: L18_ANSWER_TTS_RATE });
    })();
  }

  async function playEnglishAudioGuaranteed(text) {
    const raw = (text || "").trim();
    if (!raw) return false;
    const now = Date.now();
    if (lastAutoAudioText === raw && now - lastAutoAudioAt < 1800) {
      return false;
    }
    const ok = await playEnglishAudio(raw);
    if (ok) {
      lastAutoAudioText = raw;
      lastAutoAudioAt = now;
      return true;
    }
    // 禁用 TTS 回退，确保只有人声
    return false;
  }

  async function warmAndPreloadEnglishText(text) {
    const raw = (text || "").trim();
    if (!raw) return;
    if (preloadedAudioObjects.has(raw)) return;
    const candidates = await resolveHumanAudioCandidates(raw);
    const verified = [];
    for (const url of candidates) {
      const ok = await new Promise((resolve) => {
        const a = new Audio();
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          resolve(v);
        };
        a.addEventListener("canplaythrough", () => finish(true), { once: true });
        a.addEventListener("error", () => finish(false), { once: true });
        setTimeout(() => finish(false), 2200);
        a.src = url;
        a.load();
      });
      if (ok) verified.push(url);
    }
    const finalList = verified.length ? verified : candidates;
    resolvedAudioByText.set(raw, finalList);
    if (!finalList.length) return;
    const a = new Audio(finalList[0]);
    a.preload = "auto";
    a.load();
    preloadedAudioObjects.set(raw, a);
  }

  async function preloadHumanAudio() {
    const texts = new Set();
    WORDS.forEach((w) => {
      texts.add(w.en);
      texts.add(w.sentenceEn);
    });
    for (const text of texts) {
      await warmAndPreloadEnglishText(text);
    }
  }

  /** 第18关可能朗读的全部词/句：启动时预拉取，答对时播放更快 */
  async function preloadLevel18AnswerAudio() {
    const texts = new Set();
    L18_VOCAB.forEach((w) => texts.add(w.en));
    L18_PHRASE_ROWS.forEach((r) => texts.add(r.en));
    for (const text of texts) {
      await warmAndPreloadEnglishText(text);
    }
  }

  function playDingDong() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);

    const osc1 = ctx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(880, now);
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.16);

    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1175, now + 0.19);
    osc2.connect(gain);
    osc2.start(now + 0.19);
    osc2.stop(now + 0.5);
  }

  function getWordPair(level) {
    const start = ((level - 1) * 2) % WORDS.length;
    return [WORDS[start], WORDS[(start + 1) % WORDS.length]];
  }

  function wrongWords(target, n) {
    return shuffle(WORDS.map((w) => w.en).filter((w) => w !== target)).slice(0, n);
  }

  function buildMissingLetterTasks(word) {
    const letters = word.en.toLowerCase().split("");
    const base = letters.map((ch, i) => {
      const chars = new Set([ch]);
      shuffle(ABC).forEach((x) => {
        if (chars.size < 4) chars.add(x);
      });
      const options = shuffle(Array.from(chars));
      const pattern = letters.map((c, idx) => (idx === i ? "_" : c)).join("");
      return { missing: ch, options, pattern };
    });
    const bonus = shuffle(base.slice())
      .slice(0, 3)
      .map((task) => ({ ...task, options: shuffle(task.options.slice()) }));
    return base.concat(bonus);
  }

  function buildWordBlock(word, groupName) {
    const sentenceTokens = tokenizeSentence(word.sentenceEn);
    const pattern = new RegExp("\\b" + escapeRegExp(word.en) + "\\b", "i");
    const sentenceBlank = word.sentenceEn.replace(pattern, "______");
    const sentenceWordOptions = shuffle([word.en, ...wrongWords(word.en, 3)]);
    return [
      { kind: "W1", cat: "word", title: groupName + " · 听音识图", word, emojis: shuffle([word.emoji, ...shuffle(WORDS.map((w) => w.emoji).filter((e) => e !== word.emoji)).slice(0, 3)]) },
      { kind: "W2", cat: "word", title: groupName + " · 中译英", word, options: shuffle([word.en, ...wrongWords(word.en, 3)]) },
      { kind: "P1", cat: "speaking", title: groupName + " · 口语跟读（单词）", target: word.en, hintZh: "请跟读这个新单词", word },
      { kind: "W3", cat: "word", title: groupName + " · 填漏字母", word, tasks: buildMissingLetterTasks(word) },
      { kind: "S1", cat: "sentence", title: groupName + " · 拖拽填空", word, sentenceBlank, sentenceZh: word.sentenceZh, options: sentenceWordOptions },
      { kind: "S2", cat: "sentence", title: groupName + " · 听力拼句", word, sentence: word.sentenceEn, tokens: sentenceTokens },
      { kind: "S3", cat: "sentence", title: groupName + " · 句子中译英", word, sentence: word.sentenceEn, sentenceZh: word.sentenceZh, tokens: sentenceTokens },
      { kind: "P2", cat: "speaking", title: groupName + " · 口语跟读（句子）", target: word.sentenceEn, hintZh: "请跟读这个新句子", word },
    ];
  }

  function buildExtraWordExamSteps(wordA, wordB) {
    return [
      { kind: "D1", cat: "word", title: "听写挑战 · 新词1", word: wordA, letters: shuffle(wordA.en.split("")) },
      { kind: "D2", cat: "word", title: "听写挑战 · 新词2", word: wordB, letters: shuffle(wordB.en.split("")) },
      { kind: "M1", cat: "word", title: "默写挑战 · 新词1", word: wordA },
      { kind: "M2", cat: "word", title: "默写挑战 · 新词2", word: wordB },
    ];
  }

  const REVIEW_BANK = [
    { en: "love", zh: "喜欢" },
    { en: "I'd", zh: "我会 / 我愿意（I would）" },
    { en: "I'd love to!", zh: "我很乐意！" },
    { en: "Do you want to join us?", zh: "你想加入我们吗？" },
    { en: "Do you want to try?", zh: "你想试试吗？" },
    { en: "Can I join you?", zh: "我能加入你们吗？" },
    { en: "You're up next!", zh: "下一个到你啦！" },
    { en: "Come and play!", zh: "来玩吧！" },
    { en: "No thanks... football is just not my thing.", zh: "不用了……足球不太适合我。" },
    { en: "That looks like fun.", zh: "看起来很有趣。" },
    { en: "Can I have a turn?", zh: "能轮到我吗？" },
    { en: "You can go first.", zh: "你先请。" },
  ];

  function pickReviewSlice(level) {
    const start = level === 7 ? 0 : 4;
    return REVIEW_BANK.slice(start, start + 8);
  }

  function buildReviewLevelSteps(level, wordA, wordB) {
    const S = [
      { en: "Do you want to join us?", zh: "你想加入我们吗？" },
      { en: "Do you want to try?", zh: "你想试试吗？" },
      { en: "Can I join you?", zh: "我能加入你们吗？" },
      { en: "You're up next!", zh: "下一个到你啦！" },
      { en: "Come and play!", zh: "来玩吧！" },
      { en: "I'd love to!", zh: "我很乐意！" },
      { en: "No thanks... football is just not my thing.", zh: "不用了……足球不太适合我。" },
      { en: "That looks like fun.", zh: "看起来很有趣。" },
      { en: "Can I have a turn?", zh: "能轮到我吗？" },
      { en: "You can go first.", zh: "你先请。" },
    ];
    const mkEnOptions = (target) => shuffle([target, ...shuffle(S.map((x) => x.en).filter((x) => x !== target)).slice(0, 3)]);
    const mkZhOptions = (target) => shuffle([target, ...shuffle(S.map((x) => x.zh).filter((x) => x !== target)).slice(0, 3)]);
    const themedScenes = [
      { sceneKey: "classroom", scene: "课室里，青蛙同学在晨读。", speakerEmoji: "🐸👧🐸👦🐸" },
      { sceneKey: "school", scene: "学校门口，青蛙们集合。", speakerEmoji: "🐸🐸🐸🐸" },
      { sceneKey: "playground", scene: "操场上，大家在热身。", speakerEmoji: "🐸👦⚽🐸" },
      { sceneKey: "gym", scene: "体育馆里，轮流练习。", speakerEmoji: "🐸🏀🐸🏓" },
      { sceneKey: "art", scene: "艺术馆里，青蛙们看展板。", speakerEmoji: "🐸🎨🐸🖼️" },
    ];
    const sceneAt = (idx) => themedScenes[idx % themedScenes.length];
    const plan = level === 7
      ? [
          { kind: "RV1", title: "复习1 · 中译英", prompt: "“我很乐意！” 的英文是？", target: S[5].en },
          { kind: "P2", title: "口语1 · 跟读句子", target: S[5].en, hintZh: "请跟读这句英文" },
          { kind: "RV1", title: "复习2 · 中译英", prompt: "“来玩吧！” 的英文是？", target: S[4].en },
          { kind: "RV2", title: "复习3 · 英译中", prompt: "“That looks like fun.” 的中文是？", target: S[7].zh, autoSpeak: S[7].en },
          { kind: "RV1", title: "复习4 · 中译英", prompt: "“你想试试吗？” 的英文是？", target: S[1].en },
          { kind: "RV3", title: "复习5 · 句子拼排", sentence: S[0].en },
          { kind: "P2", title: "口语2 · 跟读句子", target: S[0].en, hintZh: "请跟读这句英文" },
          { kind: "RV4", title: "复习6 · 听力拼句", sentence: S[4].en },
          { kind: "RV2", title: "复习7 · 英译中", prompt: "“Can I join you?” 的中文是？", target: S[2].zh, autoSpeak: S[2].en },
          { kind: "RV1", title: "复习8 · 中译英", prompt: "“下一个到你啦！” 的英文是？", target: S[3].en },
          { kind: "RV4", title: "复习9 · 听力拼句", sentence: S[5].en },
          { kind: "RV3", title: "复习10 · 句子拼排", sentence: S[8].en },
          { kind: "RV1", title: "复习11 · 中译英", prompt: "“你先请。” 的英文是？", target: S[9].en },
          { kind: "RV2", title: "复习12 · 英译中", prompt: "“Do you want to join us?” 的中文是？", target: S[0].zh, autoSpeak: S[0].en },
          { kind: "RV4", title: "复习13 · 听力拼句", sentence: S[1].en },
          { kind: "RV3", title: "复习14 · 句子拼排", sentence: S[7].en },
          { kind: "RV1", title: "复习15 · 中译英", prompt: "“不用了……足球不太适合我。” 的英文是？", target: S[6].en },
          { kind: "RV1", title: "收官 · 趣味应用", prompt: "“来玩吧！” 的英文是？", target: S[4].en },
        ]
      : [
          { kind: "RV1", title: "复习1 · 中译英", prompt: "“来玩吧！” 的英文是？", target: S[4].en },
          { kind: "P2", title: "口语1 · 跟读句子", target: S[4].en, hintZh: "请跟读这句英文" },
          { kind: "RV2", title: "复习2 · 英译中", prompt: "“Do you want to join us?” 的中文是？", target: S[0].zh, autoSpeak: S[0].en },
          { kind: "RV3", title: "复习3 · 句子拼排", sentence: S[2].en },
          { kind: "RV4", title: "复习4 · 听力拼句", sentence: S[3].en },
          { kind: "P2", title: "口语2 · 跟读句子", target: S[3].en, hintZh: "请跟读这句英文" },
          { kind: "RV1", title: "复习5 · 中译英", prompt: "“我很乐意！” 的英文是？", target: S[5].en },
          { kind: "RV2", title: "复习6 · 英译中", prompt: "“No thanks... football is just not my thing.” 的中文是？", target: S[6].zh, autoSpeak: S[6].en },
          { kind: "RV3", title: "复习7 · 句子拼排", sentence: S[4].en },
          { kind: "RV4", title: "复习8 · 听力拼句", sentence: S[7].en },
          { kind: "RV1", title: "复习9 · 中译英", prompt: "“能轮到我吗？” 的英文是？", target: S[8].en },
          { kind: "RV1", title: "复习10 · 中译英", prompt: "“你先请。” 的英文是？", target: S[9].en },
          { kind: "RV3", title: "复习11 · 句子拼排", sentence: S[0].en },
          { kind: "RV4", title: "复习12 · 听力拼句", sentence: S[2].en },
          { kind: "RV2", title: "复习13 · 英译中", prompt: "“You're up next!” 的中文是？", target: S[3].zh, autoSpeak: S[3].en },
          { kind: "RV3", title: "复习14 · 句子拼排", sentence: S[9].en },
          { kind: "RV4", title: "复习15 · 听力拼句", sentence: S[4].en },
          { kind: "RV1", title: "收官 · 趣味应用", prompt: "“看起来很有趣。” 的英文是？", target: S[7].en },
        ];
    return plan.map((item, idx) => ({
      cat: "sentence",
      ...item,
      options: item.kind === "RV1" ? mkEnOptions(item.target) : item.kind === "RV2" ? mkZhOptions(item.target) : undefined,
      tokens: item.sentence ? tokenizeSentence(item.sentence) : undefined,
      ...sceneAt(idx),
    }));
  }

  function buildAdvancedLevelSteps(level, wordA, wordB) {
    const extras = ["Come and play!", "I'd love to!", "That looks like fun.", "You can go first.", "Can I have a turn?", "Do you want to try?"];
    const pick = (correct) => shuffle([correct, ...shuffle(extras.filter((x) => x !== correct)).slice(0, 3)]);
    const politeA2Step =
      level === 9
        ? {
            kind: "A2",
            cat: "dialogue",
            title: "礼貌场景 · 滑滑梯",
            scene: "你和许多青蛙冲向游乐园，你和美丽蛙几乎同一时间到滑滑梯面前，这时候你想让美丽蛙先来，你可以对美丽蛙说：",
            promptZh: "请选择最合适的一句：",
            sceneKey: "playground",
            sceneDecor: "🛝 🐸🐸 🎈",
            speaker: "美丽蛙",
            speakerEmoji: "🐸👧🐸🐸",
            target: "You can go first.",
            options: ["You can go first.", "Can I have a turn?", "Come and play!", "Do you want to try?"],
          }
        : {
            kind: "A2",
            cat: "dialogue",
            title: "你来开口 · 2",
            scene: "轮到同伴前，你礼貌地说：",
            promptZh: "对美丽蛙说：",
            target: "You can go first.",
            options: pick("You can go first."),
          };

    const scenesByLevel = {
      7: [
        { speaker: "男青蛙阿跳", scene: "操场边，阿跳挥手招呼。", line: "Do you want to join us?", target: "I'd love to!" },
        { speaker: "女青蛙小荷", scene: "跳绳区，小荷在排队。", line: "Can I join you?", target: "You can go first." },
        { speaker: "青蛙们", scene: "游戏摊位前，一群青蛙在喊。", line: "Come and play!", target: "I'd love to!" },
      ],
      8: [
        { speaker: "男青蛙阿跳", scene: "投篮机前轮到你。", line: "You're up next!", target: "Can I have a turn?" },
        { speaker: "女青蛙小荷", scene: "平衡木挑战开始。", line: "Do you want to try?", target: "I'd love to!" },
        { speaker: "青蛙们", scene: "排队游戏时。", line: "Can I have a turn?", target: "You can go first." },
      ],
      9: [
        { speaker: "帅气蛙", speakerEmoji: "🐸👦🐸", scene: "学校门口，青蛙小队约你一起玩。", sceneKey: "school", line: "Do you want to join us?", target: "I'd love to!" },
        { speaker: "美丽蛙", speakerEmoji: "🐸👧🏀🐸", scene: "体育馆里，美丽蛙准备投篮。", sceneKey: "gym", line: "You're up next!", target: "Can I have a turn?" },
        { speaker: "好运蛙", speakerEmoji: "🐸🍀🐸🖼️", scene: "艺术馆里，好运蛙和同伴看互动展板。", sceneKey: "art", line: "Come and play!", target: "That looks like fun." },
      ],
      10: [
        { speaker: "爱吃蛙", speakerEmoji: "🐸🍔🐸", scene: "课室任务发布：爱吃蛙邀请你组队闯关。", sceneKey: "classroom", line: "Can I join you?", target: "I'd love to!" },
        { speaker: "棒棒蛙", speakerEmoji: "🐸⭐⚽🐸", scene: "操场接力点，棒棒蛙鼓励你们轮流。", sceneKey: "playground", line: "Can I have a turn?", target: "You can go first." },
        { speaker: "美丽蛙", speakerEmoji: "🐸👧🎉🐸", scene: "终点舞台前，美丽蛙邀请你最终展示。", sceneKey: "final", line: "Do you want to try?", target: "I'd love to!" },
      ],
    };

    const sc = scenesByLevel[level] || scenesByLevel[7];
    const sentenceA = sc[0].line;
    const sentenceB = sc[1].line;
    const sentenceC = sc[2].line;

    const situationSteps = level === 9
      ? [
          {
            kind: "A6",
            cat: "dialogue",
            title: "趣味情景题 · 篮球场",
            sceneKey: "gym",
            scene: "体育馆里，你和帅气蛙在打篮球。",
            speakerEmoji: "🐸👦🏀🐸👧",
            line: "旁边一只青蛙看起来很想加入。",
            story: "你和帅气蛙正在打篮球，旁边的好运蛙一直看着你们，也想一起玩。",
            question: "这时候你最自然地说：",
            target: "Do you want to join us?",
            options: [
              "Do you want to join us?",
              "Can I join you?",
              "That looks like fun.",
              "Can I have a turn?",
            ],
          },
          {
            kind: "A6",
            cat: "dialogue",
            title: "趣味情景题 · 轮流礼貌",
            sceneKey: "playground",
            scene: "操场闯关点，大家排队玩投球游戏。",
            speakerEmoji: "🐸🐸🐸⚽",
            line: "你想让同伴先来，怎么说更礼貌？",
            story: "你和很多青蛙在排队，前面的同伴蛙有点紧张，你想先鼓励他。",
            question: "你应该说：",
            target: "I can go first.",
            options: [
              "I can go first.",
              "Can I have a turn?",
              "Come and play!",
              "Do you want to try?",
            ],
          },
        ]
      : [
          {
            kind: "A6",
            cat: "dialogue",
            title: "趣味情景题 · 艺术馆",
            sceneKey: "art",
            scene: "艺术馆互动墙前，美丽蛙想试试新活动。",
            speakerEmoji: "🐸👧🎨🐸",
            line: "你想邀请她一起挑战。",
            story: "你看到美丽蛙对互动展项很感兴趣，想和她一起尝试。",
            question: "你会先说：",
            target: "Do you want to try?",
            options: [
              "Do you want to try?",
              "Can I join you?",
              "That looks like fun.",
              "You can go first.",
            ],
          },
          {
            kind: "A6",
            cat: "dialogue",
            title: "趣味情景题 · 校园游戏日",
            sceneKey: "school",
            scene: "学校游戏日，青蛙们在喊你一起加入。",
            speakerEmoji: "🐸🐸🐸🏫",
            line: "你非常愿意参加。",
            story: "大家都在等你开口，你想积极回应并马上加入。",
            question: "你最自然的回答是：",
            target: "I'd love to!",
            options: [
              "I'd love to!",
              "No thanks... football is just not my thing.",
              "Can I have a turn?",
              "Do you want to join us?",
            ],
          },
        ];

    return [
      { kind: "A1", cat: "dialogue", title: "情境回应 · 1", ...sc[0], options: pick(sc[0].target) },
      {
        kind: "A2",
        cat: "dialogue",
        title: "你来开口 · 1",
        scene: "你想加入他们，应该怎么说？",
        promptZh: "对" + (sc[0].speaker || "同伴蛙") + "说：",
        target: "Can I join you?",
        options: pick("Can I join you?"),
      },
      { kind: "P2", cat: "speaking", title: "口语1 · 跟读句子", target: "Can I join you?", hintZh: "请跟读你刚刚选择的句子" },
      { kind: "A1", cat: "dialogue", title: "情境回应 · 2", ...sc[1], options: pick(sc[1].target) },
      { kind: "A3", cat: "dialogue", title: "对话拼句 · 1", speaker: "你", targetSentence: "Can I join you?" },
      ...situationSteps,
      { kind: "A1", cat: "dialogue", title: "情境回应 · 3", ...sc[2], options: pick(sc[2].target) },
      politeA2Step,
      { kind: "A4", cat: "sentence", title: "听力拼句 · 应用1", sentence: sentenceA, tokens: tokenizeSentence(sentenceA) },
      { kind: "A4", cat: "sentence", title: "听力拼句 · 应用2", sentence: sentenceB, tokens: tokenizeSentence(sentenceB) },
      { kind: "P2", cat: "speaking", title: "口语2 · 跟读句子", target: sentenceB, hintZh: "请跟读这个应用句子" },
      { kind: "A2", cat: "dialogue", title: "生活应用 · 选择自然回应", scene: "看到青蛙们在玩新游戏。", promptZh: "你先评价：", target: "That looks like fun.", options: pick("That looks like fun.") },
      { kind: "A3", cat: "dialogue", title: "对话拼句 · 2", speaker: "你", targetSentence: sentenceC },
      { kind: "A4", cat: "sentence", title: "听力拼句 · 复现1", sentence: "Do you want to try?", tokens: tokenizeSentence("Do you want to try?") },
      { kind: "A4", cat: "sentence", title: "听力拼句 · 复现2", sentence: "Come and play!", tokens: tokenizeSentence("Come and play!") },
      { kind: "A3", cat: "dialogue", title: "对话拼句 · 复现3", speaker: "你", targetSentence: "You can go first." },
      { kind: "A3", cat: "dialogue", title: "对话拼句 · 复现4", speaker: "你", targetSentence: "Can I have a turn?" },
      {
        kind: "A5",
        cat: "dialogue",
        title: "双轮对话 · 实战",
        turns: [
          {
            speaker: sc[0].speaker || "同伴蛙",
            line: "Do you want to join us?",
            target: "I'd love to!",
            options: pick("I'd love to!"),
          },
          {
            speaker: sc[1].speaker || "同伴蛙",
            line: "Can I have a turn?",
            target: "You can go first.",
            options: pick("You can go first."),
          },
        ],
      },
      { kind: "A2", cat: "dialogue", title: "最终应用 · 趣味收官", scene: "青蛙大合照前的最后互动。", promptZh: "你大声邀请大家：", target: "Come and play!", options: pick("Come and play!") },
    ];
  }

  function buildDialogueSortLevel11() {
    const inviteQ = ["Do you want to join us?", "Do you want to try?"];
    const inviteR = ["I'd love to!", "No thanks... football is just not my thing."];
    const requestQ = ["Can I join you?", "Can I have a turn?"];
    const requestR = ["Come and play!", "Sorry."];
    const extras = ["You're up next!", "You can go first.", "That looks like fun."];
    const all = [...inviteQ, ...inviteR, ...requestQ, ...requestR, ...extras];
    const pick = (correct) => shuffle([correct, ...shuffle(all.filter((x) => x !== correct)).slice(0, 3)]);
    const pickLabel = (correct) =>
      shuffle([
        correct,
        ...shuffle(["邀请链·对方发出邀请", "邀请链·我回应邀请", "请求链·我发出请求", "请求链·对方回应请求", "功能句"]).filter((x) => x !== correct).slice(0, 3),
      ]);

    return [
      {
        kind: "TIP",
        cat: "dialogue",
        title: "第11关导学 · 先认识两条链",
        scene: "先记住：一条是邀请链，一条是请求链。",
        content:
          "【邀请链】\n" +
          "对方发出邀请：\n" +
          "• Do you want to join us?\n" +
          "• Do you want to try?\n" +
          "我回应邀请：\n" +
          "• I'd love to!\n" +
          "• No thanks... football is just not my thing.",
      },
      {
        kind: "TIP",
        cat: "dialogue",
        title: "第11关导学 · 再认识请求链",
        scene: "下面这组是“我请求 -> 对方回应请求”。",
        content:
          "【请求链】\n" +
          "我发出请求：\n" +
          "• Can I join you?\n" +
          "• Can I have a turn?\n" +
          "对方回应请求：\n" +
          "• Come and play!\n" +
          "• Sorry.\n\n" +
          "【功能句】\n" +
          "• You're up next!\n" +
          "• You can go first.\n" +
          "• That looks like fun.",
      },
      { kind: "RV1", cat: "sentence", title: "高阶辨析1 · 句型归类", prompt: "句子 “Do you want to join us?” 属于哪一类？", target: "邀请链·对方发出邀请", options: pickLabel("邀请链·对方发出邀请"), autoSpeak: "Do you want to join us?", sceneKey: "school", scene: "先判断句子身份，再做配对。", speakerEmoji: "🐸📚🐸" },
      { kind: "RV1", cat: "sentence", title: "高阶辨析2 · 句型归类", prompt: "句子 “Can I have a turn?” 属于哪一类？", target: "请求链·我发出请求", options: pickLabel("请求链·我发出请求"), autoSpeak: "Can I have a turn?", sceneKey: "gym", scene: "注意和邀请句不要混淆。", speakerEmoji: "🐸🏀🐸" },
      { kind: "RV1", cat: "sentence", title: "高阶辨析3 · 句型归类", prompt: "句子 “I'd love to!” 属于哪一类？", target: "邀请链·我回应邀请", options: pickLabel("邀请链·我回应邀请"), autoSpeak: "I'd love to!", sceneKey: "classroom", scene: "这是对邀请的回应，不是请求。", speakerEmoji: "🐸✍️🐸" },
      { kind: "RV1", cat: "sentence", title: "高阶辨析4 · 句型归类", prompt: "句子 “Sorry.” 属于哪一类？", target: "请求链·对方回应请求", options: pickLabel("请求链·对方回应请求"), autoSpeak: "Sorry.", sceneKey: "playground", scene: "这是对请求的拒绝回应。", speakerEmoji: "🐸🙈🐸" },

      { kind: "A2", cat: "dialogue", title: "邀请链1 · 发出邀请", scene: "你和同伴蛙正在玩，旁边小蛙想加入。", promptZh: "你先开口邀请他：", target: "Do you want to join us?", options: pick("Do you want to join us?") },
      { kind: "A2", cat: "dialogue", title: "邀请链2 · 回应邀请", scene: "同伴蛙问你：Do you want to try?", promptZh: "你愿意尝试，回答：", target: "I'd love to!", options: pick("I'd love to!") },
      { kind: "A2", cat: "dialogue", title: "邀请链3 · 婉拒邀请", scene: "同伴蛙再次邀请你踢足球。", promptZh: "你礼貌拒绝：", target: "No thanks... football is just not my thing.", options: pick("No thanks... football is just not my thing.") },

      { kind: "A2", cat: "dialogue", title: "请求链1 · 我发请求", scene: "你想加入同伴蛙的小组。", promptZh: "你该说：", target: "Can I join you?", options: pick("Can I join you?") },
      { kind: "A2", cat: "dialogue", title: "请求链2 · 对方回应同意", scene: "你说了 Can I join you? 后，同伴欢迎你。", promptZh: "对方更自然说：", target: "Come and play!", options: pick("Come and play!") },
      { kind: "A2", cat: "dialogue", title: "请求链3 · 我发请求", scene: "排队游戏中你想轮到你。", promptZh: "你该说：", target: "Can I have a turn?", options: pick("Can I have a turn?") },
      { kind: "A2", cat: "dialogue", title: "请求链4 · 对方回应拒绝", scene: "现在暂时还不能轮到你。", promptZh: "对方更自然说：", target: "Sorry.", options: pick("Sorry.") },

      { kind: "RV1", cat: "sentence", title: "混合干扰1 · 关键区分", prompt: "有人说 “Do you want to try?”，你正在“回应邀请”时应选：", target: "I'd love to!", options: pick("I'd love to!") },
      { kind: "RV1", cat: "sentence", title: "混合干扰2 · 关键区分", prompt: "你要“发出请求去加入”时应选：", target: "Can I join you?", options: pick("Can I join you?") },
      { kind: "RV1", cat: "sentence", title: "混合干扰3 · 关键区分", prompt: "你听到 “Can I have a turn?”，你要“回应请求并同意”应选：", target: "Come and play!", options: pick("Come and play!") },

      { kind: "RV1", cat: "sentence", title: "功能句补强1", prompt: "“下一个该你了！” 的英文是？", target: "You're up next!", options: pick("You're up next!") },
      { kind: "RV1", cat: "sentence", title: "功能句补强2", prompt: "“你先来！” 的英文是？", target: "You can go first.", options: pick("You can go first.") },
      { kind: "RV1", cat: "sentence", title: "功能句补强3", prompt: "“看起来很有趣。” 的英文是？", target: "That looks like fun.", options: pick("That looks like fun.") },

      {
        kind: "A5",
        cat: "dialogue",
        title: "综合实战1 · 邀请链完整对话",
        turns: [
          { speaker: "同伴蛙", line: "Do you want to try?", target: "I'd love to!", options: pick("I'd love to!") },
          { speaker: "同伴蛙", line: "Do you want to join us?", target: "No thanks... football is just not my thing.", options: pick("No thanks... football is just not my thing.") },
        ],
      },
      {
        kind: "A5",
        cat: "dialogue",
        title: "综合实战2 · 请求链完整对话",
        turns: [
          { speaker: "你", line: "Can I join you?", target: "Come and play!", options: pick("Come and play!") },
          { speaker: "你", line: "Can I have a turn?", target: "Sorry.", options: pick("Sorry.") },
        ],
      },
      { kind: "P2", cat: "speaking", title: "口语收官 · 请求句跟读", target: "Can I have a turn?", hintZh: "请跟读请求句" },
    ];
  }

  function buildStoryLevel12() {
    const videos = [
      "assets/videos/episode_1.mp4",
      "assets/videos/episode_2.mp4",
      "assets/videos/episode_3.mp4",
      "assets/videos/episode_4.mp4",
      "assets/videos/episode_5.mp4",
    ];
    const pick = (correct, extras) => shuffle([correct, ...shuffle(extras.filter((x) => x !== correct)).slice(0, 3)]);
    const episodes = [
      {
        id: 1,
        video: videos[0],
        sceneKey: "school",
        scene: "Watch Episode 1 first, then answer 3 questions.",
        subtitles: ["Do you want to join us?", "Yes, I'd love to! Thanks!", "recess"],
        questions: [
          { title: "Video 1 - Q1", prompt: "What is Yiming's first sentence in the video?", target: "Do you want to join us?", options: pick("Do you want to join us?", ["Let's eat together!", "Can I have a turn?", "Come and join us, everyone!"]) },
          { title: "Video 1 - Q2", prompt: "If someone invites you and you want to join, what can you say?", target: "Yes, I'd love to! Thanks!", options: pick("Yes, I'd love to! Thanks!", ["No, thanks! Football is just not my thing.", "You can go first.", "Let me help you."]) },
          { title: "Video 1 - Q3", prompt: "What is the meaning of recess?", target: "break time", options: shuffle(["break time", "lunch", "gym", "after school"]) },
        ],
      },
      {
        id: 2,
        video: videos[1],
        sceneKey: "booth",
        scene: "Watch Episode 2 first, then answer 3 questions.",
        subtitles: ["Can I have a turn?", "That looks like fun. Can I try?", "You can go first."],
        questions: [
          { title: "Video 2 - Q1", prompt: "Which subtitle sentence asks for a turn?", target: "Can I have a turn?", options: pick("Can I have a turn?", ["Do you want to try?", "Let's eat together!", "Come on! Have a try!"]) },
          { title: "Video 2 - Q2", prompt: "Which sentence means the activity looks fun and you want to try?", target: "That looks like fun. Can I try?", options: pick("That looks like fun. Can I try?", ["Do you want to join us?", "Why don't you sit on my back?", "Smile and laugh under the sun."]) },
          { title: "Video 2 - Q3", prompt: "After \"Can I try?\", which subtitle response is correct?", target: "You can go first.", options: pick("You can go first.", ["No, thanks! Football is just not my thing.", "My name is Alice.", "Come and join us, everyone!"]) },
        ],
      },
      {
        id: 3,
        video: videos[2],
        sceneKey: "classroom",
        scene: "Watch Episode 3 first, then answer 3 questions.",
        subtitles: ["Hi, I'm Yiming. Do you want to join us?", "Let's eat together!", "Do you want to try?"],
        questions: [
          { title: "Video 3 - Q1", prompt: "Which subtitle includes self-introduction and invitation?", target: "Hi, I'm Yiming. Do you want to join us?", options: pick("Hi, I'm Yiming. Do you want to join us?", ["My name is Alice.", "Let's eat together!", "Come on! Have a try!"]) },
          { title: "Video 3 - Q2", prompt: "Which subtitle invites people to eat together?", target: "Let's eat together!", options: pick("Let's eat together!", ["Let's play together!", "Do you want to try?", "You can go first."]) },
          { title: "Video 3 - Q3", prompt: "Which subtitle asks someone to try something?", target: "Do you want to try?", options: pick("Do you want to try?", ["Do you want to join us?", "Can I have a turn?", "Why don't you sit on my back?"]) },
        ],
      },
      {
        id: 4,
        video: videos[3],
        sceneKey: "mountain",
        scene: "Watch Episode 4 first, then answer 3 questions.",
        subtitles: ["Why don't you sit on my back?", "Let me help you.", "My name is Alice."],
        questions: [
          { title: "Video 4 - Q1", prompt: "Which subtitle asks someone to sit on your back?", target: "Why don't you sit on my back?", options: pick("Why don't you sit on my back?", ["Come and play!", "My name is Alice.", "Skip and hop, jump and run."]) },
          { title: "Video 4 - Q2", prompt: "Which subtitle shows offering help?", target: "Let me help you.", options: pick("Let me help you.", ["You can go first.", "Can I have a turn?", "Do you want to join us?"]) },
          { title: "Video 4 - Q3", prompt: "Which subtitle sentence is self-introduction?", target: "My name is Alice.", options: pick("My name is Alice.", ["Hi, I'm Yiming. Do you want to join us?", "You can go first.", "Let's eat together!"]) },
        ],
      },
      {
        id: 5,
        video: videos[4],
        sceneKey: "finish",
        scene: "Watch Episode 5 first, then answer 3 questions.",
        subtitles: ["You're up next!", "Smile and laugh under the sun.", "Come and join us, everyone!"],
        questions: [
          { title: "Video 5 - Q1", prompt: "Which subtitle means you are next in line?", target: "You're up next!", options: pick("You're up next!", ["You can go first.", "Let me help you.", "Do you want to try?"]) },
          { title: "Video 5 - Q2", prompt: "Which subtitle describes smiling and laughing under the sun?", target: "Smile and laugh under the sun.", options: pick("Smile and laugh under the sun.", ["Skip and hop, jump and run.", "My name is Alice.", "Can I have a turn?"]) },
          { title: "Video 5 - Q3", prompt: "Which subtitle is the final group invitation?", target: "Come and join us, everyone!", options: pick("Come and join us, everyone!", ["Do you want to join us?", "Come and play!", "Yes, I'd love to! Thanks!"]) },
        ],
      },
    ];

    const steps = [];
    episodes.forEach((ep) => {
      steps.push({
        kind: "VW",
        cat: "story",
        title: "Episode " + ep.id + " - Watch First",
        video: ep.video,
        sceneKey: ep.sceneKey,
        scene: ep.scene,
        subtitles: ep.subtitles,
      });
      ep.questions.forEach((q, idx) => {
        steps.push({
          kind: "VQ",
          cat: "story",
          title: q.title,
          episodeId: ep.id,
          episodeQuestionIndex: idx + 1,
          sceneKey: ep.sceneKey,
          prompt: q.prompt,
          target: q.target,
          options: q.options,
        });
      });
    });

    const intro = {
      kind: "TIP",
      cat: "story",
      title: "Level 12 - Video Memory Challenge",
      scene: "我们来看看青蛙的记忆力，能不能成为真正的学术蛙。",
      content:
        "先看每个视频，再回答3道记忆题。\n" +
        "视频页和答题页分开，先看后答！",
      btnText: "Start Memory Challenge",
    };

    const ending = {
      kind: "RV1",
      cat: "story",
      title: "Final Question - Slogan",
      prompt: "Which sentence is the final slogan?",
      target: "Come and join us, everyone!",
      options: shuffle([
        "Come and join us, everyone!",
        "Do you want to join us?",
        "Come and play!",
        "Let's eat together!",
      ]),
    };

    return [intro, ...steps, ending];
  }

  const READING_LUCY_PASSAGE_1 =
    'Lucy is new at school. She sees some classmates playing hopscotch during lunch break. Tim notices her and smiles. "Hi! I\'m Tim. Do you want to join us?" he asks. Lucy feels shy but nods. "Yes, I\'d love to! Thanks!" she says. The group cheers and teaches her the rules. Soon, Lucy is laughing and hopping with everyone. "Let\'s play together again tomorrow!" says Tim. Lucy feels happy because she made new friends.';

  const READING_PASSAGE_2 =
    'The PE class is learning the Five-Animal Play. Lucas pretends to be a bird, flapping his arms. "Fly like a bird!" he shouts. Yiming copies him and laughs. "Can I try the monkey move?" asks Nikki. "Sure! Jump like a monkey!" says Lucas. Nikki jumps around, and everyone claps. Mulan says, "This is fun! Let\'s all try together!" The students take turns acting like different animals. Even shy Sam joins in and says, "I want to be a tiger next!"';

  const READING_PASSAGE_3 =
    'After school, Amy asks Tom, "Do you want to go swimming?" Tom shakes his head. "No, thanks! Swimming is not my thing," he replies. Amy thinks for a moment. "Why don\'t we ride bikes instead?" she suggests. Tom\'s eyes light up. "Yes, I\'d love to! Let\'s go!" They ride around the park and find other friends playing football. "Do you want to join them later?" asks Tom. "Sure! That sounds fun!" says Amy.';

  const READING_PASSAGE_4 =
    'Yafei is new in Class 3. During break time, he stands alone near the classroom. Lisa walks over and says, "Hi, I\'m Lisa. Can I help you?" Yafei smiles and replies, "Yes, please. Where is the library?" Lisa shows him the way. Then she asks, "Do you want to join our reading group? We meet every Friday." Yafei nods excitedly. "Sure! Thank you!" Now Yafei has friends and loves reading stories with them.';

  const READING_PASSAGE_5 =
    'The students are preparing for a school play. "We need one more actor!" says Emma. "Let\'s ask Leo!" suggests Ben. Leo is drawing quietly in the corner. Emma walks to him and says, "Hey, Leo! Do you want to join us? You can be the tree!" Leo thinks and answers, "Hmm... Okay, I\'ll try!" He wears a green costume and holds paper leaves. During the show, Leo sways and makes everyone laugh. "You\'re amazing!" says Ben. Leo grins, "Teamwork is fun!"';

  function buildReadingLevel14() {
    const pick3 = (correct, pool) => shuffle([correct, ...shuffle(pool.filter((x) => x !== correct)).slice(0, 2)]);
    return [
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 1 · 第1题",
        topic: "主题：邀请新朋友",
        subTopic: "阅读理解 1",
        passage: READING_LUCY_PASSAGE_1,
        prompt: "1. What game are the students playing?",
        target: "Hopscotch",
        optionLetters: ["A", "B", "C"],
        options: pick3("Hopscotch", ["Football", "Hopscotch", "Basketball"]),
        sceneKey: "classroom",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 1 · 第2题",
        topic: "主题：邀请新朋友",
        subTopic: "阅读理解 1",
        passage: READING_LUCY_PASSAGE_1,
        prompt: "2. How does Lucy feel at the end?",
        target: "Happy",
        optionLetters: ["A", "B", "C"],
        options: pick3("Happy", ["Sad", "Happy", "Angry"]),
        sceneKey: "classroom",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 2 · 第1题",
        topic: "主题：尝试新活动",
        subTopic: "阅读理解 2",
        passage: READING_PASSAGE_2,
        prompt: "1. What animal does Nikki imitate?",
        target: "Monkey",
        optionLetters: ["A", "B", "C"],
        options: pick3("Monkey", ["Bird", "Monkey", "Tiger"]),
        sceneKey: "gym",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 2 · 第2题",
        topic: "主题：尝试新活动",
        subTopic: "阅读理解 2",
        passage: READING_PASSAGE_2,
        prompt: "2. Why does Sam feel happy?",
        target: "He joins the activity.",
        optionLetters: ["A", "B", "C"],
        options: pick3("He joins the activity.", ["He wins a game.", "He gets a new book.", "He joins the activity."]),
        sceneKey: "gym",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 3 · 第1题",
        topic: "主题：礼貌拒绝",
        subTopic: "阅读理解 3",
        passage: READING_PASSAGE_3,
        prompt: "1. Why doesn\'t Tom want to swim?",
        target: "He doesn\'t like swimming.",
        optionLetters: ["A", "B", "C"],
        options: pick3("He doesn\'t like swimming.", ["He is tired.", "He doesn\'t like swimming.", "He has homework."]),
        sceneKey: "playground",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 3 · 第2题",
        topic: "主题：礼貌拒绝",
        subTopic: "阅读理解 3",
        passage: READING_PASSAGE_3,
        prompt: "2. What do Amy and Tom do finally?",
        target: "Ride bikes",
        optionLetters: ["A", "B", "C"],
        options: pick3("Ride bikes", ["Go swimming", "Ride bikes", "Play football"]),
        sceneKey: "playground",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 4 · 第1题",
        topic: "主题：帮助新同学",
        subTopic: "阅读理解 4",
        passage: READING_PASSAGE_4,
        prompt: "1. How does Lisa help Yafei?",
        target: "She shows him the library.",
        optionLetters: ["A", "B", "C"],
        options: pick3("She shows him the library.", ["She gives him a book.", "She shows him the library.", "She teaches him math."]),
        sceneKey: "school",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 4 · 第2题",
        topic: "主题：帮助新同学",
        subTopic: "阅读理解 4",
        passage: READING_PASSAGE_4,
        prompt: "2. When does the reading group meet?",
        target: "Every Friday",
        optionLetters: ["A", "B", "C"],
        options: pick3("Every Friday", ["Every Monday", "Every Friday", "Every Sunday"]),
        sceneKey: "school",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 5 · 第1题",
        topic: "主题：团队合作",
        subTopic: "阅读理解 5",
        passage: READING_PASSAGE_5,
        prompt: "1. What role does Leo play in the play?",
        target: "A tree",
        optionLetters: ["A", "B", "C"],
        options: pick3("A tree", ["A lion", "A tree", "A teacher"]),
        sceneKey: "art",
      },
      {
        kind: "RV1",
        cat: "reading",
        title: "阅读理解 5 · 第2题",
        topic: "主题：团队合作",
        subTopic: "阅读理解 5",
        passage: READING_PASSAGE_5,
        prompt: "2. Why does Leo feel happy?",
        target: "He enjoys teamwork.",
        optionLetters: ["A", "B", "C"],
        options: pick3("He enjoys teamwork.", ["He wins a prize.", "He makes new friends.", "He enjoys teamwork."]),
        sceneKey: "art",
      },
    ];
  }

  function buildClozeLevel15() {
    const steps = [];
    const shuffleAll = (arr) => shuffle(arr.slice());

    function addWordBlock(articleNum, articleLabel, template, pool, answers, sceneKey) {
      answers.forEach((target, i) => {
        steps.push({
          kind: "CLZ",
          cat: "cloze",
          title: "二 · 第" + articleNum + "篇 · 第" + (i + 1) + "空",
          sectionTitle: "二、根据上下文，从括号里选择合适的单词填空。",
          articleLabel: articleLabel,
          passageTemplate: template,
          blankIndex: i + 1,
          prompt: "请选择第 " + (i + 1) + " 空的词语",
          clozeType: "word",
          options: shuffleAll(pool),
          target: target,
          sceneKey: sceneKey || "classroom",
        });
      });
    }

    function addDialogueBlock(articleNum, articleLabel, template, pool, answers, sceneKey) {
      answers.forEach((target, i) => {
        const opts = shuffleAll(pool);
        steps.push({
          kind: "CLZ",
          cat: "cloze",
          title: "二 · 第" + articleNum + "篇 · 第" + (i + 1) + "空",
          sectionTitle: "二、根据上下文，从括号里选择合适的单词填空。",
          articleLabel: articleLabel,
          passageTemplate: template,
          blankIndex: i + 1,
          prompt: "请选择第 " + (i + 1) + " 空的句子",
          clozeType: "dialogue",
          optionLetters: ["A", "B", "C", "D"],
          options: opts,
          target: target,
          sceneKey: sceneKey || "classroom",
        });
      });
    }

    const T1 =
      "Lucy has a busy morning. {{1}}, she washes her face. {{2}}, she combs her hair. After that, she {{3}} her teeth. At 7:20, she eats {{4}}. It's time {{5}} go to school. \"Oh no! I'm late {{6}} class!\" she says.";
    addWordBlock(1, "第一篇", T1, ["to", "Then", "First", "breakfast", "for", "brush"], ["First", "Then", "brush", "breakfast", "to", "for"], "classroom");

    const T2 = 'Sam: Hi, Amy! We\'re playing football. {{1}}\nAmy: {{2}} I like football!\nSam: Great! You can kick the ball first.\nAmy: Thanks!';
    const P2 = ["Let's play together!", "Sure! Come and join us!", "No, thanks!", "Do you want to try?"];
    addDialogueBlock(2, "第二篇（对话）", T2, P2, ["Do you want to try?", "Sure! Come and join us!"], "playground");

    const T3 =
      "Tom's morning:\n{{1}}, he gets up at 7:00. {{2}}, he eats {{3}}. After that, he {{4}} his teeth. At 8:00, it's {{5}} for school. He says, \"Can I {{6}} you, Mum?\"";
    addWordBlock(3, "第三篇", T3, ["join", "breakfast", "time", "brush", "Then", "First"], ["First", "Then", "breakfast", "brush", "time", "join"], "classroom");

    const T4 =
      'Nikki: Hi, Lucas! We\'re drawing pictures. {{1}}\nLucas: {{2}} Drawing is fun!\nNikki: Here\'s a red crayon for you.';
    const P4 = ["What time is it?", "Yes, I'd love to!", "Do you want to join us?", "Let me help you."];
    addDialogueBlock(4, "第四篇（对话）", T4, P4, ["Do you want to join us?", "Yes, I'd love to!"], "art");

    const T5 =
      "My morning routine:\n{{1}}, I get dressed. {{2}}, I wash my face. After that, I {{3}} my teeth. At 7:30, I eat {{4}}. It's time {{5}} go to school. I ask my friend, \"Can I {{6}} you?\"";
    addWordBlock(5, "第五篇", T5, ["to", "join", "Then", "breakfast", "First", "brush"], ["First", "Then", "brush", "breakfast", "to", "join"], "school");

    const T6 =
      'Yiming: Look! We\'re jumping rope. {{1}}\nAlice: {{2}} I\'m good at it!\nYiming: Here\'s the rope. You can go first!';
    const P6 = ["No, thanks!", "Sure! Come and play!", "Do you want to try?", "It's time for class."];
    addDialogueBlock(6, "第六篇（对话）", T6, P6, ["Do you want to try?", "Sure! Come and play!"], "playground");

    const T7 =
      "Mike's morning:\n{{1}}, he combs his hair. {{2}}, he eats {{3}}. After that, he {{4}} his teeth. It's 8:00 now. It's time {{5}} school. He says, \"I'm late {{6}} the bus!\"";
    addWordBlock(7, "第七篇", T7, ["for", "Then", "breakfast", "to", "First", "brush"], ["First", "Then", "breakfast", "brush", "to", "for"], "classroom");

    const T8 =
      "Lily: Hi, Ben! We're playing chess. {{1}}\nBen: {{2}} Chess is my favorite!\nLily: Here's a chair. Sit down!";
    const P8 = ["Can I have a turn?", "Do you want to join us?", "Yes, thanks!", "That looks like fun!"];
    addDialogueBlock(8, "第八篇（对话）", T8, P8, ["Do you want to join us?", "That looks like fun!"], "classroom");

    const T9 =
      "Anna's morning:\n{{1}}, she drinks milk. {{2}}, she eats {{3}}. After that, she {{4}} her teeth. It's 7:50. It's time {{5}} go to school. \"Oh no! It's time {{6}} class!\" she says.";
    addWordBlock(9, "第九篇", T9, ["brush", "Then", "breakfast", "to", "First", "for"], ["First", "Then", "breakfast", "brush", "to", "for"], "classroom");

    const T10 = 'Jack: Hi! I\'m new here. {{1}}\nLucy: {{2}} We\'re playing tag!\nJack: Yes! Tag is fun!';
    const P10 = ["Sure! You can go next.", "Do you want to play?", "My name is Tina.", "No, thanks!"];
    addDialogueBlock(10, "第十篇（对话）", T10, P10, ["Do you want to play?", "Sure! You can go next."], "playground");

    return steps;
  }

  /** 第16关：试卷「七、找出不同类」共7题，答案序 ccaacbb；wordCategories 与 A/B/C 顺序一致 */
  function buildLevel16Steps() {
    const shortPrompt = "找找不同，哪个单词和其他不是一类的";
    const rows = [
      {
        words: ["want", "come", "thing"],
        target: "thing",
        wordCategories: ["动词", "动词", "名词"],
        wordZh: ["想要", "来", "东西"],
      },
      {
        words: ["us", "her", "can"],
        target: "can",
        wordCategories: ["代词", "代词", "情态动词"],
        wordZh: ["我们", "她", "可以"],
      },
      {
        words: ["fun", "look", "join"],
        target: "fun",
        wordCategories: ["名词", "动词", "动词"],
        wordZh: ["乐趣", "看", "加入"],
      },
      {
        words: ["leg", "love", "like"],
        target: "leg",
        wordCategories: ["名词", "动词", "动词"],
        wordZh: ["腿", "喜爱", "喜欢"],
      },
      {
        words: ["try", "play", "together"],
        target: "together",
        wordCategories: ["动词", "动词", "副词"],
        wordZh: ["尝试", "玩", "一起"],
      },
      {
        words: ["have", "idea", "go"],
        target: "idea",
        wordCategories: ["动词", "名词", "动词"],
        wordZh: ["有", "主意", "去"],
      },
      {
        words: ["eat", "on", "ask"],
        target: "on",
        wordCategories: ["动词", "介词", "动词"],
        wordZh: ["吃", "在……上", "问"],
      },
    ];
    function expandReplyKey(raw) {
      const s = String(raw || "").toLowerCase().replace(/[^a-e]/g, "");
      if (!s.length) return "aaaaa";
      const pad = s[s.length - 1];
      return s.padEnd(5, pad).slice(0, 5);
    }
    function mapDialogueRows(pool, keyRaw, scenarios) {
      const key = expandReplyKey(keyRaw);
      return scenarios.map((r, i) => {
        const ch = key[i] || "a";
        const idx = ch.charCodeAt(0) - 97;
        const pick = pool[Math.max(0, Math.min(4, idx))];
        return {
          scene: r.scene,
          dialogue: r.dialogue,
          target: pick.text,
          targetLetter: pick.letter,
          options: pool.map((p) => p.text),
          optionLetters: pool.map((p) => p.letter),
        };
      });
    }

    const replyPool = [
      { letter: "A", text: "Have a try." },
      { letter: "B", text: "Do you want to try?" },
      { letter: "C", text: "Can I join you?" },
      { letter: "D", text: "You can go next!" },
      { letter: "E", text: "Good idea." },
    ];
    const replyRows = mapDialogueRows(replyPool, "caedb", [
      {
        scene: "⚽ 踢足球",
        dialogue: "几个男孩在踢球，你跑过来想加入。\n你：＿＿＿＿＿\n同伴：Yes, come and join us!",
      },
      {
        scene: "🚗 玩玩具车",
        dialogue: "男孩 A：Can I have a try?\n男孩 B（拿着玩具车）：Sure. ＿＿＿＿＿",
      },
      {
        scene: "🪑 课桌旁",
        dialogue: "女孩：Ask Alice to join us!\n男孩：＿＿＿＿＿",
      },
      {
        scene: "🎯 跳房子",
        dialogue: "男孩：Can I have a turn?\n女孩：Sure. ＿＿＿＿＿",
      },
      {
        scene: "🪴 种花",
        dialogue: "奶奶（或长辈）在摆弄花盆。\n长辈：＿＿＿＿＿\n女孩：Sure! That looks fun.",
      },
    ]);

    const morningPool = [
      { letter: "A", text: "Sure!" },
      { letter: "B", text: "I have class at eight." },
      { letter: "C", text: "We can go to school together." },
      { letter: "D", text: "What time do you get up in the morning?" },
      { letter: "E", text: "What time is it now?" },
    ];
    const morningPassage =
      "Sam：Hi, Lily! ＿①＿\n" +
      "Lily：I get up at 7:10 a.m. Then, I wash my face and brush my teeth. After that, I have breakfast.\n" +
      "Sam：＿②＿\n" +
      "Lily：It's half past seven now. ＿③＿\n" +
      "Sam：＿④＿\n" +
      "Lily：Sorry, I need to pack my schoolbag. Do you want to join the school club with me?\n" +
      "Sam：＿⑤＿ What club is it?";
    const morningRows = mapDialogueRows(morningPool, "debca", [
      { scene: "", dialogue: "" },
      { scene: "", dialogue: "" },
      { scene: "", dialogue: "" },
      { scene: "", dialogue: "" },
      { scene: "", dialogue: "" },
    ]);

    return [
      {
        kind: "L16",
        cat: "sentence",
        title: "蛙蛙找不同",
        prompt: shortPrompt,
        subPrompt: "一大题共 7 小题，每行点击不同类的一项。",
        optionLetters: ["A", "B", "C"],
        rows: rows.map((row) => ({
          target: row.target,
          options: row.words.slice(),
          wordCategories: row.wordCategories,
          wordZh: row.wordZh,
        })),
      },
      {
        kind: "L16R",
        cat: "sentence",
        title: "我的蛙蛙会接话",
        rows: replyRows,
      },
      {
        kind: "L16R2",
        cat: "sentence",
        title: "我的蛙蛙会接话",
        passage: morningPassage,
        rows: morningRows,
      },
      {
        kind: "L16",
        cat: "sentence",
        title: "蛙蛙找不同",
        prompt: "找找不同，哪个单词和其他不是一类的",
        subPrompt: "共 5 小题，每行点击不同类的一项。",
        optionLetters: ["A", "B", "C"],
        rows: [
          {
            target: "breakfast",
            options: ["brush", "breakfast", "wash"],
            wordCategories: ["动词", "名词", "动词"],
            wordZh: ["刷", "早餐", "洗"],
          },
          {
            target: "up",
            options: ["teeth", "face", "up"],
            wordCategories: ["名词", "名词", "副词"],
            wordZh: ["牙齿", "脸", "向上"],
          },
          {
            target: "have",
            options: ["have", "my", "your"],
            wordCategories: ["动词", "代词", "代词"],
            wordZh: ["有", "我的", "你的"],
          },
          {
            target: "hair",
            options: ["comb", "hair", "get"],
            wordCategories: ["动词", "名词", "动词"],
            wordZh: ["梳", "头发", "得到"],
          },
          {
            target: "morning",
            options: ["before", "after", "morning"],
            wordCategories: ["介词", "介词", "名词"],
            wordZh: ["在…之前", "在…之后", "早晨"],
          },
        ],
      },
      {
        kind: "L16",
        cat: "sentence",
        title: "蛙蛙能说一句完整的话",
        prompt: "选择最合适的词语，把句子说完整。",
        subPrompt: "共 5 小题，每行点击正确的一项。",
        optionLetters: ["A", "B", "C"],
        rows: [
          {
            cue: "—What time is it?\n—＿＿＿ eight o'clock.",
            target: "It's",
            options: ["Its", "It's", "They"],
            wordCategories: ["代词/误写", "缩写", "代词"],
            wordZh: ["它的(误)", "它是", "他们"],
          },
          {
            cue: "It's time ＿＿＿ get up.",
            target: "to",
            options: ["to", "for", "of"],
            wordCategories: ["不定式符号", "介词", "介词"],
            wordZh: ["去(不定式)", "为了", "…的"],
          },
          {
            cue: "I ＿＿＿ home late.",
            target: "go",
            options: ["goes", "have", "go"],
            wordCategories: ["动词三单", "动词", "动词原形"],
            wordZh: ["去(三单)", "有", "去"],
          },
          {
            cue: "I go to school in a ＿＿＿.",
            target: "hurry",
            options: ["happy", "hurry", "hello"],
            wordCategories: ["形容词", "名词", "感叹词"],
            wordZh: ["快乐的", "匆忙", "你好"],
          },
          {
            cue: "It's time ＿＿＿ bed.",
            target: "for",
            options: ["with", "to", "for"],
            wordCategories: ["介词", "不定式符号", "介词"],
            wordZh: ["和…一起", "去", "为了"],
          },
        ],
      },
      {
        kind: "L16TF",
        cat: "sentence",
        title: "蛙蛙能懂对话，啥说了啥没说",
        subPrompt: "阅读对话，判断句子与对话是否相符：相符选 T，不相符选 F。",
        passage:
          "Mum: Good morning, Peter. Get up, please.\n" +
          "Peter: Good morning, Mum. What time is it now?\n" +
          "Mum: It's seven thirty.\n" +
          "Peter: Oh, no! I'm late for school. I have no time for breakfast.\n" +
          "Mum: You should go to bed early (提早) tonight (今晚).\n" +
          "Peter: You are right. I have to go. Bye, Mum!\n" +
          "Mum: Bye, Peter.",
        rows: [
          { statement: "It is six o'clock now.", target: "F" },
          { statement: "It's time to go to bed.", target: "F" },
          { statement: "Peter is late for school.", target: "T" },
          { statement: "Peter gets up early today.", target: "F" },
          { statement: "Peter has breakfast this morning.", target: "F" },
        ],
      },
    ];
  }

  /** Unit 5 第17关：记短语（6 种题型 × 8 条短语，仿第1关的板块节奏） */
  const U5_PHRASES = [
    {
      en: "don't run in the classroom",
      zh: "别在教室里跑。",
      emoji: "❌🏃🏫",
      orderTokens: ["don't", "run", "in", "the", "classroom"],
    },
    { en: "do your best", zh: "尽你所能。", emoji: "💪✨", orderTokens: ["do", "your", "best"] },
    { en: "take turns to speak", zh: "轮流发言。", emoji: "🔄🎤", orderTokens: ["take", "turns", "to", "speak"] },
    { en: "say nice words", zh: "说友善的话。", emoji: "👄👍", orderTokens: ["say", "nice", "words"] },
    { en: "give a helping hand", zh: "伸出援手（帮一把）。", emoji: "🤲🤝", orderTokens: ["give", "a", "helping", "hand"] },
    { en: "put away your things", zh: "把你的东西收好。", emoji: "🗄️🎒", orderTokens: ["put", "away", "your", "things"] },
    {
      en: 'what rules do you like? I like "say nice words"',
      zh: "你喜欢什么规则？我喜欢「说友善的话」这句。",
      emoji: "📋❓",
      orderTokens: ["what", "rules", "do", "you", "like?", "I", "like", "say", "nice", "words"],
    },
    { en: "what about you?", zh: "你呢？", emoji: "🫵❓", orderTokens: ["what", "about", "you?"] },
  ];

  function buildU5Options(correct) {
    const all = U5_PHRASES.map((p) => p.en);
    return shuffle([correct, ...shuffle(all.filter((x) => x !== correct)).slice(0, 3)]);
  }

  function buildU5LetterSubtasks(word) {
    const w = (word || "").toLowerCase();
    if (w.length < 3) {
      return buildMissingLetterTasks({ en: w }).slice(0, 2);
    }
    const tasks = buildMissingLetterTasks({ en: w });
    return shuffle(tasks)
      .slice(0, 3)
      .map((t) => ({ ...t, options: shuffle(t.options.slice()) }));
  }

  function buildU5WordBlank(idx) {
    const w4 = (a, b, c, d) => shuffle([a, b, c, d]);
    const rows = [
      { promptLine: "don't ______ in the classroom", target: "run", options: w4("run", "walk", "play", "read") },
      { promptLine: "do your ______", target: "best", options: w4("best", "good", "nice", "next") },
      { promptLine: "take ______ to speak", target: "turns", options: w4("turns", "time", "tries", "toys") },
      { promptLine: "say ______ words", target: "nice", options: w4("nice", "good", "new", "six") },
      { promptLine: "give a helping ______", target: "hand", options: w4("hand", "head", "hold", "heart") },
      { promptLine: "put ______ your things", target: "away", options: w4("away", "on", "in", "off") },
      { promptLine: "what ______ do you like? I like say nice words", target: "rules", options: w4("rules", "rooms", "rulers", "reads") },
      { promptLine: "what ______ you?", target: "about", options: w4("about", "is", "are", "for") },
    ];
    const b = rows[idx] || rows[0];
    return {
      kind: "L17E",
      cat: "word",
      l17eMode: "word",
      title: "U5 短语 · 选词填空",
      phrase: U5_PHRASES[idx],
      promptLine: b.promptLine,
      target: b.target,
      options: b.options,
    };
  }

  function buildU5LetterBlank(idx) {
    const plan = ["classroom", "best", "speak", "words", "helping", "things", "rules", "you"];
    const w = plan[idx] || "nice";
    const phrase = U5_PHRASES[idx];
    return {
      kind: "L17E",
      cat: "word",
      l17eMode: "letters",
      title: "U5 短语 · 补字母",
      phrase,
      word: { en: w },
      tasks: buildU5LetterSubtasks(w),
    };
  }

  /** 课本 Classroom Rules 插图（仅前 6 条有对应小图，第 7/8 条不在本海报） */
  const U5_POSTER_IMAGES = [
    "assets/u5/rule_panel_1.png",
    "assets/u5/rule_panel_2.png",
    "assets/u5/rule_panel_3.png",
    "assets/u5/rule_panel_4.png",
    "assets/u5/rule_panel_5.png",
    "assets/u5/rule_panel_6.png",
  ];

  function buildU5SixOptions(correct) {
    const six = U5_PHRASES.slice(0, 6).map((p) => p.en);
    return shuffle([correct, ...shuffle(six.filter((x) => x !== correct)).slice(0, 3)]);
  }

  function buildU5ImageMatchStep() {
    return {
      kind: "L17MT",
      cat: "word",
      title: "U5 短语 · 教材插图匹配",
      prompt: "以下 6 幅图来自课本《Classroom Rules》插图。",
      subPrompt: "每行看图，选出与图中英文句子一致的英语短语。全部选对可过关。",
      rows: U5_POSTER_IMAGES.map((image, i) => ({
        image,
        target: U5_PHRASES[i].en,
        options: buildU5SixOptions(U5_PHRASES[i].en),
      })),
    };
  }

  function buildLevel17Steps() {
    const steps = [];
    U5_PHRASES.forEach((phrase, i) => {
      steps.push(
        { kind: "L17A", cat: "word", title: "U5 短语 · 看图选英文", phrase, target: phrase.en, options: buildU5Options(phrase.en) },
        { kind: "L17B", cat: "word", title: "U5 短语 · 看中文选英文", phrase, promptZh: phrase.zh, target: phrase.en, options: buildU5Options(phrase.en) },
        { kind: "L17C", cat: "word", title: "U5 短语 · 听英文选英文", phrase, target: phrase.en, options: buildU5Options(phrase.en) },
        { kind: "L17D", cat: "word", title: "U5 短语 · 听中文选英文", phrase, target: phrase.en, options: buildU5Options(phrase.en) }
      );
      if (i % 2 === 0) {
        steps.push(buildU5WordBlank(i));
      } else {
        steps.push(buildU5LetterBlank(i));
      }
      const sentence = phrase.en;
      const tokens = phrase.orderTokens.slice();
      steps.push({
        kind: "L17F",
        cat: "sentence",
        title: "U5 短语 · 按顺序组句",
        phrase,
        sentence,
        tokens,
        sentenceZh: "按顺序点词块，把短语说完整。",
      });
    });
    steps.push(buildU5ImageMatchStep());
    return steps;
  }

  function revealOddOneOutRowMeta(row, gridEl) {
    if (!gridEl || !row.wordCategories || row.wordCategories.length === 0) return;
    const zhList = row.wordZh || [];
    gridEl.querySelectorAll(".odd-one-out-meta").forEach((meta, idx) => {
      const pos = row.wordCategories[idx];
      const zh = zhList[idx];
      if (pos == null) return;
      const posEl = meta.querySelector(".odd-one-out-pos");
      const zhEl = meta.querySelector(".odd-one-out-zh");
      if (posEl) posEl.textContent = pos;
      if (zhEl) zhEl.textContent = zh != null && String(zh).trim() !== "" ? zh : "—";
      meta.classList.remove("odd-one-out-meta--hidden");
    });
  }

  /** 第18关·环节1：用表情（emoji）当图，避免外链图片 */
  const L18_PICTURE_EMOJI = {
    run: "🏃",
    best: "🥇",
    rule: "📋",
    turn: "🔁",
    speak: "🎤",
    give: "🤲",
    away: "📦",
    must: "✅",
    need: "💧",
    top: "⛰️",
    talk: "💬",
    exercise: "🏋️",
    clean: "🧹",
    arrive: "🛬",
  };

  /**
   * 第18关·环节1：14 个核心词。
   */
  const L18_VOCAB = [
    { en: "run", zh: "跑；奔跑" },
    { en: "best", zh: "最好" },
    { en: "rule", zh: "规则" },
    { en: "turn", zh: "轮流；依次" },
    { en: "speak", zh: "说话" },
    { en: "give", zh: "给" },
    { en: "away", zh: "离开；收好" },
    { en: "must", zh: "必须" },
    { en: "need", zh: "需要" },
    { en: "top", zh: "顶部" },
    { en: "talk", zh: "交谈" },
    { en: "exercise", zh: "锻炼" },
    { en: "clean", zh: "弄干净" },
    { en: "arrive", zh: "到达" },
  ];

  /** 与 buildLevel18Steps 环节2 一致，供预缓朗读音频 */
  const L18_PHRASE_ROWS = [
    { zh: "班规", en: "classroom rules" },
    { zh: "轮流说话", en: "take turns to speak" },
    { zh: "尽自己最大努力", en: "do your best" },
    { zh: "收拾好自己的东西", en: "put away your things" },
    { zh: "仔细听", en: "listen carefully" },
    { zh: "面对说话者", en: "face the speaker" },
    { zh: "保持安静", en: "keep quiet" },
    { zh: "不要在教室里奔跑", en: "don't run in the classroom" },
    { zh: "向别人伸出援手", en: "give a helping hand" },
    { zh: "用语得体", en: "say nice words" },
    { zh: "请你/您先", en: "you first" },
  ];

  function l18VocabEnSet() {
    return L18_VOCAB.map((x) => x.en);
  }

  function l18PickWrongEn(target, n) {
    const t = String(target).toLowerCase();
    return shuffle(l18VocabEnSet().filter((w) => w.toLowerCase() !== t)).slice(0, n);
  }

  /** 环节1·填漏：每词随机抽若干“挖空位”，避免长词过题过多 */
  function buildL18LetterTasksForWord(en) {
    const low = String(en || "").toLowerCase();
    if (!low) return [];
    const w = { en: low };
    const all = buildMissingLetterTasks(w);
    const nLetters = low.length;
    const base = all.slice(0, nLetters);
    const k = Math.min(4, Math.max(2, nLetters <= 3 ? nLetters : 3));
    return shuffle(base).slice(0, k);
  }

  function buildL18VocabL18Img(w, i, n) {
    const key = String(w.en || "").toLowerCase();
    return {
      kind: "L18IMG",
      cat: "word",
      title: "第18关·环节1 · 看表情选词 " + (i + 1) + " / " + n,
      target: w.en,
      l18Pic: L18_PICTURE_EMOJI[key] || "❓",
      options: shuffle([w.en, ...l18PickWrongEn(w.en, 3)]),
    };
  }

  function buildL18VocabL18C(w, i, n) {
    return {
      kind: "L18C",
      cat: "word",
      title: "第18关·环节1 · 中译英 " + (i + 1) + " / " + n,
      promptZh: w.zh,
      target: w.en,
      options: shuffle([w.en, ...l18PickWrongEn(w.en, 3)]),
    };
  }

  function buildL18VocabW3(w, i, n) {
    return {
      kind: "W3",
      cat: "word",
      title: "第18关·环节1 · 补字母 " + (i + 1) + " / " + n,
      word: { en: w.en },
      tasks: buildL18LetterTasksForWord(w.en),
    };
  }

  function buildL18FPhraseRow(p, i, total) {
    return {
      kind: "L18F",
      cat: "word",
      title: "第18关·环节2 · 首字母补全 " + (i + 1) + " / " + total,
      zh: p.zh,
      en: p.en,
      words: p.en.toLowerCase().split(/\s+/).filter(Boolean),
    };
  }

  /**
   * 第18关：环节1 三轮（看表情选词+中译英+补字母各14题）+ 环节2 短语首字母；短语每条只出现一次。
   */
  function buildLevel18Steps() {
    const steps = [];
    const order = shuffle(L18_VOCAB.slice());
    const nV = order.length;
    const phraseRows = L18_PHRASE_ROWS;
    const nP = phraseRows.length;
    for (let i = 0; i < nV; i += 1) steps.push(buildL18VocabL18Img(order[i], i, nV));
    for (let i = 0; i < nV; i += 1) steps.push(buildL18VocabL18C(order[i], i, nV));
    for (let i = 0; i < nV; i += 1) steps.push(buildL18VocabW3(order[i], i, nV));
    for (let i = 0; i < nP; i += 1) steps.push(buildL18FPhraseRow(phraseRows[i], i, nP));
    return steps;
  }

  function buildLevels() {
    const levels = [];
    const joinWord = WORDS.find((w) => w.en === "join");
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      const [w1, w2] = getWordPair(lv);
      let steps;
      if (lv === 7 || lv === 8) {
        steps = buildReviewLevelSteps(lv, w1, w2);
      } else if (lv === 18) {
        steps = buildLevel18Steps();
      } else if (lv === 17) {
        steps = buildLevel17Steps();
      } else if (lv === 16) {
        steps = buildLevel16Steps();
      } else if (lv === 15) {
        steps = buildClozeLevel15();
      } else if (lv === 14) {
        steps = buildReadingLevel14();
      } else if (lv === 12) {
        steps = buildStoryLevel12();
      } else if (lv === 11) {
        steps = buildDialogueSortLevel11();
      } else if (lv >= 9) {
        steps = buildAdvancedLevelSteps(lv, w1, w2);
      } else {
        steps = [
          ...buildWordBlock(w1, "第一组"),
          ...buildWordBlock(w2, "第二组"),
          ...buildExtraWordExamSteps(w1, w2),
        ];
      }
      if (lv === 1 && joinWord) {
        steps.push({ kind: "M3", cat: "word", title: "加练默写 · join", word: joinWord });
      }
      if (lv === 13 && steps[4]) {
        steps[4] = {
          kind: "RV1",
          cat: "sentence",
          title: "翻译题 · 5",
          prompt: "我能加入你们吗 翻译成英文",
          target: "Can I join you?",
          options: shuffle(["Can I join you?", "Do you want to join us?", "You can go first.", "Let me help you."]),
        };
      }
      levels.push({ id: lv, steps });
    }
    return levels;
  }

  const LEVELS = buildLevels();

  const TOTAL_STEP_COUNT = LEVELS.reduce((sum, L) => sum + L.steps.length, 0);
  /** 每关最多 3 次可得星，每次最多该关环节数颗星 → 全游理论星星上限 */
  const MAX_STARS_POSSIBLE = TOTAL_STEP_COUNT * 3;

  function clampStarsToCap(n) {
    return Math.min(MAX_STARS_POSSIBLE, Math.max(0, Number(n) || 0));
  }

  /** 排行榜仅保留星星 ≥ 该值的玩家，低于则清除不展示 */
  const LEADERBOARD_MIN_STARS = 10;

  (function validateLevelsBuilt() {
    if (LEVELS.length !== MAX_LEVEL) {
      console.error("[frog-king] 关卡数量异常：", LEVELS.length, "预期", MAX_LEVEL);
    }
    LEVELS.forEach((L, i) => {
      if (!L || !L.steps || L.steps.length === 0) {
        console.error("[frog-king] 第 " + (L && L.id ? L.id : i + 1) + " 关没有环节数据");
      }
    });
  })();

  const root = document.getElementById("challenge-root");
  const btnContinue = document.getElementById("btn-continue");
  const btnRetryLevel = document.getElementById("btn-retry-level");
  const btnPauseLevel = document.getElementById("btn-pause-level");
  const btnLevelPicker = document.getElementById("btn-level-picker");
  const btnLeaderboard = document.getElementById("btn-leaderboard");
  const btnSetPin = document.getElementById("btn-set-pin");
  const btnLogout = document.getElementById("btn-logout");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const modal = document.getElementById("modal-overlay");
  const levelGrid = document.getElementById("level-grid");
  const stoneRoute = document.getElementById("stone-route");
  const nameModal = document.getElementById("name-modal-overlay");
  const nameInput = document.getElementById("name-input");
  const pinInput = document.getElementById("pin-input");
  const btnLoginName = document.getElementById("btn-login-name");
  const btnRegisterName = document.getElementById("btn-register-name");
  const btnEnterNoPin = document.getElementById("btn-enter-no-pin");
  const leaderboardModal = document.getElementById("leaderboard-modal-overlay");
  const leaderboardTitleEl = document.getElementById("leaderboard-title");
  const leaderboardStarsHintEl = document.getElementById("leaderboard-stars-hint");
  const leaderboardList = document.getElementById("leaderboard-list");
  const teacherPanel = document.getElementById("teacher-panel");
  const teacherSearchInput = document.getElementById("teacher-search");
  const teacherList = document.getElementById("teacher-list");
  const btnTeacherRefresh = document.getElementById("btn-teacher-refresh");
  const btnCloseLeaderboard = document.getElementById("btn-close-leaderboard");
  const setPinModal = document.getElementById("set-pin-modal-overlay");
  const setPinInput = document.getElementById("set-pin-input");
  const btnSavePin = document.getElementById("btn-save-pin");
  const btnCloseSetPin = document.getElementById("btn-close-set-pin");
  const cloudConfigPanel = document.getElementById("cloud-config-panel");
  const cloudUrlInput = document.getElementById("cloud-url-input");
  const cloudKeyInput = document.getElementById("cloud-key-input");
  const btnSaveCloud = document.getElementById("btn-save-cloud");
  const cloudStatus = document.getElementById("cloud-status");

  const starCountEl = document.getElementById("star-count");
  const crownCountEl = document.getElementById("crown-count");
  const stepLabel = document.getElementById("step-label");
  const frogTrackFill = document.getElementById("frog-track-fill");
  const frogMascot = document.getElementById("frog-mascot");
  const frogActor = document.getElementById("frog-actor");
  const frogOutfit = document.getElementById("frog-outfit");
  const frogNameTag = document.getElementById("frog-name-tag");
  const frogPartNeck = document.getElementById("frog-part-neck");
  const frogPartBody = document.getElementById("frog-part-body");
  const frogPartLeftArm = document.getElementById("frog-part-left-arm");
  const frogPartLeftHand = document.getElementById("frog-part-left-hand");
  const frogPartRightArm = document.getElementById("frog-part-right-arm");
  const frogPartRightHand = document.getElementById("frog-part-right-hand");
  const frogPartTorso = document.getElementById("frog-part-torso");
  const frogPartLeftLeg = document.getElementById("frog-part-left-leg");
  const frogPartLeftFoot = document.getElementById("frog-part-left-foot");
  const frogPartRightLeg = document.getElementById("frog-part-right-leg");
  const frogPartRightFoot = document.getElementById("frog-part-right-foot");
  const praisePop = document.getElementById("frog-bubble");
  const eyeFlash = document.getElementById("eye-flash");
  const characterArea = document.getElementById("character-area");
  const sparkleBurst = document.getElementById("sparkle-burst");
  const levelCelebration = document.getElementById("level-celebration");
  const levelCelebrationText = document.getElementById("level-celebration-text");

  let state = loadState();
  state.unlockedLevel = MAX_LEVEL;
  let playerId = loadPlayerId();
  let playerName = loadPlayerName();
  let leaderboard = loadLeaderboard();

  const LEVEL_SEEN0_SESSION_KEY = "frogKing_seen0_levels";
  let levelPlayCountsCache = null;
  let levelPlayCountsCachePid = null;

  function levelPlaysStorageKeyForPlayer(pid) {
    return "frogKing_u4_levelPlays_" + String(pid || "guest");
  }

  function invalidateLevelPlayCountsCache() {
    levelPlayCountsCache = null;
    levelPlayCountsCachePid = null;
  }

  function loadLevelPlayCountsRaw(pid) {
    try {
      const raw = localStorage.getItem(levelPlaysStorageKeyForPlayer(pid));
      const arr = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(arr) || arr.length !== MAX_LEVEL) {
        return Array(MAX_LEVEL).fill(0);
      }
      return arr.map((n) => Math.max(0, Math.min(999, Number(n) || 0)));
    } catch (_) {
      return Array(MAX_LEVEL).fill(0);
    }
  }

  function getLevelPlayCountsArr() {
    const pid = playerId || loadPlayerId() || "guest";
    if (levelPlayCountsCache && levelPlayCountsCachePid === pid) return levelPlayCountsCache;
    levelPlayCountsCache = loadLevelPlayCountsRaw(pid);
    levelPlayCountsCachePid = pid;
    return levelPlayCountsCache;
  }

  function bumpLevelPlayCount(levelId1Based) {
    const pid = playerId || loadPlayerId() || "guest";
    const arr = getLevelPlayCountsArr().slice();
    const i = levelId1Based - 1;
    if (i < 0 || i >= MAX_LEVEL) return;
    arr[i] = Math.min(999, (arr[i] || 0) + 1);
    levelPlayCountsCache = arr;
    localStorage.setItem(levelPlaysStorageKeyForPlayer(pid), JSON.stringify(arr));
  }

  function getLevelPlayCount(levelId1Based) {
    return getLevelPlayCountsArr()[levelId1Based - 1] || 0;
  }

  /** 本关「第几次从环节 1 开始」≤3 时，答对可得星；第 4 次起不得星 */
  function canEarnStarsThisLevelStep() {
    return getLevelPlayCount(state.currentLevel) <= 3;
  }

  function parseSeen0Set() {
    try {
      const raw = sessionStorage.getItem(LEVEL_SEEN0_SESSION_KEY);
      const a = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(a) ? a.map(Number).filter((n) => n >= 1 && n <= MAX_LEVEL) : []);
    } catch (_) {
      return new Set();
    }
  }

  function writeSeen0Set(set) {
    sessionStorage.setItem(LEVEL_SEEN0_SESSION_KEY, JSON.stringify([...set].sort((x, y) => x - y)));
  }

  /** 每次进入某关「环节 1」（含重选该关、重闯本关）计为一次闯关；同页刷新同关环节 1 不重复计次 */
  function syncLevelPlayBumpForStep0Session() {
    const L = state.currentLevel;
    const s = state.currentStepIndex;
    const seen = parseSeen0Set();
    if (s !== 0) {
      if (seen.has(L)) {
        seen.delete(L);
        writeSeen0Set(seen);
      }
      return;
    }
    if (seen.has(L)) return;
    seen.add(L);
    writeSeen0Set(seen);
    bumpLevelPlayCount(L);
  }
  let cloudSyncTimer = null;
  let cloudStateSyncTimer = null;
  let cloudRefreshInFlight = false;
  let currentStepResult = null;
  let autoAdvancing = false;
  let autoAdvanceTimer = null;
  let autoRetryTimer = null;
  let lastRenderedLevel = null;
  let levelStartCelebrationShown = null;
  let teacherAccessUnlocked = false;
  let teacherTapCount = 0;
  let teacherTapTimer = null;
  let teacherAccountsCache = [];
  const TEACHER_ENTRY_CODE = "frog2026";
  const OUTFITS = ["🎀", "🕶️", "🎓", "🧣", "🧢", "🥽", "🎧", "💚", "🌟", "🪄"];
  const OUTFIT_CLASS_BY_ICON = {
    "🎀": "frog-outfit--bow",
    "🕶️": "frog-outfit--sunglasses",
    "🎓": "frog-outfit--cap",
    "🧣": "frog-outfit--scarf",
    "🧢": "frog-outfit--hat",
    "🥽": "frog-outfit--goggles",
    "🎧": "frog-outfit--headphones",
    "💚": "frog-outfit--badge",
    "🌟": "frog-outfit--star",
    "🪄": "frog-outfit--wand",
  };
  const ZH_BY_EN = {
    "Do you want to join us?": "你想加入我们吗？",
    "Do you want to try?": "你想试试吗？",
    "I'd love to!": "我很乐意！",
    "Yes, I'd love to! Thanks!": "是的，我很乐意！谢谢！",
    "Sure! Come and play!": "当然！来一起玩吧！",
    "Let's play together!": "我们一起玩吧！",
    "That looks like fun. Can I try?": "看起来很有趣。我可以试试吗？",
    "Hi, I'm Yiming. Do you want to join us?": "嗨，我叫一鸣。你想加入我们吗？",
    "Let's eat together!": "我们一起吃吧！",
    "Sure! That looks fun.": "当然！这看起来很好玩。",
    "Why don't you sit on my back?": "为什么不坐在我背上？",
    "Let me help you.": "让我来帮你。",
    "My name is Alice.": "我叫爱丽丝。",
    "Come on! Have a try!": "来吧！试试看！",
    "Smile and laugh under the sun.": "在阳光下微笑和大笑。",
    "Skip and hop, jump and run.": "跳绳蹦跳，跳跃奔跑。",
    "Come and join us, everyone!": "大家快来加入我们！",
    "No thanks... football is just not my thing.": "不用了，足球不是我的菜。",
    "No, thanks! Football is just not my thing.": "不用了，谢谢！我不喜欢足球。",
    "Can I join you?": "我能加入你们吗？",
    "Can I have a turn?": "我能玩一次吗？",
    "Come and play!": "来玩吧！",
    "Sorry.": "对不起。",
    "You're up next!": "下一个该你了！",
    "You can go first.": "你先来！",
    "That looks like fun.": "看起来很有趣。",
  };

  function withZhInLevel11(text) {
    const raw = String(text || "").trim();
    if (state.currentLevel !== 11 || !raw) return text;
    return withZhCaption(raw);
  }

  function withZhCaption(text) {
    const raw = String(text || "").trim();
    if (!raw) return text;
    const zh = ZH_BY_EN[raw];
    return zh ? raw + "（" + zh + "）" : text;
  }

  function renderRoute() {
    if (!stoneRoute) return;
    stoneRoute.innerHTML = "";
    const max = MAX_LEVEL;
    for (let i = 1; i <= max; i++) {
      const b = el("button", "stone-node", "第" + i + "关");
      const sideCls = i % 2 === 0 ? "stone-node--right" : "stone-node--left";
      b.classList.add(sideCls);
      if (getLevelPlayCount(i) >= 3) {
        b.classList.add("stone-node--gold");
      } else if (i < state.currentLevel) {
        b.classList.add("stone-node--done");
      }
      if (i === state.currentLevel) b.classList.add("stone-node--current");
      b.type = "button";
      b.addEventListener("click", () => {
        applyLevelChoiceInUi(i);
      });
      stoneRoute.appendChild(b);
      if (i < max) {
        const c = el("div", "stone-connector", "");
        c.classList.add(i % 2 === 0 ? "stone-connector--right" : "stone-connector--left");
        stoneRoute.appendChild(c);
      }
    }
  }

  function sortLeaderboard(list) {
    return list
      .slice()
      .sort((a, b) => (b.stars - a.stars) || (b.crowns - a.crowns) || (a.updatedAt - b.updatedAt) || a.name.localeCompare(b.name));
  }

  /** 竞赛排名：⭐ 相同则名次相同；下一名为「前面人数 + 1」（如 13 人并列第 1，下一名为 #14） */
  function leaderboardCompetitionRankByStars(sorted, idx) {
    if (idx <= 0) return 1;
    let rank = 1;
    for (let i = 1; i <= idx; i++) {
      if ((sorted[i].stars || 0) !== (sorted[i - 1].stars || 0)) {
        rank = i + 1;
      }
    }
    return rank;
  }

  function findLeaderboardRowByName(name) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return null;
    return leaderboard.find((x) => String(x.name || "").trim().toLowerCase() === key) || null;
  }

  function findLeaderboardRowByPlayerId(id) {
    const key = String(id || "").trim();
    if (!key) return null;
    return leaderboard.find((x) => String(x.playerId || "").trim() === key) || null;
  }

  function normalizeUserName(raw) {
    return String(raw || "").trim().slice(0, 20);
  }

  /**
   * 游戏创作者 / 全解锁老师账号：每次生效时直达「当前最新关」第 1 环节（不保留旧存档进度），
   * 全关卡可点，故事路标可跳环节。不区分大小写，如 Iamzhuanglaoshi / iamzhuanglaoshi。
   */
  const GAME_CREATOR_USERNAMES = new Set(["iamzhuanglaoshi"]);

  function isGameCreatorUser(name) {
    return GAME_CREATOR_USERNAMES.has(String(normalizeUserName(name) || "").trim().toLowerCase());
  }

  function isTeacherFullUnlockUser(name) {
    return isGameCreatorUser(name);
  }

  /**
   * 将本关 1..N 个环节在「学校→课室→操场→体育馆→艺术馆→终点」6 个路标上均分；返回每站要跳转的环节下标（0 起计）。
   * 第 0～4 站 = 前 5 个区间的起点 b[0]..b[4]；第 5 站「终点」= 最后一环（N-1）。
   */
  function getStoryMapBoundaries0(totalSteps) {
    const t = Math.max(0, totalSteps);
    if (t <= 1) return { last: 0, b: [0, 0, 0, 0, 0, 0, 0] };
    const last = t - 1;
    const b = [];
    for (let i = 0; i <= 6; i += 1) b.push(Math.floor((i * last) / 6));
    return { last, b };
  }

  function getStoryMapStepStarts0(totalSteps) {
    const t = Math.max(0, totalSteps);
    if (t <= 1) return [0, 0, 0, 0, 0, 0];
    const last = t - 1;
    if (t <= 6) {
      return [0, 1, 2, 3, 4, 5].map((k) => (k < t - 1 ? k : last));
    }
    const { b } = getStoryMapBoundaries0(t);
    return [b[0], b[1], b[2], b[3], b[4], last];
  }

  function currentStoryMapNode6(stepIndex, totalSteps) {
    const t = totalSteps;
    if (t <= 1) return 0;
    const last = t - 1;
    if (t <= 6) {
      if (stepIndex >= last) return 5;
      return Math.min(4, stepIndex);
    }
    const { b } = getStoryMapBoundaries0(t);
    if (stepIndex >= last) return 5;
    for (let k = 0; k < 5; k += 1) {
      if (stepIndex >= b[k] && stepIndex < b[k + 1]) return k;
    }
    if (stepIndex >= b[5] && stepIndex <= b[6]) return 5;
    return 5;
  }

  function shouldShowStoryMap() {
    return state.currentLevel >= 7 || isGameCreatorUser(playerName);
  }

  function applyTeacherFullUnlockIfNeeded() {
    if (!isTeacherFullUnlockUser(playerName)) return;
    state.unlockedLevel = MAX_LEVEL;
    state.currentLevel = MAX_LEVEL;
    state.currentStepIndex = 0;
    saveState(state);
    renderRoute();
    updateHud();
  }

  function normalizePin(raw) {
    return String(raw || "").replace(/\D/g, "").slice(0, 4);
  }

  function isValidPin(pin) {
    return /^\d{4}$/.test(String(pin || ""));
  }

  function buildAccountHelpText() {
    return (
      "账号系统尚未初始化，请在 Supabase 执行以下 SQL 一次：\n\n" +
      "create table if not exists public.frog_accounts (\n" +
      "  username text primary key,\n" +
      "  pin text not null default '',\n" +
      "  player_id text not null,\n" +
      "  created_at timestamptz default now(),\n" +
      "  updated_at timestamptz default now()\n" +
      ");\n" +
      "alter table public.frog_accounts enable row level security;\n" +
      "drop policy if exists frog_accounts_rw on public.frog_accounts;\n" +
      "create policy frog_accounts_rw on public.frog_accounts\n" +
      "for all using (true) with check (true);\n\n" +
      "create table if not exists public.frog_player_state (\n" +
      "  player_id text primary key,\n" +
      "  name text not null default '',\n" +
      "  stars integer not null default 0,\n" +
      "  crowns integer not null default 0,\n" +
      "  unlocked_level integer not null default 1,\n" +
      "  current_level integer not null default 1,\n" +
      "  current_step_index integer not null default 0,\n" +
      "  updated_at timestamptz default now()\n" +
      ");\n" +
      "alter table public.frog_player_state enable row level security;\n" +
      "drop policy if exists frog_player_state_rw on public.frog_player_state;\n" +
      "create policy frog_player_state_rw on public.frog_player_state\n" +
      "for all using (true) with check (true);"
    );
  }

  async function fetchCloudAccount(username) {
    if (!CLOUD_ENABLED) return { ok: false, reason: "cloud_off" };
    const url =
      SUPABASE_URL +
      "/rest/v1/frog_accounts?select=username,pin,player_id&username=eq." +
      encodeURIComponent(username) +
      "&limit=1";
    const res = await fetch(url, { headers: cloudHeaders() });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (txt.includes("frog_accounts") || txt.includes("PGRST205") || txt.includes("42P01")) {
        return { ok: false, reason: "table_missing", detail: txt };
      }
      return { ok: false, reason: "cloud_error", detail: txt };
    }
    const data = await res.json();
    const row = Array.isArray(data) && data[0] ? data[0] : null;
    if (!row) return { ok: false, reason: "not_found" };
    return {
      ok: true,
      row: {
        username: String(row.username || "").trim(),
        pin: String(row.pin || "").trim(),
        playerId: String(row.player_id || "").trim(),
      },
    };
  }

  async function createCloudAccount(username, pin, id) {
    if (!CLOUD_ENABLED) return { ok: false, reason: "cloud_off" };
    const url = SUPABASE_URL + "/rest/v1/frog_accounts";
    const body = [{ username, pin, player_id: id, updated_at: new Date().toISOString() }];
    const res = await fetch(url, {
      method: "POST",
      headers: cloudHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const txt = await res.text().catch(() => "");
    if (txt.includes("duplicate key") || txt.includes("23505")) return { ok: false, reason: "exists", detail: txt };
    if (txt.includes("frog_accounts") || txt.includes("PGRST205") || txt.includes("42P01")) {
      return { ok: false, reason: "table_missing", detail: txt };
    }
    return { ok: false, reason: "cloud_error", detail: txt };
  }

  async function upsertCloudAccount(username, pin, id) {
    if (!CLOUD_ENABLED) return { ok: false, reason: "cloud_off" };
    const url = SUPABASE_URL + "/rest/v1/frog_accounts?on_conflict=username";
    const body = [{ username, pin, player_id: id, updated_at: new Date().toISOString() }];
    const res = await fetch(url, {
      method: "POST",
      headers: cloudHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const txt = await res.text().catch(() => "");
    if (txt.includes("frog_accounts") || txt.includes("PGRST205") || txt.includes("42P01")) {
      return { ok: false, reason: "table_missing", detail: txt };
    }
    return { ok: false, reason: "cloud_error", detail: txt };
  }

  async function fetchCloudAccountsAll() {
    if (!CLOUD_ENABLED) return { ok: false, reason: "cloud_off" };
    const url =
      SUPABASE_URL +
      "/rest/v1/frog_accounts?select=username,pin,player_id,updated_at&order=updated_at.desc&limit=500";
    const res = await fetch(url, { headers: cloudHeaders() });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (txt.includes("frog_accounts") || txt.includes("PGRST205") || txt.includes("42P01")) {
        return { ok: false, reason: "table_missing", detail: txt };
      }
      return { ok: false, reason: "cloud_error", detail: txt };
    }
    const data = await res.json();
    if (!Array.isArray(data)) return { ok: true, rows: [] };
    const rows = data.map((x) => ({
      username: String(x.username || "").trim(),
      pin: String(x.pin || "").trim(),
      playerId: String(x.player_id || "").trim(),
      updatedAt: String(x.updated_at || ""),
    })).filter((x) => x.username);
    return { ok: true, rows };
  }

  function normalizeProgressState(raw) {
    const unlocked = MAX_LEVEL;
    const current = Math.min(MAX_LEVEL, Math.max(1, Number(raw && raw.currentLevel) || 1));
    const step = Math.max(0, Number(raw && raw.currentStepIndex) || 0);
    return {
      stars: Math.max(0, Number(raw && raw.stars) || 0),
      crowns: Math.max(0, Number(raw && raw.crowns) || 0),
      unlockedLevel: unlocked,
      currentLevel: current,
      currentStepIndex: step,
    };
  }

  function buildCloudPlayerStatePayload() {
    const normalized = normalizeProgressState(state);
    return {
      player_id: playerId,
      name: playerName || "",
      stars: normalized.stars,
      crowns: normalized.crowns,
      unlocked_level: normalized.unlockedLevel,
      current_level: normalized.currentLevel,
      current_step_index: normalized.currentStepIndex,
      updated_at: new Date().toISOString(),
    };
  }

  async function fetchCloudPlayerState(id) {
    if (!CLOUD_ENABLED) return { ok: false, reason: "cloud_off" };
    const pid = String(id || "").trim();
    if (!pid) return { ok: false, reason: "missing_player_id" };
    const url =
      SUPABASE_URL +
      "/rest/v1/frog_player_state?select=player_id,stars,crowns,unlocked_level,current_level,current_step_index,updated_at&player_id=eq." +
      encodeURIComponent(pid) +
      "&limit=1";
    const res = await fetch(url, { headers: cloudHeaders() });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (txt.includes("frog_player_state") || txt.includes("PGRST205") || txt.includes("42P01") || txt.includes("42703")) {
        return { ok: false, reason: "table_missing", detail: txt };
      }
      return { ok: false, reason: "cloud_error", detail: txt };
    }
    const data = await res.json();
    const row = Array.isArray(data) && data[0] ? data[0] : null;
    if (!row) return { ok: false, reason: "not_found" };
    return {
      ok: true,
      row: normalizeProgressState({
        stars: row.stars,
        crowns: row.crowns,
        unlockedLevel: row.unlocked_level,
        currentLevel: row.current_level,
        currentStepIndex: row.current_step_index,
      }),
    };
  }

  async function upsertCloudPlayerState(payload) {
    if (!CLOUD_ENABLED) return { ok: false, reason: "cloud_off" };
    const body = payload || buildCloudPlayerStatePayload();
    const url = SUPABASE_URL + "/rest/v1/frog_player_state?on_conflict=player_id";
    const res = await fetch(url, {
      method: "POST",
      headers: cloudHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify([body]),
    });
    if (res.ok) return { ok: true };
    const txt = await res.text().catch(() => "");
    if (txt.includes("frog_player_state") || txt.includes("PGRST205") || txt.includes("42P01") || txt.includes("42703")) {
      return { ok: false, reason: "table_missing", detail: txt };
    }
    return { ok: false, reason: "cloud_error", detail: txt };
  }

  function scheduleCloudPlayerStateSync() {
    if (!CLOUD_ENABLED || !playerId || !playerName) return;
    if (cloudStateSyncTimer) clearTimeout(cloudStateSyncTimer);
    cloudStateSyncTimer = setTimeout(async () => {
      cloudStateSyncTimer = null;
      try {
        await upsertCloudPlayerState();
      } catch (_) {}
    }, 600);
  }

  async function hydrateProgressFromCloudByPlayerId(id) {
    const res = await fetchCloudPlayerState(id);
    if (!res.ok) return res;
    const cloudState = normalizeProgressState(res.row);
    const local = normalizeProgressState(state);
    state.stars = clampStarsToCap(Math.max(local.stars, cloudState.stars));
    state.crowns = Math.max(local.crowns, cloudState.crowns);
    state.unlockedLevel = MAX_LEVEL;
    if (cloudState.currentLevel > local.currentLevel) {
      state.currentLevel = cloudState.currentLevel;
      state.currentStepIndex = cloudState.currentStepIndex;
    } else if (cloudState.currentLevel === local.currentLevel) {
      state.currentLevel = local.currentLevel;
      state.currentStepIndex = Math.max(local.currentStepIndex, cloudState.currentStepIndex);
    } else {
      state.currentLevel = local.currentLevel;
      state.currentStepIndex = local.currentStepIndex;
    }
    state.currentLevel = Math.min(state.unlockedLevel, Math.max(1, state.currentLevel));
    const levelObj = LEVELS[state.currentLevel - 1];
    const stepMax = levelObj && levelObj.steps ? Math.max(0, levelObj.steps.length - 1) : 0;
    state.currentStepIndex = Math.min(stepMax, Math.max(0, state.currentStepIndex));
    applyTeacherFullUnlockIfNeeded();
    saveState(state);
    return { ok: true };
  }

  function hydrateStateFromBoundAccount() {
    const byId = findLeaderboardRowByPlayerId(playerId);
    const byName = findLeaderboardRowByName(playerName);
    const row = byId || byName;
    if (!row) return;
    state.stars = clampStarsToCap(Math.max(state.stars, row.stars || 0));
    state.crowns = Math.max(state.crowns, row.crowns || 0);
    saveState(state);
  }

  async function bindIdentityByName(name) {
    const normalized = String(name || "").trim();
    if (!normalized) return { ok: false, reason: "empty" };
    if (CLOUD_ENABLED) {
      await refreshLeaderboardFromCloud();
    }
    const sameName = findLeaderboardRowByName(normalized);
    if (sameName) {
      if (sameName.playerId) {
        // 同名即视为同一账号：自动切换到该账号 playerId，避免同设备重登被拦截。
        playerId = sameName.playerId;
        savePlayerId(playerId);
        invalidateLevelPlayCountsCache();
      }
      state.stars = clampStarsToCap(Math.max(state.stars, sameName.stars || 0));
      state.crowns = Math.max(state.crowns, sameName.crowns || 0);
      saveState(state);
    }
    return { ok: true };
  }

  async function fetchCloudLeaderboard() {
    if (!CLOUD_ENABLED) return null;
    const url =
      SUPABASE_URL +
      "/rest/v1/frog_leaderboard?select=player_id,name,stars,crowns,updated_at&order=stars.desc,crowns.desc,updated_at.asc&limit=300";
    const res = await fetch(url, { headers: cloudHeaders() });
    if (!res.ok) throw new Error("cloud_fetch_failed");
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((x) => ({
        playerId: String(x.player_id || ""),
        name: String(x.name || "").trim(),
        stars: clampStarsToCap(Number(x.stars) || 0),
        crowns: Math.max(0, Number(x.crowns) || 0),
        updatedAt: Number(new Date(x.updated_at || Date.now())) || Date.now(),
      }))
      .filter((x) => x.playerId && x.name && x.stars >= LEADERBOARD_MIN_STARS);
  }

  async function upsertCloudScore(row) {
    if (!CLOUD_ENABLED) return false;
    const url = SUPABASE_URL + "/rest/v1/frog_leaderboard?on_conflict=player_id";
    const body = [
      {
        player_id: row.playerId,
        name: row.name,
        stars: clampStarsToCap(row.stars),
        crowns: row.crowns,
        updated_at: new Date(row.updatedAt || Date.now()).toISOString(),
      },
    ];
    const res = await fetch(url, {
      method: "POST",
      headers: cloudHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  function scheduleCloudSync(row) {
    if (!CLOUD_ENABLED) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(async () => {
      cloudSyncTimer = null;
      try {
        await upsertCloudScore(row);
      } catch (_) {}
    }, 500);
  }

  async function refreshLeaderboardFromCloud() {
    if (!CLOUD_ENABLED || cloudRefreshInFlight) return false;
    cloudRefreshInFlight = true;
    try {
      const cloudList = await fetchCloudLeaderboard();
      if (Array.isArray(cloudList)) {
        leaderboard = saveLeaderboard(sortLeaderboard(cloudList));
      }
      return true;
    } catch (_) {
      return false;
    } finally {
      cloudRefreshInFlight = false;
    }
  }

  function upsertCurrentPlayerScore() {
    if (!playerName) return;
    if (!playerId) return;
    const now = Date.now();
    const next = leaderboard.slice();
    const idx = next.findIndex((x) => x.playerId === playerId);
    const row = {
      playerId,
      name: playerName,
      stars: clampStarsToCap(state.stars),
      crowns: state.crowns,
      updatedAt: now,
    };
    if (idx >= 0) next[idx] = row;
    else next.push(row);
    leaderboard = saveLeaderboard(sortLeaderboard(next));
    scheduleCloudSync(row);
  }

  function renderLeaderboard() {
    const capNotice = document.getElementById("leaderboard-notice-max-stars");
    const stepNotice = document.getElementById("leaderboard-notice-step-count");
    if (capNotice) capNotice.textContent = String(MAX_STARS_POSSIBLE);
    if (stepNotice) stepNotice.textContent = String(TOTAL_STEP_COUNT);
    if (leaderboardStarsHintEl) {
      leaderboardStarsHintEl.textContent =
        "按 ⭐ 星星总数排序（单账号封顶 " + MAX_STARS_POSSIBLE + "）。详细规则见右侧公告。";
    }
    if (!leaderboardList) return;
    leaderboardList.innerHTML = "";
    const sorted = sortLeaderboard(leaderboard);
    if (!sorted.length) {
      const empty = el("div", "leaderboard-row", "");
      const text = el("span", "leaderboard-name", "");
      text.textContent = "还没有记录，先去闯关拿 ⭐ 吧！";
      empty.appendChild(text);
      leaderboardList.appendChild(empty);
      return;
    }
    sorted.slice(0, 300).forEach((row, idx) => {
      const item = el("div", "leaderboard-row", "");
      const rank = el("span", "leaderboard-rank", "");
      rank.textContent = "#" + leaderboardCompetitionRankByStars(sorted, idx);
      const name = el("span", "leaderboard-name", "");
      name.textContent = row.name;
      const score = el("span", "leaderboard-score", "");
      score.textContent = "⭐ " + row.stars;
      item.appendChild(rank);
      item.appendChild(name);
      item.appendChild(score);
      if (playerId && row.playerId === playerId) {
        item.classList.add("leaderboard-row--me");
      }
      leaderboardList.appendChild(item);
    });
  }

  function toggleTeacherPanel(show) {
    if (!teacherPanel) return;
    teacherPanel.classList.toggle("teacher-panel--hidden", !show);
  }

  function renderTeacherAccounts() {
    if (!teacherList) return;
    teacherList.innerHTML = "";
    const keyword = (teacherSearchInput && teacherSearchInput.value ? teacherSearchInput.value : "").trim().toLowerCase();
    const rows = teacherAccountsCache.filter((row) => {
      if (!keyword) return true;
      return row.username.toLowerCase().includes(keyword);
    });
    if (!rows.length) {
      const empty = el("div", "teacher-row", "");
      empty.appendChild(el("div", "teacher-row__name", "暂无匹配账号"));
      empty.appendChild(el("div", "teacher-row__pin", "-"));
      teacherList.appendChild(empty);
      return;
    }
    rows.forEach((row) => {
      const item = el("div", "teacher-row", "");
      const left = el("div", "teacher-row__name", row.username);
      const right = el("div", "teacher-row__pin", row.pin || "（未设置）");
      item.appendChild(left);
      item.appendChild(right);
      teacherList.appendChild(item);
    });
  }

  async function loadTeacherAccounts() {
    if (!teacherAccessUnlocked) return;
    const res = await fetchCloudAccountsAll();
    if (!res.ok) {
      if (res.reason === "cloud_off") {
        alert("未连接云端，无法读取账号密码。");
      } else if (res.reason === "table_missing") {
        alert(buildAccountHelpText());
      } else {
        alert("读取账号列表失败，请稍后重试。");
      }
      return;
    }
    teacherAccountsCache = res.rows || [];
    renderTeacherAccounts();
  }

  async function unlockTeacherPanel() {
    const entered = window.prompt("教师入口：请输入口令", "");
    if (entered === null) return;
    if (String(entered).trim() !== TEACHER_ENTRY_CODE) {
      alert("口令不正确。");
      return;
    }
    teacherAccessUnlocked = true;
    toggleTeacherPanel(true);
    await loadTeacherAccounts();
  }

  function onLeaderboardTitleTap() {
    teacherTapCount += 1;
    if (teacherTapTimer) clearTimeout(teacherTapTimer);
    teacherTapTimer = setTimeout(() => {
      teacherTapCount = 0;
      teacherTapTimer = null;
    }, 1200);
    if (teacherTapCount >= 5) {
      teacherTapCount = 0;
      if (teacherTapTimer) {
        clearTimeout(teacherTapTimer);
        teacherTapTimer = null;
      }
      unlockTeacherPanel();
    }
  }

  const stepStatus = {
    hadWrong: false,
    isCorrect: false,
    graded: false,
    revealFn: null,
    reset() {
      this.hadWrong = false;
      this.isCorrect = false;
      this.graded = false;
      this.revealFn = null;
    },
    setReveal(fn) {
      this.revealFn = fn;
    },
    markWrong() {
      if (this.graded) return;
      this.hadWrong = true;
      showRetryEncouragement();
      syncActionBar();
      if (autoRetryTimer) return;
      autoRetryTimer = setTimeout(() => {
        autoRetryTimer = null;
        renderCurrentStep();
      }, 420);
    },
    markCorrect() {
      if (this.isCorrect) return;
      this.isCorrect = true;
      const step = currentStep();
      if (state.currentLevel === 15 && step && step.kind === "CLZ") {
        showLevel15ClozeGeniusPraise();
      } else if (state.currentLevel === 14 && step && step.kind === "RV1") {
        speakChineseTTS("太棒了");
        if (!this.hadWrong && !this.graded) showPraise();
      } else if (state.currentLevel === 16 && step && isLevel16PraiseStepKind(step.kind)) {
        speakLevel16GuaguaThenStepPass();
        if (!this.hadWrong && !this.graded) showPraise();
      } else if (state.currentLevel === 18) {
        playLevel18CorrectAnswerAudio(step);
        if (!this.hadWrong && !this.graded) showPraise({ noDing: true });
      } else {
        const speakText = getAutoSpeakText(step);
        if (speakText) {
          playEnglishAudioGuaranteed(speakText);
        }
        if (!this.hadWrong && !this.graded) showPraise();
      }
      syncActionBar();
      if (!this.hadWrong && !this.graded && !autoAdvancing) {
        autoAdvancing = true;
        if (autoAdvanceTimer) {
          clearTimeout(autoAdvanceTimer);
          autoAdvanceTimer = null;
        }
        autoAdvanceTimer = setTimeout(() => {
          goNextStep(true);
          autoAdvancing = false;
          autoAdvanceTimer = null;
        }, 780);
      }
    },
    runGrade() {
      if (this.graded || !this.hadWrong) return;
      this.graded = true;
      if (typeof this.revealFn === "function") this.revealFn();
      syncActionBar();
    },
  };

  function currentLevelObj() {
    return LEVELS[state.currentLevel - 1];
  }

  function currentStep() {
    const lv = currentLevelObj();
    if (!lv) return null;
    state.currentStepIndex = Math.min(Math.max(0, state.currentStepIndex), lv.steps.length - 1);
    return lv.steps[state.currentStepIndex];
  }

  function getAutoSpeakText(step) {
    if (!step) return "";
    if (step.kind && step.kind.indexOf("L17") === 0) return "";
    if (step.kind === "L18F" || step.kind === "L18IMG" || step.kind === "L18C") return "";
    if (state.currentLevel === 18 && step.kind === "W3") return "";
    if (step.kind === "CLZ") return "";
    if (state.currentLevel === 14 && step.passage) return "";
    if (state.currentLevel === 12) {
      const correctOption = step.target || "";
      return /[a-zA-Z]/.test(correctOption) ? correctOption : "";
    }
    if (step.autoSpeak) return step.autoSpeak;
    if (step.kind === "TIP") return "";
    if (step.kind === "P1" || step.kind === "P2") return "";
    if (step.kind === "S2" || step.kind === "RV4" || step.kind === "A4") return "";
    if (step.kind === "A5") return "";
    if (step.kind === "L16" || step.kind === "L16R" || step.kind === "L16R2" || step.kind === "L16TF") return "";
    const englishFromPrompt = () => {
      const m = String(step.prompt || "").match(/“([^”]+)”/);
      if (m && /[a-zA-Z]/.test(m[1])) return m[1];
      return "";
    };
    if (step.kind === "RV1" || step.kind === "RV2" || step.kind === "A1" || step.kind === "A2" || step.kind === "A6") {
      const candidate = step.target || step.line || "";
      if (/[a-zA-Z]/.test(candidate)) return candidate;
      return englishFromPrompt();
    }
    if (step.kind === "RV3" || step.kind === "RV4" || step.kind === "A3" || step.kind === "A4") {
      return step.sentence || step.targetSentence || (step.tokens ? step.tokens.join(" ") : "");
    }
    if (step.word && step.word.en) return step.word.en;
    if (step.target) return step.target;
    return "";
  }

  function maybeAutoSpeakLevel12Question(step) {
    if (!step || state.currentLevel !== 12) return;
    if (!(step.kind === "VQ" || step.kind === "RV1")) return;
    const question = String(step.prompt || "");
    if (!/[a-zA-Z]/.test(question)) return;
    playEnglishAudioGuaranteed(question);
  }

  function updateHud() {
    const lv = currentLevelObj();
    const total = lv ? lv.steps.length : MAX_LEVEL;
    const idx = Math.min(state.currentStepIndex, total - 1);
    const passed = (stepStatus.isCorrect && !stepStatus.hadWrong) || stepStatus.graded ? 1 : 0;
    const pct = ((idx + passed) / total) * 100;
    frogTrackFill.style.width = Math.min(100, pct) + "%";
    frogMascot.style.left = Math.min(100, pct) + "%";
    stepLabel.textContent = "环节 " + (idx + 1) + " / " + total + " · 第 " + state.currentLevel + " 关";
    starCountEl.textContent = String(state.stars);
    crownCountEl.textContent = String(state.crowns);
    const outfitCount = Math.max(0, state.currentLevel - 1);
    let outfit = outfitCount > 0 ? OUTFITS[(outfitCount - 1) % OUTFITS.length] : "";
    if (state.currentLevel >= 15) outfit = "";
    frogOutfit.textContent = outfit;
    applyOutfitPlacement(outfit);
    updateFrogBodyGrowth(state.currentLevel);
    if (frogActor) {
      frogActor.classList.toggle("frog-actor--level16", state.currentLevel === 16);
      frogActor.classList.toggle("frog-actor--level17", state.currentLevel === 17);
      frogActor.classList.toggle("frog-actor--level18", state.currentLevel === 18);
    }
    if (frogNameTag) frogNameTag.textContent = playerName || "小青蛙";
    upsertCurrentPlayerScore();
    renderRoute();
  }

  function applyOutfitPlacement(outfit) {
    if (!frogOutfit) return;
    Object.keys(OUTFIT_CLASS_BY_ICON).forEach((icon) => {
      frogOutfit.classList.remove(OUTFIT_CLASS_BY_ICON[icon]);
    });
    if (!outfit || !OUTFIT_CLASS_BY_ICON[outfit]) return;
    frogOutfit.classList.add(OUTFIT_CLASS_BY_ICON[outfit]);
  }

  function toggleFrogPart(node, on) {
    if (!node) return;
    node.classList.toggle("frog-part--on", !!on);
  }

  function updateFrogBodyGrowth(level) {
    toggleFrogPart(frogPartBody, level >= 10);
    toggleFrogPart(frogPartNeck, level >= 11);
    toggleFrogPart(frogPartLeftArm, level >= 11);
    toggleFrogPart(frogPartLeftHand, level >= 11);
    toggleFrogPart(frogPartRightArm, level >= 11);
    toggleFrogPart(frogPartRightHand, level >= 12);
    toggleFrogPart(frogPartTorso, level >= 13);
    toggleFrogPart(frogPartLeftLeg, level >= 13);
    toggleFrogPart(frogPartLeftFoot, level >= 13);
    toggleFrogPart(frogPartRightLeg, level >= 14);
    toggleFrogPart(frogPartRightFoot, level >= 14);
  }

  function syncActionBar() {
    if (currentStepResult === "level" || currentStepResult === "done") {
      btnContinue.disabled = false;
      if (btnPauseLevel) btnPauseLevel.disabled = true;
      return;
    }
    if (btnPauseLevel) btnPauseLevel.disabled = false;
    btnContinue.disabled = !stepStatus.isCorrect;
  }

  function showPraise(opts) {
    const noDing = opts && opts.noDing;
    if (!noDing) playDingDong();
    frogActor.dataset.mood = "nod";
    sparkleBurst.classList.add("sparkle-burst--on");
    praisePop.textContent = PRAISE_LINES[Math.floor(Math.random() * PRAISE_LINES.length)];
    praisePop.classList.remove("praise-pop--hidden");
    setTimeout(() => {
      frogActor.dataset.mood = "idle";
      sparkleBurst.classList.remove("sparkle-burst--on");
      praisePop.classList.add("praise-pop--hidden");
    }, 900);
  }

  function showLevel15ClozeGeniusPraise() {
    playDingDong();
    frogActor.dataset.mood = "nod";
    sparkleBurst.classList.add("sparkle-burst--on");
    praisePop.textContent = "你简直是英语天才";
    praisePop.classList.remove("praise-pop--hidden");
    speakChineseTTS("英语天才");
    setTimeout(() => {
      frogActor.dataset.mood = "idle";
      sparkleBurst.classList.remove("sparkle-burst--on");
      praisePop.classList.add("praise-pop--hidden");
    }, 1100);
  }

  function showRetryEncouragement() {
    praisePop.textContent = RETRY_LINES[Math.floor(Math.random() * RETRY_LINES.length)];
    praisePop.classList.remove("praise-pop--hidden");
    setTimeout(() => {
      praisePop.classList.add("praise-pop--hidden");
    }, 900);
  }

  function showCelebrationOverlay(text, options) {
    if (!levelCelebration || !levelCelebrationText) return;
    const opts = options || {};
    const duration = Math.max(700, Number(opts.duration) || 1700);
    const milestone = !!opts.milestone;
    const extraClass = typeof opts.extraClass === "string" && opts.extraClass.trim() ? opts.extraClass.trim() : "";
    levelCelebration.classList.toggle("level-celebration--milestone", milestone);
    if (extraClass) levelCelebration.classList.add(extraClass);
    levelCelebration.classList.remove("level-celebration--hidden");
    levelCelebrationText.textContent = text;
    setTimeout(() => {
      levelCelebration.classList.add("level-celebration--hidden");
      levelCelebration.classList.remove("level-celebration--milestone");
      if (extraClass) levelCelebration.classList.remove(extraClass);
    }, duration);
  }

  function showLevelCelebration(nextLevel, done) {
    showCelebrationOverlay(done ? "🏆 U5 记短语·全部通关！" : "🎉 恭喜进入第 " + nextLevel + " 关", { duration: 1700 });
  }

  function maybeShowLevelStartCelebration() {
    if (state.currentStepIndex !== 0) return;
    if (levelStartCelebrationShown === state.currentLevel) return;
    if (state.currentLevel === 16) {
      levelStartCelebrationShown = state.currentLevel;
      const name = (playerName || "").trim() || "小青蛙";
      showCelebrationOverlay(name + "开始养蛙啦！！", {
        duration: 3200,
        milestone: true,
        extraClass: "level-celebration--level16-start",
      });
      return;
    }
    if (state.currentLevel === 18) {
      levelStartCelebrationShown = state.currentLevel;
      showCelebrationOverlay("🎆 恭喜进入第18关！蛙蛙吃上橙子了🍊", {
        duration: 2400,
        milestone: true,
        extraClass: "level-celebration--level18-start",
      });
      return;
    }
    const text = LEVEL_START_CELEBRATIONS[state.currentLevel];
    if (!text) return;
    levelStartCelebrationShown = state.currentLevel;
    showCelebrationOverlay("🎆 " + text, { duration: 1900, milestone: true });
  }

  let level16EyeIntroTimer = null;
  let level16EyeSparkleTimer = null;
  let level16EyeSparkleOffTimer = null;
  let level18OrangeSparkleTimer = null;

  /** 第18关本关第1环节：角色区星闪，配合头顶橙子与全屏烟花 */
  function maybePlayLevel18OrangeIntro() {
    if (level18OrangeSparkleTimer) {
      clearTimeout(level18OrangeSparkleTimer);
      level18OrangeSparkleTimer = null;
    }
    if (state.currentLevel !== 18 || state.currentStepIndex !== 0) return;
    if (sparkleBurst) {
      sparkleBurst.classList.add("sparkle-burst--on");
      level18OrangeSparkleTimer = setTimeout(() => {
        level18OrangeSparkleTimer = null;
        if (sparkleBurst) sparkleBurst.classList.remove("sparkle-burst--on");
      }, 1500);
    }
  }

  function maybePlayLevel16EyeIntro() {
    if (!characterArea) return;
    if (level16EyeIntroTimer) {
      clearTimeout(level16EyeIntroTimer);
      level16EyeIntroTimer = null;
    }
    if (level16EyeSparkleTimer) {
      clearTimeout(level16EyeSparkleTimer);
      level16EyeSparkleTimer = null;
    }
    if (level16EyeSparkleOffTimer) {
      clearTimeout(level16EyeSparkleOffTimer);
      level16EyeSparkleOffTimer = null;
    }
    if (state.currentLevel !== 16 || state.currentStepIndex !== 0) {
      characterArea.classList.remove("character-area--level16-eye-intro");
      if (sparkleBurst) sparkleBurst.classList.remove("sparkle-burst--on");
      return;
    }
    characterArea.classList.remove("character-area--level16-eye-intro");
    void characterArea.offsetWidth;
    characterArea.classList.add("character-area--level16-eye-intro");
    level16EyeSparkleTimer = setTimeout(() => {
      level16EyeSparkleTimer = null;
      if (sparkleBurst) sparkleBurst.classList.add("sparkle-burst--on");
    }, 520);
    level16EyeSparkleOffTimer = setTimeout(() => {
      level16EyeSparkleOffTimer = null;
      if (sparkleBurst) sparkleBurst.classList.remove("sparkle-burst--on");
    }, 1580);
    level16EyeIntroTimer = setTimeout(() => {
      level16EyeIntroTimer = null;
      characterArea.classList.remove("character-area--level16-eye-intro");
      if (sparkleBurst) sparkleBurst.classList.remove("sparkle-burst--on");
    }, 3200);
  }

  function maybeShowEpisodeCelebration(step) {
    if (!step || state.currentLevel !== 12 || step.kind !== "VQ") return;
    if (step.episodeQuestionIndex !== 3) return;
    const line = VIDEO_EPISODE_CELEBRATIONS[Math.floor(Math.random() * VIDEO_EPISODE_CELEBRATIONS.length)];
    showCelebrationOverlay("🎇 " + line, { duration: 1200 });
  }

  function runEyeFlash(cb) {
    eyeFlash.textContent = "✨";
    eyeFlash.classList.add("eye-flash--on");
    setTimeout(() => {
      eyeFlash.classList.remove("eye-flash--on");
      eyeFlash.textContent = "";
      if (cb) cb();
    }, 600);
  }

  function finishLevel() {
    clearCheckpointForLevelId(state.currentLevel);
    state.crowns += 1;
    state.unlockedLevel = Math.max(state.unlockedLevel, Math.min(MAX_LEVEL, state.currentLevel + 1));
    saveState(state);
  }

  function clearRoot() {
    root.innerHTML = "";
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function renderHeader(step) {
    const titleEl = el("div", "screen-title", step.title);
    if (step.kind === "L16R" || step.kind === "L16R2") {
      titleEl.classList.add("screen-title--l16-reply-hero");
    } else if (step.kind === "L16TF") {
      titleEl.classList.add("screen-title--l16-tf");
    } else if (state.currentLevel === 16) {
      titleEl.classList.add("screen-title--level16");
    }
    root.appendChild(titleEl);
    if (shouldShowStoryMap()) {
      renderStoryMap();
    }
  }

  function renderHeaderWithAudio(step, audioText) {
    const row = el("div", "screen-title-row", "");
    row.appendChild(el("div", "screen-title", step.title));
    if (audioText) {
      const btn = el("button", "btn-audio btn-audio--blue btn-audio--inline", "🔊");
      btn.type = "button";
      btn.addEventListener("click", () => playEnglishAudioGuaranteed(audioText));
      row.appendChild(btn);
    }
    root.appendChild(row);
    if (shouldShowStoryMap()) {
      renderStoryMap();
    }
  }

  function renderStoryMap() {
    const lv = currentLevelObj();
    const total = lv ? lv.steps.length : 0;
    const t = Math.max(0, total);
    const nodes = ["学校", "课室", "操场", "体育馆", "艺术馆", "终点"];
    const creator = isGameCreatorUser(playerName);
    const stepStarts0 = t ? getStoryMapStepStarts0(t) : [0, 0, 0, 0, 0, 0];
    const activeN = t ? currentStoryMapNode6(state.currentStepIndex, t) : 0;
    const wrap = el("div", "story-map", "");
    if (creator) wrap.classList.add("story-map--creator");
    nodes.forEach((name, idx) => {
      const n = creator
        ? el("button", "story-map__node story-map__node--clickable", name)
        : el("div", "story-map__node", name);
      if (creator) n.type = "button";
      if (idx <= activeN) n.classList.add("story-map__node--on");
      if (idx === activeN) n.classList.add("story-map__node--current");
      if (creator) {
        n.setAttribute("aria-label", name + "，跳转到本关第 " + (stepStarts0[idx] + 1) + " 环节");
        n.addEventListener("click", () => {
          const to = stepStarts0[idx];
          if (to === state.currentStepIndex) return;
          state.currentStepIndex = to;
          currentStepResult = null;
          saveState(state);
          runEyeFlash(renderCurrentStep);
        });
      }
      wrap.appendChild(n);
      if (idx < nodes.length - 1) {
        const link = el("div", "story-map__link", "");
        if (idx < activeN) link.classList.add("story-map__link--on");
        wrap.appendChild(link);
      }
    });
    root.appendChild(wrap);
  }

  function createAnswerKey() {
    return el("div", "answer-key answer-key--hidden", "");
  }

  function revealKey(node, html) {
    node.classList.remove("answer-key--hidden");
    node.innerHTML = html;
  }

  function normalizeOptionText(text) {
    return String(text || "").trim().toLowerCase().replace(/[.!?]+$/g, "");
  }

  function getAcceptedTargets(item) {
    if (!item) return [];
    if (Array.isArray(item.acceptedTargets) && item.acceptedTargets.length) {
      return item.acceptedTargets.slice();
    }
    const ctx = [item.line, item.prompt, item.scene, item.question].join(" ").toLowerCase();
    const joinYouAnswers = ["You can go first.", "Sure", "Come and play!"];
    const isJoinYouResponseTarget = joinYouAnswers.some(
      (ans) => normalizeOptionText(item.target) === normalizeOptionText(ans)
    );
    if (ctx.includes("can i join you") && isJoinYouResponseTarget) {
      return joinYouAnswers;
    }
    return item.target ? [item.target] : [];
  }

  function isAcceptedOption(item, opt) {
    const picked = normalizeOptionText(opt);
    return getAcceptedTargets(item).some((ans) => normalizeOptionText(ans) === picked);
  }

  function acceptedTargetsText(item, fallback) {
    const targets = getAcceptedTargets(item);
    if (!targets.length) return fallback || "";
    return targets.join(" / ");
  }

  function renderAudioButton(text) {
    const row = el("div", "audio-row");
    const btn = el("button", "btn-audio btn-audio--blue", "🔊");
    btn.type = "button";
    btn.addEventListener("click", () => playEnglishAudioGuaranteed(text));
    row.appendChild(btn);
    root.appendChild(row);
  }

  function renderW1(step) {
    renderHeader(step);
    root.appendChild(el("div", "word-hero", step.word.en));
    renderAudioButton(step.word.en);
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    step.emojis.forEach((emoji) => {
      const b = el("button", "choice-btn emoji-card", emoji);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (emoji === step.word.emoji) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.word.emoji + "（" + step.word.en + "）");
    });
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderW2(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt", step.word.zh));
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    step.options.forEach((opt) => {
      const b = el("button", "choice-btn", withZhInLevel11(opt));
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (opt === step.word.en) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + step.word.en));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderW3(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt prompt--sub", "按顺序补全每个漏掉字母"));
    const answerKey = createAnswerKey();
    const patternEl = el("div", "word-hero", "");
    const progressEl = el("div", "mode-badge", "");
    const options = el("div", "choice-grid");
    let cursor = 0;

    function paint() {
      const task = step.tasks[cursor];
      progressEl.textContent = "第 " + (cursor + 1) + " / " + step.tasks.length + " 题";
      patternEl.textContent = task.pattern;
      options.innerHTML = "";
      task.options.forEach((ch) => {
        const b = el("button", "choice-btn", ch);
        b.type = "button";
        b.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect) return;
          if (ch === task.missing) {
            b.classList.add("choice-btn--correct");
            cursor += 1;
            if (cursor >= step.tasks.length) {
              stepStatus.markCorrect();
            } else {
              setTimeout(paint, 160);
            }
          } else {
            b.classList.add("choice-btn--wrong");
            stepStatus.markWrong();
          }
          updateHud();
        });
        options.appendChild(b);
      });
    }

    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + step.word.en));
    root.appendChild(progressEl);
    root.appendChild(patternEl);
    root.appendChild(options);
    root.appendChild(answerKey);
    paint();
  }

  function u5TextEq(a, b) {
    const norm = (x) =>
      String(x || "")
        .trim()
        .toLowerCase()
        .replace(/[“”`]/g, '"')
        .replace(/\s+/g, " ");
    return norm(a) === norm(b);
  }

  function normL18Token(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[’`]/g, "'");
  }

  function renderL18Img(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt prompt--sub", "看表情，选择正确的英文单词"));
    const box = el("div", "l18-img-question", "");
    const pic = el("div", "l18-emoji-pic", String(step.l18Pic || "❓"));
    pic.setAttribute("role", "img");
    pic.setAttribute("aria-label", "与本题相关的表情");
    box.appendChild(pic);
    root.appendChild(box);
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    (step.options || []).forEach((opt) => {
      const b = el("button", "choice-btn", opt);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        grid.querySelectorAll("button").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
        if (isAcceptedOption(step, opt)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + (step.target || "")));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderL18C(step) {
    renderHeader(step);
    const zh = String(step.promptZh || "").trim();
    root.appendChild(el("div", "prompt prompt--sub", "会为你读出中文，也可点喇叭重播"));
    root.appendChild(el("div", "prompt", zh));
    const zline = el("div", "audio-row");
    const zbtn = el("button", "btn-audio btn-audio--blue", "🔊");
    zbtn.type = "button";
    zbtn.setAttribute("aria-label", "重播中文");
    zbtn.addEventListener("click", () => speakChineseTTS(zh));
    zline.appendChild(zbtn);
    root.appendChild(zline);
    setTimeout(() => {
      if (zh) speakChineseTTS(zh);
    }, 120);
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    (step.options || []).forEach((opt) => {
      const b = el("button", "choice-btn", opt);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        grid.querySelectorAll("button").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
        if (isAcceptedOption(step, opt)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + (step.target || "")));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderL18F(step) {
    renderHeader(step);
    root.appendChild(el("div", "l18-zh", step.zh));
    root.appendChild(
      el("div", "l18-prompt", "（环节2）根据中文，在横线上补全每词首字母之后的内容。")
    );
    const box = el("div", "l18-phrase-wrap", "");
    const line = el("div", "l18-phrase-line", "");
    const words = step.words || [];
    const fields = [];
    words.forEach((w, wi) => {
      const full = String(w);
      if (!full) return;
      const first = full[0];
      const rest = full.length > 1 ? full.slice(1) : "";
      const slot = el("div", "l18-word-slot", "");
      slot.appendChild(el("span", "l18-hint", first));
      if (rest) {
        const stub = el("div", "l18-stub", "");
        const inp = document.createElement("input");
        inp.className = "l18-input";
        inp.type = "text";
        inp.autocomplete = "off";
        inp.spellcheck = false;
        inp.maxLength = rest.length;
        inp.setAttribute("aria-label", "补全第 " + (wi + 1) + " 个单词在首字 " + first + " 之后的内容");
        const wch = Math.max(2, Math.min(24, rest.length));
        inp.style.width = wch + "ch";
        inp.style.minWidth = wch + "ch";
        inp.style.maxWidth = wch + "ch";
        stub.appendChild(inp);
        slot.appendChild(stub);
        fields.push({ inp, full });
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            checkL18();
          }
        });
      } else {
        fields.push({ inp: null, full });
      }
      line.appendChild(slot);
    });
    box.appendChild(line);
    root.appendChild(box);
    const answerKey = createAnswerKey();
    const btn = el("button", "btn-primary", "提交检查");
    btn.type = "button";
    function checkL18() {
      if (stepStatus.graded || stepStatus.isCorrect) return;
      for (let i = 0; i < fields.length; i += 1) {
        const { inp, full } = fields[i];
        const rest = full.length > 1 ? full.slice(1) : "";
        let built;
        if (!rest) {
          built = full[0] || "";
        } else {
          built = (full[0] || "") + String((inp && inp.value) || "").trim();
        }
        if (normL18Token(built) !== normL18Token(full)) {
          stepStatus.markWrong();
          return;
        }
      }
      stepStatus.markCorrect();
    }
    btn.addEventListener("click", checkL18);
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>参考答案：</strong> " + (step.en || ""));
    });
    root.appendChild(btn);
    root.appendChild(answerKey);
  }

  function renderL17A(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt prompt--sub", "看场景图标，选择对应的完整英文短语"));
    root.appendChild(el("div", "emoji-hero-phrase", step.phrase.emoji));
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid choice-grid--l17-phrase");
    (step.options || []).forEach((opt) => {
      const b = el("button", "choice-btn choice-btn--phrase", opt);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (u5TextEq(opt, step.target)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.target);
    });
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderL17B(step) {
    renderHeader(step);
    const zh = String((step.phrase && step.phrase.zh) || step.promptZh || "").trim();
    root.appendChild(el("div", "prompt prompt--sub", "会为你读出中文，也可点喇叭重播"));
    root.appendChild(el("div", "prompt", zh));
    const zline = el("div", "audio-row");
    const zbtn = el("button", "btn-audio btn-audio--blue", "🔊");
    zbtn.type = "button";
    zbtn.setAttribute("aria-label", "重播中文");
    zbtn.addEventListener("click", () => speakChineseTTS(zh));
    zline.appendChild(zbtn);
    root.appendChild(zline);
    setTimeout(() => {
      if (zh) speakChineseTTS(zh);
    }, 120);
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid choice-grid--l17-phrase");
    (step.options || []).forEach((opt) => {
      const b = el("button", "choice-btn choice-btn--phrase", withZhInLevel11(opt));
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (u5TextEq(opt, step.target)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.target);
    });
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderL17C(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt prompt--sub", "听英文后，点选你听到的短语（可点喇叭重播）"));
    renderAudioButton(step.target);
    setTimeout(() => {
      playEnglishAudioGuaranteed(step.target);
    }, 120);
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid choice-grid--l17-phrase");
    (step.options || []).forEach((opt) => {
      const b = el("button", "choice-btn choice-btn--phrase", opt);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (u5TextEq(opt, step.target)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.target);
    });
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderL17D(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt prompt--sub", "听中文后，选出对应的英文短语"));
    const zline = el("div", "audio-row");
    const zbtn = el("button", "btn-audio btn-audio--blue", "🔊");
    zbtn.type = "button";
    zbtn.setAttribute("aria-label", "重播中文");
    const zh = (step.phrase && step.phrase.zh) || "";
    zbtn.addEventListener("click", () => speakChineseTTS(zh));
    zline.appendChild(zbtn);
    root.appendChild(zline);
    setTimeout(() => {
      if (zh) speakChineseTTS(zh);
    }, 120);
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid choice-grid--l17-phrase");
    (step.options || []).forEach((opt) => {
      const b = el("button", "choice-btn choice-btn--phrase", opt);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (u5TextEq(opt, step.target)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.target);
    });
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderL17E(step) {
    if (step.l17eMode === "letters" && step.word && step.tasks) {
      return renderW3({ kind: "W3", cat: "word", title: step.title, word: step.word, tasks: step.tasks });
    }
    renderHeader(step);
    root.appendChild(el("div", "prompt", step.promptLine));
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid choice-grid--l17-wordpick");
    (step.options || []).forEach((opt) => {
      const b = el("button", "choice-btn", opt);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (String(opt).trim().toLowerCase() === String(step.target).trim().toLowerCase()) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.target);
    });
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderL17ImageMatch(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt", step.prompt));
    if (step.subPrompt) {
      root.appendChild(el("div", "prompt prompt--sub l16-bundle__hint", step.subPrompt));
    }
    const answerKey = createAnswerKey();
    const wrap = el("div", "l16-bundle l17mt-bundle", "");
    const rowDone = step.rows.map(() => false);

    function checkAllDone() {
      return rowDone.every(Boolean);
    }

    step.rows.forEach((row, rowIdx) => {
      const rowEl = el("div", "l16-bundle-row l17mt-row", "");
      const num = el("div", "l16-bundle-row__num", String(rowIdx + 1));
      const imgBox = el("div", "l17mt-row__img", "");
      const img = document.createElement("img");
      img.src = row.image;
      img.alt = "课本插图 " + (rowIdx + 1);
      img.loading = "lazy";
      imgBox.appendChild(img);
      const grid = el("div", "choice-grid choice-grid--l17-phrase l17mt-row__grid", "");
      const main = el("div", "l17mt-row__main", "");
      main.appendChild(imgBox);
      main.appendChild(grid);
      rowEl.appendChild(num);
      rowEl.appendChild(main);

      row.options.forEach((opt) => {
        const b = el("button", "choice-btn choice-btn--phrase", opt);
        b.type = "button";
        b.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect || rowDone[rowIdx]) return;
          grid.querySelectorAll(".choice-btn").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
          if (u5TextEq(opt, row.target)) {
            b.classList.add("choice-btn--correct");
            grid.querySelectorAll(".choice-btn").forEach((btn) => {
              btn.disabled = true;
            });
            rowDone[rowIdx] = true;
            if (checkAllDone()) {
              stepStatus.markCorrect();
            }
            updateHud();
          } else {
            b.classList.add("choice-btn--wrong");
            setTimeout(() => {
              if (!rowDone[rowIdx] && b.classList.contains("choice-btn--wrong")) {
                b.classList.remove("choice-btn--wrong");
              }
            }, 450);
            updateHud();
          }
        });
        grid.appendChild(b);
      });
      wrap.appendChild(rowEl);
    });

    stepStatus.setReveal(() => {
      const lines = step.rows.map((r, i) => (i + 1) + ". " + r.target);
      revealKey(answerKey, "<strong>参考答案：</strong><br/>" + lines.join("<br/>"));
      wrap.querySelectorAll(".l17mt-row__grid").forEach((grid) => {
        grid.querySelectorAll(".choice-btn").forEach((btn) => {
          btn.disabled = true;
        });
      });
    });
    root.appendChild(wrap);
    root.appendChild(answerKey);
  }

  function renderS1(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt", step.sentenceBlank));
    root.appendChild(el("div", "prompt prompt--sub", "提示：" + step.sentenceZh));
    const answerKey = createAnswerKey();
    const line = el("div", "drop-line");
    const slot = el("div", "drop-slot drop-slot--tile", "");
    const pool = el("div", "drag-pool", "");
    let current = null;

    function paintSlot() {
      slot.innerHTML = "";
      slot.classList.toggle("drop-slot--filled", !!current);
      if (!current) return;
      const chip = el("button", "drag-tile", current);
      chip.type = "button";
      chip.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        current = null;
        paintSlot();
        syncActionBar();
        updateHud();
      });
      slot.appendChild(chip);
    }

    step.options.forEach((word) => {
      const chip = el("button", "drag-tile", word);
      chip.type = "button";
      chip.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (current) return;
        current = word;
        paintSlot();
        if (word === step.word.en) stepStatus.markCorrect();
        else stepStatus.markWrong();
        updateHud();
      });
      pool.appendChild(chip);
    });

    line.appendChild(slot);
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + step.word.en));
    root.appendChild(line);
    root.appendChild(pool);
    root.appendChild(answerKey);
  }

  function renderSentenceBuilder(step, withAudio) {
    renderHeader(step);
    if (state.currentLevel >= 7 && (step.kind === "RV4" || step.kind === "A4")) {
      renderReviewFunPack(step);
    }
    if (withAudio) {
      const text = step.sentence || (step.tokens ? step.tokens.join(" ") : "");
      renderAudioButton(text);
      setTimeout(() => {
        playEnglishAudioGuaranteed(text);
      }, 120);
    }
    root.appendChild(el("div", "prompt prompt--sub", withAudio ? "听音后把句子块排到中间横线上" : step.sentenceZh));
    const answerKey = createAnswerKey();
    const line = el("div", "order-built", "");
    const pool = el("div", "order-row", "");
    const tokens = step.tokens.slice();
    const lineTokens = [];
    const shuffled = shuffle(tokens.map((t, i) => ({ t, i })));

    function paintLine() {
      line.innerHTML = "";
      lineTokens.forEach((entry, idx) => {
        const chip = el("button", "order-tile", entry.t);
        chip.type = "button";
        chip.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect) return;
          lineTokens.splice(idx, 1);
          paintLine();
        });
        line.appendChild(chip);
      });
    }

    function checkLine() {
      if (lineTokens.length !== tokens.length) return;
      const ok = lineTokens.every((x, i) => x.t === tokens[i]);
      if (ok) {
        stepStatus.markCorrect();
      } else {
        stepStatus.markWrong();
      }
      updateHud();
    }

    shuffled.forEach((entry) => {
      const chip = el("button", "order-tile", entry.t);
      chip.type = "button";
      chip.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (lineTokens.length >= tokens.length) return;
        lineTokens.push(entry);
        paintLine();
        checkLine();
      });
      pool.appendChild(chip);
    });

    stepStatus.setReveal(() => {
      lineTokens.length = 0;
      tokens.forEach((t, i) => lineTokens.push({ t, i }));
      paintLine();
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.sentence);
    });
    root.appendChild(line);
    root.appendChild(pool);
    root.appendChild(answerKey);
    paintLine();
  }

  function renderSpeakingStep(step) {
    renderHeader(step);
    const target = step.target || "";
    const answerKey = createAnswerKey();
    root.appendChild(el("div", "prompt", step.hintZh || "请跟读示范发音"));
    root.appendChild(el("div", "word-hero", withZhInLevel11(target)));
    renderAudioButton(target);
    const wrap = el("div", "dialogue-box dialogue-box--yellow", "");
    const status = el("div", "prompt prompt--sub", "示范发音会自动播放，请跟读后直接点击【继续闯关】");
    setTimeout(() => {
      playEnglishAudioGuaranteed(target);
    }, 120);
    stepStatus.isCorrect = true;

    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>参考读音：</strong> " + target);
    });

    wrap.appendChild(status);
    root.appendChild(wrap);
    root.appendChild(answerKey);
  }

  function renderDictationStep(step) {
    renderHeader(step);
    renderAudioButton(step.word.en);
    root.appendChild(el("div", "prompt prompt--sub", "听音后，用字母块拼出单词"));
    const answerKey = createAnswerKey();
    const line = el("div", "spell-line", "");
    const pool = el("div", "letter-pool", "");
    const bag = step.letters.slice();
    const chosen = [];

    function refresh() {
      line.innerHTML = "";
      chosen.forEach((ch, idx) => {
        const t = el("button", "letter-tile", ch);
        t.type = "button";
        t.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect) return;
          bag.push(ch);
          chosen.splice(idx, 1);
          refresh();
        });
        line.appendChild(t);
      });

      pool.innerHTML = "";
      bag.forEach((ch, i) => {
        const t = el("button", "letter-tile", ch);
        t.type = "button";
        t.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect) return;
          chosen.push(ch);
          bag.splice(i, 1);
          refresh();
          const text = chosen.join("");
          if (text === step.word.en) {
            stepStatus.markCorrect();
          } else if (chosen.length === step.word.en.length) {
            stepStatus.markWrong();
          }
          updateHud();
        });
        pool.appendChild(t);
      });
    }

    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.word.en);
    });
    root.appendChild(line);
    root.appendChild(pool);
    root.appendChild(answerKey);
    refresh();
  }

  function renderWritingStep(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt", "请默写：" + step.word.zh));
    const answerKey = createAnswerKey();
    const wrap = el("div", "dialogue-box", "");
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "输入英文单词";
    input.autocomplete = "off";
    input.style.width = "100%";
    input.style.height = "46px";
    input.style.fontSize = "20px";
    input.style.borderRadius = "12px";
    input.style.border = "2px solid #d8d8d8";
    input.style.padding = "0 12px";
    const btn = el("button", "btn-secondary", "提交检查");
    btn.type = "button";
    btn.addEventListener("click", () => {
      if (stepStatus.graded || stepStatus.isCorrect) return;
      const v = input.value.trim().toLowerCase();
      if (!v) return;
      if (v === step.word.en) {
        stepStatus.markCorrect();
        input.style.borderColor = "#58cc02";
      } else {
        stepStatus.markWrong();
        input.style.borderColor = "#ff4b4b";
      }
      updateHud();
    });
    wrap.appendChild(input);
    wrap.appendChild(btn);
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确答案：</strong> " + step.word.en);
      input.disabled = true;
      btn.disabled = true;
    });
    root.appendChild(wrap);
    root.appendChild(answerKey);
  }

  function renderReviewChoice(step) {
    renderHeader(step);
    renderReviewFunPack(step);
    if (step.passage) {
      if (step.topic) {
        root.appendChild(el("div", "reading-topic", step.topic));
      }
      if (step.subTopic) {
        root.appendChild(el("div", "reading-subhead", step.subTopic));
      }
      const passBox = el("div", "reading-passage", step.passage);
      root.appendChild(passBox);
    }
    if (step.audioUrl) {
      const audioWrap = el("div", "dialogue-box dialogue-box--yellow", "");
      const audioHint = el("div", "prompt prompt--sub", "可先播放听力音频，再答题。");
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "none";
      const src = String(step.audioUrl || "");
      audio.src = src ? src + (src.includes("?") ? "&" : "?") + "v=" + Date.now() : "";
      audio.style.width = "100%";
      audioWrap.appendChild(audioHint);
      audioWrap.appendChild(audio);
      root.appendChild(audioWrap);
    }
    root.appendChild(el("div", "prompt", step.prompt));
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    step.options.forEach((opt, i) => {
      const letter = step.optionLetters && step.optionLetters[i];
      const label = letter ? letter + ". " + opt : opt;
      const b = el("button", "choice-btn", state.currentLevel === 11 ? withZhInLevel11(label) : label);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        grid.querySelectorAll("button").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
        if (isAcceptedOption(step, opt)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + acceptedTargetsText(step, step.target)));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderLevel16Bundle(step) {
    renderHeader(step);
    root.appendChild(el("div", "prompt", step.prompt));
    if (step.subPrompt) {
      root.appendChild(el("div", "prompt prompt--sub l16-bundle__hint", step.subPrompt));
    }
    const answerKey = createAnswerKey();
    const letters = step.optionLetters || ["A", "B", "C"];
    const wrap = el("div", "l16-bundle", "");
    const rowDone = step.rows.map(() => false);

    function checkAllDone() {
      return rowDone.every(Boolean);
    }

    step.rows.forEach((row, rowIdx) => {
      const rowEl = el("div", "l16-bundle-row", "");
      const num = el("div", "l16-bundle-row__num", String(rowIdx + 1));
      const grid = el("div", "choice-grid choice-grid--odd-one-out l16-bundle-row__choices", "");
      const main = el("div", "l16-bundle-row__main", "");
      if (row.cue) {
        main.appendChild(el("div", "l16-bundle-row__cue", row.cue));
      }
      main.appendChild(grid);
      rowEl.appendChild(num);
      rowEl.appendChild(main);

      row.options.forEach((opt, i) => {
        const label = letters[i] ? letters[i] + ". " + opt : opt;
        const b = el("button", "choice-btn", label);
        b.type = "button";
        const col = el("div", "odd-one-out-col", "");
        const meta = el("div", "odd-one-out-meta odd-one-out-meta--hidden", "");
        meta.appendChild(el("div", "odd-one-out-pos", ""));
        meta.appendChild(el("div", "odd-one-out-zh", ""));
        col.appendChild(b);
        col.appendChild(meta);
        grid.appendChild(col);

        b.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect || rowDone[rowIdx]) return;
          grid.querySelectorAll(".choice-btn").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
          const ok = normalizeOptionText(opt) === normalizeOptionText(row.target);
          if (ok) {
            b.classList.add("choice-btn--correct");
            grid.querySelectorAll(".choice-btn").forEach((btn) => {
              btn.disabled = true;
            });
            revealOddOneOutRowMeta(row, grid);
            rowDone[rowIdx] = true;
            if (checkAllDone()) {
              stepStatus.markCorrect();
            } else {
              speakLevel16SubCorrect();
            }
          } else {
            b.classList.add("choice-btn--wrong");
            setTimeout(() => {
              if (!rowDone[rowIdx] && b.classList.contains("choice-btn--wrong")) {
                b.classList.remove("choice-btn--wrong");
              }
            }, 450);
          }
          updateHud();
        });
      });
      wrap.appendChild(rowEl);
    });

    stepStatus.setReveal(() => {
      const lines = step.rows.map((r, i) => (i + 1) + ". " + acceptedTargetsText({ target: r.target }, r.target));
      revealKey(answerKey, "<strong>正确答案：</strong><br/>" + lines.join("<br/>"));
      wrap.querySelectorAll(".l16-bundle-row__choices").forEach((gridEl, idx) => {
        revealOddOneOutRowMeta(step.rows[idx], gridEl);
        gridEl.querySelectorAll(".choice-btn").forEach((btn) => {
          btn.disabled = true;
        });
      });
    });
    root.appendChild(wrap);
    root.appendChild(answerKey);
  }

  function renderLevel16Reply(step) {
    renderHeader(step);
    if (step.passage) {
      const passBox = el("div", "l16-reply-passage reading-passage", step.passage);
      root.appendChild(passBox);
    }
    const answerKey = createAnswerKey();
    const wrap = el("div", "l16-bundle l16-reply-bundle", "");
    const rowDone = step.rows.map(() => false);

    function checkAllDone() {
      return rowDone.every(Boolean);
    }

    step.rows.forEach((row, rowIdx) => {
      const rowEl = el("div", "l16-bundle-row l16-reply-row", "");
      const num = el("div", "l16-bundle-row__num", String(rowIdx + 1));
      const grid = el("div", "choice-grid choice-grid--five l16-reply-row__choices", "");
      const main = el("div", "l16-reply-row__main", "");
      if (!step.passage) {
        const body = el("div", "l16-reply-row__body", "");
        if (row.scene) {
          body.appendChild(el("div", "l16-reply-row__scene", row.scene));
        }
        body.appendChild(el("div", "l16-reply-row__dialogue", row.dialogue));
        main.appendChild(body);
      }
      main.appendChild(grid);
      rowEl.appendChild(num);
      rowEl.appendChild(main);

      const letters = row.optionLetters || ["A", "B", "C", "D", "E"];
      row.options.forEach((opt, i) => {
        const label = letters[i] ? letters[i] + ". " + opt : opt;
        const b = el("button", "choice-btn", label);
        b.type = "button";
        grid.appendChild(b);
        b.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect || rowDone[rowIdx]) return;
          grid.querySelectorAll(".choice-btn").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
          const ok = normalizeOptionText(opt) === normalizeOptionText(row.target);
          if (ok) {
            b.classList.add("choice-btn--correct");
            grid.querySelectorAll(".choice-btn").forEach((btn) => {
              btn.disabled = true;
            });
            rowDone[rowIdx] = true;
            if (checkAllDone()) {
              stepStatus.markCorrect();
            } else {
              speakLevel16SubCorrect();
            }
          } else {
            b.classList.add("choice-btn--wrong");
            setTimeout(() => {
              if (!rowDone[rowIdx] && b.classList.contains("choice-btn--wrong")) {
                b.classList.remove("choice-btn--wrong");
              }
            }, 450);
          }
          updateHud();
        });
      });
      wrap.appendChild(rowEl);
    });

    stepStatus.setReveal(() => {
      const lines = step.rows.map((r, i) => (i + 1) + ". " + (r.targetLetter || "?") + ". " + r.target);
      revealKey(answerKey, "<strong>正确答案：</strong><br/>" + lines.join("<br/>"));
      wrap.querySelectorAll(".l16-reply-row__choices").forEach((gridEl) => {
        gridEl.querySelectorAll(".choice-btn").forEach((btn) => {
          btn.disabled = true;
        });
      });
    });
    root.appendChild(wrap);
    root.appendChild(answerKey);
  }

  function renderLevel16TrueFalse(step) {
    renderHeader(step);
    if (step.passage) {
      root.appendChild(el("div", "l16-reply-passage reading-passage", step.passage));
    }
    if (step.subPrompt) {
      root.appendChild(el("div", "prompt prompt--sub l16-bundle__hint", step.subPrompt));
    }
    const answerKey = createAnswerKey();
    const wrap = el("div", "l16-bundle l16-tf-bundle", "");
    const rowDone = step.rows.map(() => false);

    function checkAllDone() {
      return rowDone.every(Boolean);
    }

    step.rows.forEach((row, rowIdx) => {
      const rowEl = el("div", "l16-bundle-row l16-tf-row", "");
      const num = el("div", "l16-bundle-row__num", String(rowIdx + 1));
      const main = el("div", "l16-bundle-row__main", "");
      main.appendChild(el("div", "l16-tf-statement", row.statement));
      const grid = el("div", "choice-grid l16-tf-grid", "");
      ["T", "F"].forEach((opt) => {
        const b = el("button", "choice-btn l16-tf-btn", opt);
        b.type = "button";
        grid.appendChild(b);
        b.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect || rowDone[rowIdx]) return;
          grid.querySelectorAll(".choice-btn").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
          const ok = normalizeOptionText(opt) === normalizeOptionText(row.target);
          if (ok) {
            b.classList.add("choice-btn--correct");
            grid.querySelectorAll(".choice-btn").forEach((btn) => {
              btn.disabled = true;
            });
            rowDone[rowIdx] = true;
            if (checkAllDone()) {
              stepStatus.markCorrect();
            } else {
              speakLevel16SubCorrect();
            }
          } else {
            b.classList.add("choice-btn--wrong");
            setTimeout(() => {
              if (!rowDone[rowIdx] && b.classList.contains("choice-btn--wrong")) {
                b.classList.remove("choice-btn--wrong");
              }
            }, 450);
          }
          updateHud();
        });
      });
      main.appendChild(grid);
      rowEl.appendChild(num);
      rowEl.appendChild(main);
      wrap.appendChild(rowEl);
    });

    stepStatus.setReveal(() => {
      const lines = step.rows.map((r, i) => (i + 1) + ". " + r.target);
      revealKey(answerKey, "<strong>正确答案：</strong><br/>" + lines.join("<br/>"));
      wrap.querySelectorAll(".l16-tf-grid").forEach((gridEl) => {
        gridEl.querySelectorAll(".choice-btn").forEach((btn) => {
          btn.disabled = true;
        });
      });
    });
    root.appendChild(wrap);
    root.appendChild(answerKey);
  }

  function renderReviewOrder(step) {
    renderHeader(step);
    renderReviewFunPack(step);
    root.appendChild(el("div", "prompt prompt--sub", "把句子按正确顺序排好"));
    const answerKey = createAnswerKey();
    const line = el("div", "order-built", "");
    const pool = el("div", "order-row", "");
    const tokens = step.tokens.slice();
    const lineTokens = [];
    const shuffled = shuffle(tokens.map((t, i) => ({ t, i })));

    function paint() {
      line.innerHTML = "";
      lineTokens.forEach((entry, idx) => {
        const chip = el("button", "order-tile", entry.t);
        chip.type = "button";
        chip.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect) return;
          lineTokens.splice(idx, 1);
          paint();
        });
        line.appendChild(chip);
      });
    }
    function check() {
      if (lineTokens.length !== tokens.length) return;
      const ok = lineTokens.every((x, i) => x.t === tokens[i]);
      if (ok) stepStatus.markCorrect();
      else stepStatus.markWrong();
      updateHud();
    }
    shuffled.forEach((entry) => {
      const chip = el("button", "order-tile", entry.t);
      chip.type = "button";
      chip.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (lineTokens.length >= tokens.length) return;
        lineTokens.push(entry);
        paint();
        check();
      });
      pool.appendChild(chip);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确句子：</strong> " + step.sentence));
    root.appendChild(line);
    root.appendChild(pool);
    root.appendChild(answerKey);
    paint();
  }

  function renderSceneCard(step) {
    const card = el("div", "scene-card scene-card--" + (step.sceneKey || "playground"), "");
    const bg = el("div", "scene-card__bg", "");
    const name = el("div", "scene-card__name", step.speaker || "青蛙伙伴");
    const actor = el("div", "scene-card__actor", (step.speakerEmoji || "🐸"));
    const bubble = el("div", "scene-card__bubble", withZhInLevel11(step.line || ""));
    const sceneVisual = buildSceneVisual(step);
    const decor = el("div", "scene-card__decor", sceneVisual.decor);
    const set = el("div", "scene-card__set", "");
    const back = el("div", "scene-card__set-item scene-card__set-item--back", sceneVisual.back);
    const left = el("div", "scene-card__set-item scene-card__set-item--left", sceneVisual.left);
    const center = el("div", "scene-card__set-item scene-card__set-item--center", sceneVisual.center);
    const right = el("div", "scene-card__set-item scene-card__set-item--right", sceneVisual.right);
    const ground = el("div", "scene-card__set-item scene-card__set-item--ground", sceneVisual.ground);
    const cap = el("div", "scene-card__caption", (step.scene || ""));
    set.appendChild(back);
    set.appendChild(left);
    set.appendChild(center);
    set.appendChild(right);
    set.appendChild(ground);
    bg.appendChild(name);
    bg.appendChild(set);
    bg.appendChild(decor);
    bg.appendChild(actor);
    bg.appendChild(bubble);
    card.appendChild(bg);
    card.appendChild(cap);
    return card;
  }

  function buildSceneVisual(step) {
    const key = step.sceneKey || "playground";
    const map = {
      school: {
        back: "☁️  ☀️",
        left: "🏫",
        center: "🚪",
        right: "📚",
        ground: "🌿  🐸  🌿",
        decor: "🏫 📚 🛎️",
      },
      classroom: {
        back: "🧱  📌",
        left: "🧑‍🏫",
        center: "🪑🪑",
        right: "📝",
        ground: "📖  🐸  ✏️",
        decor: "🧑‍🏫 🪑 ✏️",
      },
      playground: {
        back: "☁️  ☁️",
        left: "🌳",
        center: "🛝",
        right: "⚽",
        ground: "🟩  🐸🐸  🟩",
        decor: "🌳 ⚽ 🛝",
      },
      gym: {
        back: "🧱  🧱",
        left: "🏀",
        center: "⛹️",
        right: "🏓",
        ground: "🟫  🐸  🟫",
        decor: "🏀 🏓 🏸",
      },
      art: {
        back: "🖼️  🎭",
        left: "🎨",
        center: "🧑‍🎨",
        right: "🖌️",
        ground: "🟪  🐸  ✨",
        decor: "🎨 🖼️ ✨",
      },
      track: {
        back: "☁️  🌤️",
        left: "🚩",
        center: "🏃",
        right: "🏁",
        ground: "🟥🟥  🐸  🟥🟥",
        decor: "🏃 🏁 👟",
      },
      booth: {
        back: "🎪  🎈",
        left: "🎯",
        center: "🧸",
        right: "🎟️",
        ground: "🟨  🐸🐸🐸  🟨",
        decor: "🎪 🎯 🎟️",
      },
      final: {
        back: "🌟  🎆",
        left: "🏆",
        center: "🎤",
        right: "🎉",
        ground: "🟦  🐸🐸  🟦",
        decor: "🏆 🎆 🌟",
      },
      mountain: {
        back: "☁️  🌤️",
        left: "⛰️",
        center: "🪨",
        right: "🌲",
        ground: "🟫  🐸  🟫",
        decor: "⛰️ 🪨 🌤️",
      },
      finish: {
        back: "🎊  🎉",
        left: "🏁",
        center: "🎯",
        right: "👏",
        ground: "🟩  🐸  🟩",
        decor: "🎉 🏁 👏",
      },
    };
    const picked = map[key] || map.playground;
    if (step.sceneDecor) picked.decor = step.sceneDecor;
    return picked;
  }

  function sceneDecorByKey(key) {
    const map = {
      school: "🏫 📚 🛎️",
      classroom: "🧑‍🏫 🪑 ✏️",
      playground: "🌳 ⚽ 🛝",
      gym: "🏀 🏓 🏸",
      art: "🎨 🖼️ ✨",
      track: "🏃 🏁 👟",
      booth: "🎪 🎯 🎟️",
      final: "🏆 🎆 🌟",
      mountain: "⛰️ 🪨 🌤️",
      finish: "🎉 🏁 👏",
    };
    return map[key] || "🐸 ✨ 🌈";
  }

  function phraseForVisual(step) {
    if (step.targetSentence) return step.targetSentence;
    if (step.sentence) return step.sentence;
    if (step.target) return step.target;
    const m = (step.prompt || "").match(/“(.+?)”/);
    return m ? m[1] : "";
  }

  function visualEmojiList(phrase) {
    const text = (phrase || "").toLowerCase();
    const picked = [];
    if (text.includes("join")) picked.push("🤝");
    if (text.includes("love")) picked.push("❤️");
    if (text.includes("try")) picked.push("🧪");
    if (text.includes("play")) picked.push("⚽");
    if (text.includes("next")) picked.push("⏭️");
    if (text.includes("turn")) picked.push("🎮");
    if (text.includes("first")) picked.push("🥇");
    if (text.includes("fun")) picked.push("🎉");
    if (text.includes("thanks")) picked.push("🙅");
    if (!picked.length) picked.push("🐸", "✨", "🌈");
    return picked.slice(0, 4);
  }

  function renderReviewFunPack(step) {
    if (state.currentLevel < 7 || state.currentLevel > 8) return;
    const base = {
      sceneKey: step.sceneKey || "school",
      scene: step.scene || "青蛙校园站",
      speakerEmoji: step.speakerEmoji || "🐸🐸🐸",
      sceneDecor: step.sceneDecor || sceneDecorByKey(step.sceneKey || "school"),
    };
    root.appendChild(
      renderSceneCard({
        ...base,
        line: phraseForVisual(step),
      })
    );
    const strip = el("div", "review-sticker-row", "");
    visualEmojiList(phraseForVisual(step)).forEach((icon) => {
      strip.appendChild(el("span", "review-sticker", icon));
    });
    root.appendChild(strip);
  }

  function renderAdvancedChoice(step, roleMode) {
    renderHeaderWithAudio(step, step.line || step.target || "");
    if (step.scene || step.line) {
      root.appendChild(renderSceneCard(step));
    }
    const questionText = roleMode
      ? (step.promptZh || "请选择你要说的一句：")
      : (step.question || "请选择最自然的回应：");
    root.appendChild(el("div", "prompt prompt--sub", questionText));

    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    step.options.forEach((opt) => {
      const b = el("button", "choice-btn", withZhInLevel11(opt));
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        grid.querySelectorAll("button").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
        if (isAcceptedOption(step, opt)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>推荐回答：</strong> " + acceptedTargetsText(step, step.target)));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderAdvancedOrder(step) {
    renderHeader(step);
    const sentence = step.targetSentence || step.sentence;
    root.appendChild(el("div", "prompt prompt--sub", (step.speaker || "你") + " 说：把句子拼完整"));
    const zhHint = ZH_BY_EN[sentence] || "";
    if (zhHint) {
      root.appendChild(el("div", "prompt prompt--sub", "中文提示：" + zhHint));
    }
    const answerKey = createAnswerKey();
    const line = el("div", "order-built", "");
    const pool = el("div", "order-row", "");
    const tokens = tokenizeSentence(sentence);
    const lineTokens = [];
    const shuffled = shuffle(tokens.map((t, i) => ({ t, i })));

    function paintLine() {
      line.innerHTML = "";
      lineTokens.forEach((entry, idx) => {
        const chip = el("button", "order-tile", entry.t);
        chip.type = "button";
        chip.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect) return;
          lineTokens.splice(idx, 1);
          paintLine();
        });
        line.appendChild(chip);
      });
    }
    function checkLine() {
      if (lineTokens.length !== tokens.length) return;
      const ok = lineTokens.every((x, i) => x.t === tokens[i]);
      if (ok) stepStatus.markCorrect();
      else stepStatus.markWrong();
      updateHud();
    }
    shuffled.forEach((entry) => {
      const chip = el("button", "order-tile", entry.t);
      chip.type = "button";
      chip.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        if (lineTokens.length >= tokens.length) return;
        lineTokens.push(entry);
        paintLine();
        checkLine();
      });
      pool.appendChild(chip);
    });
    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>正确句子：</strong> " + sentence);
    });
    root.appendChild(line);
    root.appendChild(pool);
    root.appendChild(answerKey);
    paintLine();
  }

  function renderAdvancedMulti(step) {
    renderHeader(step);
    const answerKey = createAnswerKey();
    const box = el("div", "dialogue-box", "");
    const grid = el("div", "choice-grid");
    let turn = 0;

    function paintTurn() {
      const t = step.turns[turn];
      box.innerHTML = "";
      box.appendChild(renderSceneCard({
        sceneKey: turn === 0 ? "final" : "finish",
        scene: "剧情任务 · 第 " + (turn + 1) + " 轮",
        line: t.line,
        speaker: t.speaker,
        speakerEmoji: t.speaker.includes("美丽") ? "🐸👧" : t.speaker.includes("帅气") ? "🐸👦" : "🐸🐸🐸",
      }));
      box.appendChild(el("div", "", "第 " + (turn + 1) + " 轮"));
      box.appendChild(el("div", "", t.speaker + "："));
      box.appendChild(el("div", "prompt prompt--sub", t.line));
      const audioBtn = el("button", "btn-audio btn-audio--blue", "🔊");
      audioBtn.type = "button";
      audioBtn.style.margin = "8px auto";
      audioBtn.style.display = "block";
      audioBtn.addEventListener("click", () => playEnglishAudioGuaranteed(t.line));
      box.appendChild(audioBtn);
      grid.innerHTML = "";
      t.options.forEach((opt) => {
        const b = el("button", "choice-btn", withZhInLevel11(opt));
        b.type = "button";
        b.addEventListener("click", () => {
          if (stepStatus.graded || stepStatus.isCorrect) return;
          if (isAcceptedOption(t, opt)) {
            playEnglishAudioGuaranteed(t.target);
            if (turn >= step.turns.length - 1) {
              stepStatus.markCorrect();
            } else {
              turn += 1;
              paintTurn();
            }
          } else {
            b.classList.add("choice-btn--wrong");
            stepStatus.markWrong();
          }
          updateHud();
        });
        grid.appendChild(b);
      });
    }

    stepStatus.setReveal(() => {
      const lines = step.turns.map((t) => t.speaker + " -> " + acceptedTargetsText(t, t.target)).join("<br/>");
      revealKey(answerKey, "<strong>推荐对话：</strong><br/>" + lines);
    });
    root.appendChild(box);
    root.appendChild(grid);
    root.appendChild(answerKey);
    paintTurn();
  }

  function renderSituationalChoice(step) {
    renderHeader(step);
    root.appendChild(renderSceneCard(step));
    const panel = el(
      "div",
      "dialogue-box dialogue-box--yellow",
      '<div class="hint-pill">趣味情景题</div><div>' +
        (step.story || "") +
        '</div><div class="prompt prompt--sub" style="margin-top:8px">' +
        (step.question || "") +
        "</div>"
    );
    root.appendChild(panel);
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    step.options.forEach((opt) => {
      const b = el("button", "choice-btn", withZhInLevel11(opt));
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        grid.querySelectorAll("button").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
        if (isAcceptedOption(step, opt)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>最佳表达：</strong> " + acceptedTargetsText(step, step.target)));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderTipStep(step) {
    renderHeader(step);
    const box = el("div", "dialogue-box dialogue-box--yellow", "");
    if (step.scene) {
      box.appendChild(el("div", "prompt prompt--sub", step.scene));
    }
    const content = el("div", "prompt prompt--sub", step.content || "");
    content.style.textAlign = "left";
    content.style.whiteSpace = "pre-line";
    content.style.lineHeight = "1.6";
    box.appendChild(content);
    const okBtn = el("button", "btn-primary", step.btnText || "我知道了");
    okBtn.type = "button";
    okBtn.style.marginTop = "10px";
    okBtn.addEventListener("click", () => {
      if (stepStatus.graded || stepStatus.isCorrect) return;
      stepStatus.markCorrect();
      updateHud();
    });
    box.appendChild(okBtn);
    root.appendChild(box);
  }

  function renderStoryLineStep(step) {
    renderHeaderWithAudio(step, step.en || "");
    root.appendChild(
      renderSceneCard({
        sceneKey: step.sceneKey || "playground",
        scene: step.scene || "连续剧情",
        line: step.en || "",
        speaker: step.speaker || "青蛙伙伴",
        speakerEmoji: step.speakerEmoji || "🐸",
      })
    );
    const box = el("div", "dialogue-box dialogue-box--yellow", "");
    box.appendChild(el("div", "prompt prompt--sub", "英文台词"));
    box.appendChild(el("div", "word-hero", step.en || ""));
    box.appendChild(el("div", "prompt prompt--sub", "中文释义：" + (step.zh || "")));
    const btn = el("button", "btn-primary", "下一幕");
    btn.type = "button";
    btn.style.marginTop = "10px";
    btn.addEventListener("click", () => {
      if (stepStatus.graded || stepStatus.isCorrect) return;
      stepStatus.markCorrect();
      updateHud();
    });
    box.appendChild(btn);
    root.appendChild(box);
  }

  function renderVideoWatchStep(step) {
    renderHeader(step);
    root.appendChild(
      renderSceneCard({
        sceneKey: step.sceneKey || "playground",
        scene: step.scene || "先看视频",
        line: "先看视频，下一页再答题",
        speaker: "视频任务",
        speakerEmoji: "🎬🐸",
      })
    );
    const videoWrap = el("div", "video-quiz-wrap", "");
    const video = document.createElement("video");
    video.className = "video-quiz-player";
    video.controls = false;
    video.preload = "metadata";
    video.playsInline = true;
    const rawVideoSrc = String(step.video || "");
    video.src = rawVideoSrc
      ? rawVideoSrc + (rawVideoSrc.includes("?") ? "&" : "?") + "v=" + Date.now()
      : "";
    const tip = el("div", "video-quiz-tip", "视频只能播放两次，看看你的记忆力哦。");
    const row = el("div", "video-quiz-actions", "");
    const watchLimit = 2;
    let watchedTimes = 0;
    let isPlaying = false;
    /** 单次播放内避免 ended / timeupdate 重复计次（部分移动端偶发不触发 ended） */
    let playEndHandled = false;

    const playBtn = el("button", "btn-secondary", "开始播放");
    playBtn.type = "button";
    const readyBtn = el("button", "btn-secondary", "我准备好了");
    readyBtn.type = "button";
    readyBtn.disabled = true;
    row.appendChild(playBtn);
    row.appendChild(readyBtn);

    function refreshState() {
      if (isPlaying) {
        tip.textContent = "正在播放视频，请认真看完。";
        playBtn.disabled = true;
        readyBtn.disabled = true;
        return;
      }
      if (watchedTimes <= 0) tip.textContent = "视频只能播放两次，看看你的记忆力哦。";
      else if (watchedTimes === 1) tip.textContent = "已播放一次，点击“我准备好了”进入答题。";
      else tip.textContent = "视频两次已播放完，点击“我准备好了”进入答题。";
      playBtn.disabled = watchedTimes >= watchLimit;
      readyBtn.disabled = watchedTimes < 1;
    }

    function onWatchPlaybackEnd() {
      if (playEndHandled) return;
      playEndHandled = true;
      isPlaying = false;
      watchedTimes = Math.min(watchLimit, watchedTimes + 1);
      refreshState();
    }

    playBtn.addEventListener("click", () => {
      if (isPlaying || watchedTimes >= watchLimit) return;
      playEndHandled = false;
      try {
        video.currentTime = 0;
        isPlaying = true;
        refreshState();
        const p = video.play();
        if (p && p.catch) {
          p.catch(() => {
            isPlaying = false;
            refreshState();
          });
        }
      } catch (_) {
        isPlaying = false;
        refreshState();
      }
    });

    readyBtn.addEventListener("click", () => {
      if (isPlaying || watchedTimes < 1) return;
      stepStatus.markCorrect();
      updateHud();
    });

    video.addEventListener("ended", onWatchPlaybackEnd);
    video.addEventListener("timeupdate", () => {
      if (playEndHandled || !isPlaying) return;
      const d = video.duration;
      if (!d || !Number.isFinite(d) || d <= 0) return;
      if (video.currentTime >= d - 0.2) onWatchPlaybackEnd();
    });
    video.addEventListener("pause", () => {
      if (isPlaying && video.currentTime < (video.duration || 0)) {
        isPlaying = false;
        refreshState();
      }
    });
    video.addEventListener("error", () => {
      isPlaying = false;
      tip.textContent =
        "视频加载失败（路径或网络）。请确认已部署 assets/videos。仍可点「我准备好了」继续，以免卡住。";
      if (watchedTimes < 1) watchedTimes = 1;
      refreshState();
    });
    videoWrap.appendChild(video);
    videoWrap.appendChild(tip);
    videoWrap.appendChild(row);
    root.appendChild(videoWrap);
    refreshState();
  }

  function renderVideoQuizStep(step) {
    renderHeader(step);
    root.appendChild(
      renderSceneCard({
        sceneKey: step.sceneKey || "playground",
        scene: "根据上一页视频内容作答",
        line: step.target || "",
        speaker: "记忆挑战",
        speakerEmoji: "🧠🐸",
      })
    );
    root.appendChild(el("div", "prompt prompt--sub", step.prompt || "请选择正确答案："));
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    (step.options || []).forEach((opt) => {
      const b = el("button", "choice-btn", state.currentLevel === 11 ? withZhInLevel11(opt) : opt);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        grid.querySelectorAll("button").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
        if (isAcceptedOption(step, opt)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + acceptedTargetsText(step, step.target || "")));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function formatClozePassageHTML(template, highlightBlank) {
    const esc = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const parts = String(template || "").split(/(\{\{\d+\}\})/);
    let html = "";
    parts.forEach((part) => {
      const m = part.match(/^\{\{(\d+)\}\}$/);
      if (m) {
        const n = Number(m[1]);
        const on = n === highlightBlank;
        html +=
          '<span class="cloze-gap' +
          (on ? " cloze-gap--active" : "") +
          '"><span class="cloze-gap__num">' +
          esc(String(n)) +
          "</span> ______ </span>";
      } else {
        html += esc(part).replace(/\n/g, "<br/>");
      }
    });
    return html;
  }

  function renderClozeFillStep(step) {
    renderHeader(step);
    if (step.sectionTitle) {
      root.appendChild(el("div", "cloze-section-title", step.sectionTitle));
    }
    if (step.articleLabel) {
      root.appendChild(el("div", "reading-subhead", step.articleLabel));
    }
    const pass = el("div", "reading-passage cloze-passage");
    pass.innerHTML = formatClozePassageHTML(step.passageTemplate, step.blankIndex);
    root.appendChild(pass);
    root.appendChild(el("div", "prompt prompt--sub", step.prompt || "请点击选择正确答案"));
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    const letters = step.optionLetters;
    (step.options || []).forEach((opt, i) => {
      const label = letters && letters[i] ? letters[i] + ". " + opt : opt;
      const b = el("button", "choice-btn", label);
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        grid.querySelectorAll("button").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
        if (isAcceptedOption(step, opt)) {
          b.classList.add("choice-btn--correct");
          stepStatus.markCorrect();
        } else {
          b.classList.add("choice-btn--wrong");
          stepStatus.markWrong();
        }
        updateHud();
      });
      grid.appendChild(b);
    });
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + acceptedTargetsText(step, step.target)));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderStep(step) {
    stepStatus.reset();
    renderByKind[step.kind](step);
    syncActionBar();
    updateHud();
  }

  const renderByKind = {
    TIP: renderTipStep,
    ST1: renderStoryLineStep,
    VW: renderVideoWatchStep,
    VQ: renderVideoQuizStep,
    W1: renderW1,
    W2: renderW2,
    P1: renderSpeakingStep,
    W3: renderW3,
    S1: renderS1,
    S2: (step) => renderSentenceBuilder(step, true),
    S3: (step) => renderSentenceBuilder(step, false),
    P2: renderSpeakingStep,
    D1: renderDictationStep,
    D2: renderDictationStep,
    M1: renderWritingStep,
    M2: renderWritingStep,
    M3: renderWritingStep,
    RV1: renderReviewChoice,
    RV2: renderReviewChoice,
    RV3: renderReviewOrder,
    RV4: (step) => renderSentenceBuilder(step, true),
    A1: (step) => renderAdvancedChoice(step, false),
    A2: (step) => renderAdvancedChoice(step, true),
    A3: renderAdvancedOrder,
    A4: (step) => renderSentenceBuilder(step, true),
    A5: renderAdvancedMulti,
    A6: renderSituationalChoice,
    CLZ: renderClozeFillStep,
    L16: renderLevel16Bundle,
    L16R: renderLevel16Reply,
    L16R2: renderLevel16Reply,
    L16TF: renderLevel16TrueFalse,
    L17A: renderL17A,
    L17B: renderL17B,
    L17C: renderL17C,
    L17D: renderL17D,
    L17E: renderL17E,
    L17F: (s) => renderSentenceBuilder(s, false),
    L17MT: renderL17ImageMatch,
    L18IMG: renderL18Img,
    L18C: renderL18C,
    L18F: renderL18F,
  };

  function renderCurrentStep() {
    clearRoot();
    if (autoRetryTimer) {
      clearTimeout(autoRetryTimer);
      autoRetryTimer = null;
    }
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
      autoAdvancing = false;
    }
    currentStepResult = null;
    praisePop.classList.add("praise-pop--hidden");
    const step = currentStep();
    if (!step) return;
    if (lastRenderedLevel !== state.currentLevel) {
      lastRenderedLevel = state.currentLevel;
      levelStartCelebrationShown = null;
    }
    syncLevelPlayBumpForStep0Session();
    root.classList.toggle("challenge-zone--yellow", state.currentLevel >= 7);
    renderStep(step);
    maybeAutoSpeakLevel12Question(step);
    maybeShowLevelStartCelebration();
    maybePlayLevel16EyeIntro();
    maybePlayLevel18OrangeIntro();
  }

  function goNextStep(force) {
    if (!force && btnContinue.disabled) return;
    if (currentStepResult === "level" || currentStepResult === "done") return;
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
      autoAdvancing = false;
    }
    const step = currentStep();
    if (canEarnStarsThisLevelStep()) {
      state.stars += 1;
    }
    const total = currentLevelObj().steps.length;
    if (state.currentStepIndex < total - 1) {
      maybeShowEpisodeCelebration(step);
      state.currentStepIndex += 1;
      saveState(state);
      runEyeFlash(renderCurrentStep);
      return;
    }

    const completed = state.currentLevel;
    finishLevel();
    state.currentStepIndex = 0;
    if (state.currentLevel < MAX_LEVEL) state.currentLevel += 1;
    saveState(state);
    runEyeFlash(() => {
      const done = completed >= MAX_LEVEL;
      showLevelCelebration(state.currentLevel, done);
      if (done) {
        clearRoot();
        root.appendChild(el("div", "prompt", "🏆 U5 记短语·全部通关！"));
        currentStepResult = "done";
        syncActionBar();
        updateHud();
        return;
      }
      setTimeout(() => {
        currentStepResult = null;
        renderCurrentStep();
      }, 1750);
    });
  }

  function openNameModal() {
    if (!nameModal) return;
    nameModal.classList.remove("modal-overlay--hidden");
    if (nameInput) {
      nameInput.value = playerName || "";
    }
    if (pinInput) {
      pinInput.value = "";
    }
    setTimeout(() => {
      if (nameInput && !nameInput.value) nameInput.focus();
      else if (pinInput) pinInput.focus();
      else if (nameInput) nameInput.focus();
    }, 0);
  }

  function hasCloudAccountSystem() {
    return CLOUD_ENABLED;
  }

  function isSameDeviceForUsername(username) {
    const normalized = normalizeUserName(username);
    if (!normalized) return false;
    const saved = normalizeUserName(loadPlayerName());
    return !!saved && saved.toLowerCase() === normalized.toLowerCase();
  }

  function openSetPinModal() {
    if (!setPinModal) return;
    if (!playerName) {
      alert("请先登录账号，再设置密码。");
      return;
    }
    if (setPinInput) setPinInput.value = "";
    setPinModal.classList.remove("modal-overlay--hidden");
    if (setPinInput) setTimeout(() => setPinInput.focus(), 0);
  }

  function closeSetPinModal() {
    if (!setPinModal) return;
    setPinModal.classList.add("modal-overlay--hidden");
  }

  async function saveSetPin() {
    const username = normalizeUserName(playerName || (nameInput && nameInput.value ? nameInput.value : ""));
    if (!username) {
      alert("请先输入并登录用户名，再设置密码。");
      return;
    }
    if (!hasCloudAccountSystem()) {
      alert("当前未连接云端，无法保存跨设备密码。请先连接 Supabase。");
      return;
    }
    const pin = normalizePin(setPinInput && setPinInput.value ? setPinInput.value : "");
    if (!isValidPin(pin)) {
      alert("请输入4位数字密码。");
      if (setPinInput) {
        setPinInput.focus();
        setPinInput.select();
      }
      return;
    }

    const prevText = btnSavePin ? btnSavePin.textContent : "";
    if (btnSavePin) {
      btnSavePin.disabled = true;
      btnSavePin.textContent = "保存中...";
    }
    try {
      const localId = playerId || loadPlayerId();
      const exists = await fetchCloudAccount(username);
      if (exists.ok) {
        const row = exists.row;
        const updated = await upsertCloudAccount(row.username || username, pin, row.playerId || localId);
        if (!updated.ok) {
          alert(updated.reason === "table_missing" ? buildAccountHelpText() : "保存密码失败，请稍后重试。");
          return;
        }
      } else if (exists.reason === "not_found") {
        const created = await createCloudAccount(username, pin, localId);
        if (!created.ok && created.reason !== "exists") {
          alert(created.reason === "table_missing" ? buildAccountHelpText() : "保存密码失败，请稍后重试。");
          return;
        }
      } else {
        alert(exists.reason === "table_missing" ? buildAccountHelpText() : "保存密码失败，请稍后重试。");
        return;
      }
      alert("密码已保存，可跨设备登录。");
      closeSetPinModal();
    } catch (_) {
      alert("保存密码失败，请检查网络后重试。");
    } finally {
      if (btnSavePin) {
        btnSavePin.disabled = false;
        btnSavePin.textContent = prevText || "保存密码";
      }
    }
  }

  async function logoutAccount() {
    if (!playerName) {
      openNameModal();
      return;
    }
    if (!hasCloudAccountSystem()) {
      alert("退出登录前必须先设置密码。当前未连接云端，请先连接 Supabase 并设置密码。");
      return;
    }
    const account = await fetchCloudAccount(playerName);
    if (!account.ok) {
      if (account.reason === "table_missing") {
        alert(buildAccountHelpText());
      } else {
        alert("暂时无法验证密码状态，请稍后重试。");
      }
      return;
    }
    const savedPin = normalizePin(account.row.pin);
    if (!savedPin) {
      alert("退出登录前必须先设置4位密码。请先点击“设置密码”。");
      openSetPinModal();
      return;
    }
    if (!window.confirm("确认退出登录吗？")) return;
    playerName = "";
    savePlayerName("");
    localStorage.removeItem(STORAGE_KEYS.playerId);
    playerId = loadPlayerId();
    invalidateLevelPlayCountsCache();
    closeSetPinModal();
    openNameModal();
    updateHud();
  }

  async function finishAccountLogin(username, id) {
    playerName = username;
    if (id) {
      playerId = id;
      savePlayerId(playerId);
    }
    invalidateLevelPlayCountsCache();
    savePlayerName(playerName);
    await refreshLeaderboardFromCloud();
    const bound = await bindIdentityByName(playerName);
    if (!bound.ok) return false;
    const progressSynced = await hydrateProgressFromCloudByPlayerId(playerId);
    if (!progressSynced.ok && progressSynced.reason === "table_missing") {
      alert("跨设备进度表尚未初始化，请在 Supabase 执行一次 SQL 后即可同步关卡进度。");
    }
    if (!progressSynced.ok && progressSynced.reason !== "not_found" && progressSynced.reason !== "table_missing") {
      // 云进度同步失败时继续使用本地进度，避免阻塞登录
    }
    hydrateStateFromBoundAccount();
    applyTeacherFullUnlockIfNeeded();
    saveState(state);
    upsertCurrentPlayerScore();
    closeNameModal();
    renderCurrentStep();
    return true;
  }

  async function loginWithAccount() {
    if (!nameInput || !pinInput) return;
    const username = normalizeUserName(nameInput.value);
    const pin = normalizePin(pinInput.value);
    if (!username) {
      nameInput.focus();
      return;
    }
    if (!hasCloudAccountSystem()) {
      if (!pin) {
        await finishAccountLogin(username, playerId || loadPlayerId());
        return;
      }
      alert("当前未连接云端，无法校验密码。请先连接 Supabase。");
      return;
    }
    const rowRes = await fetchCloudAccount(username);
    if (!rowRes.ok) {
      if (rowRes.reason === "not_found") {
        alert("账号不存在，请先注册。");
      } else if (rowRes.reason === "table_missing") {
        alert(buildAccountHelpText());
      } else if (rowRes.reason === "cloud_off") {
        alert("当前未连接云端，无法跨设备登录。");
      } else {
        alert("登录失败，请稍后重试。");
      }
      return;
    }
    const row = rowRes.row;
    const savedPin = normalizePin(row.pin);
    if (savedPin) {
      if (!isValidPin(pin)) {
        alert("该账号已设置密码，请输入4位数字密码。");
        pinInput.focus();
        pinInput.select();
        return;
      }
      if (savedPin !== pin) {
        alert("密码错误，请重新输入。");
        pinInput.focus();
        pinInput.select();
        return;
      }
    }
    const ok = await finishAccountLogin(row.username || username, row.playerId || playerId);
    if (!ok) {
      alert("登录失败，请重试。");
    }
  }

  function closeNameModal() {
    if (!nameModal) return;
    nameModal.classList.add("modal-overlay--hidden");
  }

  async function enterWithoutPin() {
    if (!nameInput) return;
    const username = normalizeUserName(nameInput.value);
    if (!username) {
      nameInput.focus();
      return;
    }
    const localId = playerId || loadPlayerId();
    if (!hasCloudAccountSystem()) {
      await finishAccountLogin(username, localId);
      return;
    }
    const exists = await fetchCloudAccount(username);
    if (!exists.ok) {
      if (exists.reason === "table_missing") {
        alert(buildAccountHelpText());
        return;
      }
      if (exists.reason !== "not_found") {
        alert("暂时无法进入，请稍后重试。");
        return;
      }
      const created = await createCloudAccount(username, "", localId);
      if (!created.ok && created.reason !== "exists") {
        alert(created.reason === "table_missing" ? buildAccountHelpText() : "创建账号失败，请稍后重试。");
        return;
      }
      await finishAccountLogin(username, localId);
      return;
    }
    const row = exists.row;
    const savedPin = normalizePin(row.pin);
    if (savedPin && !isSameDeviceForUsername(row.username || username)) {
      alert("该账号已设置密码，请使用“登录账号”并输入4位密码。");
      if (pinInput) {
        pinInput.focus();
        pinInput.select();
      }
      return;
    }
    const ok = await finishAccountLogin(row.username || username, row.playerId || localId);
    if (!ok) {
      alert("进入失败，请重试。");
      return;
    }
  }

  async function registerAccount() {
    if (!nameInput || !pinInput) return;
    const username = normalizeUserName(nameInput.value);
    const pin = normalizePin(pinInput.value);
    if (!username) {
      nameInput.focus();
      return;
    }
    if (!isValidPin(pin)) {
      alert("请输入4位数字密码。");
      pinInput.focus();
      pinInput.select();
      return;
    }
    if (!hasCloudAccountSystem()) {
      alert("当前未连接云端，无法保存跨设备密码。请先连接 Supabase。");
      return;
    }
    const localId = playerId || loadPlayerId();
    const exists = await fetchCloudAccount(username);
    if (exists.ok) {
      const row = exists.row;
      const savedPin = normalizePin(row.pin);
      if (savedPin && savedPin !== pin) {
        alert("该账号已设置不同密码，请先用原密码登录。");
        pinInput.focus();
        pinInput.select();
        return;
      }
      const updated = await upsertCloudAccount(row.username || username, pin, row.playerId || localId);
      if (!updated.ok) {
        alert(updated.reason === "table_missing" ? buildAccountHelpText() : "保存密码失败，请稍后重试。");
        return;
      }
      await finishAccountLogin(row.username || username, row.playerId || localId);
      return;
    }
    if (exists.reason === "table_missing") {
      alert(buildAccountHelpText());
      return;
    }
    if (exists.reason !== "not_found") {
      alert("暂时无法注册，请稍后再试。");
      return;
    }
    const created = await createCloudAccount(username, pin, localId);
    if (!created.ok) {
      if (created.reason === "exists") {
        alert("该用户名已存在，请直接登录。");
      } else if (created.reason === "table_missing") {
        alert(buildAccountHelpText());
      } else {
        alert("注册失败，请稍后重试。");
      }
      return;
    }
    await finishAccountLogin(username, localId);
  }

  function renderCloudConfigPanel() {
    if (!cloudConfigPanel) return;
    if (cloudUrlInput) cloudUrlInput.value = SUPABASE_URL || "";
    if (cloudKeyInput) cloudKeyInput.value = SUPABASE_ANON_KEY || "";
    if (cloudStatus) {
      cloudStatus.textContent = CLOUD_ENABLED
        ? "云端排行榜已启用，可被所有链接访问者共同查看。"
        : "当前为本地排行榜模式。";
    }
  }

  async function saveCloudConfig() {
    const url = (cloudUrlInput && cloudUrlInput.value ? cloudUrlInput.value : "").trim().replace(/\/+$/, "");
    const key = (cloudKeyInput && cloudKeyInput.value ? cloudKeyInput.value : "").trim();
    localStorage.setItem(STORAGE_KEYS.cloudUrl, url);
    localStorage.setItem(STORAGE_KEYS.cloudKey, key);
    refreshCloudConfig();
    if (cloudStatus) cloudStatus.textContent = CLOUD_ENABLED ? "配置已保存，正在连接云排行榜..." : "已清空云配置，使用本地排行榜。";
    if (CLOUD_ENABLED) {
      const ok = await refreshLeaderboardFromCloud();
      if (cloudStatus) cloudStatus.textContent = ok ? "云排行榜连接成功。": "连接失败，请检查 URL/Key 或表权限。";
      renderLeaderboard();
    } else {
      renderLeaderboard();
    }
  }

  async function openLeaderboardModal() {
    upsertCurrentPlayerScore();
    await refreshLeaderboardFromCloud();
    renderCloudConfigPanel();
    renderLeaderboard();
    toggleTeacherPanel(teacherAccessUnlocked);
    if (teacherAccessUnlocked) {
      await loadTeacherAccounts();
    }
    if (leaderboardModal) leaderboardModal.classList.remove("modal-overlay--hidden");
  }

  function closeLeaderboardModal() {
    if (leaderboardModal) leaderboardModal.classList.add("modal-overlay--hidden");
  }

  async function ensurePlayerNameBeforeStart() {
    if (playerName) {
      const bound = await bindIdentityByName(playerName);
      if (!bound.ok) {
        playerName = "";
        savePlayerName("");
        openNameModal();
        return;
      }
      applyTeacherFullUnlockIfNeeded();
      renderCurrentStep();
      return;
    }
    openNameModal();
  }

  function openModal() {
    levelGrid.innerHTML = "";
    for (let i = 1; i <= MAX_LEVEL; i++) {
      const b = el("button", "level-btn", String(i));
      b.type = "button";
      if (i === state.currentLevel) b.classList.add("level-btn--current");
      b.addEventListener("click", () => {
        applyLevelChoiceInUi(i);
        modal.classList.add("modal-overlay--hidden");
      });
      levelGrid.appendChild(b);
    }
    modal.classList.remove("modal-overlay--hidden");
  }

  btnContinue.addEventListener("click", () => {
    if (currentStepResult === "level") {
      currentStepResult = null;
      renderCurrentStep();
      return;
    }
    if (currentStepResult === "done") {
      openModal();
      return;
    }
    goNextStep();
  });

  if (btnRetryLevel) {
    btnRetryLevel.addEventListener("click", () => {
      state.currentStepIndex = 0;
      clearCheckpointForLevelId(state.currentLevel);
      currentStepResult = null;
      saveState(state);
      renderCurrentStep();
    });
  }
  if (btnPauseLevel) {
    btnPauseLevel.addEventListener("click", () => {
      setCheckpointForLevelId(state.currentLevel, state.currentStepIndex);
      saveState(state);
      if (praisePop) {
        praisePop.textContent = "已记录暂停。下次在「选关/石头路」进入本关，将从本环节继续。";
        praisePop.classList.remove("praise-pop--hidden");
        setTimeout(function () {
          if (praisePop) praisePop.classList.add("praise-pop--hidden");
        }, 2500);
      }
    });
  }

  btnLevelPicker.addEventListener("click", openModal);
  if (btnLeaderboard) btnLeaderboard.addEventListener("click", openLeaderboardModal);
  if (btnSetPin) btnSetPin.addEventListener("click", openSetPinModal);
  if (btnLogout) btnLogout.addEventListener("click", logoutAccount);
  if (leaderboardTitleEl) leaderboardTitleEl.addEventListener("click", onLeaderboardTitleTap);
  if (btnTeacherRefresh) btnTeacherRefresh.addEventListener("click", loadTeacherAccounts);
  if (teacherSearchInput) teacherSearchInput.addEventListener("input", renderTeacherAccounts);
  btnCloseModal.addEventListener("click", () => modal.classList.add("modal-overlay--hidden"));
  if (btnCloseLeaderboard) btnCloseLeaderboard.addEventListener("click", closeLeaderboardModal);
  if (btnCloseSetPin) btnCloseSetPin.addEventListener("click", closeSetPinModal);
  if (btnSavePin) btnSavePin.addEventListener("click", saveSetPin);
  if (btnSaveCloud) btnSaveCloud.addEventListener("click", saveCloudConfig);

  if (btnLoginName) btnLoginName.addEventListener("click", loginWithAccount);
  if (btnRegisterName) btnRegisterName.addEventListener("click", registerAccount);
  if (btnEnterNoPin) btnEnterNoPin.addEventListener("click", enterWithoutPin);
  if (nameInput) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loginWithAccount();
    });
  }
  if (pinInput) {
    pinInput.addEventListener("input", () => {
      const trimmed = normalizePin(pinInput.value);
      if (trimmed !== pinInput.value) pinInput.value = trimmed;
    });
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loginWithAccount();
    });
  }
  if (setPinInput) {
    setPinInput.addEventListener("input", () => {
      const trimmed = normalizePin(setPinInput.value);
      if (trimmed !== setPinInput.value) setPinInput.value = trimmed;
    });
    setPinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveSetPin();
    });
  }

  refreshLeaderboardFromCloud();
  void Promise.all([preloadHumanAudio(), preloadLevel18AnswerAudio()]).catch(function () {
    // 预拉取失败不阻断游戏
  });
  updateHud();
  ensurePlayerNameBeforeStart();
})();
