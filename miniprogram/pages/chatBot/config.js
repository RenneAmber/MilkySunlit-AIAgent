// 隐私等级定义
const PRIVACY_LEVELS = {
  PUBLIC: "public",      // 所有人可见
  COUPLE: "couple",      // 仅夫妻互相 + admin
  ADMIN: "admin",        // 仅 admin
};

// 孙励天和宋陶颖的 openid 配对
const COUPLE_OPENIDS = [
  "o1vza4lDAMQeVaoL2xdW4E_xmJCs", // 孙励天
  "o1vza4gSIXtoc73DOsiBVNpsgOao", // 宋陶颖
];

// 字段隐私级别配置
const PRIVACY_CONFIG = {
  people: {
    sunLitian: {
      relationToPartner: PRIVACY_LEVELS.COUPLE,
      affectionSummary: PRIVACY_LEVELS.COUPLE,
      favoriteAppearance: PRIVACY_LEVELS.COUPLE,
      favoriteBodyPart: PRIVACY_LEVELS.COUPLE,
      affinityDetails: PRIVACY_LEVELS.COUPLE,
    },
    songTaoying: {
      relationToPartner: PRIVACY_LEVELS.COUPLE,
      affectionSummary: PRIVACY_LEVELS.COUPLE,
      favoriteThings: PRIVACY_LEVELS.PUBLIC,
      workplace: PRIVACY_LEVELS.PUBLIC,
      occupation: PRIVACY_LEVELS.PUBLIC,
    },
    sunXingyue: {
      birthday: PRIVACY_LEVELS.COUPLE,
    },
  },
};

function isCoupleOrAdmin(userIdentity, adminOpenids = []) {
  const openid = userIdentity?.openid || "";
  const isCoupleUser = COUPLE_OPENIDS.includes(openid);
  const isAdmin = adminOpenids.includes(openid);
  return isCoupleUser || isAdmin;
}

function getPrivacyLevel(fieldPath) {
  const [person, field] = fieldPath.split(".");
  return PRIVACY_CONFIG.people?.[person]?.[field] || PRIVACY_LEVELS.PUBLIC;
}

function canViewField(fieldPath, userIdentity, adminOpenids = []) {
  const level = getPrivacyLevel(fieldPath);
  if (level === PRIVACY_LEVELS.PUBLIC) return true;
  if (level === PRIVACY_LEVELS.COUPLE) return isCoupleOrAdmin(userIdentity, adminOpenids);
  if (level === PRIVACY_LEVELS.ADMIN) return adminOpenids.includes(userIdentity?.openid || "");
  return true;
}

const STATIC_LOCAL_FACTS = {
  family: {
    childName: "孙星玥",
  },
  people: {
    sunLitian: {
      name: "孙励天",
      aliases: ["孙励天"],
      birthday: "1996-01-18",
      workplace: "悉尼微软",
      occupation: "程序员",
      relationToPartner: "宋陶颖的老公",
      affectionSummary: "很喜欢宋陶颖",
      favoriteAppearance: "她美丽的外表和白嫩的肌肤",
      favoriteBodyPart: "脚",
      affinityDetails: ["喜欢她聪明能干", "喜欢她深深爱着自己", "喜欢她美丽的外表和白嫩的肌肤", "最喜欢她的脚"],
    },
    songTaoying: {
      name: "宋陶颖",
      aliases: ["宋陶颖"],
      birthday: "1998-11-25",
      workplace: "上海马陆派出所",
      occupation: "警察",
      relationToPartner: "孙励天的老婆",
      affectionSummary: "更喜欢孙励天，会很关心他的生活",
      favoriteThings: [
        "喜欢漂亮的石头",
        "喜欢好看的衣服和挂件",
        "喜欢玩王者荣耀和和平精英",
        "喜欢做饭做菜研究",
        "喜欢和阮阮姐姐聊天",
        "喜欢旅游逛街",
      ],
    },
    sunXingyue: {
      name: "孙星玥",
      aliases: ["孙星玥"],
      birthday: "2024-10-18",
      relationSummary: "孙励天和宋陶颖的孩子，宝宝，女儿，现在越来越懂事了",
    },
    qinTian: {
      name: "秦天",
      aliases: ["秦天"],
      birthday: "1996-05-19",
      education: "美国理海大学数学博士（2026年毕业）",
      workplace: "华尔街",
      occupation: "金融行业从业者",
      relationSummary: "孙励天的好兄弟，高中同学，同为数学爱好者",
      overseasSummary: "2019年赴美读博后至今未归",
      gamesWithSunLitian: ["使命召唤online", "守望先锋", "王者荣耀", "和平精英", "麻将"],
      hobbies: ["打羽毛球", "健身"],
      bodySummary: "以前体重有点大，现在一身腱子肉",
      appearanceSummary: "头发有点秃，不修边幅",
      personalitySummary: "人相对有点无趣，所以追不上女生",
      socialCircleSummary: "朋友不多，经常寂寞寂寞就好",
      socialSummary: "对孙励天的人生发展、八卦历史和现状都很了解",
      relationshipStatus: "目前单身，没有女朋友；一直想找女生，但经常做舔狗，也会对有对象的女生主动示好",
    },
  },
};

