const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const ADMIN_OPENIDS = [
  'o1vza4lDAMQeVaoL2xdW4E_xmJCs'  // 孙励天
];

const USER_IDENTITY_MAP = {
  'o1vza4lDAMQeVaoL2xdW4E_xmJCs': {
    userLabel: '孙励天',
    personName: '孙励天',
    identityPrompt: '当前使用这个账号的用户是孙励天。在没有额外说明时，用户说的"我"默认指孙励天本人；涉及关系、喜好、工作、生活、家庭时，优先从孙励天本人的视角理解和回答。'
  },
  'o1vza4gSIXtoc73DOsiBVNpsgOao': {
    userLabel: '宋陶颖',
    personName: '宋陶颖',
    identityPrompt: '当前使用这个账号的用户是宋陶颖。在没有额外说明时，用户说的"我"默认指宋陶颖本人；涉及关系、喜好、工作、生活、家庭时，优先从宋陶颖本人的视角理解和回答。',
  },
  'o1vza4qmggBW1NhFzRmfdvDU-J_c': {
    userLabel: '秦天',
    personName: '秦天',
    identityPrompt: '当前使用这个账号的用户是秦天。在没有额外说明时，用户说的"我"默认指秦天本人；涉及关系、喜好、工作、生活、家庭时，优先从秦天本人的视角理解和回答。',
  },
  'o1vza4hm5DLFuLz2kPG9ffB5czDg': {
    userLabel: '山雪',
    personName: '山雪',
    identityPrompt: '当前使用这个账号的用户是山雪。在没有额外说明时，用户说的"我"默认指山雪本人；涉及关系、喜好、工作、生活、家庭时，优先从山雪本人的视角理解和回答。',
  }
}

const DIARY_SYNC_OPENID_GROUPS = [
  [
    'o1vza4lDAMQeVaoL2xdW4E_xmJCs',
    'o1vza4gSIXtoc73DOsiBVNpsgOao',
  ],
];

const ANNIVERSARY_VISIBLE_OPENIDS = [
  'o1vza4lDAMQeVaoL2xdW4E_xmJCs', // 孙励天open id
  'o1vza4gSIXtoc73DOsiBVNpsgOao', // 宋陶颖open id
];

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_CALENDAR_LIMIT = 80;
const DEFAULT_SHARED_MEMORY_LIMIT = 30;
const DEFAULT_RAG_RESULT_LIMIT = 8;
const MAX_RAG_CANDIDATE_LIMIT = 120;
const RAG_OBSERVABILITY_COLLECTION = 'rag_observability';
const MEMORY_CONFLICT_WINDOW_SIZE = 80;
const RAG_EVAL_QUERIES = [
  { query: '山雪是谁', expectedKeywords: ['山雪', '默沙东', '曹杨二中'] },
  { query: '王晓莉和孙励天什么关系', expectedKeywords: ['王晓莉', '高中同学', '曹杨二中'] },
  { query: '山雪口中的群指谁', expectedKeywords: ['山雪', '王晓莉', '秦天', '孙励天'] },
  { query: '秦天近况', expectedKeywords: ['秦天', '华尔街', '博士'] },
];
const SHARED_CALENDAR_COLLECTION = 'shared_calendar';
const SHARED_CONCEPT_MEMORY_COLLECTION = 'shared_concept_memory';
const SHARED_BOOKKEEPING_COLLECTION = 'shared_bookkeeping';
const SHARED_RECIPE_COLLECTION = 'shared_recipe';
const SHARED_REMINDER_SUBSCRIPTION_COLLECTION = 'shared_reminder_subscription';
const SHARED_CHECKLIST_COLLECTION = 'shared_checklist';

const AZURE_OPENAI_CONFIG = {
  endpointBase: 'https://milkysunlit.openai.azure.com',
  apiKey: '236d2d85c3ce4b5d9fbf5517df1c5e6f',
  deployment: 'gpt-5.4-mini',
  apiVersion: '2025-01-01-preview',
};

const RECIPE_SIMILARITY_THRESHOLD = 0.55;

const RELATIONSHIP_ANNIVERSARIES = [
  { id: 'song-birthday', name: '宋陶颖生日', monthDay: '11-25', dateText: '11.25', type: 'birthday', owner: '宋陶颖' },
  { id: 'sun-birthday', name: '孙励天生日', monthDay: '01-18', dateText: '1.18', type: 'birthday', owner: '孙励天' },
  { id: 'xingyue-birthday', name: '孙星玥生日', monthDay: '10-18', dateText: '10.18', type: 'birthday', owner: '孙星玥' },
  { id: 'together-day', name: '在一起', date: '2021-11-21', dateText: '2021.11.21', type: 'milestone' },
  { id: 'license-day', name: '领证纪念日', date: '2023-02-18', dateText: '2023.02.18', type: 'milestone' },
];

const REMINDER_TEMPLATE_CONFIG = {
  anniversary: {
    templateId: 'FK8M0CLpzj1xQGUXCAPRqPshILh9hIDYnfOwadiEd5w',
    fields: {
      subject: 'thing1',
      reminderPerson: 'name2',
      date: 'date4',
      remark: 'thing5',
      reminderThing: 'thing6',
    },
  },
  calendar: {
    templateId: 'kC7AxlY0BGgVjms7k0pT8TGsRsCX-darqjCoihdXunw',
    fields: {
      reminderPerson: 'name1',
      date: 'date2',
      reminderThing: 'thing3',
      subject: 'phrase5',
      remark: 'thing9',
    },
  },
  bookkeeping: {
    templateId: 'kC7AxlY0BGgVjms7k0pT8TGsRsCX-darqjCoihdXunw',
    fields: {
      reminderPerson: 'name1',
      date: 'date2',
      reminderThing: 'thing3',
      subject: 'phrase5',
      remark: 'thing9',
    },
  },
};

const REMINDER_TYPE_OPTIONS = {
  anniversary: [
    { value: 'anniversary_day_before', label: '前一天提醒' },
    { value: 'anniversary_same_day', label: '当天提醒' },
  ],
  calendar: [
    { value: 'calendar_day_before', label: '前一天提醒' },
    { value: 'calendar_same_day', label: '当天提醒' },
  ],
  bookkeeping: [
    { value: 'bookkeeping_due', label: 'åˆ°æœŸæé†’' },
    { value: 'bookkeeping_overdue', label: 'è¶…æœŸæé†’' },
  ],
};

function isAdmin(openid) {
  return ADMIN_OPENIDS.includes(openid);
}

function getUserIdentity(openid) {
  const identity = USER_IDENTITY_MAP[String(openid || '')] || {};
  return {
    userLabel: identity.userLabel || '',
    personName: identity.personName || '',
    identityPrompt: identity.identityPrompt || '',
  };
}

function getOpenidByPersonName(personName = '') {
  const targetName = String(personName || '').trim();
  if (!targetName) {
    return '';
  }
  const matched = Object.entries(USER_IDENTITY_MAP).find(([, identity]) => String((identity && identity.personName) || '') === targetName);
  return String((matched && matched[0]) || '').trim();
}

function normalizeLimit(limit) {
  return Math.max(1, Math.min(Number(limit) || DEFAULT_PAGE_SIZE, 100));
}

function normalizeSkip(skip) {
  return Math.max(0, Number(skip) || 0);
}

function normalizeUserFilter(userFilter) {
  const value = String(userFilter || 'all').trim();
  return value || 'all';
}

function getOpenidsForUserFilter(userFilter) {
  const normalizedFilter = normalizeUserFilter(userFilter);
  if (normalizedFilter === 'all') {
    return [];
  }

  return Object.entries(USER_IDENTITY_MAP)
    .filter(([, identity]) => identity && identity.userLabel === normalizedFilter)
    .map(([mappedOpenid]) => mappedOpenid)
    .filter(Boolean);
}

function getSyncedDiaryOpenids(openid) {
  const normalizedOpenid = String(openid || '');
  if (!normalizedOpenid) {
    return [];
  }

  const syncGroup = DIARY_SYNC_OPENID_GROUPS.find((group) => Array.isArray(group) && group.includes(normalizedOpenid));
  if (syncGroup && syncGroup.length) {
    return syncGroup;
  }
  return [normalizedOpenid];
}

function normalizeCalendarDate(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  // Validate YYYY-MM-DD format directly without Date conversion (avoids timezone shift)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  // Only use Date parsing as fallback for other formats
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  // Use local time string to avoid UTC offset issues
  return text.slice(0, 10);
}

function normalizeCalendarLimit(limit) {
  return Math.max(1, Math.min(Number(limit) || DEFAULT_CALENDAR_LIMIT, 200));
}

function normalizeSharedMemoryLimit(limit) {
  return Math.max(1, Math.min(Number(limit) || DEFAULT_SHARED_MEMORY_LIMIT, 100));
}

function normalizeSharedMemoryContent(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[。！？!?,，；;]+$/g, '')
    .slice(0, 300);
}

function normalizeMemoryFingerprint(content = '') {
  return String(content || '')
    .toLowerCase()
    .replace(/[\s，,。.!！？；;:：'"“”‘’()（）\[\]{}]/g, '')
    .trim();
}

function rewriteRagQuery(query = '') {
  const normalized = normalizeRagQuery(query);
  if (!normalized) {
    return {
      originalQuery: '',
      rewrittenQuery: '',
      expandedTerms: [],
    };
  }

  const termMap = {
    群: ['群体', '同学群', '四人', '朋友'],
    口中的群: ['群体', '同学群', '四人'],
    近况: ['最近', '现在', '目前', '现状'],
    关系: ['同学', '朋友', '关联'],
    哪个学校: ['学校', '本科', '高中'],
    学校: ['本科', '高中', '大学'],
    同学: ['高中同学', '校友'],
  };

  const expanded = [];
  Object.entries(termMap).forEach(([key, values]) => {
    if (normalized.includes(key)) {
      expanded.push(...values);
    }
  });

  Object.values(USER_IDENTITY_MAP).forEach((identity) => {
    const personName = String((identity && identity.personName) || '').trim();
    if (personName && normalized.includes(personName)) {
      expanded.push(personName);
    }
  });

  const expandedTerms = Array.from(new Set(expanded.filter(Boolean))).slice(0, 12);
  const rewrittenQuery = [normalized, ...expandedTerms].join(' ').trim();
  return {
    originalQuery: normalized,
    rewrittenQuery,
    expandedTerms,
  };
}

function buildSparseVector(tokens = []) {
  const vector = Object.create(null);
  (tokens || []).forEach((token) => {
    const key = String(token || '').trim();
    if (!key) {
      return;
    }
    vector[key] = (vector[key] || 0) + 1;
  });
  return vector;
}

function cosineSimilaritySparse(vecA = {}, vecB = {}) {
  const keysA = Object.keys(vecA);
  const keysB = Object.keys(vecB);
  if (!keysA.length || !keysB.length) {
    return 0;
  }

  let dot = 0;
  keysA.forEach((key) => {
    if (vecB[key]) {
      dot += vecA[key] * vecB[key];
    }
  });
  const normA = Math.sqrt(keysA.reduce((sum, key) => sum + vecA[key] * vecA[key], 0));
  const normB = Math.sqrt(keysB.reduce((sum, key) => sum + vecB[key] * vecB[key], 0));
  if (!normA || !normB) {
    return 0;
  }
  return dot / (normA * normB);
}

function scoreRagCandidateHybrid(queryInfo = {}, candidate = {}) {
  const queryText = String(queryInfo.rewrittenQuery || '').trim();
  const queryTokens = buildRagTokens(queryText);
  const content = String(candidate.content || '').trim();
  if (!queryText || !content) {
    return {
      lexicalScore: 0,
      semanticScore: 0,
      recencyScore: 0,
      totalScore: 0,
    };
  }

  const candidateTokens = buildRagTokens(`${candidate.title || ''} ${content} ${candidate.userLabel || ''}`);
  const querySet = new Set(queryTokens);
  const overlap = candidateTokens.filter((token) => querySet.has(token)).length;
  const lexicalScore = overlap ? overlap * 2 + overlap / Math.max(1, querySet.size) * 2 : 0;

  const queryVec = buildSparseVector(queryTokens);
  const candidateVec = buildSparseVector(candidateTokens);
  const semanticScore = cosineSimilaritySparse(queryVec, candidateVec) * 6;

  const createdAtMs = toTimeMs(candidate.createdAt);
  const ageDays = createdAtMs ? Math.max(0, (Date.now() - createdAtMs) / (24 * 60 * 60 * 1000)) : 365;
  const recencyScore = Math.max(0, 1 - ageDays / 90);
  const sourceBoost = candidate.source === 'chatMemory' ? 0.5 : candidate.source === 'sharedConcept' ? 0.3 : 0.1;
  const importantBoost = candidate.important ? 0.4 : 0;
  const fullTextBoost = content.includes(String(queryInfo.originalQuery || '').trim()) ? 1.2 : 0;

  const totalScore = lexicalScore + semanticScore + recencyScore + sourceBoost + importantBoost + fullTextBoost;
  return {
    lexicalScore: Number(lexicalScore.toFixed(3)),
    semanticScore: Number(semanticScore.toFixed(3)),
    recencyScore: Number(recencyScore.toFixed(3)),
    totalScore: Number(totalScore.toFixed(3)),
  };
}

function detectRagConflicts(ranked = []) {
  const conflicts = [];
  const seenBySubject = new Map();

  ranked.forEach((item) => {
    const content = String(item.content || '').trim();
    const subjectMatch = content.match(/^([\u4e00-\u9fffA-Za-z0-9]{1,12})(是|在|为|口中的|关系)/);
    const subject = subjectMatch ? subjectMatch[1] : '';
    if (!subject) {
      return;
    }
    const normalized = normalizeMemoryFingerprint(content);
    const isNegative = /(不是|并非|没有|无)/.test(content);
    const prev = seenBySubject.get(subject);
    if (prev && prev.isNegative !== isNegative && prev.normalized !== normalized) {
      conflicts.push({
        subject,
        left: prev.content,
        right: content,
      });
      return;
    }
    if (!prev) {
      seenBySubject.set(subject, { content, normalized, isNegative });
    }
  });

  return conflicts.slice(0, 6);
}

function rerankRagCandidates(candidates = [], limit = DEFAULT_RAG_RESULT_LIMIT) {
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return toTimeMs(b.createdAt) - toTimeMs(a.createdAt);
  });

  const selected = [];
  const sourceCount = {
    sharedConcept: 0,
    chatMemory: 0,
    diary: 0,
  };

  for (const item of sorted) {
    if (selected.length >= limit) {
      break;
    }
    const source = String(item.source || 'sharedConcept');
    if (sourceCount[source] >= Math.ceil(limit / 2)) {
      continue;
    }
    selected.push(item);
    sourceCount[source] = (sourceCount[source] || 0) + 1;
  }

  if (selected.length < limit) {
    for (const item of sorted) {
      if (selected.length >= limit) {
        break;
      }
      if (!selected.find((entry) => entry.id === item.id && entry.source === item.source)) {
        selected.push(item);
      }
    }
  }

  return selected.slice(0, limit);
}

