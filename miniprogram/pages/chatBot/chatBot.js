// pages/chatBot/chatBot.js
const {
  DEFAULT_MEMORY_ITEMS,
  DIARY_MEMORY_LIMIT,
  buildChatBotPageData,
  buildMemoryPrompt,
  mergeMemoryPrompt,
  buildStructuredLocalFactsPrompt,
  STATIC_LOCAL_FACTS,
  buildStrictLocalNames,
  PRIVACY_LEVELS,
  COUPLE_OPENIDS,
} = require("./config");

// 只有 孙励天↔宋陶颖 互相共享日记记忆，其他人只用本地默认
const ALLOWED_SHARED_DIARY_USERS = ["孙励天", "宋陶颖"];
// 共享日记每小时同步一次，避免每次打开页面都请求云端
const DIARY_SYNC_CACHE_KEY = "chatbot_diary_sync_cache";
const DIARY_SYNC_TTL = 3600000; // 1 小时（ms）
// onShow 时若 memory prompt 未过期则跳过重新拉取，避免每次切回都触发云端请求
const MEMORY_PROMPT_REFRESH_KEY = "chatbot_memory_prompt_refreshed_at";
const MEMORY_PROMPT_TTL = 300000; // 5 分钟（ms）
const CHAT_MEMORY_LIMIT = 40;
const ADMIN_OPENIDS = ["o1vza4lDAMQeVaoL2xdW4E_xmJCs"];

function normalizePrivacyLevel(value) {
  const level = String(value || PRIVACY_LEVELS.PUBLIC).toLowerCase().trim();
  if (level === PRIVACY_LEVELS.COUPLE || level === PRIVACY_LEVELS.ADMIN) {
    return level;
  }
  return PRIVACY_LEVELS.PUBLIC;
}

function isCoupleOpenid(openid) {
  return COUPLE_OPENIDS.includes(String(openid || ""));
}

function canViewMemoryItem(item = {}, viewerIdentity = {}) {
  const level = normalizePrivacyLevel(item.privacyLevel || item.level || item.visibility);
  const viewerOpenid = String(viewerIdentity.openid || "");
  const ownerOpenid = String(item.ownerOpenid || item._openid || item.creatorOpenid || "");
  const isAdminViewer = !!viewerIdentity.isAdmin || ADMIN_OPENIDS.includes(viewerOpenid);
  const isOwner = !!viewerOpenid && !!ownerOpenid && viewerOpenid === ownerOpenid;

  if (level === PRIVACY_LEVELS.PUBLIC) {
    return true;
  }
  if (level === PRIVACY_LEVELS.ADMIN) {
    return isAdminViewer;
  }
  if (isAdminViewer || isOwner) {
    return true;
  }

  // COUPLE: 仅夫妻互相可见（外加 admin 与本人）
  return isCoupleOpenid(viewerOpenid) && isCoupleOpenid(ownerOpenid);
}