const DEFAULT_MEMORY_ITEMS = [
  {
    title: "家庭与关系",
    content:
      "孙励天是宋陶颖的老公，他们有个孩子叫孙星玥。孙励天很喜欢宋陶颖，宋陶颖更喜欢孙励天。",
  },
  {
    title: "孙励天信息",
    content: "孙励天1996.1.18出生，在悉尼微软工作，程序员。",
  },
  {
    title: "宋陶颖信息",
    content: "宋陶颖1998.11.25出生，在上海马陆派出所工作，警察。",
  },
  {
    title: "秦天信息",
    content:
      "秦天1996.5.19出生，美国理海大学数学博士（2026年毕业），目前在华尔街工作；是孙励天的好兄弟和高中同学，2019年赴美读博后至今未归。爱好是打羽毛球和健身，以前偏胖现在一身腱子肉。",
  },
];

const DIARY_MEMORY_LIMIT = 12;

function calculateAge(birthday) {
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) {
    return "";
  }

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  const dayDiff = now.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return `${age}`;
}

function buildStrictLocalNames(facts = {}) {
  return Object.values(facts.people || {})
    .flatMap((person) => person.aliases || [])
    .filter(Boolean);
}

function buildStructuredLocalFactsPrompt(facts = {}, userIdentity = {}, adminOpenids = []) {
  const { family = {}, people = {} } = facts;
  const sunLitian = people.sunLitian || {};
  const songTaoying = people.songTaoying || {};
  const sunXingyue = people.sunXingyue || {};
  const qinTian = people.qinTian || {};
  const sunLitianAge = calculateAge(sunLitian.birthday);
  const songTaoyingAge = calculateAge(songTaoying.birthday);
  const qinTianAge = calculateAge(qinTian.birthday);
  const sunLitianDetails = (sunLitian.affinityDetails || []).join("；");
  const songTaoyingFavorites = (songTaoying.favoriteThings || []).join("；");
  const qinTianGames = (qinTian.gamesWithSunLitian || []).join("、");
  const qinTianHobbies = (qinTian.hobbies || []).join("、");

  return [
    "以下人物设定属于当前对话里的本地固定事实，不要联想到任何外部同名人物、历史人物或影视角色。",
    canViewField("sunLitian.relationToPartner", userIdentity, adminOpenids) 
      ? `${sunLitian.name}：生日${sunLitian.birthday}，当前${sunLitianAge}岁，在${sunLitian.workplace}工作，职业是${sunLitian.occupation}，身份是${sunLitian.relationToPartner}，感情信息是${sunLitian.affectionSummary}。`
      : `${sunLitian.name}：生日${sunLitian.birthday}，当前${sunLitianAge}岁，在${sunLitian.workplace}工作，职业是${sunLitian.occupation}。`,
    canViewField("sunLitian.favoriteAppearance", userIdentity, adminOpenids) && sunLitian.favoriteAppearance
      ? `${sunLitian.name}明确喜欢${songTaoying.name}的：${sunLitian.favoriteAppearance}。`
      : "",
    canViewField("sunLitian.favoriteBodyPart", userIdentity, adminOpenids) && sunLitian.favoriteBodyPart
      ? `${sunLitian.name}最喜欢${songTaoying.name}的身体部位是：${sunLitian.favoriteBodyPart}。`
      : "",
    canViewField("sunLitian.affinityDetails", userIdentity, adminOpenids) && sunLitianDetails
      ? `${sunLitian.name}补充偏好：${sunLitianDetails}。`
      : "",
    canViewField("songTaoying.relationToPartner", userIdentity, adminOpenids)
      ? `${songTaoying.name}：生日${songTaoying.birthday}，当前${songTaoyingAge}岁，在${songTaoying.workplace}工作，职业是${songTaoying.occupation}，身份是${songTaoying.relationToPartner}，感情信息是${songTaoying.affectionSummary}。`
      : `${songTaoying.name}：当前${songTaoyingAge}岁，在${songTaoying.workplace}工作，职业是${songTaoying.occupation}。`,
    songTaoyingFavorites ? `${songTaoying.name}明确喜欢的事情有：${songTaoyingFavorites}。` : "",
    canViewField("sunXingyue.birthday", userIdentity, adminOpenids)
      ? `${sunXingyue.name}：${sunXingyue.relationSummary}。`
      : `${sunXingyue.name}：是家庭的一员。`,
    qinTian.name
      ? `${qinTian.name}：生日${qinTian.birthday}，当前${qinTianAge}岁，${qinTian.education || "学历信息未知"}，在${qinTian.workplace || "未知地点"}工作，职业是${qinTian.occupation || "未知职业"}。`
      : "",
    qinTian.relationSummary ? `${qinTian.name}与孙励天关系：${qinTian.relationSummary}。` : "",
    qinTian.overseasSummary ? `${qinTian.name}经历：${qinTian.overseasSummary}。` : "",
    qinTianHobbies ? `${qinTian.name}爱好：${qinTianHobbies}。` : "",
    qinTian.bodySummary ? `${qinTian.name}体型变化：${qinTian.bodySummary}。` : "",
    qinTian.appearanceSummary ? `${qinTian.name}外在特点：${qinTian.appearanceSummary}。` : "",
    qinTian.personalitySummary ? `${qinTian.name}性格补充：${qinTian.personalitySummary}。` : "",
    qinTian.socialCircleSummary ? `${qinTian.name}社交状态：${qinTian.socialCircleSummary}。` : "",
    qinTianGames ? `${qinTian.name}和孙励天一起玩过：${qinTianGames}。` : "",
    qinTian.socialSummary ? `${qinTian.name}补充信息：${qinTian.socialSummary}。` : "",
    qinTian.relationshipStatus ? `${qinTian.name}感情状态：${qinTian.relationshipStatus}。` : "",
    `家庭关系：${sunLitian.name}和${songTaoying.name}有个孩子叫${family.childName || sunXingyue.name}。`,
    "当用户问年龄、几岁、生日、关系、工作、喜欢谁、喜欢什么、为什么喜欢、最喜欢什么部位、喜欢她哪里时，优先使用这些固定事实直接回答；如果固定事实里已经有明确答案，必须直接回答该答案，不要改写成推测、泛化分析或文学化发挥；可以做轻微的、贴近日常关系的自然推断，但不要说来源。",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildMemoryPrompt(items = []) {
  if (!items.length) return "";
  const content = items
    .map((item, idx) => `${idx + 1}. ${item.title || "记忆"}：${item.content || ""}`)
    .filter((line) => line && !line.endsWith("："))
    .join("\n");

  if (!content) return "";
  return `你是奶菠小筑的温柔陪聊助手。以下是长期记忆，请在相关话题中自然使用，不要生硬罗列：\n${content}`;
}

function mergeMemoryPrompt(basePrompt, identityPrompt) {
  return [basePrompt, identityPrompt].filter(Boolean).join("\n\n");
}

function buildAgentConfig() {
  return {
    botId: "bot-c5167aab",
    allowWebSearch: true,
    allowUploadFile: true,
    allowPullRefresh: true,
    allowUploadImage: true,
    showToolCallDetail: true,
    allowMultiConversation: true,
    allowVoice: true,
    showBotName: true,
  };
}

function buildModelConfig() {
  return {
    modelProvider: "openai",
    quickResponseModel: "gpt-4.1-mini",
    deploymentName: "gpt-41_milky",
    apiVersion: "2025-01-01-preview",
    endpointBase: "https://milkysunlit.openai.azure.com",
    apiKey: "236d2d85c3ce4b5d9fbf5517df1c5e6f",
    enableQaLogging: true,
    qaLogCollection: "chat_logs",
    strictLocalNames: buildStrictLocalNames(STATIC_LOCAL_FACTS),
    localFactsPrompt: buildStructuredLocalFactsPrompt(STATIC_LOCAL_FACTS),
    memoryPrompt: "",
    logo: "",
    welcomeMsg: "你好，不介意的话，我可以陪你聊会天",
  };
}

function buildChatBotPageData() {
  return {
    chatMode: "model",
    showBotAvatar: true,
    agentConfig: buildAgentConfig(),
    modelConfig: buildModelConfig(),
  };
}

module.exports = {
  DEFAULT_MEMORY_ITEMS,
  DIARY_MEMORY_LIMIT,
  STATIC_LOCAL_FACTS,
  PRIVACY_LEVELS,
  COUPLE_OPENIDS,
  buildAgentConfig,
  buildChatBotPageData,
  buildMemoryPrompt,
  buildModelConfig,
  buildStrictLocalNames,
  buildStructuredLocalFactsPrompt,
  mergeMemoryPrompt,
};