async function recordRagObservability(openid, payload = {}) {
  try {
    await db.collection(RAG_OBSERVABILITY_COLLECTION).add({
      data: {
        openid,
        query: String(payload.query || '').slice(0, 300),
        rewrittenQuery: String(payload.rewrittenQuery || '').slice(0, 500),
        expandedTerms: Array.isArray(payload.expandedTerms) ? payload.expandedTerms.slice(0, 20) : [],
        candidateCount: Number(payload.candidateCount) || 0,
        selectedCount: Number(payload.selectedCount) || 0,
        topSources: Array.isArray(payload.topSources) ? payload.topSources.slice(0, 20) : [],
        avgScore: Number(payload.avgScore) || 0,
        conflicts: Array.isArray(payload.conflicts) ? payload.conflicts.slice(0, 10) : [],
        latencyMs: Number(payload.latencyMs) || 0,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    // Observability must be best-effort only.
  }
}

function normalizeRagLimit(limit) {
  return Math.max(1, Math.min(Number(limit) || DEFAULT_RAG_RESULT_LIMIT, 20));
}

function normalizeRagQuery(query) {
  return String(query || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function normalizeMemoryVisibility(value = '') {
  const level = String(value || '').trim().toLowerCase();
  if (level === 'admin') return 'admin';
  if (level === 'couple') return 'couple';
  return 'public';
}

function canViewerAccessMemoryItem(item = {}, viewerOpenid = '') {
  const viewer = String(viewerOpenid || '').trim();
  const ownerOpenid = String(item.ownerOpenid || item._openid || item.creatorOpenid || '').trim();
  const isViewerAdmin = isAdmin(viewer);
  const isOwner = viewer && ownerOpenid && viewer === ownerOpenid;
  const level = normalizeMemoryVisibility(item.privacyLevel || item.level || item.visibility);

  if (level === 'public') {
    return true;
  }
  if (level === 'admin') {
    return isViewerAdmin;
  }
  if (isViewerAdmin || isOwner) {
    return true;
  }
  return COUPLE_OPENIDS.includes(viewer) && COUPLE_OPENIDS.includes(ownerOpenid);
}

function buildRagTokens(text = '') {
  const normalized = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const stopWords = new Set([
    '什么', '怎么', '为什么', '请问', '一下', '一个', '这个', '那个', '以及', '还有', '目前', '现在',
    '是谁', '哪些', '哪个', '你们', '我们', '他们', '她们', '关于', '告诉', '知道', '一下子',
  ]);
  const tokens = [];
  const asciiWords = normalized.match(/[a-z0-9_]+/g) || [];
  asciiWords.forEach((word) => {
    if (word && !stopWords.has(word)) {
      tokens.push(word);
    }
  });

  const zhParts = normalized.match(/[\u4e00-\u9fff]+/g) || [];
  zhParts.forEach((part) => {
    if (!part) {
      return;
    }
    if (!stopWords.has(part)) {
      tokens.push(part);
    }
    if (part.length === 1) {
      tokens.push(part);
      return;
    }
    for (let i = 0; i < part.length - 1; i += 1) {
      const gram = part.slice(i, i + 2);
      if (gram && !stopWords.has(gram)) {
        tokens.push(gram);
      }
    }
  });

  return Array.from(new Set(tokens));
}

function toTimeMs(value) {
  const ts = new Date(value || '').getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function scoreRagCandidate(queryText = '', queryTokens = [], candidate = {}) {
  const content = String(candidate.content || '').trim();
  if (!content) {
    return 0;
  }

  const candidateTokens = buildRagTokens(`${candidate.title || ''} ${content} ${candidate.userLabel || ''}`);
  if (!candidateTokens.length || !queryTokens.length) {
    return 0;
  }

  const querySet = new Set(queryTokens);
  const overlap = candidateTokens.filter((token) => querySet.has(token)).length;
  if (!overlap) {
    return 0;
  }

  const coverage = overlap / Math.max(1, querySet.size);
  const containsWholeQuery = queryText && content.includes(queryText) ? 1 : 0;
  const createdAtMs = toTimeMs(candidate.createdAt);
  const ageDays = createdAtMs ? Math.max(0, (Date.now() - createdAtMs) / (24 * 60 * 60 * 1000)) : 365;
  const recencyBonus = Math.max(0, 1 - ageDays / 90);
  const importantBonus = candidate.important ? 0.3 : 0;

  return overlap * 2 + coverage * 2 + containsWholeQuery * 1.5 + recencyBonus + importantBonus;
}

async function retrieveRagContext(openid, { query, limit } = {}) {
  const startedAt = Date.now();
  const queryInfo = rewriteRagQuery(query);
  const normalizedQuery = queryInfo.rewrittenQuery;
  const normalizedLimit = normalizeRagLimit(limit);
  const syncOpenids = getSyncedDiaryOpenids(openid);

  if (!normalizedQuery || !syncOpenids.length) {
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      query: queryInfo.originalQuery,
      rewrittenQuery: queryInfo.rewrittenQuery,
      expandedTerms: queryInfo.expandedTerms,
      conflicts: [],
      metrics: {
        candidateCount: 0,
        selectedCount: 0,
        avgScore: 0,
        latencyMs: Date.now() - startedAt,
      },
      error: null,
    };
  }

  try {
    const [sharedConceptRes, chatMemoryRes, diaryRes] = await Promise.all([
      db.collection(SHARED_CONCEPT_MEMORY_COLLECTION)
        .where({ ownerOpenid: _.in(syncOpenids) })
        .orderBy('createdAt', 'desc')
        .limit(MAX_RAG_CANDIDATE_LIMIT)
        .get(),
      db.collection('chat_memory')
        .where({ enabled: true })
        .orderBy('order', 'asc')
        .limit(MAX_RAG_CANDIDATE_LIMIT)
        .get(),
      db.collection('diaryList')
        .where({ _openid: _.in(syncOpenids) })
        .orderBy('createdAt', 'desc')
        .limit(MAX_RAG_CANDIDATE_LIMIT)
        .get(),
    ]);

    const candidates = [];

    (sharedConceptRes.data || []).forEach((item) => {
      const content = String(item && item.content ? item.content : '').trim();
      if (!content) {
        return;
      }
      const ownerOpenid = String(item.ownerOpenid || item._openid || '').trim();
      const identity = getUserIdentity(ownerOpenid);
      candidates.push({
        source: 'sharedConcept',
        id: String(item._id || '').trim(),
        content,
        createdAt: item.createdAt || item._createTime || '',
        ownerOpenid,
        userLabel: identity.userLabel || '',
        important: false,
      });
    });

    (chatMemoryRes.data || []).forEach((item) => {
      if (!canViewerAccessMemoryItem(item, openid)) {
        return;
      }
      const title = String(item && item.title ? item.title : '').trim();
      const content = String(item && item.content ? item.content : '').trim();
      const mergedContent = [title, content].filter(Boolean).join('：').trim();
      if (!mergedContent) {
        return;
      }
      const ownerOpenid = String(item.ownerOpenid || item._openid || item.creatorOpenid || '').trim();
      const identity = getUserIdentity(ownerOpenid);
      candidates.push({
        source: 'chatMemory',
        id: String(item._id || '').trim(),
        content: mergedContent,
        title,
        createdAt: item.updatedAt || item.createdAt || item._createTime || '',
        ownerOpenid,
        userLabel: identity.userLabel || '',
        important: !!item.important,
      });
    });

    (diaryRes.data || []).forEach((item) => {
      const text = String(item && item.text ? item.text : '').trim();
      if (!text) {
        return;
      }
      const ownerOpenid = String(item._openid || item.ownerOpenid || '').trim();
      const identity = getUserIdentity(ownerOpenid);
      const dateText = String(item.date || '').trim();
      const diaryContent = dateText ? `${dateText}：${text}` : text;
      candidates.push({
        source: 'diary',
        id: String(item._id || '').trim(),
        content: diaryContent,
        createdAt: item.createdAt || item._createTime || '',
        ownerOpenid,
        userLabel: identity.userLabel || '',
        important: !!item.important,
      });
    });

    const ranked = candidates
      .map((candidate) => {
        const scoreParts = scoreRagCandidateHybrid(queryInfo, candidate);
        return {
          ...candidate,
          score: scoreParts.totalScore,
          scoreParts,
        };
      })
      .filter((candidate) => candidate.score > 0);

    const reranked = rerankRagCandidates(ranked, normalizedLimit * 2);
    const conflicts = detectRagConflicts(reranked);

    const deduped = [];
    const seen = new Set();
    reranked.forEach((item) => {
      if (deduped.length >= normalizedLimit) {
        return;
      }
      const key = String(item.content || '').trim();
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      deduped.push({
        source: item.source,
        id: item.id,
        userLabel: item.userLabel,
        content: item.content,
        createdAt: item.createdAt,
        scoreParts: item.scoreParts,
        score: Number(item.score.toFixed(3)),
      });
    });

    const avgScore = deduped.length
      ? deduped.reduce((sum, item) => sum + Number(item.score || 0), 0) / deduped.length
      : 0;
    const topSources = deduped.map((item) => item.source);
    const latencyMs = Date.now() - startedAt;

    await recordRagObservability(openid, {
      query: queryInfo.originalQuery,
      rewrittenQuery: queryInfo.rewrittenQuery,
      expandedTerms: queryInfo.expandedTerms,
      candidateCount: ranked.length,
      selectedCount: deduped.length,
      topSources,
      avgScore,
      conflicts,
      latencyMs,
    });

    return {
      list: deduped,
      total: deduped.length,
      limit: normalizedLimit,
      query: queryInfo.originalQuery,
      rewrittenQuery: queryInfo.rewrittenQuery,
      expandedTerms: queryInfo.expandedTerms,
      conflicts,
      metrics: {
        candidateCount: ranked.length,
        selectedCount: deduped.length,
        avgScore: Number(avgScore.toFixed(3)),
        latencyMs,
      },
      error: null,
    };
  } catch (error) {
    console.error('retrieveRagContext error:', error && error.message ? error.message : error);
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      query: queryInfo.originalQuery,
      rewrittenQuery: queryInfo.rewrittenQuery,
      expandedTerms: queryInfo.expandedTerms,
      conflicts: [],
      metrics: {
        candidateCount: 0,
        selectedCount: 0,
        avgScore: 0,
        latencyMs: Date.now() - startedAt,
      },
      error: error && error.message ? error.message : 'Retrieve RAG context failed',
    };
  }
}

async function runRagEvaluation(openid, { queries, limit } = {}) {
  if (!isAdmin(openid)) {
    return {
      success: false,
      error: 'No permission',
      summary: null,
      details: [],
    };
  }

  const evalQueries = (Array.isArray(queries) && queries.length)
    ? queries.map((item) => ({
        query: String(item && item.query ? item.query : '').trim(),
        expectedKeywords: Array.isArray(item && item.expectedKeywords) ? item.expectedKeywords : [],
      })).filter((item) => item.query)
    : RAG_EVAL_QUERIES;

  const details = [];
  for (const item of evalQueries) {
    const result = await retrieveRagContext(openid, {
      query: item.query,
      limit: limit || DEFAULT_RAG_RESULT_LIMIT,
    });
    const topText = (result.list || []).map((row) => String(row.content || '')).join('\n');
    const hitCount = (item.expectedKeywords || []).filter((keyword) => keyword && topText.includes(keyword)).length;
    const recall = (item.expectedKeywords || []).length
      ? hitCount / (item.expectedKeywords || []).length
      : 0;
    details.push({
      query: item.query,
      expectedKeywords: item.expectedKeywords || [],
      hitCount,
      recall: Number(recall.toFixed(3)),
      selectedCount: Number((result.metrics && result.metrics.selectedCount) || 0),
      avgScore: Number((result.metrics && result.metrics.avgScore) || 0),
      latencyMs: Number((result.metrics && result.metrics.latencyMs) || 0),
      rewrittenQuery: result.rewrittenQuery || item.query,
      conflicts: result.conflicts || [],
      topSources: (result.list || []).map((row) => row.source),
    });
  }

  const avgRecall = details.length
    ? details.reduce((sum, row) => sum + Number(row.recall || 0), 0) / details.length
    : 0;
  const avgLatency = details.length
    ? details.reduce((sum, row) => sum + Number(row.latencyMs || 0), 0) / details.length
    : 0;

  return {
    success: true,
    error: null,
    summary: {
      totalQueries: details.length,
      avgRecall: Number(avgRecall.toFixed(3)),
      avgLatencyMs: Number(avgLatency.toFixed(1)),
      passedQueries: details.filter((row) => Number(row.recall) >= 0.5).length,
    },
    details,
  };
}

function getTodayDateText() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForTemplate(dateText) {
  const normalized = normalizeCalendarDate(dateText);
  if (!normalized) {
    return '';
  }
  const [y, m, d] = normalized.split('-');
  return `${y}年${m}月${d}日`;
}

function shiftDateText(dateText, dayOffset = 0) {
  const normalizedDate = normalizeCalendarDate(dateText);
  if (!normalizedDate) {
    return '';
  }
  const date = new Date(`${normalizedDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  date.setDate(date.getDate() + Number(dayOffset || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNextAnniversaryDate(sourceItem = {}, referenceDate = '') {
  const todayText = normalizeCalendarDate(referenceDate) || getTodayDateText();
  const rawMonthDay = sourceItem.monthDay || String(sourceItem.date || '').slice(5) || '';
  if (!rawMonthDay || rawMonthDay.length < 5) {
    return '';
  }
  const yearNum = parseInt(todayText.slice(0, 4), 10);
  const thisYearDate = `${yearNum}-${rawMonthDay}`;
  return thisYearDate >= todayText ? thisYearDate : `${yearNum + 1}-${rawMonthDay}`;
}

function getAnniversaryYears(sourceItem = {}, occurrenceDate = '') {
  const baseDate = normalizeCalendarDate(sourceItem.date);
  const nextDate = normalizeCalendarDate(occurrenceDate);
  if (!baseDate || !nextDate) {
    return 0;
  }
  return Math.max(0, parseInt(nextDate.slice(0, 4), 10) - parseInt(baseDate.slice(0, 4), 10));
}

function getReminderFieldMaxLen(fieldKey = '') {
  const key = String(fieldKey || '').trim().toLowerCase();
  if (key.startsWith('phrase')) {
    return 5;
  }
  if (key.startsWith('name')) {
    return 10;
  }
  return 20;
}

function buildAnniversaryTemplateValues(sourceItem = {}, reminderType = '') {
  const occurrenceDate = getNextAnniversaryDate(sourceItem);
  const years = getAnniversaryYears(sourceItem, occurrenceDate);
  const isBirthday = String(sourceItem.type || '').trim() === 'birthday';
  const isDayBefore = String(reminderType || '').trim() === 'anniversary_day_before';
  const subjectValue = isBirthday ? 'ç”Ÿæ—¥æé†’' : (String(sourceItem.name || '').includes('é¢†è¯') ? 'ç»“å©šçºªå¿µæ—¥' : 'çºªå¿µæ—¥æé†’');
  const reminderThingValue = isBirthday
    ? sanitizeTemplateText(sourceItem.name || 'ç”Ÿæ—¥æé†’', 20)
    : sanitizeTemplateText(`${sourceItem.name || 'çºªå¿µæ—¥'}${years > 0 ? `${years}å‘¨å¹´` : ''}`, 20);
  const remarkValue = isBirthday
    ? sanitizeTemplateText(isDayBefore ? 'æ˜Žå¤©è®°å¾—é€ä¸Šç¥ç¦å“¦' : 'ä»Šå¤©è®°å¾—åº†ç¥ä¸€ä¸‹å“¦', 20)
    : sanitizeTemplateText(isDayBefore ? 'æ˜Žå¤©å°±æ˜¯çºªå¿µæ—¥å•¦' : 'ä»Šå¤©æ˜¯é‡è¦çºªå¿µæ—¥å“¦', 20);
  return {
    dateValue: occurrenceDate || getTodayDateText(),
    subjectValue: sanitizeTemplateText(subjectValue, 20) || 'çºªå¿µæ—¥æé†’',
    reminderThingValue: reminderThingValue || 'çºªå¿µæ—¥æé†’',
    remarkValue: remarkValue || 'çºªå¿µæ—¥æé†’',
  };
}

function normalizeReminderType(sourceType = '', reminderType = '') {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const normalizedReminderType = String(reminderType || '').trim().toLowerCase();
  const allowedValues = (REMINDER_TYPE_OPTIONS[normalizedSourceType] || []).map((item) => item.value);
  return allowedValues.includes(normalizedReminderType) ? normalizedReminderType : '';
}

function getReminderTemplateConfig(sourceType = '') {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  return REMINDER_TEMPLATE_CONFIG[normalizedSourceType] || null;
}

function getReminderTypeLabel(sourceType = '', reminderType = '') {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const normalizedReminderType = normalizeReminderType(normalizedSourceType, reminderType);
  const matched = (REMINDER_TYPE_OPTIONS[normalizedSourceType] || []).find((item) => item.value === normalizedReminderType);
  return (matched && matched.label) || '';
}

function isReminderTemplateEnabled(sourceType = '') {
  const config = getReminderTemplateConfig(sourceType);
  return !!(config && String(config.templateId || '').trim());
}

function canViewAnniversaries(openid = '') {
  return ANNIVERSARY_VISIBLE_OPENIDS.includes(String(openid || '').trim());
}

function pickAnniversariesForOpenid(openid = '') {
  return canViewAnniversaries(openid) ? RELATIONSHIP_ANNIVERSARIES : [];
}

function pickReminderSubscribeConfig(openid = '') {
  return {
    anniversary: {
      enabled: isReminderTemplateEnabled('anniversary'),
      templateId: String((REMINDER_TEMPLATE_CONFIG.anniversary && REMINDER_TEMPLATE_CONFIG.anniversary.templateId) || '').trim(),
      options: REMINDER_TYPE_OPTIONS.anniversary,
      hint: 'æ¯ä¸ªæŽ¥æ”¶æé†’çš„äººéƒ½éœ€è¦åœ¨è‡ªå·±çš„è´¦å·é‡Œå•ç‹¬è®¢é˜…ä¸€æ¬¡ã€‚',
    },
    calendar: {
      enabled: isReminderTemplateEnabled('calendar'),
      templateId: String((REMINDER_TEMPLATE_CONFIG.calendar && REMINDER_TEMPLATE_CONFIG.calendar.templateId) || '').trim(),
      options: REMINDER_TYPE_OPTIONS.calendar,
      hint: 'æ¯ä¸ªæŽ¥æ”¶æé†’çš„äººéƒ½éœ€è¦åœ¨è‡ªå·±çš„è´¦å·é‡Œå•ç‹¬è®¢é˜…ä¸€æ¬¡ã€‚',
    },
    bookkeeping: {
      enabled: isReminderTemplateEnabled('bookkeeping'),
      templateId: String((REMINDER_TEMPLATE_CONFIG.bookkeeping && REMINDER_TEMPLATE_CONFIG.bookkeeping.templateId) || '').trim(),
      options: REMINDER_TYPE_OPTIONS.bookkeeping,
      hint: 'å€Ÿæ¬¾äººå’Œä»˜æ¬¾äººå¦‚æžœéƒ½æƒ³æ”¶åˆ°æé†’ï¼Œéœ€è¦åˆ†åˆ«åœ¨å„è‡ªè´¦å·é‡Œè®¢é˜…ã€‚',
    },
    anniversaries: pickAnniversariesForOpenid(openid),
  };
}

function buildReminderTriggerDate(sourceType = '', reminderType = '', sourceItem = {}) {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const normalizedReminderType = normalizeReminderType(normalizedSourceType, reminderType);
  const todayText = getTodayDateText();
  if (!normalizedReminderType) {
    return '';
  }

  if (normalizedSourceType === 'anniversary') {
    // Compute next annual occurrence of the anniversary
    const rawMonthDay = sourceItem.monthDay || (String(sourceItem.date || '').slice(5)) || '';
    if (!rawMonthDay || rawMonthDay.length < 5) {
      return '';
    }
    const yearNum = parseInt(todayText.slice(0, 4), 10);
    const thisYearDate = `${yearNum}-${rawMonthDay}`;
    const nextYearDate = `${yearNum + 1}-${rawMonthDay}`;
    const eventDate = thisYearDate >= todayText ? thisYearDate : nextYearDate;
    if (normalizedReminderType === 'anniversary_day_before') {
      const dayBefore = shiftDateText(eventDate, -1);
      return dayBefore && dayBefore >= todayText ? dayBefore : '';
    }
    if (normalizedReminderType === 'anniversary_same_day') {
      return eventDate >= todayText ? eventDate : '';
    }
    return '';
  }

  if (normalizedSourceType === 'calendar') {
    const eventDate = normalizeCalendarDate(sourceItem.date);
    if (!eventDate) {
      return '';
    }
    if (normalizedReminderType === 'calendar_day_before') {
      const dayBefore = shiftDateText(eventDate, -1);
      return dayBefore && dayBefore >= todayText ? dayBefore : '';
    }
    if (normalizedReminderType === 'calendar_same_day') {
      return eventDate >= todayText ? eventDate : '';
    }
    return '';
  }

  if (normalizedSourceType === 'bookkeeping') {
    const promiseDate = normalizeCalendarDate(sourceItem.promiseDate);
    const outstandingAmount = Math.max(
      0,
      Math.round((normalizeMoney(sourceItem.promiseAmount || sourceItem.transferAmount) - normalizeMoney(sourceItem.repaidAmount)) * 100) / 100
    );
    if (!promiseDate || outstandingAmount <= 0) {
      return '';
    }
    if (normalizedReminderType === 'bookkeeping_due') {
      return promiseDate >= todayText ? promiseDate : '';
    }
    if (normalizedReminderType === 'bookkeeping_overdue') {
      const overdueDate = shiftDateText(promiseDate, 1);
      if (!overdueDate) {
        return '';
      }
      return overdueDate < todayText ? todayText : overdueDate;
    }
  }

  return '';
}

function isReminderStillApplicable(sourceType = '', reminderType = '', sourceItem = {}) {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const normalizedReminderType = normalizeReminderType(normalizedSourceType, reminderType);
  if (!normalizedReminderType) {
    return false;
  }
  if (normalizedSourceType === 'anniversary') {
    // Anniversaries recur every year, always applicable
    const rawMonthDay = sourceItem.monthDay || (String(sourceItem.date || '').slice(5)) || '';
    return rawMonthDay.length >= 5;
  }
  if (normalizedSourceType === 'calendar') {
    return !!normalizeCalendarDate(sourceItem.date);
  }
  if (normalizedSourceType === 'bookkeeping') {
    const promiseDate = normalizeCalendarDate(sourceItem.promiseDate);
    const outstandingAmount = Math.max(
      0,
      Math.round((normalizeMoney(sourceItem.promiseAmount || sourceItem.transferAmount) - normalizeMoney(sourceItem.repaidAmount)) * 100) / 100
    );
    return !!promiseDate && outstandingAmount > 0;
  }
  return false;
}

function clipReminderThing(value, maxLen = 20) {
  return normalizeShortText(value, maxLen) || 'æé†’';
}

function sanitizeTemplateText(value, maxLen = 20) {
  const text = String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxLen);
}

function buildReminderSubscribeMessage(sourceType = '', reminderType = '', sourceItem = {}, subscription = {}) {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const normalizedReminderType = normalizeReminderType(normalizedSourceType, reminderType);
  const templateConfig = getReminderTemplateConfig(normalizedSourceType);
  const templateId = String((templateConfig && templateConfig.templateId) || '').trim();
  if (!normalizedReminderType || !templateConfig || !templateId) {
    return null;
  }

  const triggerDate = String(subscription.triggerDate || buildReminderTriggerDate(normalizedSourceType, normalizedReminderType, sourceItem) || '').trim();
  const fieldMap = templateConfig.fields || {};
  const reminderLabel = sanitizeTemplateText(getReminderTypeLabel(normalizedSourceType, normalizedReminderType), 20);
  const recipientName = String(subscription.recipientName || '').trim() || 'ä½ ';

  let dateValue = triggerDate || getTodayDateText();
  let reminderThingValue = reminderLabel || 'æé†’äº‹é¡¹';
  let subjectValue = 'æ—¥ç¨‹';
  let remarkValue = reminderLabel || 'è¯·åŠæ—¶å¤„ç†';
  let page = 'pages/index/index';

  if (normalizedSourceType === 'anniversary') {
    const anniversaryValues = buildAnniversaryTemplateValues(sourceItem, normalizedReminderType);
    dateValue = anniversaryValues.dateValue;
    reminderThingValue = anniversaryValues.reminderThingValue;
    subjectValue = anniversaryValues.subjectValue;
    remarkValue = anniversaryValues.remarkValue;
    page = 'pages/love/love';
  } else if (normalizedSourceType === 'calendar') {
    reminderThingValue = sanitizeTemplateText(sourceItem.title || sourceItem.note || 'å…±äº«æ—¥ç¨‹', 20) || 'å…±äº«æ—¥ç¨‹';
    subjectValue = 'æ—¥ç¨‹';
    remarkValue = sanitizeTemplateText(sourceItem.note || reminderLabel || 'è¯·æŸ¥çœ‹äº‹é¡¹è¯¦æƒ…', 20) || 'æ—¥ç¨‹æé†’';
    page = 'pages/love/love';
  } else if (normalizedSourceType === 'bookkeeping') {
    const outstandingAmount = Math.max(
      0,
      Math.round((normalizeMoney(sourceItem.promiseAmount || sourceItem.transferAmount) - normalizeMoney(sourceItem.repaidAmount)) * 100) / 100
    );
    reminderThingValue = sanitizeTemplateText(sourceItem.purchaseItem || 'å…±äº«è®°è´¦', 20) || 'å…±äº«è®°è´¦';
    subjectValue = 'è´¦å•';
    remarkValue = sanitizeTemplateText(`åˆ°æœŸ${sourceItem.promiseDate || '?'} æ¬ ${outstandingAmount}`, 20) || 'è´¦å•æé†’';
    page = 'pages/bookkeeping/bookkeeping';
  }

  const data = {};
  if (fieldMap.reminderPerson) {
    data[fieldMap.reminderPerson] = { value: sanitizeTemplateText(recipientName, getReminderFieldMaxLen(fieldMap.reminderPerson)) || 'ä½ ' };
  }
  if (fieldMap.date) {
    const rawDate = dateValue || getTodayDateText();
    data[fieldMap.date] = { value: formatDateForTemplate(rawDate) || rawDate };
  }
  if (fieldMap.reminderThing) {
    data[fieldMap.reminderThing] = { value: sanitizeTemplateText(reminderThingValue, getReminderFieldMaxLen(fieldMap.reminderThing)) || 'æé†’äº‹é¡¹' };
  }
  if (fieldMap.subject) {
    data[fieldMap.subject] = { value: sanitizeTemplateText(subjectValue, getReminderFieldMaxLen(fieldMap.subject)) || 'æé†’' };
  }
  if (fieldMap.remark) {
    data[fieldMap.remark] = { value: sanitizeTemplateText(remarkValue, getReminderFieldMaxLen(fieldMap.remark)) || 'è¯·åŠæ—¶å¤„ç†' };
  }

  return {
    touser: String(subscription.recipientOpenid || subscription.ownerOpenid || '').trim(),
    templateId,
    page,
    data,
  };
}

function normalizeMoney(value) {
  const normalizedText = String(value === undefined || value === null ? '' : value).replace(/[^\d.-]/g, '');
  const num = Number(normalizedText);
  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }
  return Math.round(num * 100) / 100;
}

function normalizeShortText(value, maxLen = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function normalizeStringArray(value, maxLen = 20, itemLen = 120) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeShortText(item, itemLen))
      .filter(Boolean)
      .slice(0, maxLen);
  }
  const text = normalizeShortText(value, maxLen * itemLen);
  if (!text) {
    return [];
  }
  return text
    .split(/[,ï¼Œ;ï¼›ã€\n]/)
    .map((item) => normalizeShortText(item, itemLen))
    .filter(Boolean)
    .slice(0, maxLen);
}

function isOverdue(dateText, outstanding) {
  if (!dateText || outstanding <= 0) {
    return false;
  }
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayText = `${y}-${m}-${d}`;
  return String(dateText) < todayText;
}

function pickBookkeepingFields(item = {}, viewerOpenid = '') {
  const viewerIdentity = getUserIdentity(viewerOpenid);
  const viewerName = String(viewerIdentity.personName || '');
  const ownerOpenid = item.ownerOpenid || item._openid || '';
  const transferAmount = normalizeMoney(item.transferAmount);
  const promiseAmount = normalizeMoney(item.promiseAmount || transferAmount);
  const repaidAmount = normalizeMoney(item.repaidAmount);
  const outstandingAmount = Math.max(0, Math.round((promiseAmount - repaidAmount) * 100) / 100);
  const dueDate = item.promiseDate || '';
  const fromName = item.fromName || '孙励天';
  const toName = item.toName || '宋陶颖';
  const overdue = isOverdue(dueDate, outstandingAmount);
  return {
    id: item._id || '',
    _openid: ownerOpenid,
    fromName,
    toName,
    transferAmount,
    purchaseItem: item.purchaseItem || '',
    promiseDate: dueDate,
    promiseAmount,
    repaidAmount,
    outstandingAmount,
    overdue,
    penaltyCount: Number(item.penaltyCount) || 0,
    penaltySuggestion: item.penaltySuggestion || '',
    penaltyDecision: item.penaltyDecision || '',
    createdAt: item.createdAt || item._createTime || '',
    updatedAt: item.updatedAt || '',
    isOwner: String(ownerOpenid) === String(viewerOpenid || ''),
    canSuggestPenalty:
      viewerName && viewerName === String(toName) && !item.penaltySuggestion && overdue && outstandingAmount > 0,
    canDecidePenalty:
      viewerName && viewerName === String(fromName) && !!item.penaltySuggestion && item.penaltyDecision === 'pending',
  };
}

function buildBookkeepingReminderPayload(item = {}) {
  const purchaseItem = normalizeShortText(item.purchaseItem, 80) || 'è´¦å•';
  const promiseDate = normalizeCalendarDate(item.promiseDate);
  const outstandingAmount = Math.max(
    0,
    Math.round((normalizeMoney(item.promiseAmount || item.transferAmount) - normalizeMoney(item.repaidAmount)) * 100) / 100
  );
  if (!promiseDate || outstandingAmount <= 0) {
    return null;
  }
  return {
    date: promiseDate,
    title: 'è®°è´¦åˆ°æœŸæé†’',
    note: `${purchaseItem} åˆ°æœŸéœ€å½’è¿˜ Â¥${outstandingAmount}`,
  };
}

async function syncBookkeepingReminder(openid, bookkeepingItem = {}) {
  const sourceBookkeepingId = String(bookkeepingItem._id || bookkeepingItem.id || '').trim();
  if (!sourceBookkeepingId) {
    return;
  }
  const reminderPayload = buildBookkeepingReminderPayload(bookkeepingItem);
  const existingRes = await db.collection('shared_calendar').where({
    ownerOpenid: openid,
    sourceBookkeepingId,
  }).limit(1).get();
  const existing = (existingRes.data || [])[0] || null;

  if (!reminderPayload) {
    if (existing && existing._id) {
      await db.collection('shared_calendar').doc(existing._id).remove();
    }
    return;
  }

  const patch = {
    ownerOpenid: openid,
    sourceBookkeepingId,
    sourceType: 'bookkeeping',
    date: reminderPayload.date,
    title: reminderPayload.title,
    note: reminderPayload.note,
    updatedAt: new Date(),
  };

  if (existing && existing._id) {
    await db.collection('shared_calendar').doc(existing._id).update({ data: patch });
    return;
  }

  await db.collection('shared_calendar').add({
    data: {
      ...patch,
      createdAt: new Date(),
    },
  });
}

async function removeBookkeepingReminder(openid, bookkeepingId = '') {
  const sourceBookkeepingId = String(bookkeepingId || '').trim();
  if (!sourceBookkeepingId) {
    return;
  }
  const existingRes = await db.collection('shared_calendar').where({
    ownerOpenid: openid,
    sourceBookkeepingId,
  }).limit(1).get();
  const existing = (existingRes.data || [])[0] || null;
  if (existing && existing._id) {
    await db.collection('shared_calendar').doc(existing._id).remove();
  }
}

function pickRecipeFields(item = {}, viewerOpenid = '') {
  const ownerOpenid = item.ownerOpenid || item._openid || '';
  const ingredients = normalizeStringArray(
    item.ingredients !== undefined ? item.ingredients : item.ingredientsText || item.ingredient || item.materials,
    80,
    120
  );
  const steps = normalizeStringArray(
    item.steps !== undefined ? item.steps : item.stepsText || item.method || item.instructions,
    120,
    400
  );
  return {
    id: item._id || '',
    _openid: ownerOpenid,
    name: item.name || '',
    ingredients,
    steps,
    link: item.link || '',
    note: item.note || '',
    createdAt: item.createdAt || item._createTime || '',
    updatedAt: item.updatedAt || '',
    isOwner: String(ownerOpenid) === String(viewerOpenid || ''),
  };
}

function pickCalendarFields(item = {}, viewerOpenid = '') {
  const ownerOpenid = item.ownerOpenid || item._openid || '';
  const identity = getUserIdentity(ownerOpenid);
  return {
    _id: item._id || '',
    _openid: ownerOpenid,
    userLabel: identity.userLabel || '',
    date: item.date || '',
    title: item.title || '',
    note: item.note || '',
    createdAt: item.createdAt || item._createTime || '',
    isOwner: String(ownerOpenid) === String(viewerOpenid || ''),
  };
}

async function getReminderSourceItem(sourceType = '', sourceId = '') {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const docId = String(sourceId || '').trim();
  if (!normalizedSourceType || !docId) {
    return null;
  }
  if (normalizedSourceType === 'anniversary') {
    const found = RELATIONSHIP_ANNIVERSARIES.find((a) => a.id === docId);
    return found ? { ...found, _id: found.id } : null;
  }
  if (normalizedSourceType === 'calendar') {
    const detailRes = await db.collection(SHARED_CALENDAR_COLLECTION).doc(docId).get();
    return detailRes.data || null;
  }
  if (normalizedSourceType === 'bookkeeping') {
    const detailRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    return detailRes.data || null;
  }
  return null;
}

function canAccessReminderSource(openid, sourceItem = {}) {
  // Anniversaries are restricted to whitelist users.
  if (sourceItem._id && RELATIONSHIP_ANNIVERSARIES.some((a) => a.id === sourceItem._id)) {
    return canViewAnniversaries(openid);
  }
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return false;
  }
  const ownerOpenid = String(sourceItem.ownerOpenid || sourceItem._openid || '').trim();
  return !!ownerOpenid && openids.includes(ownerOpenid);
}

function buildReminderSnapshot(sourceType = '', sourceItem = {}) {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  if (normalizedSourceType === 'anniversary') {
    return {
      name: normalizeShortText(sourceItem.name || 'çºªå¿µæ—¥', 80),
      dateText: normalizeShortText(sourceItem.dateText || '', 40),
      type: normalizeShortText(sourceItem.type || '', 20),
    };
  }
  if (normalizedSourceType === 'calendar') {
    return {
      date: normalizeCalendarDate(sourceItem.date),
      title: normalizeShortText(sourceItem.title || 'å…±äº«æ—¥åŽ†', 80),
      note: normalizeShortText(sourceItem.note || '', 120),
    };
  }
  if (normalizedSourceType === 'bookkeeping') {
    return {
      promiseDate: normalizeCalendarDate(sourceItem.promiseDate),
      purchaseItem: normalizeShortText(sourceItem.purchaseItem || 'è´¦å•', 80),
      fromName: normalizeShortText(sourceItem.fromName || '', 32),
      toName: normalizeShortText(sourceItem.toName || '', 32),
      outstandingAmount: Math.max(
        0,
        Math.round((normalizeMoney(sourceItem.promiseAmount || sourceItem.transferAmount) - normalizeMoney(sourceItem.repaidAmount)) * 100) / 100
      ),
    };
  }
  return {};
}

async function upsertReminderSubscription(openid, { sourceType, sourceId, reminderType } = {}) {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const normalizedReminderType = normalizeReminderType(normalizedSourceType, reminderType);
  const docId = String(sourceId || '').trim();
  if (!normalizedSourceType || !normalizedReminderType || !docId) {
    return { success: false, error: 'sourceType/sourceId/reminderType is required', item: null };
  }
  if (!isReminderTemplateEnabled(normalizedSourceType)) {
    return { success: false, error: 'Reminder template is not configured', item: null };
  }

  try {
    const sourceItem = await getReminderSourceItem(normalizedSourceType, docId);
    if (!sourceItem) {
      return { success: false, error: 'Source item not found', item: null };
    }
    if (!canAccessReminderSource(openid, sourceItem)) {
      return { success: false, error: 'No permission', item: null };
    }

    const triggerDate = buildReminderTriggerDate(normalizedSourceType, normalizedReminderType, sourceItem);
    if (!triggerDate) {
      return { success: false, error: 'This reminder time has already passed or is invalid', item: null };
    }

    const snapshot = buildReminderSnapshot(normalizedSourceType, sourceItem);
    const templateId = String((getReminderTemplateConfig(normalizedSourceType) || {}).templateId || '').trim();
    const identity = getUserIdentity(openid);
    const existingRes = await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).where({
      recipientOpenid: openid,
      sourceType: normalizedSourceType,
      sourceId: docId,
      reminderType: normalizedReminderType,
    }).limit(1).get();
    const existing = (existingRes.data || [])[0] || null;

    const patch = {
      ownerOpenid: openid,
      recipientOpenid: openid,
      recipientName: String(identity.personName || identity.userLabel || '').trim(),
      sourceType: normalizedSourceType,
      sourceId: docId,
      reminderType: normalizedReminderType,
      templateId,
      triggerDate,
      snapshot,
      status: 'active',
      sentAt: null,
      lastError: '',
      updatedAt: new Date(),
    };

    if (existing && existing._id) {
      await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(existing._id).update({ data: patch });
      const detailRes = await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(existing._id).get();
      return { success: true, error: null, item: detailRes.data || null };
    }

    const addResult = await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).add({
      data: {
        ...patch,
        createdAt: new Date(),
      },
    });
    const detailRes = await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(addResult._id).get();
    return { success: true, error: null, item: detailRes.data || null };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Subscribe reminder failed',
      item: null,
    };
  }
}

async function testSendReminderNotification(openid, { sourceType, sourceId, reminderType } = {}) {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const normalizedReminderType = normalizeReminderType(normalizedSourceType, reminderType);
  const docId = String(sourceId || '').trim();
  let sourceItem = null;
  if (!normalizedSourceType || !normalizedReminderType || !docId) {
    return { success: false, error: 'sourceType/sourceId/reminderType is required' };
  }
  if (!isReminderTemplateEnabled(normalizedSourceType)) {
    return { success: false, error: 'Reminder template is not configured' };
  }

  try {
    sourceItem = await getReminderSourceItem(normalizedSourceType, docId);
    if (!sourceItem) {
      return { success: false, error: 'Source item not found' };
    }
    if (!canAccessReminderSource(openid, sourceItem)) {
      return { success: false, error: 'No permission' };
    }
    const templatePayload = buildReminderSubscribeMessage(normalizedSourceType, normalizedReminderType, sourceItem, {
      recipientOpenid: openid,
      ownerOpenid: openid,
      recipientName: String((getUserIdentity(openid).personName || '')).trim(),
      triggerDate: getTodayDateText(),
    });
    if (!templatePayload) {
      return { success: false, error: 'Unable to build reminder message' };
    }
    await cloud.openapi.subscribeMessage.send(templatePayload);
    return {
      success: true,
      error: null,
      recipientOpenid: openid,
      recipientName: String((getUserIdentity(openid).personName || '')).trim(),
      templatePayload,
    };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Test send reminder failed',
      debug: {
        errCode: error && error.errCode !== undefined ? error.errCode : null,
        errMsg: error && error.errMsg ? error.errMsg : '',
        sourceType: normalizedSourceType,
        sourceId: docId,
        reminderType: normalizedReminderType,
        templateId: String((getReminderTemplateConfig(normalizedSourceType) || {}).templateId || '').trim(),
        templatePayload: buildReminderSubscribeMessage(normalizedSourceType, normalizedReminderType, sourceItem || {}, {
          recipientOpenid: openid,
          ownerOpenid: openid,
          recipientName: String((getUserIdentity(openid).personName || '')).trim(),
          triggerDate: getTodayDateText(),
        }),
      },
    };
  }
}

async function removeReminderSubscriptionsBySource(sourceType = '', sourceId = '') {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const docId = String(sourceId || '').trim();
  if (!normalizedSourceType || !docId) {
    return;
  }
  const existingRes = await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).where({
    sourceType: normalizedSourceType,
    sourceId: docId,
  }).get();
  const items = existingRes.data || [];
  for (const item of items) {
    if (item && item._id) {
      await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(item._id).remove();
    }
  }
}

async function refreshReminderSubscriptionsForSource(sourceType = '', sourceItem = {}) {
  const normalizedSourceType = String(sourceType || '').trim().toLowerCase();
  const sourceId = String(sourceItem._id || sourceItem.id || '').trim();
  if (!normalizedSourceType || !sourceId) {
    return;
  }

  const existingRes = await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).where({
    sourceType: normalizedSourceType,
    sourceId,
  }).get();
  const items = existingRes.data || [];
  const snapshot = buildReminderSnapshot(normalizedSourceType, sourceItem);
  const templateId = String((getReminderTemplateConfig(normalizedSourceType) || {}).templateId || '').trim();

  for (const item of items) {
    if (!(item && item._id)) {
      continue;
    }
    const normalizedReminderType = normalizeReminderType(normalizedSourceType, item.reminderType);
    if (!normalizedReminderType || !isReminderStillApplicable(normalizedSourceType, normalizedReminderType, sourceItem)) {
      await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(item._id).update({
        data: {
          status: 'cancelled',
          snapshot,
          updatedAt: new Date(),
          lastError: '',
        },
      });
      continue;
    }

    const triggerDate = buildReminderTriggerDate(normalizedSourceType, normalizedReminderType, sourceItem);
    if (!triggerDate) {
      await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(item._id).update({
        data: {
          status: 'cancelled',
          snapshot,
          updatedAt: new Date(),
          lastError: '',
        },
      });
      continue;
    }

    const shouldReactivate = String(item.triggerDate || '').trim() !== triggerDate;
    await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(item._id).update({
      data: {
        templateId,
        triggerDate,
        snapshot,
        status: shouldReactivate ? 'active' : item.status || 'active',
        sentAt: shouldReactivate ? null : item.sentAt || null,
        lastError: '',
        updatedAt: new Date(),
      },
    });
  }
}

async function dispatchReminderNotifications() {
  const todayText = getTodayDateText();
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const dueRes = await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).where({
    status: 'active',
    triggerDate: _.lte(todayText),
  }).limit(100).get();
  const subscriptions = dueRes.data || [];

  for (const subscription of subscriptions) {
    if (!(subscription && subscription._id)) {
      continue;
    }
    try {
      const sourceItem = await getReminderSourceItem(subscription.sourceType, subscription.sourceId);
      if (!sourceItem || !isReminderStillApplicable(subscription.sourceType, subscription.reminderType, sourceItem)) {
        await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(subscription._id).update({
          data: {
            status: 'cancelled',
            updatedAt: new Date(),
            lastError: '',
          },
        });
        skippedCount += 1;
        continue;
      }

      const messagePayload = buildReminderSubscribeMessage(subscription.sourceType, subscription.reminderType, sourceItem, subscription);
      if (!messagePayload) {
        skippedCount += 1;
        continue;
      }

      await cloud.openapi.subscribeMessage.send(messagePayload);
      await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(subscription._id).update({
        data: {
          status: 'sent',
          sentAt: new Date(),
          lastError: '',
          updatedAt: new Date(),
        },
      });
      sentCount += 1;
    } catch (error) {
      await db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).doc(subscription._id).update({
        data: {
          status: 'failed',
          lastError: error && error.message ? error.message : 'Send reminder failed',
          updatedAt: new Date(),
        },
      });
      failedCount += 1;
    }
  }

  return {
    success: true,
    total: subscriptions.length,
    sentCount,
    failedCount,
    skippedCount,
    runDate: todayText,
  };
}

function pickSharedMemoryFields(item = {}, viewerOpenid = '') {
  const ownerOpenid = item.ownerOpenid || item._openid || '';
  const identity = getUserIdentity(ownerOpenid);
  return {
    _id: item._id || '',
    _openid: ownerOpenid,
    userLabel: identity.userLabel || '',
    content: item.content || '',
    createdAt: item.createdAt || item._createTime || '',
    isOwner: String(ownerOpenid) === String(viewerOpenid || ''),
  };
}

function getCollectionMeta(section) {
  if (section === 'diary') {
    return {
      section: 'diary',
      collectionName: 'diaryList',
      orderField: 'createdAt',
      pickFields: pickDiaryFields,
    };
  }

  if (section === 'chatLog') {
    return {
      section: 'chatLog',
      collectionName: 'chat_logs',
      orderField: 'createdAt',
      pickFields: pickChatLogFields,
    };
  }

  return null;
}

async function listCollectionSafely(collectionName, { orderField, orderDirection = 'desc', limit = DEFAULT_PAGE_SIZE, skip = 0, openids = [] } = {}) {
  try {
    let query = db.collection(collectionName);
    if (openids.length) {
      query = query.where({
        _openid: _.in(openids),
      });
    }
    if (orderField) {
      query = query.orderBy(orderField, orderDirection);
    }
    const result = await query.skip(skip).limit(limit).get();
    return {
      data: result.data || [],
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      error: {
        collection: collectionName,
        message: error && error.message ? error.message : 'Query failed',
      },
    };
  }
}

async function countCollectionSafely(collectionName, { openids = [] } = {}) {
  try {
    let query = db.collection(collectionName);
    if (openids.length) {
      query = query.where({
        _openid: _.in(openids),
      });
    }
    const result = await query.count();
    return {
      total: result.total || 0,
      error: null,
    };
  } catch (error) {
    return {
      total: 0,
      error: {
        collection: collectionName,
        message: error && error.message ? error.message : 'Count failed',
      },
    };
  }
}

function pickDiaryFields(item = {}) {
  const identity = getUserIdentity(item._openid);
  return {
    _id: item._id || '',
    _openid: item._openid || '',
    userLabel: identity.userLabel || '',
    text: item.text || '',
    date: item.date || '',
    important: !!item.important,
    createdAt: item.createdAt || item._createTime || '',
  };
}

function pickChatLogFields(item = {}) {
  const identity = getUserIdentity(item._openid);
  return {
    _id: item._id || '',
    _openid: item._openid || '',
    userLabel: identity.userLabel || '',
    question: item.question || '',
    answerPreview: String(item.answer || '').slice(0, 120),
    answerLength: String(item.answer || '').length,
    hasError: !!item.hasError,
    error: item.error || '',
    errorReason: item.errorReason || '',
    durationMs: Number(item.durationMs) || 0,
    createdAt: item.createdAt || item.requestEndedAt || item._createTime || '',
  };
}

async function listSection(section, { limit, skip, userFilter } = {}) {
  const meta = getCollectionMeta(section);
  if (!meta) {
    return {
      list: [],
      total: 0,
      error: { collection: section || 'unknown', message: 'Unknown section' },
    };
  }

  const normalizedLimit = normalizeLimit(limit);
  const normalizedSkip = normalizeSkip(skip);
  const normalizedUserFilter = normalizeUserFilter(userFilter);
  const openids = getOpenidsForUserFilter(normalizedUserFilter);
  if (normalizedUserFilter !== 'all' && !openids.length) {
    return {
      list: [],
      total: 0,
      error: null,
      section: meta.section,
      limit: normalizedLimit,
      skip: normalizedSkip,
      userFilter: normalizedUserFilter,
    };
  }

  const [listResult, countResult] = await Promise.all([
    listCollectionSafely(meta.collectionName, {
      orderField: meta.orderField,
      limit: normalizedLimit,
      skip: normalizedSkip,
      openids,
    }),
    countCollectionSafely(meta.collectionName, { openids }),
  ]);

  return {
    list: (listResult.data || []).map(meta.pickFields),
    total: countResult.total || 0,
    error: listResult.error || countResult.error || null,
    section: meta.section,
    limit: normalizedLimit,
    skip: normalizedSkip,
    userFilter: normalizedUserFilter,
  };
}

async function getChatLogDetail(id) {
  try {
    const result = await db.collection('chat_logs').doc(String(id || '')).get();
    const item = result.data || {};
    return {
      detail: {
        _id: item._id || '',
        answer: item.answer || '',
        question: item.question || '',
        error: item.error || '',
        errorReason: item.errorReason || '',
      },
      error: null,
    };
  } catch (error) {
    return {
      detail: null,
      error: error && error.message ? error.message : 'Detail query failed',
    };
  }
}

async function listSharedDiaries(openid, { limit } = {}) {
  const normalizedLimit = normalizeLimit(limit || DEFAULT_PAGE_SIZE);
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      openids: [],
      error: null,
    };
  }

  const [listResult, countResult] = await Promise.all([
    listCollectionSafely('diaryList', {
      orderField: 'createdAt',
      limit: normalizedLimit,
      skip: 0,
      openids,
    }),
    countCollectionSafely('diaryList', { openids }),
  ]);

  return {
    list: (listResult.data || []).map((item) => ({
      ...pickDiaryFields(item),
      isOwner: String(item._openid || '') === String(openid || ''),
    })),
    total: countResult.total || 0,
    limit: normalizedLimit,
    openids,
    error: listResult.error || countResult.error || null,
  };
}

async function listSharedCalendar(openid, { date, limit, skip } = {}) {
  const normalizedLimit = normalizeCalendarLimit(limit);
  const normalizedSkip = normalizeSkip(skip);
  const normalizedDate = normalizeCalendarDate(date);
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      skip: normalizedSkip,
      date: normalizedDate,
      openids: [],
      error: null,
    };
  }

  const whereCondition = {
    ownerOpenid: _.in(openids),
  };
  if (normalizedDate) {
    whereCondition.date = normalizedDate;
  }

  try {
    const query = db.collection('shared_calendar').where(whereCondition);
    const listResult = await query.orderBy('date', 'asc').orderBy('createdAt', 'desc').skip(normalizedSkip).limit(normalizedLimit).get();

    return {
      list: (listResult.data || []).map((item) => pickCalendarFields(item, openid)),
      total: (listResult.data || []).length,
      limit: normalizedLimit,
      skip: normalizedSkip,
      date: normalizedDate,
      openids,
      error: null,
    };
  } catch (error) {
    console.error('listSharedCalendar error:', error.message, error.errCode);
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      skip: normalizedSkip,
      date: normalizedDate,
      openids,
      error: error.message || 'List shared calendar failed',
    };
  }
}

async function listSharedCalendarMonth(openid, { yearMonth, limit } = {}) {
  const normalizedLimit = normalizeCalendarLimit(limit);
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return {
      calendarList: [],
      total: 0,
      limit: normalizedLimit,
      error: null,
    };
  }

  // Extract year and month from yearMonth (YYYY-MM)
  const [year, month] = String(yearMonth || '').split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return {
      calendarList: [],
      total: 0,
      limit: normalizedLimit,
      error: 'Invalid yearMonth format',
    };
  }

  // Generate date range for the month
  const pad = (n) => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(month)}-01`;
  const lastDayNum = new Date(year, month, 0).getDate();
  const endDate = `${year}-${pad(month)}-${pad(lastDayNum)}`;

  try {
    // Try to query, if collection doesn't exist, return empty
    const allResults = [];
    try {
      for (const userid of openids) {
        try {
          const query = db.collection('shared_calendar').where({
            ownerOpenid: userid,
            date: _.gte(startDate),
          });
          const result = await query.orderBy('date', 'asc').orderBy('createdAt', 'desc').limit(normalizedLimit).get();
          if (result.data) {
            allResults.push(...result.data.filter(item => item.date <= endDate));
          }
        } catch (e) {
          // Skip individual user query errors
          console.warn(`Query for user ${userid} failed:`, e.message);
        }
      }
    } catch (e) {
      console.warn('Collection query failed, returning empty:', e.message);
    }

    return {
      calendarList: allResults.map((item) => pickCalendarFields(item, openid)),
      total: allResults.length,
      limit: normalizedLimit,
      error: null,
    };
  } catch (error) {
    console.error('listSharedCalendarMonth error:', error);
    return {
      calendarList: [],
      total: 0,
      limit: normalizedLimit,
      error: null,  // Return null error to prevent crash
    };
  }
}

async function addSharedCalendar(openid, { date, title, note } = {}) {
  const normalizedDate = normalizeCalendarDate(date);
  const finalTitle = String(title || '').trim();
  const finalNote = String(note || '').trim();

  if (!normalizedDate) {
    return {
      success: false,
      error: 'Invalid date',
      item: null,
    };
  }

  if (!finalTitle && !finalNote) {
    return {
      success: false,
      error: 'Title or note is required',
      item: null,
    };
  }

  try {
    let addResult, detailRes;
    try {
      addResult = await db.collection(SHARED_CALENDAR_COLLECTION).add({
        data: {
          date: normalizedDate,
          title: finalTitle,
          note: finalNote,
          createdAt: new Date(),
          ownerOpenid: openid,
        },
      });

      detailRes = await db.collection(SHARED_CALENDAR_COLLECTION).doc(addResult._id).get();
    } catch (e) {
      console.error('Add calendar item failed:', e.message);
      return {
        success: false,
        error: `Failed to add calendar: ${e.message}`,
        item: null,
      };
    }

    return {
      success: true,
      error: null,
      item: pickCalendarFields(detailRes.data || {}, openid),
    };
  } catch (error) {
    console.error('addSharedCalendar error:', error);
    return {
      success: false,
      error: error && error.message ? error.message : 'Add shared calendar failed',
      item: null,
    };
  }
}

async function deleteSharedCalendar(openid, { id } = {}) {
  const docId = String(id || '').trim();
  if (!docId) {
    return {
      success: false,
      error: 'Invalid id',
    };
  }

  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return {
      success: false,
      error: 'No permission',
    };
  }

  try {
    let detailRes, item;
    try {
      detailRes = await db.collection(SHARED_CALENDAR_COLLECTION).doc(docId).get();
      item = detailRes.data || {};
    } catch (e) {
      const msg = String((e && e.message) || '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('not exist') || msg.includes('not found')) {
        // Idempotent delete: treat missing item as already deleted.
        return {
          success: true,
          error: null,
        };
      }
      console.warn('Get calendar item failed:', e.message);
      return {
        success: false,
        error: `Failed to get calendar: ${e.message}`,
      };
    }

    if (!openids.includes(String(item.ownerOpenid || item._openid || ''))) {
      return {
        success: false,
        error: 'No permission',
      };
    }

    try {
      await db.collection(SHARED_CALENDAR_COLLECTION).doc(docId).remove();
    } catch (e) {
      const msg = String((e && e.message) || '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('not exist') || msg.includes('not found')) {
        return {
          success: true,
          error: null,
        };
      }
      console.warn('Remove calendar item failed:', e.message);
      return {
        success: false,
        error: `Failed to remove calendar: ${e.message}`,
      };
    }

    // Reminder-subscription cleanup should not block successful deletion.
    try {
      await removeReminderSubscriptionsBySource('calendar', docId);
    } catch (e) {
      console.warn('Remove calendar reminders failed:', e.message);
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error('deleteSharedCalendar error:', error);
    return {
      success: false,
      error: error && error.message ? error.message : 'Delete shared calendar failed',
    };
  }
}

async function updateSharedCalendar(openid, { id, date, title, note } = {}) {
  const docId = String(id || '').trim();
  if (!docId) {
    return {
      success: false,
      error: 'Invalid id',
      item: null,
    };
  }

  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return {
      success: false,
      error: 'No permission',
      item: null,
    };
  }

  const finalTitle = title === undefined ? undefined : String(title || '').trim();
  const finalNote = note === undefined ? undefined : String(note || '').trim();
  const normalizedDate = date === undefined ? undefined : normalizeCalendarDate(date);

  if (date !== undefined && !normalizedDate) {
    return {
      success: false,
      error: 'Invalid date',
      item: null,
    };
  }

  if (finalTitle === undefined && finalNote === undefined && normalizedDate === undefined) {
    return {
      success: false,
      error: 'Nothing to update',
      item: null,
    };
  }

  try {
    let detailRes;
    try {
      detailRes = await db.collection(SHARED_CALENDAR_COLLECTION).doc(docId).get();
    } catch (e) {
      return {
        success: false,
        error: `Failed to get calendar: ${e.message}`,
        item: null,
      };
    }

    const sourceItem = detailRes.data || {};
    if (!openids.includes(String(sourceItem.ownerOpenid || sourceItem._openid || ''))) {
      return {
        success: false,
        error: 'No permission',
        item: null,
      };
    }

    const patch = {};
    if (normalizedDate !== undefined) {
      patch.date = normalizedDate;
    }
    if (finalTitle !== undefined) {
      patch.title = finalTitle;
    }
    if (finalNote !== undefined) {
      patch.note = finalNote;
    }
    patch.updatedAt = new Date();

    if (
      (patch.title !== undefined ? patch.title : String(sourceItem.title || '').trim()) === '' &&
      (patch.note !== undefined ? patch.note : String(sourceItem.note || '').trim()) === ''
    ) {
      return {
        success: false,
        error: 'Title or note is required',
        item: null,
      };
    }

    await db.collection(SHARED_CALENDAR_COLLECTION).doc(docId).update({ data: patch });
    const updatedRes = await db.collection(SHARED_CALENDAR_COLLECTION).doc(docId).get();
    await refreshReminderSubscriptionsForSource('calendar', updatedRes.data || {});

    return {
      success: true,
      error: null,
      item: pickCalendarFields(updatedRes.data || {}, openid),
    };
  } catch (error) {
    console.error('updateSharedCalendar error:', error);
    return {
      success: false,
      error: error && error.message ? error.message : 'Update shared calendar failed',
      item: null,
    };
  }
}

async function listSharedConceptMemories(openid, { limit } = {}) {
  const normalizedLimit = normalizeSharedMemoryLimit(limit);
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      openids: [],
      error: null,
    };
  }

  try {
    const query = db.collection(SHARED_CONCEPT_MEMORY_COLLECTION).where({
      ownerOpenid: _.in(openids),
    });
    const listResult = await query.orderBy('createdAt', 'desc').limit(normalizedLimit).get();

    const deduped = [];
    const seen = new Set();
    (listResult.data || []).forEach((item) => {
      const content = String(item && item.content ? item.content : '').trim();
      if (!content || seen.has(content)) {
        return;
      }
      seen.add(content);
      deduped.push(pickSharedMemoryFields(item, openid));
    });

    return {
      list: deduped,
      total: deduped.length,
      limit: normalizedLimit,
      openids,
      error: null,
    };
  } catch (error) {
    console.error('listSharedConceptMemories error:', error.message);
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      openids,
      error: error && error.message ? error.message : 'List shared concept memories failed',
    };
  }
}

async function addSharedConceptMemory(openid, { content } = {}) {
  const finalContent = normalizeSharedMemoryContent(content);
  const contentFingerprint = normalizeMemoryFingerprint(finalContent);
  if (!finalContent) {
    return {
      success: false,
      error: 'Invalid content',
      item: null,
    };
  }

  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    console.warn('addSharedConceptMemory: no synced openids for', openid);
    return {
      success: false,
      error: 'No permission',
      item: null,
    };
  }

  try {
    const recentRes = await db.collection(SHARED_CONCEPT_MEMORY_COLLECTION).where({
      ownerOpenid: _.in(openids),
    }).orderBy('createdAt', 'desc').limit(MEMORY_CONFLICT_WINDOW_SIZE).get();

    const existing = (recentRes.data || []).find((item) => {
      const prev = normalizeMemoryFingerprint(item && item.content ? item.content : '');
      return !!prev && prev === contentFingerprint;
    });
    if (existing) {
      return {
        success: true,
        error: null,
        item: pickSharedMemoryFields(existing, openid),
      };
    }

    const conflictWith = (recentRes.data || []).find((item) => {
      const prevContent = String(item && item.content ? item.content : '').trim();
      if (!prevContent) {
        return false;
      }
      const subjectNow = finalContent.match(/^([\u4e00-\u9fffA-Za-z0-9]{1,12})/);
      const subjectPrev = prevContent.match(/^([\u4e00-\u9fffA-Za-z0-9]{1,12})/);
      if (!subjectNow || !subjectPrev || subjectNow[1] !== subjectPrev[1]) {
        return false;
      }
      const nowNeg = /(不是|并非|没有|无)/.test(finalContent);
      const prevNeg = /(不是|并非|没有|无)/.test(prevContent);
      return nowNeg !== prevNeg;
    });

    const addResult = await db.collection(SHARED_CONCEPT_MEMORY_COLLECTION).add({
      data: {
        content: finalContent,
        contentFingerprint,
        conflictTag: conflictWith ? 'possible_conflict' : '',
        conflictRefId: conflictWith ? String(conflictWith._id || '') : '',
        createdAt: new Date(),
        ownerOpenid: openid,
      },
    });
    console.log('addSharedConceptMemory: added new memory, id:', addResult._id, 'ownerOpenid:', openid);
    const detailRes = await db.collection(SHARED_CONCEPT_MEMORY_COLLECTION).doc(addResult._id).get();
    return {
      success: true,
      error: null,
      item: pickSharedMemoryFields(detailRes.data || {}, openid),
    };
  } catch (error) {
    console.error('addSharedConceptMemory error:', error.message, error.errCode);
    return {
      success: false,
      error: error && error.message ? error.message : 'Add shared concept memory failed',
      item: null,
    };
  }
}