function normalizeDiaryText(value, maxLen = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen)}...`;
}

function summarizeDiaryImage(imagePath) {
  const fullPath = String(imagePath || "").trim();
  if (!fullPath) {
    return "";
  }
  const filename = fullPath.split("/").pop() || fullPath;
  return `并上传了1张图片（${filename}）`;
}

function buildDiaryMemoryItems(diaries = [], fallbackPersonName = "") {
  return diaries
    .map((item) => {
      const textPart = normalizeDiaryText(item.text || "");
      if (!textPart) {
        return null;
      }
      const owner = String(item.userLabel || "").trim() || fallbackPersonName || "用户";
      const dateText = String(item.date || "").trim() || "某天";
      const imagePart = summarizeDiaryImage(item.image || "");
      const importantPart = item.important ? " 这是当事人特别标记为重要的内容。" : "";
      return {
        title: `日记记忆（${dateText}）`,
        content: `${owner}在${dateText}写道：${textPart}${imagePart ? `，${imagePart}` : ""}。${importantPart}`,
      };
    })
    .filter(Boolean)
    .slice(0, DIARY_MEMORY_LIMIT);
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    ...buildChatBotPageData(),
    // bot 表示使用agent，model 表示使用大模型
    // 是否在对话框左侧显示头像
    // envShareConfig: {
    //   // 不使用环境共享，请删除此配置或配置EnvShareConfig:null
    //   // 资源方 AppID
    //   resourceAppid: "wx7ac1bfecc7bf5f4f",
    //   // 资源方环境 ID
    //   resourceEnv: "chriscc-demo-7ghlpjf846d46d2d",
    // },
  },
  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad() {
    await this.initMemoryPrompt();
  },

  async initMemoryPrompt() {
    const viewerIdentity = await this.loadViewerIdentity();
    // DEFAULT_MEMORY_ITEMS 始终作为基础（包含秦天等固定人物），DB 条目追加其后
    const dbItems = await this.loadMemoryItemsFromDb(viewerIdentity);
    const allItems = [...DEFAULT_MEMORY_ITEMS, ...dbItems];
    const basePrompt = buildMemoryPrompt(allItems);
    const viewerIdentityPrompt = viewerIdentity.identityPrompt || "";
    const finalPrompt = mergeMemoryPrompt(basePrompt, viewerIdentityPrompt);
    this.setData({
      "modelConfig.memoryPrompt": finalPrompt,
      "modelConfig.localFactsPrompt": buildStructuredLocalFactsPrompt(
        STATIC_LOCAL_FACTS,
        viewerIdentity,
        ADMIN_OPENIDS
      ),
      "modelConfig.strictLocalNames": buildStrictLocalNames(STATIC_LOCAL_FACTS),
    });
    try {
      wx.setStorageSync(MEMORY_PROMPT_REFRESH_KEY, Date.now());
    } catch (e) {}
  },

  async loadViewerIdentity() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'getViewerIdentity' },
      });
      return {
        openid: (result && result.openid) || "",
        isAdmin: !!(result && result.isAdmin),
        userLabel: (result && result.userLabel) || '',
        personName: (result && result.personName) || '',
        identityPrompt: (result && result.identityPrompt) || '',
      };
    } catch (error) {
      return {
        openid: "",
        isAdmin: false,
        userLabel: '',
        personName: '',
        identityPrompt: '',
      };
    }
  },

  // 从云端加载共享日记条目，带 1 小时本地缓存
  // 只有 ALLOWED_SHARED_DIARY_USERS 中的用户才会调用此方法
  async loadSharedDiaryItemsCached(viewerIdentity = {}) {
    try {
      const cached = wx.getStorageSync(DIARY_SYNC_CACHE_KEY);
      if (cached && Array.isArray(cached.items) && (Date.now() - (cached.cachedAt || 0)) < DIARY_SYNC_TTL) {
        return cached.items;
      }
    } catch (e) {}

    try {
      const sharedDiaryRes = await wx.cloud.callFunction({
        name: "adminAuth",
        data: { action: "listSharedDiaries", limit: DIARY_MEMORY_LIMIT },
      });
      const sharedDiaryList = (sharedDiaryRes && sharedDiaryRes.result && sharedDiaryRes.result.diaryList) || [];
      const items = buildDiaryMemoryItems(sharedDiaryList, viewerIdentity.personName || viewerIdentity.userLabel || "");
      try {
        wx.setStorageSync(DIARY_SYNC_CACHE_KEY, { items, cachedAt: Date.now() });
      } catch (e) {}
      return items;
    } catch (error) {
      return [];
    }
  },

  // 从云端加载 chat_memory 条目，并在允许时追加共享日记条目
  // 返回 memory item 数组（非 prompt 字符串），由调用方合并 DEFAULT_MEMORY_ITEMS
  async loadMemoryItemsFromDb(viewerIdentity = {}) {
    const personName = String(viewerIdentity.personName || "").trim();
    const isAllowedSharedUser = ALLOWED_SHARED_DIARY_USERS.includes(personName);

    try {
      const db = wx.cloud.database();
      const chatMemoryRes = await db
        .collection("chat_memory")
        .where({ enabled: true })
        .orderBy("order", "asc")
        .limit(CHAT_MEMORY_LIMIT)
        .get();
      const baseItems = (chatMemoryRes.data || [])
        .filter((item) => item && item.content)
        .filter((item) => canViewMemoryItem(item, viewerIdentity));

      // 只有 孙励天/宋陶颖 才拉取共享日记，其他用户只用本地固定记忆
      const diaryItems = isAllowedSharedUser
        ? await this.loadSharedDiaryItemsCached(viewerIdentity)
        : [];

      return [...diaryItems, ...baseItems];
    } catch (error) {
      return [];
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 5 分钟内若已初始化过则跳过，避免每次切回都发起云端请求
    try {
      const lastRefresh = wx.getStorageSync(MEMORY_PROMPT_REFRESH_KEY) || 0;
      if (Date.now() - lastRefresh < MEMORY_PROMPT_TTL) {
        return;
      }
    } catch (e) {}
    this.initMemoryPrompt();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {},

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {},
});
