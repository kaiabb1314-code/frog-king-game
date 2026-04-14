(function () {
  "use strict";

  const STORAGE_KEYS = {
    stars: "frogKing_u4_stars",
    crowns: "frogKing_u4_crowns",
    unlocked: "frogKing_u4_unlocked",
    lastLevel: "frogKing_u4_lastLevel",
    stepIndex: "frogKing_u4_stepIndex",
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
      stars: loadNumber(STORAGE_KEYS.stars, 0),
      crowns: loadNumber(STORAGE_KEYS.crowns, 0),
      unlockedLevel: Math.min(11, Math.max(1, loadNumber(STORAGE_KEYS.unlocked, 1))),
      currentLevel: Math.min(11, Math.max(1, loadNumber(STORAGE_KEYS.lastLevel, 1))),
      currentStepIndex: Math.max(0, loadNumber(STORAGE_KEYS.stepIndex, 0)),
    };
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEYS.stars, String(state.stars));
    localStorage.setItem(STORAGE_KEYS.crowns, String(state.crowns));
    localStorage.setItem(STORAGE_KEYS.unlocked, String(state.unlockedLevel));
    localStorage.setItem(STORAGE_KEYS.lastLevel, String(state.currentLevel));
    localStorage.setItem(STORAGE_KEYS.stepIndex, String(state.currentStepIndex));
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

  function savePlayerName(name) {
    localStorage.setItem(STORAGE_KEYS.playerName, name);
  }

  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x) => x && typeof x.name === "string")
        .map((x) => ({
          playerId: String(x.playerId || ""),
          name: String(x.name).trim(),
          stars: Math.max(0, Number(x.stars) || 0),
          crowns: Math.max(0, Number(x.crowns) || 0),
          updatedAt: Number(x.updatedAt) || Date.now(),
        }))
        .filter((x) => x.name);
    } catch (_) {
      return [];
    }
  }

  function saveLeaderboard(list) {
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(list));
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

  function playAudioUrl(url) {
    return new Promise((resolve, reject) => {
      const a = new Audio(url);
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
      return urls;
    }
    const clean = normalizedPhrase(raw);
    urls.push("https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(clean || raw) + "&type=2");
    urls.push("https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(clean || raw) + "&type=1");
    return urls;
  }

  async function playEnglishAudio(text) {
    const raw = (text || "").trim();
    if (!raw) return null;
    const candidates = resolvedAudioByText.get(raw) || (await resolveHumanAudioCandidates(raw));
    if (!resolvedAudioByText.has(raw)) resolvedAudioByText.set(raw, candidates);
    for (const url of candidates) {
      try {
        await playAudioUrl(url);
        return true;
      } catch (_) {
        continue;
      }
    }
    return false;
  }

  function speakFallback(text) {
    if (!window.speechSynthesis) return false;
    const raw = (text || "").trim();
    if (!raw) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(raw);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
    return true;
  }

  async function playEnglishAudioGuaranteed(text) {
    const ok = await playEnglishAudio(text);
    if (ok) return true;
    return speakFallback(text);
  }

  async function preloadHumanAudio() {
    const texts = new Set();
    WORDS.forEach((w) => {
      texts.add(w.en);
      texts.add(w.sentenceEn);
    });
    for (const text of texts) {
      const candidates = await resolveHumanAudioCandidates(text);
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
      resolvedAudioByText.set(text, finalList);
      if (!finalList.length) continue;
      const a = new Audio(finalList[0]);
      a.preload = "auto";
      a.load();
      preloadedAudioObjects.set(text, a);
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
      { kind: "A2", cat: "dialogue", title: "你来开口 · 1", scene: "你想加入他们，应该怎么说？", promptZh: "对帅气蛙说：", target: "Can I join you?", options: pick("Can I join you?") },
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
            speaker: "帅气蛙",
            line: "Do you want to join us?",
            target: "I'd love to!",
            options: pick("I'd love to!"),
          },
          {
            speaker: "美丽蛙",
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

  function buildLevels() {
    const levels = [];
    const joinWord = WORDS.find((w) => w.en === "join");
    for (let lv = 1; lv <= 11; lv++) {
      const [w1, w2] = getWordPair(lv);
      let steps;
      if (lv === 7 || lv === 8) {
        steps = buildReviewLevelSteps(lv, w1, w2);
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
      levels.push({ id: lv, steps });
    }
    return levels;
  }

  const LEVELS = buildLevels();

  const root = document.getElementById("challenge-root");
  const btnContinue = document.getElementById("btn-continue");
  const btnRetryLevel = document.getElementById("btn-retry-level");
  const btnLevelPicker = document.getElementById("btn-level-picker");
  const btnLeaderboard = document.getElementById("btn-leaderboard");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const modal = document.getElementById("modal-overlay");
  const levelGrid = document.getElementById("level-grid");
  const stoneRoute = document.getElementById("stone-route");
  const nameModal = document.getElementById("name-modal-overlay");
  const nameInput = document.getElementById("name-input");
  const btnSaveName = document.getElementById("btn-save-name");
  const leaderboardModal = document.getElementById("leaderboard-modal-overlay");
  const leaderboardList = document.getElementById("leaderboard-list");
  const btnCloseLeaderboard = document.getElementById("btn-close-leaderboard");
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
  const praisePop = document.getElementById("frog-bubble");
  const eyeFlash = document.getElementById("eye-flash");
  const sparkleBurst = document.getElementById("sparkle-burst");
  const levelCelebration = document.getElementById("level-celebration");
  const levelCelebrationText = document.getElementById("level-celebration-text");

  let state = loadState();
  let playerId = loadPlayerId();
  let playerName = loadPlayerName();
  let leaderboard = loadLeaderboard();
  let cloudSyncTimer = null;
  let cloudRefreshInFlight = false;
  let currentStepResult = null;
  let autoAdvancing = false;
  let autoAdvanceTimer = null;
  let autoRetryTimer = null;
  const OUTFITS = ["🎀", "🕶️", "🎓", "🧣", "🧢", "🥽", "🎧", "💚", "🌟", "🪄"];
  const ZH_BY_EN = {
    "Do you want to join us?": "你想加入我们吗？",
    "Do you want to try?": "你想试试吗？",
    "I'd love to!": "我很乐意！",
    "No thanks... football is just not my thing.": "不用了，足球不是我的菜。",
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
    const zh = ZH_BY_EN[raw];
    return zh ? raw + "（" + zh + "）" : text;
  }

  function renderRoute() {
    if (!stoneRoute) return;
    stoneRoute.innerHTML = "";
    const max = Math.max(1, state.unlockedLevel);
    for (let i = 1; i <= max; i++) {
      const b = el("button", "stone-node", "第" + i + "关");
      const sideCls = i % 2 === 0 ? "stone-node--right" : "stone-node--left";
      b.classList.add(sideCls);
      if (i < state.currentLevel) b.classList.add("stone-node--done");
      if (i === state.currentLevel) b.classList.add("stone-node--current");
      b.type = "button";
      b.addEventListener("click", () => {
        state.currentLevel = i;
        state.currentStepIndex = 0;
        currentStepResult = null;
        saveState(state);
        renderCurrentStep();
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
        stars: Math.max(0, Number(x.stars) || 0),
        crowns: Math.max(0, Number(x.crowns) || 0),
        updatedAt: Number(new Date(x.updated_at || Date.now())) || Date.now(),
      }))
      .filter((x) => x.playerId && x.name);
  }

  async function upsertCloudScore(row) {
    if (!CLOUD_ENABLED) return false;
    const url = SUPABASE_URL + "/rest/v1/frog_leaderboard?on_conflict=player_id";
    const body = [
      {
        player_id: row.playerId,
        name: row.name,
        stars: row.stars,
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
        leaderboard = sortLeaderboard(cloudList);
        saveLeaderboard(leaderboard);
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
    const row = { playerId, name: playerName, stars: state.stars, crowns: state.crowns, updatedAt: now };
    if (idx >= 0) next[idx] = row;
    else next.push(row);
    leaderboard = sortLeaderboard(next);
    saveLeaderboard(leaderboard);
    scheduleCloudSync(row);
  }

  function renderLeaderboard() {
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
      rank.textContent = "#" + (idx + 1);
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
      const speakText = getAutoSpeakText(step);
      if (speakText) {
        playEnglishAudioGuaranteed(speakText);
      }
      if (!this.hadWrong && !this.graded) showPraise();
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
    if (step.autoSpeak) return step.autoSpeak;
    if (step.kind === "TIP") return "";
    if (step.kind === "P1" || step.kind === "P2") return "";
    if (step.kind === "A5") return "";
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

  function updateHud() {
    const lv = currentLevelObj();
    const total = lv ? lv.steps.length : 16;
    const idx = Math.min(state.currentStepIndex, total - 1);
    const passed = (stepStatus.isCorrect && !stepStatus.hadWrong) || stepStatus.graded ? 1 : 0;
    const pct = ((idx + passed) / total) * 100;
    frogTrackFill.style.width = Math.min(100, pct) + "%";
    frogMascot.style.left = Math.min(100, pct) + "%";
    stepLabel.textContent = "环节 " + (idx + 1) + " / " + total + " · 第 " + state.currentLevel + " 关";
    starCountEl.textContent = String(state.stars);
    crownCountEl.textContent = String(state.crowns);
    const outfitCount = Math.max(0, state.currentLevel - 1);
    frogOutfit.textContent = outfitCount > 0 ? OUTFITS[(outfitCount - 1) % OUTFITS.length] : "";
    upsertCurrentPlayerScore();
    renderRoute();
  }

  function syncActionBar() {
    if (currentStepResult === "level" || currentStepResult === "done") {
      btnContinue.disabled = false;
      return;
    }
    btnContinue.disabled = !stepStatus.isCorrect;
  }

  function showPraise() {
    playDingDong();
    frogActor.dataset.mood = "nod";
    sparkleBurst.classList.add("sparkle-burst--on");
    praisePop.classList.remove("praise-pop--hidden");
    setTimeout(() => {
      frogActor.dataset.mood = "idle";
      sparkleBurst.classList.remove("sparkle-burst--on");
      praisePop.classList.add("praise-pop--hidden");
    }, 900);
  }

  function showLevelCelebration(nextLevel, done) {
    levelCelebration.classList.remove("level-celebration--hidden");
    levelCelebrationText.textContent = done ? "🏆 Unit 4 全部通关！" : "🎉 恭喜进入第 " + nextLevel + " 关";
    setTimeout(() => {
      levelCelebration.classList.add("level-celebration--hidden");
    }, 1700);
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
    state.crowns += 1;
    state.unlockedLevel = Math.max(state.unlockedLevel, Math.min(11, state.currentLevel + 1));
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
    root.appendChild(el("div", "screen-title", step.title));
    if (state.currentLevel >= 7) {
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
    if (state.currentLevel >= 7) {
      renderStoryMap();
    }
  }

  function renderStoryMap() {
    const lv = currentLevelObj();
    const total = lv ? lv.steps.length : 16;
    const progress = total ? state.currentStepIndex / (total - 1 || 1) : 0;
    const nodes = ["学校", "课室", "操场", "体育馆", "艺术馆", "终点"];
    const active = Math.min(nodes.length - 1, Math.floor(progress * (nodes.length - 1)));
    const wrap = el("div", "story-map", "");
    nodes.forEach((name, idx) => {
      const n = el("div", "story-map__node", name);
      if (idx <= active) n.classList.add("story-map__node--on");
      if (idx === active) n.classList.add("story-map__node--current");
      wrap.appendChild(n);
      if (idx < nodes.length - 1) {
        const link = el("div", "story-map__link", "");
        if (idx < active) link.classList.add("story-map__link--on");
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
    root.appendChild(el("div", "prompt", step.hintZh || "点击录音并跟读"));
    root.appendChild(el("div", "word-hero", withZhInLevel11(target)));
    renderAudioButton(target);
    const wrap = el("div", "dialogue-box dialogue-box--yellow", "");
    const status = el("div", "prompt prompt--sub", "先听示范发音，再点击录音按钮开始跟读");
    const transcript = el("div", "prompt prompt--sub", "");
    transcript.style.minHeight = "24px";
    transcript.style.marginTop = "8px";
    const recordBtn = el("button", "btn-primary", "🎤 点击录音");
    recordBtn.type = "button";
    recordBtn.style.marginTop = "8px";
    const autoSpeakMs = estimateSpeechDurationMs(target);
    const durationMs = Math.max(700, Math.round(autoSpeakMs / 2));
    const isSentenceStep = step.kind === "P2" || /\s/.test(normalizeSpeechText(target));

    function finalize(spokenText, heard) {
      const spoken = normalizeSpeechText(spokenText);
      if (isSentenceStep) {
        // 句子口语：只要检测到有声音（或识别到文本）即通过
        if (spoken || heard) {
          transcript.textContent = "已检测到你的跟读：通过";
          stepStatus.markCorrect();
        } else {
          transcript.textContent = "没有检测到有效语音，请再试一次";
          stepStatus.markWrong();
        }
        updateHud();
        return;
      }
      const score = calcSpeechSimilarity(target, spoken);
      if (!spoken && heard) {
        transcript.textContent = "检测到你已发声，识别文本较弱：通过";
        stepStatus.markCorrect();
      } else {
        transcript.textContent = "你说的是: " + (spokenText || "(未识别到)") + " ｜ 相似度: " + Math.round(score * 100) + "%";
        if (score >= 0.1) stepStatus.markCorrect();
        else stepStatus.markWrong();
      }
      updateHud();
    }

    let recording = false;
    async function startManualRecording() {
      if (recording || stepStatus.isCorrect || stepStatus.graded) return;
      recording = true;
      recordBtn.disabled = true;
      status.textContent = "录音中...（约 " + (durationMs / 1000).toFixed(1) + " 秒，= 示范发音约一半）";
      const heardResult = await listenVoiceWithFallback(durationMs);
      finalize(heardResult.transcript, heardResult.heard);
      recording = false;
      recordBtn.disabled = false;
    }

    recordBtn.addEventListener("click", startManualRecording);
    setTimeout(() => {
      playEnglishAudioGuaranteed(target);
    }, 120);

    stepStatus.setReveal(() => {
      revealKey(answerKey, "<strong>参考读音：</strong> " + target);
    });

    wrap.appendChild(status);
    wrap.appendChild(recordBtn);
    wrap.appendChild(transcript);
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
    root.appendChild(el("div", "prompt", step.prompt));
    const answerKey = createAnswerKey();
    const grid = el("div", "choice-grid");
    step.options.forEach((opt) => {
      const b = el("button", "choice-btn", withZhInLevel11(opt));
      b.type = "button";
      b.addEventListener("click", () => {
        if (stepStatus.graded || stepStatus.isCorrect) return;
        grid.querySelectorAll("button").forEach((x) => x.classList.remove("choice-btn--wrong", "choice-btn--correct"));
        if (opt === step.target) {
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
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>正确答案：</strong> " + step.target));
    root.appendChild(grid);
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
        if (opt === step.target) {
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
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>推荐回答：</strong> " + step.target));
    root.appendChild(grid);
    root.appendChild(answerKey);
  }

  function renderAdvancedOrder(step) {
    renderHeader(step);
    if (state.currentLevel >= 9) {
      root.appendChild(
        renderSceneCard({
          sceneKey: step.sceneKey || "gym",
          scene: step.scene || "剧情任务场景",
          line: step.targetSentence || step.sentence,
          speaker: step.speaker || "青蛙伙伴",
          speakerEmoji: step.speakerEmoji || "🐸🐸🐸",
        })
      );
    }
    root.appendChild(el("div", "prompt prompt--sub", (step.speaker || "你") + " 说：把句子拼完整"));
    const sentence = step.targetSentence || step.sentence;
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
          if (opt === t.target) {
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
      const lines = step.turns.map((t) => t.speaker + " -> " + t.target).join("<br/>");
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
        if (opt === step.target) {
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
    stepStatus.setReveal(() => revealKey(answerKey, "<strong>最佳表达：</strong> " + step.target));
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

  function renderStep(step) {
    stepStatus.reset();
    renderByKind[step.kind](step);
    syncActionBar();
    updateHud();
  }

  const renderByKind = {
    TIP: renderTipStep,
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
    root.classList.toggle("challenge-zone--yellow", state.currentLevel >= 7);
    renderStep(step);
  }

  function goNextStep(force) {
    if (!force && btnContinue.disabled) return;
    if (currentStepResult === "level" || currentStepResult === "done") return;
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
      autoAdvancing = false;
    }
    state.stars += 1;
    const total = currentLevelObj().steps.length;
    if (state.currentStepIndex < total - 1) {
      state.currentStepIndex += 1;
      saveState(state);
      runEyeFlash(renderCurrentStep);
      return;
    }

    const completed = state.currentLevel;
    finishLevel();
    state.currentStepIndex = 0;
    if (state.currentLevel < 11) state.currentLevel += 1;
    saveState(state);
    runEyeFlash(() => {
      const done = completed >= 11;
      showLevelCelebration(state.currentLevel, done);
      if (done) {
        clearRoot();
        root.appendChild(el("div", "prompt", "🏆 Unit 4 全部通关！"));
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
      setTimeout(() => nameInput.focus(), 0);
    }
  }

  function closeNameModal() {
    if (!nameModal) return;
    nameModal.classList.add("modal-overlay--hidden");
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
    if (leaderboardModal) leaderboardModal.classList.remove("modal-overlay--hidden");
  }

  function closeLeaderboardModal() {
    if (leaderboardModal) leaderboardModal.classList.add("modal-overlay--hidden");
  }

  function ensurePlayerNameBeforeStart() {
    if (playerName) {
      renderCurrentStep();
      return;
    }
    openNameModal();
  }

  function openModal() {
    levelGrid.innerHTML = "";
    for (let i = 1; i <= 11; i++) {
      const b = el("button", "level-btn", String(i));
      b.type = "button";
      if (i > state.unlockedLevel) b.disabled = true;
      if (i === state.currentLevel) b.classList.add("level-btn--current");
      b.addEventListener("click", () => {
        state.currentLevel = i;
        state.currentStepIndex = 0;
        saveState(state);
        modal.classList.add("modal-overlay--hidden");
        renderCurrentStep();
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
      renderCurrentStep();
    });
  }

  btnLevelPicker.addEventListener("click", openModal);
  if (btnLeaderboard) btnLeaderboard.addEventListener("click", openLeaderboardModal);
  btnCloseModal.addEventListener("click", () => modal.classList.add("modal-overlay--hidden"));
  if (btnCloseLeaderboard) btnCloseLeaderboard.addEventListener("click", closeLeaderboardModal);
  if (btnSaveCloud) btnSaveCloud.addEventListener("click", saveCloudConfig);

  function commitPlayerName() {
    if (!nameInput) return;
    const name = (nameInput.value || "").trim().slice(0, 20);
    if (!name) {
      nameInput.focus();
      return;
    }
    playerName = name;
    savePlayerName(playerName);
    upsertCurrentPlayerScore();
    closeNameModal();
    renderCurrentStep();
  }

  if (btnSaveName) btnSaveName.addEventListener("click", commitPlayerName);
  if (nameInput) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commitPlayerName();
    });
  }

  refreshLeaderboardFromCloud();
  preloadHumanAudio();
  updateHud();
  ensurePlayerNameBeforeStart();
})();