async function listSharedBookkeeping(openid, { limit } = {}) {
  const normalizedLimit = normalizeLimit(limit || DEFAULT_PAGE_SIZE);
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return { list: [], total: 0, limit: normalizedLimit, error: null };
  }
  try {
    const query = db.collection(SHARED_BOOKKEEPING_COLLECTION).where({ ownerOpenid: _.in(openids) });
    const listResult = await query.orderBy('createdAt', 'desc').limit(normalizedLimit).get();
    const list = (listResult.data || []).map((item) => pickBookkeepingFields(item, openid));
    return {
      list,
      total: list.length,
      limit: normalizedLimit,
      error: null,
    };
  } catch (error) {
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      error: error && error.message ? error.message : 'List shared bookkeeping failed',
    };
  }
}

async function addSharedBookkeeping(openid, payload = {}) {
  const transferAmount = normalizeMoney(payload.transferAmount);
  const promiseAmount = normalizeMoney(payload.promiseAmount || transferAmount);
  const purchaseItem = normalizeShortText(payload.purchaseItem, 200);
  const promiseDate = normalizeCalendarDate(payload.promiseDate || payload.repayDate);
  if (transferAmount <= 0 || !purchaseItem || !promiseDate) {
    return { success: false, error: 'transferAmount/purchaseItem/promiseDate is required', item: null };
  }
  try {
    const addResult = await db.collection(SHARED_BOOKKEEPING_COLLECTION).add({
      data: {
        ownerOpenid: openid,
        fromName: normalizeShortText(payload.fromName, 32) || '孙励天',
        toName: normalizeShortText(payload.toName, 32) || '宋陶颖',
        transferAmount,
        purchaseItem,
        promiseDate,
        promiseAmount,
        repaidAmount: 0,
        penaltyCount: 0,
        penaltySuggestion: '',
        penaltyDecision: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const detailRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(addResult._id).get();
    await syncBookkeepingReminder(openid, detailRes.data || {});
    return { success: true, error: null, item: pickBookkeepingFields(detailRes.data || {}, openid) };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Add shared bookkeeping failed',
      item: null,
    };
  }
}

async function repaySharedBookkeeping(openid, { id, repayAmount } = {}) {
  const docId = String(id || '').trim();
  const amount = normalizeMoney(repayAmount);
  if (!docId || amount <= 0) {
    return { success: false, error: 'id and repayAmount are required', item: null };
  }
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return { success: false, error: 'No permission', item: null };
  }
  try {
    const detailRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    const source = detailRes.data || {};
    if (!openids.includes(String(source.ownerOpenid || source._openid || ''))) {
      return { success: false, error: 'No permission', item: null };
    }
    const nextRepaidAmount = normalizeMoney((source.repaidAmount || 0) + amount);
    await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).update({
      data: { repaidAmount: nextRepaidAmount, updatedAt: new Date() },
    });
    const updatedRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    await syncBookkeepingReminder(openid, updatedRes.data || {});
    await refreshReminderSubscriptionsForSource('bookkeeping', updatedRes.data || {});
    return { success: true, error: null, item: pickBookkeepingFields(updatedRes.data || {}, openid) };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Repay shared bookkeeping failed',
      item: null,
    };
  }
}

async function updateSharedBookkeeping(openid, payload = {}) {
  const docId = String(payload.id || '').trim();
  if (!docId) {
    return { success: false, error: 'id is required', item: null };
  }
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return { success: false, error: 'No permission', item: null };
  }

  const patch = {};
  if (payload.promiseDate !== undefined) {
    const promiseDate = normalizeCalendarDate(payload.promiseDate);
    if (!promiseDate) {
      return { success: false, error: 'Invalid promiseDate', item: null };
    }
    patch.promiseDate = promiseDate;
  }
  if (payload.promiseAmount !== undefined) {
    const promiseAmount = normalizeMoney(payload.promiseAmount);
    if (promiseAmount <= 0) {
      return { success: false, error: 'Invalid promiseAmount', item: null };
    }
    patch.promiseAmount = promiseAmount;
  }
  if (payload.repaidAmount !== undefined) {
    const repaidAmount = normalizeMoney(payload.repaidAmount);
    if (repaidAmount < 0) {
      return { success: false, error: 'Invalid repaidAmount', item: null };
    }
    patch.repaidAmount = repaidAmount;
  }
  if (payload.transferAmount !== undefined) {
    const transferAmount = normalizeMoney(payload.transferAmount);
    if (transferAmount <= 0) {
      return { success: false, error: 'Invalid transferAmount', item: null };
    }
    patch.transferAmount = transferAmount;
  }
  if (payload.purchaseItem !== undefined) {
    const purchaseItem = normalizeShortText(payload.purchaseItem, 200);
    if (!purchaseItem) {
      return { success: false, error: 'Invalid purchaseItem', item: null };
    }
    patch.purchaseItem = purchaseItem;
  }
  if (!Object.keys(patch).length) {
    return { success: false, error: 'Nothing to update', item: null };
  }

  try {
    const detailRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    const source = detailRes.data || {};
    if (!openids.includes(String(source.ownerOpenid || source._openid || ''))) {
      return { success: false, error: 'No permission', item: null };
    }

    patch.updatedAt = new Date();
    await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).update({ data: patch });
    const updatedRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    await syncBookkeepingReminder(openid, updatedRes.data || {});
    await refreshReminderSubscriptionsForSource('bookkeeping', updatedRes.data || {});
    return { success: true, error: null, item: pickBookkeepingFields(updatedRes.data || {}, openid) };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Update shared bookkeeping failed',
      item: null,
    };
  }
}

async function deleteSharedBookkeeping(openid, { id } = {}) {
  const docId = String(id || '').trim();
  if (!docId) {
    return { success: false, error: 'Invalid id' };
  }
  try {
    const detailRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    const source = detailRes.data || {};
    const ownerOpenid = String(source.ownerOpenid || source._openid || '');
    if (String(ownerOpenid) !== String(openid || '')) {
      return { success: false, error: 'Only creator can delete this bill' };
    }
    await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).remove();
    await removeBookkeepingReminder(openid, docId);
    await removeReminderSubscriptionsBySource('bookkeeping', docId);
    return { success: true, error: null };
  } catch (error) {
    const errMsg = String((error && error.message) || '').toLowerCase();
    if (errMsg.includes('does not exist') || errMsg.includes('not exist') || errMsg.includes('not found')) {
      return { success: true, error: null };
    }
    return {
      success: false,
      error: error && error.message ? error.message : 'Delete shared bookkeeping failed',
    };
  }
}

async function suggestSharedPenalty(openid, { id, suggestion } = {}) {
  const docId = String(id || '').trim();
  const suggestionText = normalizeShortText(suggestion, 300);
  const identity = getUserIdentity(openid);
  if (!docId || !suggestionText) {
    return { success: false, error: 'id and suggestion are required', item: null };
  }
  try {
    const detailRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    const source = detailRes.data || {};
    const picked = pickBookkeepingFields(source, openid);
    if (String(identity.personName || '') !== String(picked.toName || '')) {
      return { success: false, error: 'Only the borrower can suggest penalty', item: null };
    }
    if (!(picked.overdue && picked.outstandingAmount > 0)) {
      return { success: false, error: 'Penalty only allowed when overdue and still unpaid', item: null };
    }
    if (picked.penaltySuggestion && picked.penaltyDecision === 'pending') {
      return { success: false, error: 'A penalty suggestion is already pending', item: null };
    }
    await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).update({
      data: {
        penaltySuggestion: suggestionText,
        penaltyDecision: 'pending',
        penaltyCount: (Number(source.penaltyCount) || 0) + 1,
        updatedAt: new Date(),
      },
    });
    const updatedRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    return { success: true, error: null, item: pickBookkeepingFields(updatedRes.data || {}, openid) };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Suggest penalty failed',
      item: null,
    };
  }
}

async function decideSharedPenalty(openid, { id, decision } = {}) {
  const docId = String(id || '').trim();
  const finalDecision = String(decision || '').trim().toLowerCase();
  const identity = getUserIdentity(openid);
  if (!docId || !['accept', 'accepted', 'reject', 'rejected'].includes(finalDecision)) {
    return { success: false, error: 'id and decision(accept/reject) are required', item: null };
  }
  try {
    const detailRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    const source = detailRes.data || {};
    const picked = pickBookkeepingFields(source, openid);
    if (String(identity.personName || '') !== String(picked.fromName || '')) {
      return { success: false, error: 'Only the payer can decide penalty', item: null };
    }
    if (!(picked.penaltySuggestion && picked.penaltyDecision === 'pending')) {
      return { success: false, error: 'No pending penalty suggestion found', item: null };
    }
    await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).update({
      data: {
        penaltyDecision: finalDecision.startsWith('accept') ? 'accepted' : 'rejected',
        updatedAt: new Date(),
      },
    });
    const updatedRes = await db.collection(SHARED_BOOKKEEPING_COLLECTION).doc(docId).get();
    return { success: true, error: null, item: pickBookkeepingFields(updatedRes.data || {}, openid) };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Decide penalty failed',
      item: null,
    };
  }
}

async function listSharedRecipes(openid, { keyword, limit } = {}) {
  const normalizedLimit = normalizeLimit(limit || DEFAULT_PAGE_SIZE);
  const openids = getSyncedDiaryOpenids(openid);
  const keywordText = normalizeShortText(keyword, 60);
  if (!openids.length) {
    return { list: [], total: 0, limit: normalizedLimit, error: null };
  }
  try {
    const query = db.collection(SHARED_RECIPE_COLLECTION).where({ ownerOpenid: _.in(openids) });
    const listResult = await query.orderBy('updatedAt', 'desc').limit(Math.max(normalizedLimit, 50)).get();
    let list = (listResult.data || []).map((item) => pickRecipeFields(item, openid));
    if (keywordText) {
      list = list.filter((item) => {
        const inName = String(item.name || '').includes(keywordText);
        const inIngredients = (item.ingredients || []).some((it) => String(it).includes(keywordText));
        const inSteps = (item.steps || []).some((it) => String(it).includes(keywordText));
        return inName || inIngredients || inSteps;
      });
    }
    list = list.slice(0, normalizedLimit);
    return { list, total: list.length, limit: normalizedLimit, error: null };
  } catch (error) {
    return {
      list: [],
      total: 0,
      limit: normalizedLimit,
      error: error && error.message ? error.message : 'List shared recipes failed',
    };
  }
}

async function addSharedRecipe(openid, payload = {}) {
  const name = normalizeShortText(payload.name, 80);
  const ingredients = normalizeStringArray(payload.ingredients, 80, 120);
  const steps = normalizeStringArray(payload.steps, 120, 400);
  const link = normalizeShortText(payload.link, 500);
  const note = normalizeShortText(payload.note, 400);
  if (!name || !ingredients.length || !steps.length) {
    return { success: false, error: 'name/ingredients/steps are required', item: null };
  }
  try {
    const addResult = await db.collection(SHARED_RECIPE_COLLECTION).add({
      data: {
        ownerOpenid: openid,
        name,
        ingredients,
        steps,
        link,
        note,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const detailRes = await db.collection(SHARED_RECIPE_COLLECTION).doc(addResult._id).get();
    return { success: true, error: null, item: pickRecipeFields(detailRes.data || {}, openid) };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Add shared recipe failed',
      item: null,
    };
  }
}

async function updateSharedRecipe(openid, payload = {}) {
  const docId = String(payload.id || '').trim();
  if (!docId) {
    return { success: false, error: 'id is required', item: null };
  }
  try {
    const detailRes = await db.collection(SHARED_RECIPE_COLLECTION).doc(docId).get();
    const source = detailRes.data || {};
    const ownerOpenid = String(source.ownerOpenid || source._openid || '');
    if (String(ownerOpenid) !== String(openid || '')) {
      return { success: false, error: 'Only creator can edit this recipe', item: null };
    }

    const patch = {};
    if (payload.name !== undefined) {
      const name = normalizeShortText(payload.name, 80);
      if (!name) {
        return { success: false, error: 'Invalid name', item: null };
      }
      patch.name = name;
    }
    if (payload.ingredients !== undefined) {
      const ingredients = normalizeStringArray(payload.ingredients, 80, 120);
      if (!ingredients.length) {
        return { success: false, error: 'Invalid ingredients', item: null };
      }
      patch.ingredients = ingredients;
    }
    if (payload.steps !== undefined) {
      const steps = normalizeStringArray(payload.steps, 120, 400);
      if (!steps.length) {
        return { success: false, error: 'Invalid steps', item: null };
      }
      patch.steps = steps;
    }
    if (payload.link !== undefined) {
      patch.link = normalizeShortText(payload.link, 500);
    }
    if (payload.note !== undefined) {
      patch.note = normalizeShortText(payload.note, 400);
    }
    if (!Object.keys(patch).length) {
      return { success: false, error: 'Nothing to update', item: null };
    }

    patch.updatedAt = new Date();
    await db.collection(SHARED_RECIPE_COLLECTION).doc(docId).update({ data: patch });
    const updatedRes = await db.collection(SHARED_RECIPE_COLLECTION).doc(docId).get();
    return { success: true, error: null, item: pickRecipeFields(updatedRes.data || {}, openid) };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Update shared recipe failed',
      item: null,
    };
  }
}

async function deleteSharedRecipe(openid, { id } = {}) {
  const docId = String(id || '').trim();
  if (!docId) {
    return { success: false, error: 'Invalid id' };
  }
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return { success: false, error: 'No permission' };
  }
  try {
    const detailRes = await db.collection(SHARED_RECIPE_COLLECTION).doc(docId).get();
    const source = detailRes.data || {};
    if (!openids.includes(String(source.ownerOpenid || source._openid || ''))) {
      return { success: false, error: 'No permission' };
    }
    await db.collection(SHARED_RECIPE_COLLECTION).doc(docId).remove();
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Delete shared recipe failed',
    };
  }
}

async function deleteSectionItem(section, id) {
  const meta = getCollectionMeta(section);
  if (!meta) {
    return {
      success: false,
      error: 'Unknown section',
    };
  }

  try {
    await db.collection(meta.collectionName).doc(String(id || '')).remove();
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : 'Delete failed',
    };
  }
}

function pickChecklistFields(doc = {}, viewerOpenid = '') {
  const ownerOpenid = String(doc.ownerOpenid || doc._openid || '').trim();
  const identity = getUserIdentity(ownerOpenid);
  const rawItems = Array.isArray(doc.items) ? doc.items : [];
  const items = rawItems.map((it) => ({
    id: String((it && it.id) || ''),
    content: String((it && it.content) || ''),
    blocker: String((it && it.blocker) || ''),
    done: !!(it && it.done),
    createdAt: (it && it.createdAt) || '',
  }));
  const doneCount = items.filter((it) => it.done).length;
  return {
    id: String(doc._id || ''),
    ownerOpenid,
    ownerLabel: identity.userLabel || '',
    title: String(doc.title || ''),
    expectedDate: String(doc.expectedDate || ''),
    items,
    itemCount: items.length,
    doneCount,
    createdAt: doc.createdAt || '',
    updatedAt: doc.updatedAt || '',
    isOwner: ownerOpenid === String(viewerOpenid || ''),
  };
}

function generateChecklistItemId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function loadChecklistDoc(openid, docId) {
  const detailRes = await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).get();
  const doc = detailRes.data || null;
  if (!doc) {
    return { doc: null, error: 'Checklist not found' };
  }
  const ownerOpenid = String(doc.ownerOpenid || doc._openid || '').trim();
  const allowedOpenids = getSyncedDiaryOpenids(openid);
  if (!allowedOpenids.includes(ownerOpenid)) {
    return { doc: null, error: 'No permission' };
  }
  return { doc, error: null };
}

async function listSharedChecklists(openid, { limit } = {}) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) {
    return { list: [], total: 0, error: null };
  }
  try {
    const res = await db.collection(SHARED_CHECKLIST_COLLECTION)
      .where({ ownerOpenid: _.in(openids) })
      .orderBy('updatedAt', 'desc')
      .limit(normalizedLimit)
      .get();
    const list = (res.data || []).map((d) => pickChecklistFields(d, openid));
    return { list, total: list.length, error: null };
  } catch (error) {
    return {
      list: [],
      total: 0,
      error: (error && error.message) || 'List checklists failed',
    };
  }
}

async function addSharedChecklist(openid, { title, expectedDate } = {}) {
  const finalTitle = String(title || '').trim().slice(0, 60);
  const normalizedDate = normalizeCalendarDate(expectedDate) || '';
  if (!finalTitle) {
    return { success: false, error: 'Title is required', item: null };
  }
  try {
    const now = new Date();
    const addResult = await db.collection(SHARED_CHECKLIST_COLLECTION).add({
      data: {
        ownerOpenid: openid,
        title: finalTitle,
        expectedDate: normalizedDate,
        items: [],
        createdAt: now,
        updatedAt: now,
      },
    });
    const detailRes = await db.collection(SHARED_CHECKLIST_COLLECTION).doc(addResult._id).get();
    return {
      success: true,
      error: null,
      item: pickChecklistFields(detailRes.data || {}, openid),
    };
  } catch (error) {
    return {
      success: false,
      error: (error && error.message) || 'Add checklist failed',
      item: null,
    };
  }
}

async function updateSharedChecklist(openid, { id, title, expectedDate } = {}) {
  const docId = String(id || '').trim();
  if (!docId) {
    return { success: false, error: 'id is required', item: null };
  }
  try {
    const loaded = await loadChecklistDoc(openid, docId);
    if (!loaded.doc) {
      return { success: false, error: loaded.error, item: null };
    }
    const patch = { updatedAt: new Date() };
    if (title !== undefined) {
      const finalTitle = String(title || '').trim().slice(0, 60);
      if (!finalTitle) {
        return { success: false, error: 'Title cannot be empty', item: null };
      }
      patch.title = finalTitle;
    }
    if (expectedDate !== undefined) {
      patch.expectedDate = normalizeCalendarDate(expectedDate) || '';
    }
    await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).update({ data: patch });
    const updatedRes = await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).get();
    return {
      success: true,
      error: null,
      item: pickChecklistFields(updatedRes.data || {}, openid),
    };
  } catch (error) {
    return {
      success: false,
      error: (error && error.message) || 'Update checklist failed',
      item: null,
    };
  }
}

async function deleteSharedChecklist(openid, { id } = {}) {
  const docId = String(id || '').trim();
  if (!docId) {
    return { success: false, error: 'id is required' };
  }
  try {
    const loaded = await loadChecklistDoc(openid, docId);
    if (!loaded.doc) {
      return { success: false, error: loaded.error };
    }
    const ownerOpenid = String(loaded.doc.ownerOpenid || loaded.doc._openid || '').trim();
    if (ownerOpenid !== String(openid)) {
      return { success: false, error: 'Only owner can delete' };
    }
    await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).remove();
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: (error && error.message) || 'Delete checklist failed',
    };
  }
}

async function addChecklistItem(openid, { id, content, blocker } = {}) {
  const docId = String(id || '').trim();
  const finalContent = String(content || '').trim().slice(0, 100);
  const finalBlocker = String(blocker || '').trim().slice(0, 100);
  if (!docId || !finalContent) {
    return { success: false, error: 'id and content are required', item: null };
  }
  try {
    const loaded = await loadChecklistDoc(openid, docId);
    if (!loaded.doc) {
      return { success: false, error: loaded.error, item: null };
    }
    const currentItems = Array.isArray(loaded.doc.items) ? loaded.doc.items : [];
    const nextItems = currentItems.concat([{
      id: generateChecklistItemId(),
      content: finalContent,
      blocker: finalBlocker,
      done: false,
      createdAt: new Date().toISOString(),
    }]);
    await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).update({
      data: { items: nextItems, updatedAt: new Date() },
    });
    const updatedRes = await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).get();
    return {
      success: true,
      error: null,
      item: pickChecklistFields(updatedRes.data || {}, openid),
    };
  } catch (error) {
    return {
      success: false,
      error: (error && error.message) || 'Add checklist item failed',
      item: null,
    };
  }
}

async function updateChecklistItem(openid, { id, itemId, content, blocker, done } = {}) {
  const docId = String(id || '').trim();
  const targetItemId = String(itemId || '').trim();
  if (!docId || !targetItemId) {
    return { success: false, error: 'id and itemId are required', item: null };
  }
  try {
    const loaded = await loadChecklistDoc(openid, docId);
    if (!loaded.doc) {
      return { success: false, error: loaded.error, item: null };
    }
    const currentItems = Array.isArray(loaded.doc.items) ? loaded.doc.items : [];
    let found = false;
    const nextItems = currentItems.map((it) => {
      if (!it || it.id !== targetItemId) {
        return it;
      }
      found = true;
      const next = Object.assign({}, it);
      if (content !== undefined) {
        next.content = String(content || '').trim().slice(0, 100);
      }
      if (blocker !== undefined) {
        next.blocker = String(blocker || '').trim().slice(0, 100);
      }
      if (done !== undefined) {
        next.done = !!done;
      }
      return next;
    });
    if (!found) {
      return { success: false, error: 'Item not found', item: null };
    }
    await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).update({
      data: { items: nextItems, updatedAt: new Date() },
    });
    const updatedRes = await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).get();
    return {
      success: true,
      error: null,
      item: pickChecklistFields(updatedRes.data || {}, openid),
    };
  } catch (error) {
    return {
      success: false,
      error: (error && error.message) || 'Update checklist item failed',
      item: null,
    };
  }
}

async function deleteChecklistItem(openid, { id, itemId } = {}) {
  const docId = String(id || '').trim();
  const targetItemId = String(itemId || '').trim();
  if (!docId || !targetItemId) {
    return { success: false, error: 'id and itemId are required', item: null };
  }
  try {
    const loaded = await loadChecklistDoc(openid, docId);
    if (!loaded.doc) {
      return { success: false, error: loaded.error, item: null };
    }
    const currentItems = Array.isArray(loaded.doc.items) ? loaded.doc.items : [];
    const nextItems = currentItems.filter((it) => it && it.id !== targetItemId);
    if (nextItems.length === currentItems.length) {
      return { success: false, error: 'Item not found', item: null };
    }
    await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).update({
      data: { items: nextItems, updatedAt: new Date() },
    });
    const updatedRes = await db.collection(SHARED_CHECKLIST_COLLECTION).doc(docId).get();
    return {
      success: true,
      error: null,
      item: pickChecklistFields(updatedRes.data || {}, openid),
    };
  } catch (error) {
    return {
      success: false,
      error: (error && error.message) || 'Delete checklist item failed',
      item: null,
    };
  }
}

// ==================== Recipe AI generation ====================

function httpsPostJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    try {
      const https = require('https');
      const parsed = new URL(url);
      const payload = Buffer.from(JSON.stringify(body || {}), 'utf8');
      const req = https.request(
        {
          method: 'POST',
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || 443,
          path: `${parsed.pathname}${parsed.search || ''}`,
          headers: Object.assign(
            {
              'Content-Type': 'application/json',
              'Content-Length': payload.length,
            },
            headers || {}
          ),
          timeout: 60000,
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(text));
              } catch (e) {
                resolve({ raw: text });
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
            }
          });
        }
      );
      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy(new Error('Request timeout'));
      });
      req.write(payload);
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function callAzureOpenAIChat(messages, options = {}) {
  const { endpointBase, apiKey, deployment, apiVersion } = AZURE_OPENAI_CONFIG;
  if (!endpointBase || !apiKey || !deployment) {
    throw new Error('Azure OpenAI is not configured');
  }
  const url = `${endpointBase}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const body = {
    messages,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.4,
    max_tokens: options.maxTokens || 1200,
  };
  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }
  const result = await httpsPostJson(url, { 'api-key': apiKey }, body);
  const content = (((result || {}).choices || [])[0] || {}).message || {};
  const text = String(content.content || '').trim();
  if (!text) {
    throw new Error('AI returned empty content');
  }
  return text;
}

async function downloadCloudFileAsDataUrl(fileID) {
  if (!fileID) {
    return '';
  }
  try {
    const res = await cloud.downloadFile({ fileID });
    const buf = res && res.fileContent;
    if (!buf) {
      return '';
    }
    const lower = String(fileID).toLowerCase();
    let mime = 'image/jpeg';
    if (lower.endsWith('.png')) mime = 'image/png';
    else if (lower.endsWith('.webp')) mime = 'image/webp';
    else if (lower.endsWith('.gif')) mime = 'image/gif';
    const base64 = Buffer.from(buf).toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    console.error('downloadCloudFileAsDataUrl error:', error.message);
    return '';
  }
}

function normalizeRecipeKeyText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s\-_/]/g, '')
    .replace(/[，,。.！!？?、；;：:（）()\[\]【】""''""''`~!@#$%^&*+=]/g, '')
    .trim();
}

function normalizeIngredientToken(text) {
  return normalizeRecipeKeyText(
    String(text || '')
      .replace(/[\d\s]+(?:克|g|千克|kg|毫升|ml|升|l|勺|汤匙|茶匙|大勺|小勺|个|只|片|段|根|颗|粒|撮|把|瓣|斤|两|份|点|少许|适量)/g, '')
      .replace(/\d+/g, '')
  );
}

function stringBigramSet(text) {
  const s = normalizeRecipeKeyText(text);
  const set = new Set();
  if (s.length <= 1) {
    if (s) set.add(s);
    return set;
  }
  for (let i = 0; i < s.length - 1; i += 1) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

function jaccardSets(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  setA.forEach((v) => {
    if (setB.has(v)) inter += 1;
  });
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

function computeRecipeSimilarity(candidate = {}, target = {}) {
  const nameA = normalizeRecipeKeyText(candidate.name);
  const nameB = normalizeRecipeKeyText(target.name);
  let nameScore = 0;
  if (nameA && nameB) {
    if (nameA === nameB) {
      nameScore = 1;
    } else if (nameA.includes(nameB) || nameB.includes(nameA)) {
      nameScore = 0.85;
    } else {
      nameScore = jaccardSets(stringBigramSet(nameA), stringBigramSet(nameB));
    }
  }

  const ingA = new Set(
    (candidate.ingredients || []).map(normalizeIngredientToken).filter(Boolean)
  );
  const ingB = new Set(
    (target.ingredients || []).map(normalizeIngredientToken).filter(Boolean)
  );
  const ingredientScore = jaccardSets(ingA, ingB);

  return Number((nameScore * 0.6 + ingredientScore * 0.4).toFixed(3));
}

async function findSimilarRecipe(openid, target = {}) {
  const openids = getSyncedDiaryOpenids(openid);
  if (!openids.length) return null;
  try {
    const res = await db
      .collection(SHARED_RECIPE_COLLECTION)
      .where({ ownerOpenid: _.in(openids) })
      .limit(100)
      .get();
    let best = null;
    (res.data || []).forEach((doc) => {
      const score = computeRecipeSimilarity(doc, target);
      if (!best || score > best.score) {
        best = { doc, score };
      }
    });
    if (!best || best.score < RECIPE_SIMILARITY_THRESHOLD) {
      return null;
    }
    return {
      score: best.score,
      item: pickRecipeFields(best.doc, openid),
    };
  } catch (error) {
    console.error('findSimilarRecipe error:', error.message);
    return null;
  }
}

function extractRecipeJsonBlock(text) {
  if (!text) return null;
  const raw = String(text).trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

async function generateRecipeFromInput(openid, { description, imageFileID } = {}) {
  const desc = String(description || '').trim().slice(0, 800);
  const fileID = String(imageFileID || '').trim();
  if (!desc && !fileID) {
    return { success: false, error: '请提供图片或描述', data: null };
  }

  const systemPrompt = `你是一位中文家庭菜谱生成助手。基于用户给出的菜品图片和/或文字描述，生成一份可直接照做的菜谱。请严格只输出 JSON，禁止输出其它解释文字。JSON 结构：
{
  "name": "菜名（10字以内）",
  "ingredients": ["食材1 用量", "食材2 用量"],
  "steps": ["步骤1...", "步骤2..."],
  "note": "可选小贴士（少于60字）"
}
- ingredients 每项尽量含份量，列 3~10 项；
- steps 每项一句话，6~12 步；
- 若图片与描述冲突，以图片内容为主；
- 若信息不足，用常见家常做法合理补全。`;

  const userContent = [];
  if (desc) {
    userContent.push({ type: 'text', text: `描述：${desc}` });
  } else {
    userContent.push({ type: 'text', text: '请根据图片识别菜品并生成菜谱。' });
  }
  if (fileID) {
    const dataUrl = await downloadCloudFileAsDataUrl(fileID);
    if (dataUrl) {
      userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
  }

  let rawText = '';
  try {
    rawText = await callAzureOpenAIChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { temperature: 0.5, maxTokens: 1400, responseFormat: { type: 'json_object' } }
    );
  } catch (error) {
    return {
      success: false,
      error: (error && error.message) || 'AI 调用失败',
      data: null,
    };
  }

  const parsed = extractRecipeJsonBlock(rawText) || {};
  const generated = {
    name: String(parsed.name || '').trim().slice(0, 40),
    ingredients: Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30)
      : [],
    steps: Array.isArray(parsed.steps)
      ? parsed.steps.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30)
      : [],
    note: String(parsed.note || '').trim().slice(0, 200),
  };

  if (!generated.name || !generated.ingredients.length || !generated.steps.length) {
    return {
      success: false,
      error: 'AI 返回内容不完整，请重试或补充描述',
      data: { rawText, generated },
    };
  }

  const similar = await findSimilarRecipe(openid, generated);
  return {
    success: true,
    error: null,
    data: {
      mode: similar ? 'matched' : 'generated',
      generated,
      similar: similar || null,
    },
  };
}

exports.main = async (event = {}, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const envId = wxContext.ENV || cloud.DYNAMIC_CURRENT_ENV || '';
  const action = event.action || 'check';

  if ((event.triggerTime || event.triggerName || event.time) && (action === 'check' || action === 'dispatchReminderNotifications')) {
    const result = await dispatchReminderNotifications();
    return {
      envId,
      ...result,
    };
  }

  if (action === 'getViewerIdentity') {
    return {
      openid,
      isAdmin: isAdmin(openid),
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      anniversaries: pickAnniversariesForOpenid(openid),
      ...getUserIdentity(openid),
    };
  }

  if (action === 'listRelationshipAnniversaries') {
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      anniversaries: pickAnniversariesForOpenid(openid),
    };
  }

  if (action === 'listMyReminderSubscriptions') {
    try {
      const filterSourceType = String(event.sourceType || '').trim().toLowerCase();
      const query = {
        status: _.in(['active', 'sent', 'failed']),
      };
      if (filterSourceType) {
        query.sourceType = filterSourceType;
      }

      const [ownerRes, recipientRes] = await Promise.all([
        db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).where({ ...query, ownerOpenid: openid }).limit(100).get(),
        db.collection(SHARED_REMINDER_SUBSCRIPTION_COLLECTION).where({ ...query, recipientOpenid: openid }).limit(100).get(),
      ]);

      const merged = [...(ownerRes.data || []), ...(recipientRes.data || [])];
      const subs = [];
      const seen = new Set();
      for (const item of merged) {
        const id = String((item && item._id) || '').trim();
        if (!id || seen.has(id)) {
          continue;
        }
        seen.add(id);
        subs.push(item);
      }

      return {
        isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
        envId,
        subscriptions: subs,
        count: subs.length,
        hasAny: subs.length > 0,
      };
    } catch (error) {
      return {
        isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
        envId,
        subscriptions: [],
        count: 0,
        hasAny: false,
      };
    }
  }

  if (action === 'getReminderSubscribeConfig') {
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      reminderConfig: pickReminderSubscribeConfig(openid),
    };
  }

  if (action === 'subscribeReminderNotification') {
    const result = await upsertReminderSubscription(openid, {
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      reminderType: event.reminderType,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'testSendReminderNotification') {
    const result = await testSendReminderNotification(openid, {
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      reminderType: event.reminderType,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      recipientOpenid: result.recipientOpenid || '',
      recipientName: result.recipientName || '',
      error: result.error,
    };
  }

  if (action === 'dispatchReminderNotifications') {
    const result = await dispatchReminderNotifications();
    return {
      envId,
      ...result,
    };
  }

  if (action === 'listSharedDiaries') {
    const result = await listSharedDiaries(openid, { limit: event.limit });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      diaryList: result.list,
      diaryCount: result.total,
      diaryLimit: result.limit,
      syncOpenids: result.openids,
      error: result.error,
    };
  }

  if (action === 'listSharedCalendar') {
    const result = await listSharedCalendar(openid, {
      date: event.date,
      limit: event.limit,
      skip: event.skip,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      calendarList: result.list,
      calendarCount: result.total,
      calendarLimit: result.limit,
      calendarSkip: result.skip,
      date: result.date,
      syncOpenids: result.openids,
      error: result.error,
    };
  }

  if (action === 'listSharedCalendarMonth') {
    const result = await listSharedCalendarMonth(openid, {
      yearMonth: event.yearMonth,
      limit: event.limit,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      calendarList: result.calendarList,
      calendarCount: result.total,
      calendarLimit: result.limit,
      error: result.error,
    };
  }

  if (action === 'addSharedCalendar') {
    const result = await addSharedCalendar(openid, {
      date: event.date,
      title: event.title,
      note: event.note,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'deleteSharedCalendar') {
    const result = await deleteSharedCalendar(openid, { id: event.id });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      error: result.error,
    };
  }

  if (action === 'updateSharedCalendar') {
    const result = await updateSharedCalendar(openid, {
      id: event.id,
      date: event.date,
      title: event.title,
      note: event.note,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'listSharedConceptMemories') {
    const result = await listSharedConceptMemories(openid, { limit: event.limit });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      memoryList: result.list,
      memoryCount: result.total,
      memoryLimit: result.limit,
      syncOpenids: result.openids,
      error: result.error,
    };
  }

  if (action === 'retrieveRagContext') {
    const result = await retrieveRagContext(openid, {
      query: event.query,
      limit: event.limit,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      ragList: result.list,
      ragCount: result.total,
      ragLimit: result.limit,
      query: result.query,
      rewrittenQuery: result.rewrittenQuery,
      expandedTerms: result.expandedTerms,
      conflicts: result.conflicts,
      metrics: result.metrics,
      error: result.error,
    };
  }

  if (action === 'runRagEvaluation' || action === 'runRagEvalation') {
    const result = await runRagEvaluation(openid, {
      queries: event.queries,
      limit: event.limit,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      summary: result.summary,
      details: result.details,
      error: result.error,
    };
  }

  if (action === 'addSharedConceptMemory') {
    const result = await addSharedConceptMemory(openid, { content: event.content });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'listSharedBookkeeping') {
    const result = await listSharedBookkeeping(openid, { limit: event.limit });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      bookkeepingList: result.list,
      bookkeepingCount: result.total,
      bookkeepingLimit: result.limit,
      error: result.error,
    };
  }

  if (action === 'addSharedBookkeeping') {
    const result = await addSharedBookkeeping(openid, {
      fromName: event.fromName,
      toName: event.toName,
      transferAmount: event.transferAmount,
      purchaseItem: event.purchaseItem,
      promiseDate: event.promiseDate,
      promiseAmount: event.promiseAmount,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'repaySharedBookkeeping') {
    const result = await repaySharedBookkeeping(openid, {
      id: event.id,
      repayAmount: event.repayAmount,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'updateSharedBookkeeping') {
    const result = await updateSharedBookkeeping(openid, {
      id: event.id,
      promiseDate: event.promiseDate,
      promiseAmount: event.promiseAmount,
      repaidAmount: event.repaidAmount,
      transferAmount: event.transferAmount,
      purchaseItem: event.purchaseItem,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'deleteSharedBookkeeping') {
    const result = await deleteSharedBookkeeping(openid, { id: event.id });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      error: result.error,
    };
  }

  if (action === 'suggestSharedPenalty') {
    const result = await suggestSharedPenalty(openid, {
      id: event.id,
      suggestion: event.suggestion,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'decideSharedPenalty') {
    const result = await decideSharedPenalty(openid, {
      id: event.id,
      decision: event.decision,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'listSharedRecipes') {
    const result = await listSharedRecipes(openid, {
      keyword: event.keyword,
      limit: event.limit,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      recipeList: result.list,
      recipeCount: result.total,
      recipeLimit: result.limit,
      error: result.error,
    };
  }

  if (action === 'addSharedRecipe') {
    const result = await addSharedRecipe(openid, {
      name: event.name,
      ingredients: event.ingredients,
      steps: event.steps,
      link: event.link,
      note: event.note,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'updateSharedRecipe') {
    const result = await updateSharedRecipe(openid, {
      id: event.id,
      name: event.name,
      ingredients: event.ingredients,
      steps: event.steps,
      link: event.link,
      note: event.note,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'deleteSharedRecipe') {
    const result = await deleteSharedRecipe(openid, { id: event.id });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      error: result.error,
    };
  }

  if (!isAdmin(openid)) {
    return {
      isAdmin: false,
      envId,
      message: 'No permission',
    };
  }

  if (action === 'listAdminData') {
    const diaryLimit = normalizeLimit(event.diaryLimit);
    const chatLogLimit = normalizeLimit(event.chatLogLimit);
    const userFilter = normalizeUserFilter(event.userFilter);
    const [diaryResult, chatLogResult] = await Promise.all([
      listSection('diary', { limit: diaryLimit, skip: 0, userFilter }),
      listSection('chatLog', { limit: chatLogLimit, skip: 0, userFilter }),
    ]);

    const loadErrors = [diaryResult.error, chatLogResult.error].filter(Boolean);

    return {
      isAdmin: true,
      envId,
      diaryList: diaryResult.list || [],
      diaryCount: diaryResult.total || 0,
      diaryLimit,
      diarySkip: 0,
      userFilter,
      chatLogList: chatLogResult.list || [],
      chatLogCount: chatLogResult.total || 0,
      chatLogLimit,
      chatLogSkip: 0,
      loadErrors,
    };
  }

  if (action === 'listPage') {
    const section = String(event.section || '');
    const result = await listSection(section, {
      limit: event.limit,
      skip: event.skip,
      userFilter: event.userFilter,
    });

    return {
      isAdmin: true,
      envId,
      section: result.section,
      list: result.list,
      total: result.total,
      skip: result.skip,
      limit: result.limit,
      userFilter: result.userFilter,
      error: result.error,
    };
  }

  if (action === 'getChatLogDetail') {
    const result = await getChatLogDetail(event.id);
    return {
      isAdmin: true,
      envId,
      detail: result.detail,
      error: result.error,
    };
  }

  if (action === 'deleteItem') {
    const result = await deleteSectionItem(String(event.section || ''), event.id);
    return {
      isAdmin: true,
      envId,
      success: result.success,
      error: result.error,
    };
  }

  if (action === 'listSharedChecklists') {
    const result = await listSharedChecklists(openid, { limit: event.limit });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      checklistList: result.list,
      checklistCount: result.total,
      error: result.error,
    };
  }

  if (action === 'addSharedChecklist') {
    const result = await addSharedChecklist(openid, {
      title: event.title,
      expectedDate: event.expectedDate,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'updateSharedChecklist') {
    const result = await updateSharedChecklist(openid, {
      id: event.id,
      title: event.title,
      expectedDate: event.expectedDate,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'deleteSharedChecklist') {
    const result = await deleteSharedChecklist(openid, { id: event.id });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      error: result.error,
    };
  }

  if (action === 'addChecklistItem') {
    const result = await addChecklistItem(openid, {
      id: event.id,
      content: event.content,
      blocker: event.blocker,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'updateChecklistItem') {
    const result = await updateChecklistItem(openid, {
      id: event.id,
      itemId: event.itemId,
      content: event.content,
      blocker: event.blocker,
      done: event.done,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'deleteChecklistItem') {
    const result = await deleteChecklistItem(openid, {
      id: event.id,
      itemId: event.itemId,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      item: result.item,
      error: result.error,
    };
  }

  if (action === 'generateRecipeFromInput') {
    const result = await generateRecipeFromInput(openid, {
      description: event.description,
      imageFileID: event.imageFileID,
    });
    return {
      isKnownUser: !!USER_IDENTITY_MAP[String(openid || '')],
      envId,
      success: result.success,
      data: result.data,
      error: result.error,
    };
  }

  return {
    isAdmin: true,
  };
};



