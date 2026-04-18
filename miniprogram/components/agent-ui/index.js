// components/agent-ui/index.js
import { checkConfig, randomSelectInitquestion, getCloudInstance, commonRequest, sleep } from "./tools";
import md5 from "./md5.js";

const LOCAL_MEMORY_STORAGE_KEY = "agent_ui_local_memories";
const LOCAL_TESTER_ID_KEY = "agent_ui_tester_id";
const LOCAL_SESSION_ID_KEY = "agent_ui_session_id";
const LOCAL_PENDING_SHARED_MEMORIES_KEY = "agent_ui_pending_shared_memories";
const SHARED_MEMORY_REFRESH_INTERVAL = 15000;

Component({
  properties: {
    chatMode: {
      type: String,
      value: "",
    },
    envShareConfig: {
      type: Object,
      value: {},
    },
    showBotAvatar: {
      type: Boolean,
      value: false,
    },
    presentationMode: {
      type: String,
      value: "",
    },
    agentConfig: {
      type: Object,
      value: {
        botId: String,
        allowUploadFile: Boolean,
        allowWebSearch: Boolean,
        allowPullRefresh: Boolean,
        allowUploadImage: Boolean,
        allowMultiConversation: Boolean,
        allowVoice: Boolean,
        showToolCallDetail: Boolean,
        showBotName: Boolean,
      },
    },
    modelConfig: {
      type: Object,
      value: {
        modelProvider: String,
        quickResponseModel: String,
        fallbackProvider: String,
        fallbackModel: String,
        memoryPrompt: String,
        localFactsPrompt: String,
        strictLocalNames: Array,
        endpointBase: String,
        apiKey: String,
        deploymentName: String,
        apiVersion: String,
        enableQaLogging: Boolean,
        qaLogCollection: String,
        // deepReasoningModel: String, // 待支持
        logo: String,
        welcomeMsg: String,
      },
    },
  },

  observers: {
    showWebSearchSwitch: function (showWebSearchSwitch) {
      this.setData({
        showFeatureList: showWebSearchSwitch,
      });
    },
  },

  data: {
    showMenu: false,
    tapMenuRecordId: "",
    isLoading: true, // 判断是否尚在加载中
    article: {},
    windowInfo: wx.getWindowInfo(),
    bot: {},
    inputValue: "",
    output: "",
    chatRecords: [],
    setPanelVisibility: false,
    questions: [],
    scrollTop: 0, // 文字撑起来后能滚动的最大高度
    viewTop: 0, // 根据实际情况，可能用户手动滚动，需要记录当前滚动的位置
    scrollTo: "", // 快速定位到指定元素，置底用
    scrollTimer: null, //
    manualScroll: false, // 当前为手动滚动/自动滚动
    showTools: false, // 展示底部工具栏
    showFileList: false, // 展示输入框顶部文件行
    showTopBar: false, // 展示顶部bar
    sendFileList: [],
    lastScrollTop: 0,
    showUploadFile: true,
    showUploadImg: true,
    showWebSearchSwitch: false,
    showPullRefresh: true,
    showToolCallDetail: true,
    showMultiConversation: true,
    showBotName: true,
    showVoice: true,
    useWebSearch: false,
    showFeatureList: false,
    chatStatus: 0, // 页面状态： 0-正常状态，可输入，可发送， 1-发送中 2-思考中 3-输出content中
    triggered: false,
    page: 1,
    size: 10,
    total: 0,
    refreshText: "下拉加载历史记录",
    shouldAddScrollTop: false,
    isShowFeedback: false,
    feedbackRecordId: "",
    feedbackType: "",
    textareaHeight: 50,
    defaultErrorMsg: "网络繁忙，请稍后重试!",
    errorMsg: "", // 新增字段，动态展示错误信息
    curScrollHeight: 0,
    isDrawerShow: false,
    conversations: [],
    transformConversations: {},
    conversationPageOptions: {
      page: 1,
      size: 15,
      total: 0,
    },
    conversation: null,
    defaultConversation: null, // 旧结构默认会话
    fetchConversationLoading: false,
    audioContext: {}, // 只存储当前正在使用的音频context playStatus 状态 0 默认待播放 1 解析中 2 播放中
    audioSrcMap: {}, // 下载过的音频 src 缓存
    useVoice: false,
    startY: 0, // 触摸起点Y坐标
    longPressTriggered: false, // 长按是否触发
    sendStatus: 0, // 0 默认态 （还未触发长按） 1 待发送态 （触发长按，待发送） 2 待取消态 （触发长按，但超出阈值）3 发送 4 取消
    moveThreshold: 50, // 滑动阈值（单位：px）
    longPressTimer: null, // 长按定时器
    recorderManager: null,
    recordOptions: {
      duration: 60000, // 最长60s
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 192000,
      format: "aac",
      frameSize: 50,
    },
    voiceRecognizing: false,
    speedList: [2, 1.5, 1.25, 1, 0.75],
    sharedMemoryPrompt: "",
    sharedMemoryLoadedAt: 0,
    viewerIdentity: {
      isKnownUser: false,
      userLabel: "",
      personName: "",
    },
  },
  attached: async function () {
    const chatMode = this.data.chatMode;
    // 检查配置
    const [check, message] = checkConfig(chatMode, this.data.agentConfig, this.data.modelConfig);
    if (!check) {
      wx.showModal({
        title: "提示",
        content: message,
      });
      return;
    }
    // 初始化一次cloudInstance，它是单例的，后面不传参数也可以获取到
    const cloudInstance = await getCloudInstance(this.data.envShareConfig);
    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "getViewerIdentity",
        },
      });
      this.setData({
        viewerIdentity: {
          isKnownUser: !!(result && result.isKnownUser),
          userLabel: (result && result.userLabel) || "",
          personName: (result && result.personName) || "",
        },
      });
    } catch (error) {}

    if (chatMode === "bot") {
      const { botId } = this.data.agentConfig;
      const ai = cloudInstance.extend.AI;
      const bot = await ai.bot.get({ botId });
      // 新增错误提示
      if (bot.code) {
        wx.showModal({
          title: "提示",
          content: bot.message,
        });
        return;
      }

      // 初始化第一条记录为welcomeMessage
      const record = {
        content: bot.welcomeMessage || "你好，有什么我可以帮到你？",
        record_id: "record_id" + String(+new Date() + 10),
        role: "assistant",
        hiddenBtnGround: true,
      };
      const { chatRecords } = this.data;
      // 随机选取三个初始化问题
      const questions = randomSelectInitquestion(bot.initQuestions, 3);
      let {
        allowWebSearch,
        allowUploadFile,
        allowPullRefresh,
        allowUploadImage,
        showToolCallDetail,
        allowMultiConversation,
        allowVoice,
        showBotName,
      } = this.data.agentConfig;
      allowWebSearch = allowWebSearch === undefined ? true : allowWebSearch;
      allowUploadFile = allowUploadFile === undefined ? true : allowUploadFile;
      allowPullRefresh = allowPullRefresh === undefined ? true : allowPullRefresh;
      allowUploadImage = allowUploadImage === undefined ? true : allowUploadImage;
      showToolCallDetail = showToolCallDetail === undefined ? true : showToolCallDetail;
      allowMultiConversation = allowMultiConversation === undefined ? true : allowMultiConversation;
      allowVoice = allowVoice === undefined ? true : allowVoice;
      showBotName = showBotName === undefined ? true : showBotName;
      this.setData({
        bot,
        questions,
        chatRecords: chatRecords.length > 0 ? chatRecords : [record],
        showWebSearchSwitch: allowWebSearch,
        showUploadFile: allowUploadFile,
        showUploadImg: allowUploadImage,
        showPullRefresh: allowPullRefresh,
        showToolCallDetail: showToolCallDetail,
        showMultiConversation: allowMultiConversation,
        showVoice: allowVoice,
        showBotName: showBotName,
      });
      console.log("bot", this.data.bot);
      if (chatMode === "bot" && this.data.bot.multiConversationEnable) {
        // 拉一次默认旧会话
        await this.fetchDefaultConversationList();
        // 拉一遍新会话列表
        await this.resetFetchConversationList();
      }
      // this.setData({
      //   bot: {
      //     ...this.data.bot,
      //     voiceSettings: {
      //       enable: true,
      //     },
      //   },
      // });
      if (chatMode === "bot" && this.data.bot.voiceSettings?.enable) {
        // 初始化录音管理器
        await this.initRecordManager();
        // 提前获取语音权限
        wx.getSetting({
          success(res) {
            console.log("auth settings", res);
            if (!res.authSetting["scope.record"]) {
              wx.authorize({
                scope: "scope.record",
                success() {},
                fail() {
                  // 用户拒绝授权，可以引导用户到设置页面手动开启权限
                  wx.openSetting({
                    success(res) {
                      if (res.authSetting["scope.record"]) {
                        // 用户手动开启权限，可以进行录音操作
                      }
                    },
                  });
                },
              });
            }
          },
        });
      }
    }
  },
  detached: function () {
    // 在组件实例被从页面节点树移除时执行，释放当前的音频资源
    const context = this.data.audioContext.context;
    if (context) {
      context.stop();
      context.destroy();
    }
  },
  methods: {
    buildSharedMemoryPrompt: function (memoryList = []) {
      const lines = (memoryList || [])
        .filter((item) => item && item.content)
        .map((item, index) => {
          const label = String(item.userLabel || "").trim() || "用户";
          return `${index + 1}. ${label}明确告诉你：${item.content}`;
        })
        .filter(Boolean);

      if (!lines.length) {
        return "";
      }

      return `以下是双方共享的新增概念记忆，请在相关对话中自然使用，不要提来源：\n${lines.join("\n")}`;
    },
    loadSharedMemoryPromptFromCloud: async function (forceRefresh = false) {
      const now = Date.now();
      if (!forceRefresh && this.data.sharedMemoryPrompt && now - Number(this.data.sharedMemoryLoadedAt || 0) < SHARED_MEMORY_REFRESH_INTERVAL) {
        return this.data.sharedMemoryPrompt;
      }

      try {
        const { result } = await wx.cloud.callFunction({
          name: "adminAuth",
          data: {
            action: "listSharedConceptMemories",
            limit: 20,
          },
        });
        if (!result || result.error) {
          return this.data.sharedMemoryPrompt || "";
        }

        const sharedMemoryPrompt = this.buildSharedMemoryPrompt(result.memoryList || []);
        this.setData({
          sharedMemoryPrompt,
          sharedMemoryLoadedAt: now,
        });
        return sharedMemoryPrompt;
      } catch (error) {
        return this.data.sharedMemoryPrompt || "";
      }
    },
    getTodayDateText: function () {
      const now = new Date();
      const pad = (num) => String(num).padStart(2, "0");
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    },
    normalizeDateText: function (value, fallbackDate = "") {
      const raw = String(value || "").trim();
      if (!raw) {
        return fallbackDate || this.getTodayDateText();
      }
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        return fallbackDate || this.getTodayDateText();
      }
      const pad = (num) => String(num).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    },
    pickDateFromText: function (text = "", fallbackDate = "") {
      const normalized = String(text || "").trim();
      if (!normalized) {
        return fallbackDate || this.getTodayDateText();
      }
      const dateMatch = normalized.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (dateMatch) {
        return this.normalizeDateText(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`, fallbackDate);
      }
      if (normalized.includes("今天")) {
        return this.getTodayDateText();
      }
      if (normalized.includes("明天")) {
        const base = new Date();
        base.setDate(base.getDate() + 1);
        return this.normalizeDateText(base, fallbackDate);
      }
      if (normalized.includes("后天")) {
        const base = new Date();
        base.setDate(base.getDate() + 2);
        return this.normalizeDateText(base, fallbackDate);
      }
      return fallbackDate || this.getTodayDateText();
    },
    buildDiarySyncKey: function (entry = {}) {
      return [
        String(entry.date || "").trim(),
        String(entry.text || "").trim(),
        entry.important ? "1" : "0",
        String(entry.image || "").trim(),
      ].join("||");
    },
    extractDiaryDraftFromInput: function (text = "") {
      const normalized = String(text || "").trim();
      if (!normalized) {
        return null;
      }
      const diaryCommandMatch = normalized.match(/(?:^|\s)(?:写日记|记日记|帮我写日记|帮我记日记|日记)\s*[：:]\s*(.+)$/);
      if (!diaryCommandMatch || !diaryCommandMatch[1]) {
        return null;
      }

      const rawContent = diaryCommandMatch[1].trim();
      const dateMatch = rawContent.match(/(?:日期|date)\s*[：:]\s*(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})/i);
      const dateText = this.pickDateFromText(dateMatch ? dateMatch[1] : rawContent, this.getTodayDateText());
      const important = /重要|标星|加星|\*{1,2}重要\*{1,2}/.test(rawContent);
      const cleanedText = rawContent
        .replace(/(?:日期|date)\s*[：:]\s*20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/gi, "")
        .replace(/重要|标星|加星/g, "")
        .replace(/^[，,。\s]+|[，,。\s]+$/g, "")
        .trim();

      if (!cleanedText) {
        return null;
      }

      return {
        text: cleanedText,
        date: dateText,
        important,
      };
    },
    saveDiaryFromChat: async function (draft = {}) {
      const text = String(draft.text || "").trim();
      if (!text) {
        return false;
      }
      const date = this.normalizeDateText(draft.date || "", this.getTodayDateText());
      const important = !!draft.important;
      const diaryEntry = {
        image: "",
        text,
        date,
        important,
        syncKey: this.buildDiarySyncKey({
          image: "",
          text,
          date,
          important,
        }),
        createdAt: new Date(),
      };

      try {
        const db = wx.cloud.database();
        const addRes = await db.collection("diaryList").add({ data: diaryEntry });
        const localDiaryList = wx.getStorageSync("diaryList") || [];
        localDiaryList.push({
          ...diaryEntry,
          _id: addRes && addRes._id ? addRes._id : "",
        });
        wx.setStorageSync("diaryList", localDiaryList);
        return true;
      } catch (error) {
        return false;
      }
    },
    extractCalendarDraftFromInput: function (text = "") {
      const normalized = String(text || "").trim();
      if (!normalized) {
        return null;
      }
      const parseDateTextFromInput = (sourceText = "") => {
        const dateMatch = sourceText.match(/(?:日期|date|时间)\s*[：:]\s*(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|今天|明天|后天)/i);
        return this.pickDateFromText(dateMatch ? dateMatch[1] : sourceText, this.getTodayDateText());
      };

      const inferTitleByText = (sourceText = "") => {
        if (/(早上|清晨|今早|早餐)/.test(sourceText)) {
          return "早餐";
        }
        if (/(中午|中午饭|午饭|午餐)/.test(sourceText)) {
          return "午饭";
        }
        if (/(晚上|今晚|晚饭|晚餐|夜宵)/.test(sourceText)) {
          return "晚饭";
        }
        return "日程";
      };

      const inferPersonName = (sourceText = "") => {
        if (/(宋陶颖)/.test(sourceText)) {
          return "宋陶颖";
        }
        if (/(孙励天)/.test(sourceText)) {
          return "孙励天";
        }
        if (/(孙星玥)/.test(sourceText)) {
          return "孙星玥";
        }

        const currentPersonName = String((this.data.viewerIdentity && this.data.viewerIdentity.personName) || "").trim();
        const isKnownFamilyUser = currentPersonName === "孙励天" || currentPersonName === "宋陶颖";

        if (/(我老婆|老婆|媳妇)/.test(sourceText)) {
          if (currentPersonName === "孙励天") {
            return "宋陶颖";
          }
          return "";
        }

        if (/(我老公|老公)/.test(sourceText)) {
          if (currentPersonName === "宋陶颖") {
            return "孙励天";
          }
          return "";
        }

        if (/(我女儿|女儿|宝宝)/.test(sourceText)) {
          if (isKnownFamilyUser) {
            return "孙星玥";
          }
          return "";
        }

        if (/(我|本人|自己)/.test(sourceText) && currentPersonName) {
          return currentPersonName;
        }

        return "";
      };

      const buildDescription = (sourceText = "", personName = "") => {
        let activity = String(sourceText || "").trim();
        activity = activity
          .replace(/^(帮我|请|麻烦|记得|记一下|增加|添加|加入|放到|写到)\s*/g, "")
          .replace(/(加到日历里面|加到日历里|加到日历|添加到日历里面|添加到日历里|添加到日历|记到日历里面|记到日历里|记到日历)\s*/g, "")
          .replace(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|今天|明天|后天/g, "")
          .replace(/(早上|清晨|今早|中午|下午|晚上|今晚|早餐|午饭|午餐|晚饭|晚餐|夜宵)/g, "")
          .replace(/(我老婆|老婆|媳妇|爱人|对象|我老公|老公|我女儿|女儿|宝宝|宋陶颖|孙励天|孙星玥|我)\s*/g, "")
          .replace(/^[，,。；;:：\s]+|[，,。；;:：\s]+$/g, "")
          .trim();

        if (!activity) {
          return "";
        }
        if (/^吃(?!了)/.test(activity)) {
          activity = activity.replace(/^吃(?!了)/, "吃了");
        }
        if (/^(去了|去|做了|做|买了|买|看了|看|参加了|参加)/.test(activity) && !/了/.test(activity.slice(0, 3))) {
          activity = activity
            .replace(/^去(?!了)/, "去了")
            .replace(/^做(?!了)/, "做了")
            .replace(/^买(?!了)/, "买了")
            .replace(/^看(?!了)/, "看了")
            .replace(/^参加(?!了)/, "参加了");
        }
        return personName ? `${personName}${activity}` : activity;
      };

      const reminderCommandMatch = normalized.match(/(?:^|\s)(?:提醒我|加提醒|添加提醒|日历提醒|写日历提醒|帮我加提醒)\s*[：:]\s*(.+)$/);
      if (reminderCommandMatch && reminderCommandMatch[1]) {
        const rawContent = reminderCommandMatch[1].trim();
        const dateText = parseDateTextFromInput(rawContent);
        const cleanedContent = rawContent
          .replace(/(?:日期|date|时间)\s*[：:]\s*(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|今天|明天|后天)/gi, "")
          .replace(/^[，,。\s]+|[，,。\s]+$/g, "")
          .trim();
        if (!cleanedContent) {
          return null;
        }

        return {
          date: dateText,
          title: cleanedContent.slice(0, 50),
          note: cleanedContent,
        };
      }

      const directCalendarCommandMatch = normalized.match(
        /^(?:帮我|请|麻烦)?(?:加到日历里面|加到日历里|加到日历|添加到日历里面|添加到日历里|添加到日历|记到日历里面|记到日历里|记到日历|帮我增加|帮我添加)\s*(.+)$/
      );
      if (directCalendarCommandMatch && directCalendarCommandMatch[1]) {
        const rawContent = directCalendarCommandMatch[1].trim();
        const date = parseDateTextFromInput(rawContent);
        const title = inferTitleByText(rawContent);
        const personName = inferPersonName(rawContent);
        const note = buildDescription(rawContent, personName);
        if (!note) {
          return null;
        }
        return {
          date,
          title,
          note,
        };
      }

      // 支持自然句式：例如“今天中午我老婆吃东北菜”
      const hasDateHint = /(今天|明天|后天|20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})/.test(normalized);
      const hasEventHint = /(早餐|午饭|午餐|晚饭|晚餐|夜宵|吃|喝|去|做|买|看|参加|安排|计划)/.test(normalized);
      if (!hasDateHint || !hasEventHint) {
        return null;
      }

      const date = parseDateTextFromInput(normalized);
      const title = inferTitleByText(normalized);
      const personName = inferPersonName(normalized);
      const note = buildDescription(normalized, personName);
      if (!note) {
        return null;
      }

      return {
        date,
        title,
        note,
      };
    },
    parseModelJsonObject: function (text = "") {
      const normalized = String(text || "").trim();
      if (!normalized) {
        return null;
      }

      try {
        return JSON.parse(normalized);
      } catch (error) {}

      const objectMatch = normalized.match(/\{[\s\S]*\}/);
      if (!objectMatch) {
        return null;
      }

      try {
        return JSON.parse(objectMatch[0]);
      } catch (error) {
        return null;
      }
    },
    normalizeCalendarDraft: function (draft = {}, fallbackDraft = null) {
      const fallbackDate = fallbackDraft && fallbackDraft.date ? fallbackDraft.date : this.getTodayDateText();
      const fallbackTitle = fallbackDraft && fallbackDraft.title ? fallbackDraft.title : "日程";
      const fallbackNote = fallbackDraft && fallbackDraft.note ? fallbackDraft.note : "";
      const date = this.normalizeDateText(draft.date || fallbackDate, this.getTodayDateText());
      const title = String(draft.title || fallbackTitle).trim() || "日程";
      const note = String(draft.note || fallbackNote).trim();
      if (!note) {
        return null;
      }
      return {
        date,
        title,
        note,
      };
    },
    resolveCalendarDraftWithAi: async function (inputText = "", ruleDraft = null) {
      const normalizedInput = String(inputText || "").trim();
      if (!normalizedInput) {
        return ruleDraft;
      }

      const { modelConfig = {} } = this.data;
      const endpointBase = String(modelConfig.endpointBase || "").trim().replace(/\/+$/, "");
      const apiKey = String(modelConfig.apiKey || "").trim();
      const deployment = String(modelConfig.deploymentName || modelConfig.quickResponseModel || "").trim();
      const apiVersion = String(modelConfig.apiVersion || "2025-01-01-preview").trim();

      if (!endpointBase || !apiKey || !deployment) {
        return ruleDraft;
      }

      const today = this.getTodayDateText();
      const identityName = String((this.data.viewerIdentity && this.data.viewerIdentity.personName) || "").trim();
      const userPromptPayload = {
        input: normalizedInput,
        today,
        currentPersonName: identityName || null,
        ruleDraft: ruleDraft || null,
      };

      const requestMessages = [
        {
          role: "system",
          content:
            "你是日历事件抽取器。请严格返回 JSON 对象，不要输出 Markdown。字段: shouldAdd(boolean), date(string), title(string), note(string), confidence(number 0-1), reason(string)。规则: 1) 只有输入明确包含可记录事件时 shouldAdd=true。2) date 使用 YYYY-MM-DD；若输入是今天/明天/后天请换算成具体日期。3) title 简短，优先 早餐/午饭/晚饭/日程。4) note 用自然中文，尽量包含是谁做了什么。",
        },
        {
          role: "user",
          content: JSON.stringify(userPromptPayload),
        },
      ];

      try {
        const response = await new Promise((resolve, reject) => {
          wx.request({
            url: `${endpointBase}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
            method: "POST",
            data: {
              messages: requestMessages,
              temperature: 0,
              max_tokens: 400,
            },
            header: {
              "Content-Type": "application/json",
              "api-key": apiKey,
            },
            success: (res) => {
              if (res.statusCode >= 400) {
                reject(new Error(res?.data?.error?.message || `HTTP ${res.statusCode}`));
                return;
              }
              resolve(res.data || {});
            },
            fail: (err) => {
              reject(new Error(err?.errMsg || "请求失败"));
            },
          });
        });

        const content = response?.choices?.[0]?.message?.content || "";
        const decision = this.parseModelJsonObject(content);
        if (!decision || typeof decision.shouldAdd !== "boolean") {
          return ruleDraft;
        }

        if (!decision.shouldAdd) {
          return null;
        }

        const aiDraft = this.normalizeCalendarDraft(
          {
            date: decision.date,
            title: decision.title,
            note: decision.note,
          },
          ruleDraft
        );

        return aiDraft || ruleDraft;
      } catch (error) {
        return ruleDraft;
      }
    },
    buildCalendarMemoryContent: function (draft = {}) {
      const date = this.normalizeDateText(draft.date || "", this.getTodayDateText());
      const title = String(draft.title || "").trim() || "日程";
      const note = String(draft.note || "").trim();
      if (!note) {
        return "";
      }
      return `${date}，${title}：${note}`;
    },
    addCalendarReminderFromChat: async function (draft = {}) {
      const finalDate = this.normalizeDateText(draft.date || "", this.getTodayDateText());
      const finalTitle = String(draft.title || "").trim();
      const finalNote = String(draft.note || "").trim();
      if (!finalTitle && !finalNote) {
        return false;
      }

      try {
        const { result } = await wx.cloud.callFunction({
          name: "adminAuth",
          data: {
            action: "addSharedCalendar",
            date: finalDate,
            title: finalTitle,
            note: finalNote,
          },
        });
        return !!(result && result.success);
      } catch (error) {
        return false;
      }
    },
    listSharedCalendarByDate: async function (dateText = "", limit = 20, skip = 0) {
      try {
        const { result } = await wx.cloud.callFunction({
          name: "adminAuth",
          data: {
            action: "listSharedCalendar",
            date: this.normalizeDateText(dateText || this.getTodayDateText(), this.getTodayDateText()),
            limit,
            skip,
          },
        });
        return (result && result.calendarList) || [];
      } catch (error) {
        return [];
      }
    },
    formatCalendarItemsForReply: function (calendarList = []) {
      const lines = (calendarList || [])
        .slice(0, 8)
        .map((item, index) => {
          const title = String((item && item.title) || "").trim() || "日程";
          const note = String((item && item.note) || "").trim();
          const date = String((item && item.date) || "").trim();
          const id = String((item && item.id) || "").trim();
          const detail = note ? `${title}：${note}` : title;
          return `${index + 1}. ${date} ${detail}${id ? `（id:${id}）` : ""}`;
        })
        .filter(Boolean);
      return lines.join("\n");
    },
    resolveCalendarItemIdForAction: async function (action = {}) {
      const directId = String(action.id || "").trim();
      if (directId) {
        return directId;
      }

      const date = this.normalizeDateText(action.date || this.getTodayDateText(), this.getTodayDateText());
      const keyword = String(action.keyword || action.title || action.note || "").trim();
      const list = await this.listSharedCalendarByDate(date, 30, 0);
      if (!list.length) {
        return "";
      }
      if (!keyword) {
        return String((list[0] && list[0].id) || "").trim();
      }

      const matched = list.find((item) => {
        const title = String((item && item.title) || "").trim();
        const note = String((item && item.note) || "").trim();
        return title.includes(keyword) || note.includes(keyword);
      });
      return String(((matched || list[0]) && (matched || list[0]).id) || "").trim();
    },
    executeCalendarActionFromAi: async function (action = {}) {
      const type = String((action && action.type) || "none").trim().toLowerCase();
      if (!type || type === "none") {
        return { applied: false, replySuffix: "" };
      }

      if (type === "read") {
        const date = this.normalizeDateText(action.date || this.getTodayDateText(), this.getTodayDateText());
        const list = await this.listSharedCalendarByDate(date, 20, 0);
        if (!list.length) {
          return {
            applied: true,
            replySuffix: `\n\n【日历查询】${date} 暂无日程。`,
          };
        }
        return {
          applied: true,
          replySuffix: `\n\n【日历查询】${date} 日程如下：\n${this.formatCalendarItemsForReply(list)}`,
        };
      }

      if (type === "add") {
        const draft = this.normalizeCalendarDraft(
          {
            date: action.date,
            title: action.title,
            note: action.note,
          },
          null
        );
        if (!draft) {
          return { applied: false, replySuffix: "\n\n【日历操作】添加失败：缺少有效内容。" };
        }
        const saved = await this.addCalendarReminderFromChat(draft);
        if (!saved) {
          return { applied: false, replySuffix: "\n\n【日历操作】添加失败。" };
        }

        const calendarMemory = this.buildCalendarMemoryContent(draft);
        if (calendarMemory) {
          this.saveLocalMemory(calendarMemory);
          const cloudMemoryResult = await this.saveSharedMemoryToCloud(calendarMemory);
          if (cloudMemoryResult && cloudMemoryResult.success) {
            await this.loadSharedMemoryPromptFromCloud(true);
          }
        }
        return { applied: true, replySuffix: `\n\n【日历操作】已添加：${draft.date} ${draft.title}` };
      }

      if (type === "delete") {
        const id = await this.resolveCalendarItemIdForAction(action);
        if (!id) {
          return { applied: false, replySuffix: "\n\n【日历操作】删除失败：未找到目标。" };
        }

        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: {
              action: "deleteSharedCalendar",
              id,
            },
          });
          return result && result.success
            ? { applied: true, replySuffix: "\n\n【日历操作】已删除目标日程。" }
            : {
                applied: false,
                replySuffix: `\n\n【日历操作】删除失败：${(result && result.error) || "未知错误"}`,
              };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【日历操作】删除失败：请求异常。" };
        }
      }

      if (type === "update") {
        const id = await this.resolveCalendarItemIdForAction(action);
        if (!id) {
          return { applied: false, replySuffix: "\n\n【日历操作】修改失败：未找到目标。" };
        }

        const payload = {
          action: "updateSharedCalendar",
          id,
        };
        if (action.date !== undefined) {
          payload.date = action.date;
        }
        if (action.title !== undefined) {
          payload.title = action.title;
        }
        if (action.note !== undefined) {
          payload.note = action.note;
        }

        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: payload,
          });
          if (!(result && result.success)) {
            return {
              applied: false,
              replySuffix: `\n\n【日历操作】修改失败：${(result && result.error) || "未知错误"}`,
            };
          }
          const item = (result && result.item) || {};
          const draft = this.normalizeCalendarDraft(
            {
              date: item.date,
              title: item.title,
              note: item.note,
            },
            null
          );
          if (draft) {
            const calendarMemory = this.buildCalendarMemoryContent(draft);
            if (calendarMemory) {
              this.saveLocalMemory(calendarMemory);
              const cloudMemoryResult = await this.saveSharedMemoryToCloud(calendarMemory);
              if (cloudMemoryResult && cloudMemoryResult.success) {
                await this.loadSharedMemoryPromptFromCloud(true);
              }
            }
          }
          return { applied: true, replySuffix: "\n\n【日历操作】已完成修改。" };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【日历操作】修改失败：请求异常。" };
        }
      }

      return { applied: false, replySuffix: "" };
    },
    hasCalendarIntent: function (text = "") {
      const normalized = String(text || "").trim();
      if (!normalized) {
        return false;
      }
      // 账单/菜谱语义优先，避免“新增账单”被误当成日历。
      if (/(记账|账单|转给|借给|欠|归还|还款|还钱|菜谱|食谱|做法|食材|步骤)/i.test(normalized)) {
        return false;
      }
      // 日历仅匹配明确语义，避免通用动作词（新增/删除/修改/查询）误触发。
      return /(日历|提醒|日程|安排|计划|行程|待办|约会|早餐|午饭|晚饭|干了啥|做了什么)/.test(normalized);
    },
    hasBookkeepingIntent: function (text = "") {
      const normalized = String(text || "").trim();
      if (!normalized) {
        return false;
      }
      return /(记账|账单|转给|借给|欠|归还|还款|还了|还钱|超期|惩罚|罚款|欠多少|买了什么|改账|改金额|改承诺|改日期|删账|删除账单)/.test(normalized);
    },
    hasRecipeIntent: function (text = "") {
      const normalized = String(text || "").trim();
      if (!normalized) {
        return false;
      }
      return /(菜谱|食谱|做法|食材|步骤|怎么做|recipe|链接)/i.test(normalized);
    },
    listSharedBookkeeping: async function (limit = 20) {
      try {
        const { result } = await wx.cloud.callFunction({
          name: "adminAuth",
          data: {
            action: "listSharedBookkeeping",
            limit,
          },
        });
        return (result && result.bookkeepingList) || [];
      } catch (error) {
        return [];
      }
    },
    formatBookkeepingItemsForReply: function (list = []) {
      const lines = (list || [])
        .slice(0, 8)
        .map((item, index) => {
          const purchase = String((item && item.purchaseItem) || "").trim() || "未填写";
          const transferAmount = Number((item && item.transferAmount) || 0);
          const promiseDate = String((item && item.promiseDate) || "").trim() || "未填写";
          const promiseAmount = Number((item && item.promiseAmount) || transferAmount);
          const repaidAmount = Number((item && item.repaidAmount) || 0);
          const outstandingAmount = Number((item && item.outstandingAmount) || Math.max(promiseAmount - repaidAmount, 0));
          const id = String((item && item.id) || "").trim();
          const overdueTag = item && item.overdue ? "（已超期）" : "";
          return `${index + 1}. ${purchase}，转账¥${transferAmount}，承诺${promiseDate}还¥${promiseAmount}，已还¥${repaidAmount}，还欠¥${outstandingAmount}${overdueTag}${id ? `（id:${id}）` : ""}`;
        })
        .filter(Boolean);
      return lines.join("\n");
    },
    resolveBookkeepingItemIdForAction: async function (action = {}) {
      const directId = String(action.id || "").trim();
      if (directId) {
        return directId;
      }
      const keyword = String(action.keyword || action.purchaseItem || "").trim();
      const list = await this.listSharedBookkeeping(30);
      if (!list.length) {
        return "";
      }
      if (!keyword) {
        return String((list[0] && list[0].id) || "").trim();
      }
      const matched = list.find((item) => String((item && item.purchaseItem) || "").includes(keyword));
      return String(((matched || list[0]) && (matched || list[0]).id) || "").trim();
    },
    clearUpcomingSummaryCache: function () {
      try {
        wx.removeStorageSync("upcomingSummaryCache");
      } catch (error) {
        // Ignore cache clear failures so chat actions still complete.
      }
    },
    normalizeBookkeepingMoneyInput: function (value) {
      if (value === undefined || value === null) {
        return 0;
      }
      const num = Number(String(value).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(num) || num <= 0) {
        return 0;
      }
      return Math.round(num * 100) / 100;
    },
    normalizeBookkeepingDateInput: function (value) {
      const raw = String(value || "").trim();
      if (!raw) {
        return "";
      }
      const normalized = raw.replace(/[./年]/g, "-").replace(/[月]/g, "-").replace(/[日号]/g, "");
      const pad = (num) => String(num).padStart(2, "0");
      const fullMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (fullMatch) {
        const year = Number(fullMatch[1]);
        const month = Number(fullMatch[2]);
        const day = Number(fullMatch[3]);
        if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${pad(month)}-${pad(day)}`;
        }
      }
      const monthDayMatch = normalized.match(/^(\d{1,2})-(\d{1,2})$/);
      if (monthDayMatch) {
        const now = new Date();
        const year = now.getFullYear();
        const month = Number(monthDayMatch[1]);
        const day = Number(monthDayMatch[2]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${pad(month)}-${pad(day)}`;
        }
      }
      return "";
    },
    extractBookkeepingDraftFromText: function (text = "") {
      const source = String(text || "").trim();
      if (!source) {
        return {};
      }
      const draft = {};
      const amountMatch = source.match(/(?:借|转|给|欠|还)\s*([0-9]+(?:\.[0-9]+)?)/) || source.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:元|块|rmb|￥|¥)/i);
      if (amountMatch && amountMatch[1]) {
        draft.transferAmount = Number(amountMatch[1]);
      }
      const dateMatch = source.match(/(?:承诺|约定|预计|计划).{0,8}?(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2})/) || source.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2})\s*(?:归还|还款|还)/);
      if (dateMatch && dateMatch[1]) {
        draft.promiseDate = dateMatch[1];
      }
      const relationMatch = source.match(/^([\u4e00-\u9fa5]{2,6})向([\u4e00-\u9fa5]{2,6})(借|转)/);
      if (relationMatch) {
        draft.fromName = relationMatch[2];
        draft.toName = relationMatch[1];
      }
      if (/借|借款|还款|归还/.test(source)) {
        draft.purchaseItem = "借款";
      }
      return draft;
    },
    inferDirectBookkeepingAction: function (text = "") {
      const source = String(text || "").trim();
      if (!source) {
        return null;
      }
      const draft = this.extractBookkeepingDraftFromText(source);
      const hasAddIntent = /(增加记账|新增记账|添加记账|记账|加个账单|新增账单|添加账单)/.test(source);
      if (hasAddIntent && this.normalizeBookkeepingMoneyInput(draft.transferAmount) > 0) {
        return {
          type: "add",
          fromName: draft.fromName,
          toName: draft.toName,
          transferAmount: draft.transferAmount,
          purchaseItem: draft.purchaseItem,
          promiseDate: draft.promiseDate,
        };
      }
      return null;
    },
    buildBookkeepingAddPayload: function (action = {}, rawInputText = "") {
      const fallback = this.extractBookkeepingDraftFromText(rawInputText);
      const pickText = (list = []) => {
        for (const key of list) {
          const fromAction = String((action && action[key]) || "").trim();
          if (fromAction) {
            return fromAction;
          }
          const fromFallback = String((fallback && fallback[key]) || "").trim();
          if (fromFallback) {
            return fromFallback;
          }
        }
        return "";
      };
      const pickMoney = (list = []) => {
        for (const key of list) {
          const fromAction = this.normalizeBookkeepingMoneyInput(action && action[key]);
          if (fromAction > 0) {
            return fromAction;
          }
          const fromFallback = this.normalizeBookkeepingMoneyInput(fallback && fallback[key]);
          if (fromFallback > 0) {
            return fromFallback;
          }
        }
        return 0;
      };

      const fromName = pickText(["fromName", "payer", "from", "fromUser"]) || "孙励天";
      const toName = pickText(["toName", "payee", "to", "toUser"]) || "宋陶颖";
      const transferAmount = pickMoney(["transferAmount", "amount", "money", "totalAmount", "price"]);
      const promiseAmount = pickMoney(["promiseAmount", "returnAmount", "expectedAmount"]) || transferAmount;
      const purchaseItem = pickText(["purchaseItem", "item", "purpose", "remark", "title", "desc"]) || "日常支出";
      let promiseDate = this.normalizeBookkeepingDateInput(
        pickText(["promiseDate", "date", "dueDate", "returnDate", "repayDate"])
      );

      if (!promiseDate) {
        const looseDate = String(rawInputText || "").match(/(\d{1,2}[./-]\d{1,2})/);
        if (looseDate && looseDate[1]) {
          promiseDate = this.normalizeBookkeepingDateInput(looseDate[1]);
        }
      }

      if (!promiseDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const pad = (num) => String(num).padStart(2, "0");
        promiseDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
      }

      if (!transferAmount) {
        return {
          ok: false,
          error: "未识别到有效金额，请补充如“1000元”后重试。",
          payload: null,
        };
      }

      return {
        ok: true,
        error: "",
        payload: {
          action: "addSharedBookkeeping",
          fromName,
          toName,
          transferAmount,
          purchaseItem,
          promiseDate,
          promiseAmount,
        },
      };
    },
    executeBookkeepingActionFromAi: async function (action = {}, rawInputText = "") {
      const type = String((action && action.type) || "none").trim().toLowerCase();
      if (!type || type === "none") {
        return { applied: false, replySuffix: "" };
      }

      if (type === "read") {
        const list = await this.listSharedBookkeeping(20);
        if (!list.length) {
          return { applied: true, replySuffix: "\n\n【记账】当前没有账单记录。" };
        }
        return {
          applied: true,
          replySuffix: `\n\n【记账】当前账单如下：\n${this.formatBookkeepingItemsForReply(list)}`,
        };
      }

      if (type === "add") {
        const draft = this.buildBookkeepingAddPayload(action, rawInputText);
        if (!(draft && draft.ok && draft.payload)) {
          return { applied: false, replySuffix: `\n\n【记账】新增失败：${(draft && draft.error) || "参数不完整"}` };
        }
        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: draft.payload,
          });
          if (result && result.success) {
            this.clearUpcomingSummaryCache();
            return {
              applied: true,
              replySuffix: `\n\n【记账】已新增账单：${draft.payload.purchaseItem}，承诺${draft.payload.promiseDate}归还¥${draft.payload.promiseAmount}。`,
            };
          }
          return { applied: false, replySuffix: `\n\n【记账】新增失败：${(result && result.error) || "未知错误"}` };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【记账】新增失败：请求异常。" };
        }
      }

      if (type === "repay") {
        const id = await this.resolveBookkeepingItemIdForAction(action);
        if (!id) {
          return { applied: false, replySuffix: "\n\n【记账】还款登记失败：未找到目标账单。" };
        }
        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: {
              action: "repaySharedBookkeeping",
              id,
              repayAmount: action.repayAmount,
            },
          });
          if (result && result.success) {
            this.clearUpcomingSummaryCache();
            const item = (result && result.item) || {};
            return {
              applied: true,
              replySuffix: `\n\n【记账】已登记还款，当前还欠¥${Number(item.outstandingAmount || 0)}。`,
            };
          }
          return { applied: false, replySuffix: `\n\n【记账】还款登记失败：${(result && result.error) || "未知错误"}` };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【记账】还款登记失败：请求异常。" };
        }
      }

      if (type === "suggestpenalty") {
        const id = await this.resolveBookkeepingItemIdForAction(action);
        if (!id) {
          return { applied: false, replySuffix: "\n\n【记账】惩罚提议失败：未找到目标账单。" };
        }
        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: {
              action: "suggestSharedPenalty",
              id,
              suggestion: action.suggestion,
            },
          });
          return result && result.success
            ? { applied: true, replySuffix: "\n\n【记账】已发起惩罚措施提议，等待对方选择同意或拒绝。" }
            : { applied: false, replySuffix: `\n\n【记账】惩罚提议失败：${(result && result.error) || "未知错误"}` };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【记账】惩罚提议失败：请求异常。" };
        }
      }

      if (type === "decidepenalty") {
        const id = await this.resolveBookkeepingItemIdForAction(action);
        if (!id) {
          return { applied: false, replySuffix: "\n\n【记账】登记失败：未找到目标账单。" };
        }
        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: {
              action: "decideSharedPenalty",
              id,
              decision: action.decision,
            },
          });
          if (result && result.success) {
            const decisionText = String((action && action.decision) || "").toLowerCase().startsWith("accept") ? "同意" : "拒绝";
            return { applied: true, replySuffix: `\n\n【记账】已登记${decisionText}该惩罚措施。` };
          }
          return { applied: false, replySuffix: `\n\n【记账】登记失败：${(result && result.error) || "未知错误"}` };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【记账】登记失败：请求异常。" };
        }
      }

      if (type === "update") {
        const id = await this.resolveBookkeepingItemIdForAction(action);
        if (!id) {
          return { applied: false, replySuffix: "\n\n【记账】修改失败：未找到目标账单。" };
        }
        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: {
              action: "updateSharedBookkeeping",
              id,
              promiseDate: action.promiseDate,
              promiseAmount: action.promiseAmount,
              transferAmount: action.transferAmount,
              purchaseItem: action.purchaseItem,
            },
          });
          if (result && result.success) {
            this.clearUpcomingSummaryCache();
            const item = (result && result.item) || {};
            return {
              applied: true,
              replySuffix: `\n\n【记账】已修改账单，承诺日期${item.promiseDate || "未填写"}，承诺金额¥${Number(item.promiseAmount || 0)}。`,
            };
          }
          return { applied: false, replySuffix: `\n\n【记账】修改失败：${(result && result.error) || "未知错误"}` };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【记账】修改失败：请求异常。" };
        }
      }

      if (type === "delete") {
        const id = await this.resolveBookkeepingItemIdForAction(action);
        if (!id) {
          return { applied: false, replySuffix: "\n\n【记账】删除失败：未找到目标账单。" };
        }
        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: {
              action: "deleteSharedBookkeeping",
              id,
            },
          });
          if (result && result.success) {
            this.clearUpcomingSummaryCache();
            return { applied: true, replySuffix: "\n\n【记账】已删除该账单。" };
          }
          return { applied: false, replySuffix: `\n\n【记账】删除失败：${(result && result.error) || "未知错误"}` };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【记账】删除失败：请求异常。" };
        }
      }

      return { applied: false, replySuffix: "" };
    },
    listSharedRecipes: async function (keyword = "", limit = 12) {
      try {
        const { result } = await wx.cloud.callFunction({
          name: "adminAuth",
          data: {
            action: "listSharedRecipes",
            keyword,
            limit,
          },
        });
        return (result && result.recipeList) || [];
      } catch (error) {
        return [];
      }
    },
    formatRecipesForReply: function (list = []) {
      const lines = (list || [])
        .slice(0, 6)
        .map((item, index) => {
          const name = String((item && item.name) || "").trim() || "未命名菜谱";
          const ingredients = (item && item.ingredients) || [];
          const steps = (item && item.steps) || [];
          const link = String((item && item.link) || "").trim();
          const id = String((item && item.id) || "").trim();
          return `${index + 1}. ${name}｜食材:${ingredients.join("、") || "无"}｜步骤:${steps.length}步${link ? `｜链接:${link}` : ""}${id ? `（id:${id}）` : ""}`;
        })
        .filter(Boolean);
      return lines.join("\n");
    },
    executeRecipeActionFromAi: async function (action = {}) {
      const type = String((action && action.type) || "none").trim().toLowerCase();
      if (!type || type === "none") {
        return { applied: false, replySuffix: "" };
      }

      if (type === "read") {
        const list = await this.listSharedRecipes(action.keyword || "", 12);
        if (!list.length) {
          return { applied: true, replySuffix: "\n\n【菜谱】未找到相关菜谱。" };
        }
        return {
          applied: true,
          replySuffix: `\n\n【菜谱】查询结果：\n${this.formatRecipesForReply(list)}`,
        };
      }

      if (type === "add") {
        const name = String((action && action.name) || "").trim();
        const ingredients = Array.isArray(action && action.ingredients) ? action.ingredients : [];
        const steps = Array.isArray(action && action.steps) ? action.steps : [];
        const link = String((action && action.link) || "").trim();
        const note = String((action && action.note) || "").trim();
        if (!name) {
          return { applied: false, replySuffix: "\n\n【菜谱】新增失败：缺少菜谱名称。" };
        }
        try {
          const { result } = await wx.cloud.callFunction({
            name: "adminAuth",
            data: {
              action: "addSharedRecipe",
              name,
              ingredients,
              steps,
              link,
              note,
            },
          });
          if (result && result.success) {
            return { applied: true, replySuffix: `\n\n【菜谱】已新增：${name}` };
          }
          return { applied: false, replySuffix: `\n\n【菜谱】新增失败：${(result && result.error) || "未知错误"}` };
        } catch (error) {
          return { applied: false, replySuffix: "\n\n【菜谱】新增失败：请求异常。" };
        }
      }

      return { applied: false, replySuffix: "" };
    },
    handleClickConversation: async function (e) {
      // 清除旧的会话聊天记录
      this.clearChatRecords();
      const { conversation } = e.currentTarget.dataset;
      this.setData({
        isDrawerShow: false,
        conversation: {
          conversationId: conversation.conversationId,
          title: conversation.title,
        },
        page: 1, // 重置历史记录分页参数
        size: 10,
      });
      this.handleRefresh();
      // // 拉取当前会话聊天记录
      // const res = await wx.cloud.extend.AI.bot.getChatRecords({
      //   botId: this.data.agentConfig.botId,
      //   pageNumber: this.data.page,
      //   pageSize: this.data.size,
      //   sort: "desc",
      //   conversationId: this.data.conversation?.conversationId || undefined,
      // });
      // if (res.recordList) {
      // }
    },
    fetchDefaultConversationList: async function () {
      try {
        if (this.data.bot.botId) {
          const res = await this.fetchConversationList(true, this.data.bot.botId);
          if (res) {
            const { data } = res;
            if (data && !data.code) {
              // 区分旧的默认会话结构与新的默认会话结构
              if (data.data) {
                if (data.data.length) {
                  this.setData({
                    defaultConversation: data.data[0],
                    conversations: data.data,
                    transformConversations: this.transformConversationList(data.data),
                  });
                }
              } else {
                this.setData({
                  defaultConversation: data,
                  conversations: [data],
                  transformConversations: this.transformConversationList([data]),
                  // conversationPageOptions: {
                  //   ...this.data.conversationPageOptions,
                  //   total: data.total,
                  // },
                });
              }
            }
          }
        }
      } catch (e) {
        console.log("fetchDefaultConversationList e", e);
      }
    },
    fetchConversationList: async function (isDefault, botId) {
      // const { token } = await cloudInstance.extend.AI.bot.tokenManager.getToken();
      if (this.data.fetchConversationLoading) {
        return;
      }

      return new Promise((resolve, reject) => {
        const { page, size } = this.data.conversationPageOptions;
        const limit = size;
        const offset = (page - 1) * size;
        this.setData({
          fetchConversationLoading: true,
        });

        commonRequest({
          path: `conversation/?botId=${botId}&limit=${limit}&offset=${offset}&isDefault=${isDefault}`,
          method: "GET",
          header: {},
          success: (res) => {
            resolve(res);
          },
          fail(e) {
            console.log("conversation list e", e);
            reject(e);
          },
          complete: () => {
            this.setData({
              fetchConversationLoading: false,
            });
            // wx.hideLoading();
          },
        });
      });
    },
    createConversation: async function () {
      // const cloudInstance = await getCloudInstance();
      // const { token } = await cloudInstance.extend.AI.bot.tokenManager.getToken();
      return new Promise((resolve, reject) => {
        commonRequest({
          path: `conversation`,
          header: {
            // Authorization: `Bearer ${token}`,
          },
          data: {
            botId: this.data.agentConfig.botId,
          },
          method: "POST",
          success: (res) => {
            resolve(res);
          },
          fail(e) {
            console.log("create conversation e", e);
            reject(e);
          },
        });
      });
    },
    clickCreateInDrawer: function () {
      this.setData({
        isDrawerShow: false,
      });
      this.createNewConversation();
    },
    createNewConversation: async function () {
      if (!this.data.bot.multiConversationEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 多会话模式",
        });
        return;
      }
      // // TODO: 创建新对话
      // const { data } = await this.createConversation();
      // console.log("createRes", data);
      this.clearChatRecords();
      // this.setData({
      //   conversation: {
      //     conversationId: data.conversationId,
      //     title: data.title,
      //   },
      // });
      this.setData({
        refreshText: "下拉加载历史记录",
      });
    },
    scrollConToBottom: async function (e) {
      console.log("scrollConToBottom", e);
      const { page, size } = this.data.conversationPageOptions;
      if (page * size >= this.data.conversationPageOptions.total) {
        return;
      }
      this.setData({
        conversationPageOptions: {
          ...this.data.conversationPageOptions,
          page: this.data.conversationPageOptions.page + 1,
        },
      });
      // 调用分页接口查询更多
      if (this.data.bot.botId) {
        const res = await this.fetchConversationList(false, this.data.bot.botId);
        if (res) {
          const { data } = res;
          if (data && !data.code) {
            const addConversations = [...this.data.conversations, ...data.data];
            // TODO: 临时倒序处理
            const sortConData = addConversations.sort(
              (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
            );
            this.setData({
              conversations: sortConData,
              transformConversations: this.transformConversationList(sortConData),
            });
          }
        }
      }
    },
    resetFetchConversationList: async function () {
      this.setData({
        conversationPageOptions: {
          page: 1,
          size: 15,
          total: 0,
        },
      });
      try {
        if (this.data.bot.botId) {
          const res = await this.fetchConversationList(false, this.data.bot.botId);
          if (res) {
            const { data } = res;
            if (data && !data.code) {
              // TODO: 临时倒序处理
              const sortData = data.data.sort(
                (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
              );
              const finalConData = this.data.defaultConversation
                ? sortData.concat(this.data.defaultConversation)
                : sortData;
              this.setData({
                conversations: finalConData,
                transformConversations: this.transformConversationList(finalConData),
                conversationPageOptions: {
                  ...this.data.conversationPageOptions,
                  total: data.total,
                },
              });
            }
          }
        }
      } catch (e) {
        console.log("fetchConversationList e", e);
      }
    },
    transformConversationList: function (conversations) {
      // 区分今天，本月，更早
      const todayCon = [];
      const curMonthCon = [];
      const earlyCon = [];
      const now = new Date();
      const todayDate = now.setHours(0, 0, 0, 0);
      const monthFirstDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      for (let item of conversations) {
        const itemDate = new Date(item.createTime).getTime();
        if (itemDate >= todayDate) {
          todayCon.push(item);
        } else if (itemDate >= monthFirstDate) {
          curMonthCon.push(item);
        } else {
          earlyCon.push(item);
        }
      }
      return {
        todayCon,
        curMonthCon,
        earlyCon,
      };
    },
    openDrawer: async function () {
      if (!this.data.bot.multiConversationEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 多会话模式",
        });
        return;
      }
      this.setData({
        isDrawerShow: true,
        // conversationPageOptions: {
        //   ...this.data.conversationPageOptions,
        //   page: 1,
        //   size: 15,
        // },
      });

      // await this.fetchHistoryConversationData();
    },
    closeDrawer() {
      this.setData({
        isDrawerShow: false,
      });
    },
    showErrorMsg: function (e) {
      const { content, reqid } = e.currentTarget.dataset;
      // console.log("content", content);
      const transformContent =
        typeof content === "string"
          ? reqid
            ? `${content}|reqId:${reqid}`
            : content
          : JSON.stringify({ err: content, reqid });
      wx.showModal({
        title: "错误原因",
        content: transformContent,
        success() {
          wx.setClipboardData({
            data: transformContent,
            success: function (res) {
              wx.showToast({
                title: "复制错误完成",
                icon: "success",
              });
            },
          });
        },
      });
    },
    transformToolCallHistoryList: function (toolCallList) {
      const callParamsList = toolCallList.filter((item) => item.type === "tool-call");
      // const callResultList = toolCallList.filter(item => item.type === 'tool-result')
      const callContentList = toolCallList.filter((item) => item.type === "text");
      const transformToolCallList = [];
      for (let i = 0; i < callParamsList.length; i++) {
        const curParam = callParamsList[i];
        const curResult = toolCallList.find(
          (item) => item.type === "tool-result" && item.toolCallId === curParam.tool_call.id
        );
        const curContent = callContentList[i];
        const curError = toolCallList.find(
          (item) => item.finish_reason === "error" && item.error.message.toolCallId === curParam.tool_call.id
          // (item) => item.finish_reason === "error"
        );
        const transformToolCallObj = {
          id: curParam.tool_call.id,
          name: this.transformToolName(curParam.tool_call.function.name),
          rawParams: curParam.tool_call.function.arguments,
          callParams: "```json\n\n" + JSON.stringify(curParam.tool_call.function.arguments, null, 2) + "\n```",
          content: ((curContent && curContent.content) || "").replaceAll("\t", "").replaceAll("\n", "\n\n"),
        };
        if (curResult) {
          transformToolCallObj.rawResult = curResult.result;
          transformToolCallObj.callResult = "```json\n\n" + JSON.stringify(curResult.result, null, 2) + "\n```";
        }
        if (curError) {
          transformToolCallObj.error = curError;
        }

        transformToolCallList.push(transformToolCallObj);
      }
      return transformToolCallList;
    },
    handleLineChange: function (e) {
      // console.log("linechange", e.detail.lineCount);
      // 查foot-function height
      const self = this;
      const query = wx.createSelectorQuery().in(this);
      query
        .select(".foot_function")
        .boundingClientRect(function (res) {
          if (res) {
            self.setData({
              textareaHeight: res.height,
            });
          } else {
            // console.log("未找到指定元素");
          }
        })
        .exec();
    },
    openFeedback: function (e) {
      const { feedbackrecordid, feedbacktype } = e.currentTarget.dataset;
      let index = null;
      this.data.chatRecords.forEach((item, _index) => {
        if (item.record_id === feedbackrecordid) {
          index = _index;
        }
      });
      const inputRecord = this.data.chatRecords[index - 1];
      const answerRecord = this.data.chatRecords[index];
      // console.log(record)
      this.setData({
        isShowFeedback: true,
        feedbackRecordId: feedbackrecordid,
        feedbackType: feedbacktype,
        aiAnswer: answerRecord.content,
        input: inputRecord.content,
      });
    },
    closefeedback: function () {
      this.setData({ isShowFeedback: false, feedbackRecordId: "", feedbackType: "" });
    },
    // 滚动相关处理
    calculateContentHeight() {
      return new Promise((resolve) => {
        const query = wx.createSelectorQuery().in(this);
        query
          .selectAll(".main >>> .contentBox")
          .boundingClientRect((rects) => {
            let totalHeight = 0;
            rects.forEach((rect) => {
              totalHeight += rect.height;
            });
            resolve(totalHeight);
          })
          .exec();
      });
    },
    calculateContentInTop() {
      // console.log('执行top 部分计算')
      return new Promise((resolve) => {
        const query = wx.createSelectorQuery().in(this);
        query
          .selectAll(".main >>> .nav, .main >>> .tips")
          .boundingClientRect((rects) => {
            let totalHeight = 0;
            rects.forEach((rect) => {
              totalHeight += rect.height;
            });
            // console.log('top height', totalHeight);
            resolve(totalHeight);
          })
          .exec();
      });
    },
    onWheel: function (e) {
      // 解决小程序开发工具中滑动
      if (!this.data.manualScroll && e.detail.deltaY < 0) {
        this.setData({
          manualScroll: true,
        });
      }
    },
    onScroll: function (e) {
      if (e.detail.scrollTop < this.data.lastScrollTop) {
        // 鸿蒙系统上可能滚动事件，拖动事件失效，兜底处理
        this.setData({
          manualScroll: true,
        });
      }

      this.setData({
        lastScrollTop: e.detail.scrollTop,
      });

      // 针对连续滚动的最后一次进行处理，scroll-view的 scroll end事件不好判定
      if (this.data.scrollTimer) {
        clearTimeout(this.data.scrollTimer);
      }

      this.setData({
        scrollTimer: setTimeout(() => {
          const newTop = Math.max(this.data.scrollTop, e.detail.scrollTop);
          if (this.data.manualScroll) {
            this.setData({
              scrollTop: newTop,
            });
          } else {
            this.setData({
              scrollTop: newTop,
              viewTop: newTop,
            });
          }
        }, 100),
      });
    },
    handleScrollStart: function (e) {
      // console.log("drag start", e);
      if (e.detail.scrollTop > 0 && !this.data.manualScroll) {
        // 手动开始滚
        this.setData({
          manualScroll: true,
        });
      }
    },
    handleScrollToLower: function (e) {
      // console.log("scroll to lower", e);
      // 到底转自动
      this.setData({
        manualScroll: false,
      });
    },
    autoToBottom: function () {
      this.setData({
        manualScroll: false,
        scrollTo: "scroll-bottom",
      });
    },
    bindInputFocus: function (e) {
      this.setData({
        manualScroll: false,
      });
      this.autoToBottom();
    },
    bindKeyInput: function (e) {
      this.setData({
        inputValue: e.detail.value,
      });
    },
    handleRefresh: function (e) {
      if (this.data.triggered) {
        return;
      }
      console.log("开始刷新");
      this.setData(
        {
          triggered: true,
          refreshText: "刷新中",
        },
        async () => {
          // 模拟请求回数据后 停止加载
          // console.log('this.data.agentConfig.type', this.data.agentConfig.type)
          if (this.data.chatMode === "bot") {
            // 判断当前是否大于一条 （一条则为系统默认提示，直接从库里拉出最近的一页）
            if (this.data.chatRecords.length > 1) {
              const newPage = Math.floor(this.data.chatRecords.length / this.data.size) + 1;
              this.setData({
                page: newPage,
              });
            }
            const cloudInstance = await getCloudInstance(this.data.envShareConfig);
            const ai = cloudInstance.extend.AI;
            const getRecordsReq = {
              botId: this.data.agentConfig.botId,
              pageNumber: this.data.page,
              pageSize: this.data.size,
              sort: "desc",
            };
            if (this.data.conversation?.conversationId) {
              getRecordsReq.conversationId = this.data.conversation?.conversationId;
            }
            const res = await ai.bot.getChatRecords(getRecordsReq);
            if (res.recordList) {
              this.setData({
                total: res.total,
              });

              if (this.data.total === this.data.chatRecords.length - 1) {
                this.setData({
                  triggered: false,
                  refreshText: "到底啦",
                });
                return;
              }

              // 找出新获取的一页中，不在内存中的数据
              const freshNum = this.data.size - ((this.data.chatRecords.length - 1) % this.data.size);
              const freshChatRecords = res.recordList
                .reverse()
                .slice(0, freshNum)
                .map((item) => {
                  let transformItem = {
                    ...item,
                    record_id: item.recordId,
                  };
                  if (item.role === "user" && item.fileInfos) {
                    transformItem.fileList = item.fileInfos.map((item) => ({
                      status: "parsed",
                      rawFileName: item.fileName,
                      rawType: item.type,
                      fileId: item.cloudId,
                      fileSize: item.bytes,
                    }));
                  }
                  if (item.role === "assistant") {
                    if (item.content === "") {
                      transformItem.content = this.data.defaultErrorMsg;
                      transformItem.error = {};
                      transformItem.reqId = item.trace_id || "";
                    }

                    if (item.origin_msg) {
                      // console.log("toolcall origin_msg", JSON.parse(item.origin_msg));
                      const origin_msg_obj = JSON.parse(item.origin_msg);
                      if (origin_msg_obj.aiResHistory) {
                        const transformToolCallList = this.transformToolCallHistoryList(origin_msg_obj.aiResHistory);
                        transformItem.toolCallList = transformToolCallList;
                        const toolCallErr = transformToolCallList.find((item) => item.error)?.error;
                        // console.log("toolCallErr", toolCallErr);
                        if (toolCallErr?.error?.message) {
                          transformItem.error = toolCallErr.error.message;
                          transformItem.reqId = item.trace_id || "";
                        }
                      } else {
                        // 之前异常的返回
                        // return null
                      }
                    }
                  }
                  return transformItem;
                })
                .filter((item) => item);
              // 只有一条则一定是系统开头语，需要置前，否则则为真实对话，靠后
              this.setData({
                chatRecords:
                  this.data.chatRecords.length === 1
                    ? [...this.data.chatRecords, ...freshChatRecords]
                    : [...freshChatRecords, ...this.data.chatRecords],
              });
              // console.log("totalChatRecords", this.data.chatRecords);
            }
            this.setData({
              triggered: false,
              refreshText: "下拉加载历史记录",
            });
          }
        }
      );
    },
    handleTapClear: function (e) {
      this.clearChatRecords();
    },
    clearChatRecords: function () {
      console.log("执行清理");
      const chatMode = this.data.chatMode;
      const { bot } = this.data;
      this.setData({ showTools: false });
      if (chatMode === "model") {
        this.setData({
          chatRecords: [],
          chatStatus: 0,
        });
        return;
      }
      // 只有一条不需要清
      // if (this.data.chatRecords.length === 1) {
      //   return;
      // }
      const record = {
        content: bot.welcomeMessage || "你好，有什么我可以帮到你？",
        record_id: "record_id" + String(+new Date() + 10),
        role: "assistant",
        hiddenBtnGround: true,
      };
      const questions = randomSelectInitquestion(bot.initQuestions, 3);
      this.setData({
        chatRecords: [record],
        chatStatus: 0,
        questions,
        page: 1, // 重置分页页码
        conversation: null,
      });
    },
    chooseMedia: function (sourceType) {
      const self = this;
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: [sourceType],
        maxDuration: 30,
        camera: "back",
        success(res) {
          // console.log("res", res);
          // console.log("tempFiles", res.tempFiles);
          const isImageSizeValid = res.tempFiles.every((item) => item.size <= 30 * 1024 * 1024);
          if (!isImageSizeValid) {
            wx.showToast({
              title: "图片大小30M限制",
              icon: "error",
            });
            return;
          }
          const tempFiles = res.tempFiles.map((item) => {
            const tempFileInfos = item.tempFilePath.split(".");
            const tempFileName = md5(tempFileInfos[0]) + "." + tempFileInfos[1];
            return {
              tempId: tempFileName,
              rawType: item.fileType, // 微信选择默认的文件类型 image/video/file
              tempFileName: tempFileName, // 文件名
              rawFileName: "", // 图片类不带源文件名
              tempPath: item.tempFilePath,
              fileSize: item.size,
              fileUrl: "",
              fileId: "",
              botId: self.data.agentConfig.botId,
              status: "",
            };
          });

          const finalFileList = [...tempFiles];
          // console.log("final", finalFileList);
          self.setData({
            sendFileList: finalFileList, //
          });
          if (finalFileList.length) {
            self.setData({
              showTools: false,
            });
            if (!self.data.showFileList) {
              self.setData({
                showFileList: true,
              });
            }
          }
        },
      });
    },
    handleUploadImg: function (sourceType) {
      if (!this.data.bot.searchFileEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 文件上传功能",
        });
        return;
      }
      if (this.data.useWebSearch) {
        wx.showModal({
          title: "提示",
          content: "联网搜索不支持上传文件/图片",
        });
        return;
      }
      const self = this;
      const isCurSendFile = this.data.sendFileList.find((item) => item.rawType === "file");
      if (isCurSendFile) {
        wx.showModal({
          title: "确认替换吗",
          content: "上传图片将替换当前文件内容",
          showCancel: "true",
          cancelText: "取消",
          confirmText: "确认",
          success(res) {
            // console.log("res", res);
            self.chooseMedia(sourceType);
          },
          fail(error) {
            // console.log("choose file e", error);
          },
        });
      } else {
        self.chooseMedia(sourceType);
      }
    },
    chooseMessageFile: function () {
      // console.log("触发choose");
      const self = this;
      const oldFileLen = this.data.sendFileList.filter((item) => item.rawType === "file").length;
      // console.log("oldFileLen", oldFileLen);
      const subFileCount = oldFileLen <= 5 ? 5 - oldFileLen : 0;
      if (subFileCount === 0) {
        wx.showToast({
          title: "文件数量限制5个",
          icon: "error",
        });
        return;
      }
      wx.chooseMessageFile({
        count: subFileCount,
        type: "file",
        success(res) {
          // tempFilePath可以作为img标签的src属性显示图片
          // const tempFilePaths = res.tempFiles;
          // console.log("res", res);
          // 检验文件后缀
          const isFileExtValid = res.tempFiles.every((item) => self.checkFileExt(item.name.split(".")[1]));
          if (!isFileExtValid) {
            wx.showModal({
              content: "当前支持文件类型为 pdf、txt、doc、docx、ppt、pptx、xls、xlsx、csv",
              showCancel: false,
              confirmText: "确定",
            });
            return;
          }
          // 校验各文件大小是否小于10M
          const isFileSizeValid = res.tempFiles.every((item) => item.size <= 10 * 1024 * 1024);
          if (!isFileSizeValid) {
            wx.showToast({
              title: "单文件10M限制",
              icon: "error",
            });
            return;
          }
          const tempFiles = res.tempFiles.map((item) => {
            const tempFileInfos = item.path.split(".");
            const tempFileName = md5(tempFileInfos[0]) + "." + tempFileInfos[1];
            return {
              tempId: tempFileName,
              rawType: item.type, // 微信选择默认的文件类型 image/video/file
              tempFileName: tempFileName, // 文件名
              rawFileName: item.name,
              tempPath: item.path,
              fileSize: item.size,
              fileUrl: "",
              fileId: "",
              botId: self.data.agentConfig.botId,
              status: "",
            };
          });
          // 过滤掉已选择中的 image 文件（保留file)
          const filterFileList = self.data.sendFileList.filter((item) => item.rawType !== "image");
          const finalFileList = [...filterFileList, ...tempFiles];
          console.log("final", finalFileList);

          self.setData({
            sendFileList: finalFileList, //
          });

          if (finalFileList.length) {
            self.setData({
              showTools: false,
            });
            if (!self.data.showFileList) {
              self.setData({
                showFileList: true,
              });
            }
          }
        },
        fail(e) {
          console.log("choose e", e);
        },
      });
    },
    handleUploadMessageFile: function () {
      // 判断agent 配置是否打开上传文件
      if (!this.data.bot.searchFileEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 文件上传功能",
        });
        return;
      }
      if (this.data.useWebSearch) {
        wx.showModal({
          title: "提示",
          content: "联网搜索不支持上传文件/图片",
        });
        return;
      }

      const self = this;
      const isCurSendImage = this.data.sendFileList.find((item) => item.rawType === "image");
      if (isCurSendImage) {
        wx.showModal({
          title: "确认替换吗",
          content: "上传文件将替换当前图片内容",
          showCancel: "true",
          cancelText: "取消",
          confirmText: "确认",
          success(res) {
            console.log("res", res);
            self.chooseMessageFile();
          },
          fail(error) {
            console.log("choose file e", error);
          },
        });
      } else {
        self.chooseMessageFile();
      }
    },
    handleAlbum: function () {
      this.handleUploadImg("album");
    },
    handleCamera: function () {
      this.handleUploadImg("camera");
    },
    checkFileExt: function (ext) {
      return ["pdf", "txt", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv"].includes(ext);
    },
    stop: function () {
      this.autoToBottom();
      const { chatRecords, chatStatus } = this.data;
      const newChatRecords = [...chatRecords];
      const record = newChatRecords[newChatRecords.length - 1];
      if (chatStatus === 1) {
        record.content = "已暂停生成";
      }
      // 暂停思考
      if (chatStatus === 2) {
        record.pauseThinking = true;
      }
      this.setData({
        chatRecords: newChatRecords,
        manualScroll: false,
        chatStatus: 0, // 暂停之后切回正常状态
      });
    },
    openSetPanel: function () {
      this.setData({ setPanelVisibility: true });
    },
    closeSetPanel: function () {
      this.setData({ setPanelVisibility: false });
    },
    getPersistentId: function (storageKey, prefix) {
      try {
        const currentValue = wx.getStorageSync(storageKey);
        if (currentValue) {
          return currentValue;
        }
      } catch (error) {}

      const nextValue = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      try {
        wx.setStorageSync(storageKey, nextValue);
      } catch (error) {}
      return nextValue;
    },
    persistQaLog: async function (payload = {}) {
      const { modelConfig = {} } = this.data;
      const { enableQaLogging, qaLogCollection = "chat_logs" } = modelConfig;
      if (!enableQaLogging) {
        return;
      }

      try {
        const testerId = this.getPersistentId(LOCAL_TESTER_ID_KEY, "tester");
        const sessionId = this.getPersistentId(LOCAL_SESSION_ID_KEY, "session");
        const db = wx.cloud.database();
        await db.collection(qaLogCollection).add({
          data: {
            testerId,
            sessionId,
            source: "chatBot",
            chatMode: this.data.chatMode,
            question: payload.question || "",
            answer: payload.answer || "",
            modelProvider: payload.modelProvider || "",
            modelName: payload.modelName || "",
            hasError: !!payload.hasError,
            error: payload.error || "",
            errorReason: payload.errorReason || payload.error || "",
            durationMs: Number(payload.durationMs) || 0,
            durationSec: Number(payload.durationMs) ? (Number(payload.durationMs) / 1000).toFixed(2) : "0.00",
            requestStartedAt: payload.requestStartedAt ? new Date(payload.requestStartedAt) : new Date(),
            requestEndedAt: payload.requestEndedAt ? new Date(payload.requestEndedAt) : new Date(),
            answerLength: String(payload.answer || "").length,
            questionLength: String(payload.question || "").length,
            createdAt: new Date(),
          },
        });
      } catch (error) {}
    },
    extractMemoryContent: function (text = "") {
      const normalizedText = String(text || "").trim();
      if (!normalizedText) {
        return "";
      }

      const triggerList = ["我告诉你", "记住", "你要知道"];
      for (const trigger of triggerList) {
        const triggerIndex = normalizedText.indexOf(trigger);
        if (triggerIndex === -1) {
          continue;
        }

        const rawContent = normalizedText.slice(triggerIndex + trigger.length).trim();
        const cleanedContent = rawContent.replace(/^[：:，,。！？!?\s]+/, "").trim();
        if (cleanedContent) {
          return cleanedContent;
        }
      }

      return "";
    },
    loadLocalMemories: function () {
      try {
        const memories = wx.getStorageSync(LOCAL_MEMORY_STORAGE_KEY);
        return Array.isArray(memories) ? memories : [];
      } catch (error) {
        return [];
      }
    },
    saveLocalMemory: function (content) {
      const finalContent = String(content || "").trim();
      if (!finalContent) {
        return;
      }

      const existingMemories = this.loadLocalMemories();
      const dedupedMemories = existingMemories.filter((item) => item && item.content !== finalContent);
      const nextMemories = [
        {
          content: finalContent,
          createdAt: Date.now(),
        },
        ...dedupedMemories,
      ].slice(0, 20);

      try {
        wx.setStorageSync(LOCAL_MEMORY_STORAGE_KEY, nextMemories);
      } catch (error) {}
    },
    loadPendingSharedMemories: function () {
      try {
        const pending = wx.getStorageSync(LOCAL_PENDING_SHARED_MEMORIES_KEY);
        return Array.isArray(pending) ? pending : [];
      } catch (error) {
        return [];
      }
    },
    savePendingSharedMemories: function (list = []) {
      try {
        wx.setStorageSync(LOCAL_PENDING_SHARED_MEMORIES_KEY, Array.isArray(list) ? list.slice(0, 30) : []);
      } catch (error) {}
    },
    enqueuePendingSharedMemory: function (content) {
      const finalContent = String(content || "").trim();
      if (!finalContent) {
        return;
      }
      const pending = this.loadPendingSharedMemories();
      const deduped = pending.filter((item) => item && item.content !== finalContent);
      const next = [
        {
          content: finalContent,
          createdAt: Date.now(),
        },
        ...deduped,
      ].slice(0, 30);
      this.savePendingSharedMemories(next);
    },
    saveSharedMemoryToCloud: async function (content) {
      const finalContent = String(content || "").trim();
      if (!finalContent) {
        return { success: false, reason: "empty content" };
      }

      try {
        const { result } = await wx.cloud.callFunction({
          name: "adminAuth",
          data: {
            action: "addSharedConceptMemory",
            content: finalContent,
          },
        });
        console.log('CF addSharedConceptMemory result:', JSON.stringify(result));
        if (result && result.success) {
          return { success: true, channel: "cloud-function" };
        }
      } catch (error) {
        console.error('CF addSharedConceptMemory failed:', error.message);
      }

      try {
        const db = wx.cloud.database();
        const userInfo = wx.getStorageSync('userInfo') || {};
        const openid = userInfo.openid || '';
        
        await db.collection("shared_concept_memory").add({
          data: {
            content: finalContent,
            createdAt: new Date(),
            ownerOpenid: openid,
          },
        });
        console.log('Direct DB add success, ownerOpenid:', openid);
        return { success: true, channel: "direct-db" };
      } catch (error) {
        console.error('Direct DB add failed:', error.message);
        this.enqueuePendingSharedMemory(finalContent);
        return { success: false, reason: (error && error.message) || "cloud sync failed" };
      }
    },
    flushPendingSharedMemories: async function () {
      const pending = this.loadPendingSharedMemories();
      if (!pending.length) {
        return 0;
      }

      const remain = [];
      let syncedCount = 0;
      for (const item of pending) {
        const content = item && item.content ? item.content : "";
        if (!content) {
          continue;
        }
        const result = await this.saveSharedMemoryToCloud(content);
        if (result && result.success) {
          syncedCount += 1;
        } else {
          remain.push(item);
        }
      }
      this.savePendingSharedMemories(remain);
      return syncedCount;
    },
    buildLocalMemoryPrompt: function () {
      const memories = this.loadLocalMemories();
      if (!memories.length) {
        return "";
      }

      const memoryLines = memories
        .filter((item) => item && item.content)
        .map((item, index) => `${index + 1}. ${item.content}`)
        .join("\n");

      if (!memoryLines) {
        return "";
      }

      return `以下是用户后来明确告诉你的新增记忆，请在相关对话里自然记住并使用，不要提来源：\n${memoryLines}`;
    },
    awaitWithTimeout: function (promise, timeoutMs = 30000, errorMessage = "请求超时") {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(errorMessage));
        }, Math.max(1000, Number(timeoutMs) || 30000));
        Promise.resolve(promise)
          .then((value) => {
            clearTimeout(timer);
            resolve(value);
          })
          .catch((error) => {
            clearTimeout(timer);
            reject(error);
          });
      });
    },
    startChatBusyGuard: function () {
      this.stopChatBusyGuard();
      const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this._chatBusyGuardToken = token;
      this._chatBusyGuardTimer = setTimeout(() => {
        if (this._chatBusyGuardToken !== token) {
          return;
        }
        const records = [...(this.data.chatRecords || [])];
        const lastIndex = records.length - 1;
        if (lastIndex >= 0) {
          const last = records[lastIndex] || {};
          if (last.role === "assistant" && !String(last.content || "").trim()) {
            last.content = "请求超时，请重试。";
            last.hiddenBtnGround = false;
            records[lastIndex] = last;
          }
        }
        console.error("[agent-ui] busy guard forced unlock", {
          token,
          chatStatus: this.data.chatStatus,
          records: records.length,
        });
        this.setData({
          chatRecords: records,
          chatStatus: 0,
        });
      }, 15000);
    },
    stopChatBusyGuard: function () {
      this._chatBusyGuardToken = "";
      if (this._chatBusyGuardTimer) {
        clearTimeout(this._chatBusyGuardTimer);
        this._chatBusyGuardTimer = null;
      }
    },
    handleSendMessage: async function (event) {
      // 发送消息前校验所有文件上传状态
      if (this.data.sendFileList.some((item) => !item.fileId || item.status !== "parsed")) {
        wx.showToast({
          title: "文件上传解析中",
          icon: "error",
        });
        return;
      }
      await this.sendMessage(event.currentTarget.dataset.message);
    },
    sendMessage: async function (message) {
      if (this.data.showFileList) {
        this.setData({
          showFileList: !this.data.showFileList,
        });
      }
      if (this.data.showTools) {
        this.setData({
          showTools: !this.data.showTools,
        });
      }
      // const { message } = event.currentTarget.dataset;
      let { inputValue, bot, agentConfig, chatRecords, chatStatus, modelConfig } = this.data;
      // 如果正在进行对话，不让发送消息
      if (chatStatus !== 0) {
        // Recover from stale stuck state: assistant placeholder exists but no content for a long-failed request.
        const records = this.data.chatRecords || [];
        const lastRecord = records.length ? records[records.length - 1] : null;
        const isStalePending = !!(
          lastRecord &&
          lastRecord.role === "assistant" &&
          !String(lastRecord.content || "").trim()
        );
        if (isStalePending) {
          this.setData({ chatStatus: 0 });
          chatStatus = 0;
        } else {
          return;
        }
      }
      // 将传进来的消息给到inputValue
      if (message) {
        inputValue = message;
      }
      // 空消息返回
      if (!inputValue) {
        return;
      }

      // 异步处理待同步的记忆，不阻塞主流程
      const syncPendingMemoriesPromise = this.flushPendingSharedMemories().then((syncedCount) => {
        if (syncedCount > 0) {
          return this.loadSharedMemoryPromptFromCloud(true);
        }
      });
      // 不等待待同步记忆处理完成，立即继续处理当前消息

      const capturedMemory = this.extractMemoryContent(inputValue);
      if (capturedMemory) {
        this.saveLocalMemory(capturedMemory);
        const cloudResult = await this.saveSharedMemoryToCloud(capturedMemory);
        if (cloudResult && cloudResult.success) {
          await this.loadSharedMemoryPromptFromCloud(true);
        }
        wx.showToast({
          title: cloudResult && cloudResult.success ? "记住了（云端已同步）" : "记住了（仅本地，待同步）",
          icon: "none",
        });
      }

      let chatMode = this.data.chatMode;
      const isModelOpenAiMode =
        chatMode === "model" &&
        String((modelConfig && modelConfig.modelProvider) || "") === "openai" &&
        String((modelConfig && modelConfig.endpointBase) || "").trim() &&
        String((modelConfig && modelConfig.apiKey) || "").trim();
      const isOpenAiConfigured =
        String((modelConfig && modelConfig.modelProvider) || "") === "openai" &&
        String((modelConfig && modelConfig.endpointBase) || "").trim() &&
        String((modelConfig && modelConfig.apiKey) || "").trim();

      // Circuit breaker: bot stream may hang in some environments.
      // If OpenAI model is configured, route to model mode directly.
      if (chatMode === "bot" && isOpenAiConfigured) {
        console.warn("[agent-ui] bot mode circuit-breaker fallback -> model mode");
        chatMode = "model";
      }
      const shouldSkipCalendarSideEffect = isModelOpenAiMode && this.hasCalendarIntent(inputValue);

      // 先立刻更新 UI、切换发送状态，side effects 并行执行不阻塞渲染
      const userRecord = {
        content: inputValue,
        record_id: "record_id" + String(+new Date() - 10),
        role: "user",
        fileList: this.data.sendFileList,
      };
      if (this.data.sendFileList.length) {
        this.setData({
          sendFileList: [],
        });
      }
      const record = {
        content: "",
        record_id: "record_id" + String(+new Date() + 10),
        role: "assistant",
        hiddenBtnGround: true,
      };
      this.setData({
        inputValue: "",
        questions: [],
        chatRecords: [...chatRecords, userRecord, record],
        chatStatus: 1, // 聊天状态切换为1发送中
      });

      const debugReqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      console.log("[agent-ui] sendMessage started", {
        debugReqId,
        chatMode,
        inputPreview: String(inputValue || "").slice(0, 60),
      });

      this.startChatBusyGuard();

      try {

      // 新增一轮对话记录时 自动往下滚底
      this.autoToBottom();

      // side effects 异步并行，不阻塞主流程
      this.runChatSideEffects(inputValue, {
        skipCalendar: shouldSkipCalendarSideEffect,
      }).then((sideEffectMessages) => {
        if (sideEffectMessages && sideEffectMessages.length) {
          wx.showToast({
            title: sideEffectMessages.join("，").slice(0, 16),
            icon: "none",
          });
        }
      });

      const directBookkeepingAction = this.hasBookkeepingIntent(inputValue)
        ? this.inferDirectBookkeepingAction(inputValue)
        : null;
      if (directBookkeepingAction) {
        try {
          const bookkeepingResult = await this.executeBookkeepingActionFromAi(directBookkeepingAction, inputValue);
          const directValue = [...this.data.chatRecords];
          const lastValueIndex = directValue.length - 1;
          const lastValue = directValue[lastValueIndex];
          const suffix = String((bookkeepingResult && bookkeepingResult.replySuffix) || '').trim();
          lastValue.content = suffix ? `好的。${suffix}` : '好的，已为你处理。';
          lastValue.modelProvider = 'local-rule';
          lastValue.modelName = 'direct-bookkeeping';
          lastValue.hiddenBtnGround = false;
          this.setData({
            chatRecords: directValue,
            chatStatus: 0,
          });
          this.persistQaLog({
            question: inputValue,
            answer: lastValue.content,
            modelProvider: 'local-rule',
            modelName: 'direct-bookkeeping',
            hasError: false,
            durationMs: 0,
            requestStartedAt: Date.now(),
            requestEndedAt: Date.now(),
          });
          return;
        } catch (error) {
          const directValue = [...this.data.chatRecords];
          const lastValueIndex = directValue.length - 1;
          const lastValue = directValue[lastValueIndex];
          lastValue.content = `【记账】处理失败：${(error && error.message) || '请求异常'}`;
          lastValue.hiddenBtnGround = false;
          this.setData({
            chatRecords: directValue,
            chatStatus: 0,
          });
          return;
        }
      }

      if (chatMode === "bot" && !isOpenAiConfigured) {
        const fallbackValue = [...this.data.chatRecords];
        const lastValueIndex = fallbackValue.length - 1;
        const lastValue = fallbackValue[lastValueIndex] || {};
        lastValue.content = "聊天服务暂不可用（bot 通道无响应）。请在设置中启用 model/openai 后重试。";
        lastValue.hiddenBtnGround = false;
        this.setData({
          chatRecords: fallbackValue,
          chatStatus: 0,
        });
        console.error("[agent-ui] bot mode unavailable and openai not configured");
        return;
      }

      if (chatMode === "bot") {
        try {
          console.log("[agent-ui] entering bot mode", { debugReqId });
          const cloudInstance = await getCloudInstance(this.data.envShareConfig);
          const ai = cloudInstance.extend.AI;
        // const ai = wx.cloud.extend.AI;
        // 区分当前是旧的单会话模式 or 新的多会话模式
        let res;
        if (!this.data.bot.multiConversationEnable) {
          // 单会话
          res = await this.awaitWithTimeout(
            ai.bot.sendMessage({
              data: {
                botId: bot.botId,
                msg: inputValue,
                files: this.data.showUploadFile ? userRecord.fileList.map((item) => item.fileId) : undefined,
                searchEnable: this.data.useWebSearch,
              },
            }),
            30000,
            "聊天请求超时"
          );
        } else {
          // 多会话
          if (!this.data.conversation && this.data.bot.multiConversationEnable) {
            // 发消息前构造新会话
            try {
              const { data } = await this.createConversation();
              this.setData({
                conversation: {
                  conversationId: data.conversationId,
                  title: data.title,
                },
              });
            } catch (e) {
              console.log("createConversation e", e);
            }
          }

          const sendReq = {
            botId: bot.botId,
            msg: inputValue,
            files: this.data.showUploadFile ? userRecord.fileList.map((item) => item.fileId) : undefined,
            searchEnable: this.data.useWebSearch,
          };

          if (this.data.conversation?.conversationId) {
            sendReq.conversationId = this.data.conversation.conversationId;
          }

          res = await this.awaitWithTimeout(
            ai.bot.sendMessage({
              data: sendReq,
            }),
            30000,
            "聊天请求超时"
          );
          // 当前已产生新会话，重刷一遍
          await this.awaitWithTimeout(this.resetFetchConversationList(), 10000, "会话列表刷新超时");
        }
        let contentText = "";
        let reasoningContentText = "";
        let isManuallyPaused = false; //这个标记是为了处理手动暂停时，不要请求推荐问题，不显示下面的按钮
        let startTime = null; //记录开始思考时间
        let endTime = null; // 记录结束思考时间
        let index = 0;
        let streamTimeoutError = null;
        const streamIterator = res && res.eventStream && res.eventStream[Symbol.asyncIterator]
          ? res.eventStream[Symbol.asyncIterator]()
          : null;
        if (!streamIterator) {
          throw new Error("eventStream unavailable");
        }
        console.log("[agent-ui] bot stream started", {
          chatMode,
          conversationId: (this.data.conversation && this.data.conversation.conversationId) || "",
        });
        while (true) {
          let nextResult;
          try {
            nextResult = await this.awaitWithTimeout(streamIterator.next(), 20000, "流式响应超时");
          } catch (error) {
            streamTimeoutError = error;
            console.error("[agent-ui] bot stream stalled", error);
            break;
          }
          if (!nextResult || nextResult.done) {
            break;
          }
          const event = nextResult.value;
          // console.log("event", event);
          const { chatStatus } = this.data;
          if (chatStatus === 0) {
            isManuallyPaused = true;
            break;
          }
          if (index % 10 === 0) {
            // 更新频率降为1/10
            this.toBottom(40);
          }
          const { data } = event;
          if (data === "[DONE]") {
            break;
          }
          try {
            const dataJson = JSON.parse(data);
            const {
              type,
              content,
              reasoning_content,
              record_id,
              search_info,
              role,
              knowledge_meta,
              knowledge_base,
              finish_reason,
              search_results,
              error,
              usage,
            } = dataJson;
            const newValue = [...this.data.chatRecords];
            // 取最后一条消息更新
            const lastValueIndex = newValue.length - 1;
            const lastValue = newValue[lastValueIndex];
            lastValue.role = role || "assistant";
            lastValue.record_id = record_id;
            // 优先处理错误,直接中断
            if (finish_reason === "error" || finish_reason === "content_filter" || error) {
              lastValue.search_info = null;
              lastValue.reasoning_content = "";
              lastValue.knowledge_meta = [];
              // 内容过滤错误用友好提示，其他错误用通用提示
              if (finish_reason === "content_filter") {
                lastValue.content = "这个话题涉及内容审核限制，我没法回答。换个话题试试？";
                lastValue.error = "内容审核被拦截";
              } else {
                lastValue.content = this.data.defaultErrorMsg;
                lastValue.error = error?.message || "服务异常";
              }
              if (error && error.message) {
                this.setData({
                  [`chatRecords[${lastValueIndex}].error`]: lastValue.error,
                });
                if (lastValue.toolCallList && lastValue.toolCallList.length) {
                  let errToolCallObj = null;
                  if (typeof error.message === "string") {
                    errToolCallObj = lastValue.toolCallList[lastValue.toolCallList.length - 1];
                  } else {
                    if (error.message?.toolCallId) {
                      errToolCallObj = lastValue.toolCallList.find((item) => item.id === error.message.toolCallId);
                    }
                  }
                  if (errToolCallObj && !errToolCallObj.callResult) {
                    errToolCallObj.error = error;
                    this.setData({
                      [`chatRecords[${lastValueIndex}].toolCallList`]: lastValue.toolCallList,
                    });
                    this.autoToBottom();
                  }
                }
              }
              this.setData({
                [`chatRecords[${lastValueIndex}].search_info`]: lastValue.search_info,
                [`chatRecords[${lastValueIndex}].reasoning_content`]: lastValue.reasoning_content,
                [`chatRecords[${lastValueIndex}].knowledge_meta`]: lastValue.knowledge_meta,
                [`chatRecords[${lastValueIndex}].content`]: lastValue.content,
                [`chatRecords[${lastValueIndex}].record_id`]: lastValue.record_id,
              });
              // if (error) {
              //   lastValue.error = error;
              //   this.setData({
              //     [`chatRecords[${lastValueIndex}].error`]: lastValue.error,
              //   });
              // }
              break;
            }
            // 下面根据type来确定输出的内容
            // 只更新一次参考文献，后续再收到这样的消息丢弃
            if (type === "search" && !lastValue.search_info) {
              lastValue.search_info = search_info;
              this.setData({
                chatStatus: 2,
                [`chatRecords[${lastValueIndex}].search_info`]: lastValue.search_info,
                [`chatRecords[${lastValueIndex}].record_id`]: lastValue.record_id,
              }); // 聊天状态切换为思考中,展示联网的信息
            }
            // 思考过程
            if (type === "thinking") {
              if (!startTime) {
                startTime = +new Date();
                endTime = +new Date();
              } else {
                endTime = +new Date();
              }
              reasoningContentText += reasoning_content;
              lastValue.reasoning_content = reasoningContentText;
              lastValue.thinkingTime = Math.floor((endTime - startTime) / 1000);
              this.setData({
                [`chatRecords[${lastValueIndex}].reasoning_content`]: lastValue.reasoning_content,
                [`chatRecords[${lastValueIndex}].thinkingTime`]: lastValue.thinkingTime,
                [`chatRecords[${lastValueIndex}].record_id`]: lastValue.record_id,
                chatStatus: 2,
              }); // 聊天状态切换为思考中
            }
            // 内容
            if (type === "text") {
              // 区分是 toolCall 的content 还是普通的 content
              let isToolCallContent = false;
              const toolCallList = lastValue.toolCallList;
              if (toolCallList && toolCallList.length) {
                // const lastToolCallObj = toolCallList[toolCallList.length - 1];
                const findToolCallObj = toolCallList.find((item) => item.callParams && !item.callResult);
                if (findToolCallObj) {
                  isToolCallContent = true;
                  findToolCallObj.content += content.replaceAll("\t", "").replaceAll("\n", "\n\n");
                  this.setData({
                    [`chatRecords[${lastValueIndex}].toolCallList`]: lastValue.toolCallList,
                    chatStatus: 3,
                  });
                  this.autoToBottom();
                }
              }

              if (!isToolCallContent) {
                contentText += content;
                lastValue.content = contentText;
                this.setData({
                  [`chatRecords[${lastValueIndex}].content`]: lastValue.content,
                  [`chatRecords[${lastValueIndex}].record_id`]: lastValue.record_id,
                  chatStatus: 3,
                }); // 聊天状态切换为输出content中
              }
            }
            // 知识库，只更新一次
            if (type === "knowledge" && !lastValue.knowledge_meta) {
              // console.log('ryan',knowledge_base)
              lastValue.knowledge_base = knowledge_base;
              this.setData({
                [`chatRecords[${lastValueIndex}].knowledge_base`]: lastValue.knowledge_base,
                chatStatus: 2,
              });
            }
            // 数据库，只更新一次
            if (type === "db" && !lastValue.db_len) {
              lastValue.db_len = search_results.relateTables || 0;
              this.setData({
                [`chatRecords[${lastValueIndex}].db_len`]: lastValue.db_len,
                chatStatus: 2,
              });
            }
            // tool_call 场景，调用请求
            if (type === "tool-call") {
              const { tool_call } = dataJson;
              const callBody = {
                id: tool_call.id,
                name: this.transformToolName(tool_call.function.name),
                rawParams: tool_call.function.arguments,
                callParams: "```json\n" + JSON.stringify(tool_call.function.arguments, null, 2) + "\n```",
                content: "",
              };
              if (!lastValue.toolCallList) {
                lastValue.toolCallList = [callBody];
              } else {
                lastValue.toolCallList.push(callBody);
              }
              this.setData({
                [`chatRecords[${lastValueIndex}].toolCallList`]: lastValue.toolCallList,
              });
              this.autoToBottom();
            }
            // tool_call 场景，调用响应
            if (type === "tool-result") {
              const { toolCallId, result } = dataJson;
              // console.log("tool-result", result);
              if (lastValue.toolCallList && lastValue.toolCallList.length) {
                const lastToolCallObj = lastValue.toolCallList.find((item) => item.id === toolCallId);
                if (lastToolCallObj && !lastToolCallObj.callResult) {
                  lastToolCallObj.rawResult = result;
                  lastToolCallObj.callResult = "```json\n" + JSON.stringify(result, null, 2) + "\n```";
                  this.setData({
                    [`chatRecords[${lastValueIndex}].toolCallList`]: lastValue.toolCallList,
                  });
                  this.autoToBottom();
                }
              }
            }
            // 超出token数限制
            if (type === "finish" && finish_reason === "length") {
              const completionTokens = usage?.completionTokens || 0;
              lastValue.error = "回答被截断了，请尝试重新提问，或把问题拆分得更具体一点";
              this.setData({
                [`chatRecords[${lastValueIndex}].error`]: lastValue.error,
              });
            }
          } catch (e) {
            console.log("err", event, e);
            break;
          }
          index++;
        }
        if (streamTimeoutError) {
          const timeoutValue = [...this.data.chatRecords];
          const timeoutIndex = timeoutValue.length - 1;
          const timeoutRecord = timeoutValue[timeoutIndex] || {};
          if (!String(timeoutRecord.content || "").trim()) {
            timeoutRecord.content = "请求超时，请重试。";
          }
          timeoutRecord.error = streamTimeoutError && streamTimeoutError.message ? streamTimeoutError.message : "流式响应超时";
          timeoutValue[timeoutIndex] = timeoutRecord;
          this.setData({
            chatRecords: timeoutValue,
          });
        }
        this.toBottom(40);
        const newValue = [...this.data.chatRecords];
        const lastValueIndex = newValue.length - 1;
        // 取最后一条消息更新
        const lastValue = newValue[lastValueIndex];
        lastValue.hiddenBtnGround = isManuallyPaused;
        if (lastValue.content === "") {
          lastValue.content = this.data.defaultErrorMsg;
          this.setData({
            [`chatRecords[${lastValueIndex}].content`]: lastValue.content,
          });
        }
        // console.log("this.data.chatRecords", this.data.chatRecords);
        this.setData({
          chatStatus: 0,
          [`chatRecords[${lastValueIndex}].hiddenBtnGround`]: isManuallyPaused,
        }); // 对话完成，切回0 ,并且修改最后一条消息的状态，让下面的按钮展示
        if (bot.isNeedRecommend && !isManuallyPaused) {
          const cloudInstance = await getCloudInstance(this.data.envShareConfig);
          const ai = cloudInstance.extend.AI;
          const chatRecords = this.data.chatRecords;
          const lastPairChatRecord = chatRecords.length >= 2 ? chatRecords.slice(chatRecords.length - 2) : [];
          const recommendRes = await ai.bot.getRecommendQuestions({
            data: {
              botId: bot.botId,
              history: lastPairChatRecord.map((item) => ({
                role: item.role,
                content: item.content,
              })),
              msg: inputValue,
              agentSetting: "",
              introduction: "",
              name: "",
            },
          });
          let result = "";
          for await (let str of recommendRes.textStream) {
            // this.toBottom();
            this.toBottom();
            result += str;
            this.setData({
              questions: result.split("\n").filter((item) => !!item),
            });
          }
        }
        } catch (error) {
          console.error("[agent-ui] bot mode failed", { debugReqId, error });
          const newValue = [...this.data.chatRecords];
          const lastValue = newValue[newValue.length - 1];
          if (lastValue) {
            lastValue.content = lastValue.content || this.data.defaultErrorMsg;
            lastValue.error = error && error.message ? error.message : "服务异常";
            lastValue.hiddenBtnGround = false;
          }
          this.setData({ chatRecords: newValue, chatStatus: 0 });
        }
      }
      if (chatMode === "model") {
        console.log("[agent-ui] entering model mode", { debugReqId });
        const requestStartedAt = Date.now();
        const {
          modelProvider,
          quickResponseModel,
          fallbackProvider,
          fallbackModel,
          memoryPrompt,
          localFactsPrompt,
          strictLocalNames,
          endpointBase,
          apiKey,
          deploymentName,
          apiVersion,
          enableQaLogging,
          qaLogCollection,
        } = modelConfig;

        const sharedMemoryPrompt = await this.loadSharedMemoryPromptFromCloud(false);
        const mergedMemoryPrompt = [sharedMemoryPrompt, memoryPrompt].filter(Boolean).join("\n\n");

        if (modelProvider === "openai" && endpointBase && apiKey) {
          try {
            const nameList = Array.isArray(strictLocalNames) ? strictLocalNames : [];
            const containsLocalName = nameList.some((name) => inputValue.includes(name));
            const localMemoryPrompt = this.buildLocalMemoryPrompt();
            const strictLocalGuard = containsLocalName
              ? [
                  {
                    role: "system",
                    content:
                      "下面涉及到孙励天、宋陶颖、孙星玥、秦天时，必须优先依据本地事实回答，禁止引用外部人物、历史资料或编造成其他同名人物。回复时不要出现“根据你此前提供的信息”“根据本地记忆”“资料显示”“没有这条记录”这类来源说明。对于固定事实里已经明确写出的内容，必须直接回答该事实本身，不要改写成泛泛分析、推测、文学化发挥或标准答案总结。只有在固定事实没有明确答案时，才允许做温和、贴近日常聊天的常识性推断，而且不要解释推理过程。",
                  },
                  ...(localFactsPrompt
                    ? [
                        {
                          role: "system",
                          content: localFactsPrompt,
                        },
                      ]
                    : []),
                ]
              : [];

            const needsBookkeepingTool = this.hasBookkeepingIntent(inputValue);
            const needsRecipeTool = this.hasRecipeIntent(inputValue);
            const needsCalendarTool = this.hasCalendarIntent(inputValue) && !needsBookkeepingTool && !needsRecipeTool;
            const needsStructuredDecision = needsCalendarTool || needsBookkeepingTool || needsRecipeTool;
            const directBookkeepingAction = needsBookkeepingTool ? this.inferDirectBookkeepingAction(inputValue) : null;
            const targetDate = this.pickDateFromText(inputValue, this.getTodayDateText());
            const calendarPreview = needsCalendarTool ? await this.listSharedCalendarByDate(targetDate, 20, 0) : [];
            const bookkeepingPreview = needsBookkeepingTool ? await this.listSharedBookkeeping(8) : [];
            const recipePreview = needsRecipeTool ? await this.listSharedRecipes("", 6) : [];

            if (directBookkeepingAction) {
              const bookkeepingResult = await this.executeBookkeepingActionFromAi(directBookkeepingAction, inputValue);
              const newValue = [...this.data.chatRecords];
              const lastValue = newValue[newValue.length - 1];
              const suffix = (bookkeepingResult && bookkeepingResult.replySuffix) || "\n\n【记账】已处理。";
              lastValue.content = `好的。${suffix}`;
              lastValue.modelProvider = "local-rule";
              lastValue.modelName = "direct-bookkeeping";
              lastValue.hiddenBtnGround = false;
              this.setData({ chatRecords: newValue, chatStatus: 0 });
              this.persistQaLog({
                question: inputValue,
                answer: lastValue.content,
                modelProvider: "local-rule",
                modelName: "direct-bookkeeping",
                hasError: false,
                durationMs: Date.now() - requestStartedAt,
                requestStartedAt,
                requestEndedAt: Date.now(),
              });
              return;
            }
            const calendarToolSystemPrompt = {
              role: "system",
              content:
                "你现在具备共享日历操作能力。请严格输出 JSON 对象，不要输出 Markdown，不要加解释。JSON 结构: {\"reply\": string, \"calendarAction\": {\"type\": \"none|read|add|delete|update\", \"id\"?: string, \"date\"?: \"YYYY-MM-DD\", \"title\"?: string, \"note\"?: string, \"keyword\"?: string}, \"reason\": string}。规则: 1) reply 是对用户自然回复。2) 当用户表达查日历/加日历/删日历/改日历意图时，给出对应 calendarAction；否则 type=none。3) 只要用户信息足够形成最小日程（日期+事件），就直接选择 add，不要反问用户是否要加，也不要要求用户再补标题。4) 删除或修改优先给 id；若无 id，尽量给 date+keyword。5) date 必须是 YYYY-MM-DD。",
            };
            const bookkeepingToolSystemPrompt = {
              role: "system",
              content:
                "你还具备记账能力。当用户涉及转账、消费用途、承诺归还、还款、还欠多少、超期惩罚、改承诺日期、改金额、删除账单时，返回 bookkeepingAction。bookkeepingAction JSON: {\"type\":\"none|read|add|repay|update|delete|suggestPenalty|decidePenalty\",\"id\"?:string,\"keyword\"?:string,\"fromName\"?:string,\"toName\"?:string,\"transferAmount\"?:number,\"purchaseItem\"?:string,\"promiseDate\"?:\"YYYY-MM-DD\",\"promiseAmount\"?:number,\"repayAmount\"?:number,\"suggestion\"?:string,\"decision\"?:\"accept|reject\"}。规则：孙励天提惩罚，宋陶颖决定同意或拒绝。若无id可给keyword用于定位账单。",
            };
            const recipeToolSystemPrompt = {
              role: "system",
              content:
                "你还具备菜谱能力。涉及菜谱/食谱/做法/食材/步骤/链接时，返回 recipeAction。recipeAction JSON: {\"type\":\"none|read|add\",\"keyword\"?:string,\"name\"?:string,\"ingredients\"?:string[],\"steps\"?:string[],\"link\"?:string,\"note\"?:string}。",
            };
            const calendarToolContext = {
              role: "system",
              content: JSON.stringify({
                today: this.getTodayDateText(),
                viewerIdentity: this.data.viewerIdentity || {},
                calendarPreviewDate: targetDate,
                calendarPreview,
                bookkeepingPreview,
                recipePreview,
              }),
            };

            const systemMessages = [
              ...strictLocalGuard,
              ...(localMemoryPrompt
                ? [
                    {
                      role: "system",
                      content: localMemoryPrompt,
                    },
                  ]
                : []),
              ...(mergedMemoryPrompt
                ? [
                    {
                      role: "system",
                      content: mergedMemoryPrompt,
                    },
                  ]
                : []),
              // 仅在命中对应工具意图时注入提示，避免普通消息多消耗 token
              ...(needsCalendarTool ? [calendarToolSystemPrompt] : []),
              ...(needsBookkeepingTool ? [bookkeepingToolSystemPrompt] : []),
              ...(needsRecipeTool ? [recipeToolSystemPrompt] : []),
              ...(needsStructuredDecision ? [calendarToolContext] : []),
            ];

            const recentConversationMessages = [
              ...chatRecords.map((item) => ({
                role: item.role,
                content: item.content,
              })),
              {
                role: "user",
                content: inputValue,
              },
            ].slice(-6);

            const requestMessages = [...systemMessages, ...recentConversationMessages];

            const normalizedEndpoint = endpointBase.replace(/\/+$/, "");
            const realDeployment = deploymentName || quickResponseModel;
            const realApiVersion = apiVersion || "2025-01-01-preview";
            const url = `${normalizedEndpoint}/openai/deployments/${realDeployment}/chat/completions?api-version=${realApiVersion}`;

            const response = await new Promise((resolve, reject) => {
              wx.request({
                url,
                method: "POST",
                timeout: 20000,
                data: {
                  messages: requestMessages,
                  max_tokens: 2000,
                  // 仅命中工具场景时强制 JSON，普通聊天不额外约束
                  ...(needsStructuredDecision ? { response_format: { type: "json_object" } } : {}),
                },
                header: {
                  "Content-Type": "application/json",
                  "api-key": apiKey,
                },
                success: (res) => {
                  if (res.statusCode >= 400) {
                    reject(new Error(res?.data?.error?.message || `HTTP ${res.statusCode}`));
                    return;
                  }
                  resolve(res.data || {});
                },
                fail: (err) => {
                  reject(new Error(err?.errMsg || "请求失败"));
                },
              });
            });

            const rawResponseContent = response?.choices?.[0]?.message?.content || "";
            const parsedDecision = this.parseModelJsonObject(rawResponseContent);
            const newValue = [...this.data.chatRecords];
            const lastValue = newValue[newValue.length - 1];

            let finalReply = rawResponseContent || this.data.defaultErrorMsg;
            let calendarHandled = false;
            let bookkeepingHandled = false;
            let recipeHandled = false;
            if (parsedDecision && typeof parsedDecision.reply === "string" && parsedDecision.reply.trim()) {
              finalReply = parsedDecision.reply.trim();
            } else if (parsedDecision) {
              // 命中结构化 JSON 但没有自然语言 reply 时，不直接把 JSON 原文展示给用户。
              finalReply = "";
            }

            let resolvedCalendarAction = parsedDecision && parsedDecision.calendarAction ? parsedDecision.calendarAction : null;
            let resolvedBookkeepingAction = parsedDecision && parsedDecision.bookkeepingAction ? parsedDecision.bookkeepingAction : null;
            let resolvedRecipeAction = parsedDecision && parsedDecision.recipeAction ? parsedDecision.recipeAction : null;

            if (
              parsedDecision &&
              !resolvedCalendarAction &&
              !resolvedBookkeepingAction &&
              !resolvedRecipeAction &&
              typeof parsedDecision.type === "string"
            ) {
              const rawType = String(parsedDecision.type || "").trim().toLowerCase();
              if (
                needsBookkeepingTool &&
                ["none", "read", "add", "repay", "update", "delete", "suggestpenalty", "decidepenalty"].includes(rawType)
              ) {
                resolvedBookkeepingAction = parsedDecision;
              } else if (needsRecipeTool && ["none", "read", "add"].includes(rawType)) {
                resolvedRecipeAction = parsedDecision;
              } else if (needsCalendarTool && ["none", "read", "add", "delete", "update"].includes(rawType)) {
                resolvedCalendarAction = parsedDecision;
              }
            }

            if (resolvedCalendarAction) {
              const calendarResult = await this.executeCalendarActionFromAi(resolvedCalendarAction);
              if (calendarResult && calendarResult.replySuffix) {
                finalReply = `${finalReply}${calendarResult.replySuffix}`;
              }
              calendarHandled = !!(calendarResult && (calendarResult.applied || calendarResult.replySuffix));
            }

            if (resolvedBookkeepingAction) {
              const bookkeepingResult = await this.executeBookkeepingActionFromAi(resolvedBookkeepingAction, inputValue);
              if (bookkeepingResult && bookkeepingResult.replySuffix) {
                finalReply = `${finalReply}${bookkeepingResult.replySuffix}`;
              }
              bookkeepingHandled = !!(bookkeepingResult && (bookkeepingResult.applied || bookkeepingResult.replySuffix));
            }

            if (resolvedRecipeAction) {
              const recipeResult = await this.executeRecipeActionFromAi(resolvedRecipeAction);
              if (recipeResult && recipeResult.replySuffix) {
                finalReply = `${finalReply}${recipeResult.replySuffix}`;
              }
              recipeHandled = !!(recipeResult && (recipeResult.applied || recipeResult.replySuffix));
            }

            // 兜底：模型未返回结构化 calendarAction 时，保证“说记下来了却未落库”的问题不会发生。
            if (needsCalendarTool && !calendarHandled && !bookkeepingHandled && !recipeHandled) {
              const fallbackRuleDraft = this.extractCalendarDraftFromInput(inputValue);
              const fallbackDraft = await this.resolveCalendarDraftWithAi(inputValue, fallbackRuleDraft);
              if (fallbackDraft) {
                const saved = await this.addCalendarReminderFromChat(fallbackDraft);
                if (saved) {
                  const calendarMemory = this.buildCalendarMemoryContent(fallbackDraft);
                  if (calendarMemory) {
                    this.saveLocalMemory(calendarMemory);
                    const cloudMemoryResult = await this.saveSharedMemoryToCloud(calendarMemory);
                    if (cloudMemoryResult && cloudMemoryResult.success) {
                      await this.loadSharedMemoryPromptFromCloud(true);
                    }
                  }
                  finalReply = `${finalReply}\n\n【日历操作】已添加：${fallbackDraft.date} ${fallbackDraft.title}`;
                  calendarHandled = true;
                }
              }

              if (!calendarHandled && /(查看|查询|看|干了啥|做了什么|有什么|日历)/.test(inputValue)) {
                const readResult = await this.executeCalendarActionFromAi({
                  type: "read",
                  date: targetDate,
                });
                if (readResult && readResult.replySuffix) {
                  finalReply = `${finalReply}${readResult.replySuffix}`;
                  calendarHandled = true;
                }
              }
            }

            if (!String(finalReply || "").trim()) {
              finalReply = (calendarHandled || bookkeepingHandled || recipeHandled)
                ? "好的，已为你处理。"
                : "收到。";
            }

            lastValue.content = finalReply;
            lastValue.modelProvider = "azure-openai";
            lastValue.modelName = realDeployment;
            lastValue.hiddenBtnGround = false;
            this.setData({ chatRecords: newValue, chatStatus: 0 });
            // 日志写入不阻塞 UI 恢复
            this.persistQaLog({
              question: inputValue,
              answer: finalReply,
              modelProvider: "azure-openai",
              modelName: realDeployment,
              hasError: false,
              durationMs: Date.now() - requestStartedAt,
              requestStartedAt,
              requestEndedAt: Date.now(),
            });
          } catch (error) {
            const newValue = [...this.data.chatRecords];
            const lastValue = newValue[newValue.length - 1];
            const errorMsg = error?.message || "模型服务异常";
            
            // 识别内容过滤错误，给用户友好提示
            const isContentFilterError = /content.{0,20}filter|filter.{0,20}polic/i.test(errorMsg) || 
                                         /内容.{0,10}过滤|内容.{0,10}审核/.test(errorMsg);
            
            if (isContentFilterError) {
              lastValue.content = "这个话题涉及内容审核限制，我没法回答。换个话题试试？";
              lastValue.error = "内容审核被拦截";
            } else {
              lastValue.content = this.data.defaultErrorMsg;
              lastValue.error = errorMsg;
            }
            
            lastValue.hiddenBtnGround = false;
            this.setData({ chatRecords: newValue, chatStatus: 0 });
            this.persistQaLog({
              question: inputValue,
              answer: lastValue.content,
              modelProvider: "azure-openai",
              modelName: deploymentName || quickResponseModel,
              hasError: true,
              error: lastValue.error,
              errorReason: errorMsg,
              durationMs: Date.now() - requestStartedAt,
              requestStartedAt,
              requestEndedAt: Date.now(),
            });
          }
          return;
        }
        const cloudInstance = await getCloudInstance(this.data.envShareConfig);
        const ai = cloudInstance.extend.AI;
        const baseMessages = [
          ...(mergedMemoryPrompt
            ? [
                {
                  role: "system",
                  content: mergedMemoryPrompt,
                },
              ]
            : []),
          ...chatRecords.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          {
            role: "user",
            content: inputValue,
          },
        ];

        const runModelStream = async (provider, modelName) => {
          const aiModel = ai.createModel(provider);
          const res = await aiModel.streamText({
            data: {
              model: modelName,
              messages: baseMessages,
            },
          });

          let contentText = "";
          let reasoningText = "";
          let curChatStatus = 2;
          let isManuallyPaused = false;
          let startTime = null;
          let endTime = null;

          for await (let event of res.eventStream) {
            if (this.data.chatStatus === 0) {
              isManuallyPaused = true;
              break;
            }
            this.toBottom();

            const { data } = event;
            try {
              const dataJson = JSON.parse(data);
              const { id, choices = [] } = dataJson || {};
              const { delta, finish_reason } = choices[0] || {};
              if (finish_reason === "stop") {
                break;
              }
              const { content, reasoning_content } = delta;
              reasoningText += reasoning_content || "";
              contentText += content || "";
              const newValue = [...this.data.chatRecords];
              const lastValue = newValue[newValue.length - 1];
              lastValue.content = contentText;
              lastValue.reasoning_content = reasoningText;
              lastValue.record_id = "record_id" + String(id);
              if (!!reasoningText && !contentText) {
                curChatStatus = 2;
                if (!startTime) {
                  startTime = +new Date();
                  endTime = +new Date();
                } else {
                  endTime = +new Date();
                }
              } else {
                curChatStatus = 3;
              }
              lastValue.thinkingTime = endTime ? Math.floor((endTime - startTime) / 1000) : 0;
              this.setData({ chatRecords: newValue, chatStatus: curChatStatus });
            } catch (e) {
              break;
            }
          }

          const newValue = [...this.data.chatRecords];
          const lastValue = newValue[newValue.length - 1];
          lastValue.hiddenBtnGround = isManuallyPaused;
          this.setData({ chatRecords: newValue, chatStatus: 0 });
        };

        try {
          await runModelStream(modelProvider, quickResponseModel);
        } catch (primaryError) {
          const hasFallback = fallbackProvider && fallbackModel;
          const isDifferentModel = fallbackProvider !== modelProvider || fallbackModel !== quickResponseModel;
          if (hasFallback && isDifferentModel) {
            wx.showToast({
              title: "主模型不可用，已切备用",
              icon: "none",
            });
            try {
              await runModelStream(fallbackProvider, fallbackModel);
            } catch (fallbackError) {
              const newValue = [...this.data.chatRecords];
              const lastValue = newValue[newValue.length - 1];
              if (!lastValue.content) {
                lastValue.content = this.data.defaultErrorMsg;
              }
              lastValue.error = fallbackError?.message || "模型服务异常";
              this.setData({ chatRecords: newValue, chatStatus: 0 });
            }
          } else {
            const newValue = [...this.data.chatRecords];
            const lastValue = newValue[newValue.length - 1];
            if (!lastValue.content) {
              lastValue.content = this.data.defaultErrorMsg;
            }
            lastValue.error = primaryError?.message || "模型服务异常";
            this.setData({ chatRecords: newValue, chatStatus: 0 });
          }
        }
      }
      } finally {
        this.stopChatBusyGuard();
      }
    },
    toBottom: async function (unit) {
      const addUnit = unit === undefined ? 4 : unit;
      if (this.data.shouldAddScrollTop) {
        const newTop = this.data.scrollTop + addUnit;
        if (this.data.manualScroll) {
          this.setData({
            scrollTop: newTop,
          });
        } else {
          this.setData({
            scrollTop: newTop,
            viewTop: newTop,
          });
        }
        return;
      }
      // 只有当内容高度接近scroll 区域视口高度时才开始增加 scrollTop
      // const clientHeight =
      //   this.data.windowInfo.windowHeight - this.data.footerHeight - (this.data.chatMode === "bot" ? 40 : 0); // 视口高度
      const clientHeight = this.data.curScrollHeight; // TODO:
      // const contentHeight =
      //   (await this.calculateContentHeight()) +
      //   (this.data.contentHeightInScrollViewTop || (await this.calculateContentInTop())); // 内容总高度
      const contentHeight = await this.calculateContentHeight();
      // console.log(
      //   'contentHeight clientHeight newTop',
      //   contentHeight,
      //   clientHeight,
      //   this.data.scrollTop + 4
      // );
      if (clientHeight - contentHeight < 10) {
        this.setData({
          shouldAddScrollTop: true,
        });
      }
    },
    copyChatRecord: function (e) {
      const { content } = e.currentTarget.dataset;
      wx.setClipboardData({
        data: content,
        success: function (res) {
          wx.showToast({
            title: "复制成功",
            icon: "success",
          });
        },
      });
    },
    addFileList: function () {
      // 顶部文件行展现时，隐藏底部工具栏
      this.setData({});
    },
    subFileList: function () {},
    copyUrl: function (e) {
      const { url } = e.currentTarget.dataset;
      console.log(url);
      wx.setClipboardData({
        data: url,
        success: function (res) {
          wx.showToast({
            title: "复制成功",
            icon: "success",
          });
        },
      });
    },
    handleRemoveChild: function (e) {
      // console.log("remove", e.detail.tempId);
      if (e.detail.tempId) {
        const newSendFileList = this.data.sendFileList.filter((item) => item.tempId !== e.detail.tempId);
        console.log("newSendFileList", newSendFileList);
        this.setData({
          sendFileList: newSendFileList,
        });
        if (newSendFileList.length === 0 && this.data.showFileList) {
          this.setData({
            showFileList: false,
          });
        }
      }
    },
    handleChangeChild: function (e) {
      console.log("change", e.detail);
      const { fileId, tempId, status } = e.detail;
      // const curFile = this.data.sendFileList.find(item => item.tempId === tempId)
      // curFile.fileId = fileId
      const newSendFileList = this.data.sendFileList.map((item) => {
        if (item.tempId === tempId) {
          const obj = {};
          if (fileId) {
            obj.fileId = fileId;
          }
          if (status) {
            obj.status = status;
          }
          return {
            ...item,
            ...obj,
          };
        }
        return item;
      });
      this.setData({
        sendFileList: newSendFileList,
      });
    },
    handleClickTools: function () {
      this.setData({
        showTools: !this.data.showTools,
      });
    },
    handleClickWebSearch: function () {
      if (!this.data.useWebSearch && !this.data.bot.searchEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 联网搜索功能",
        });
        return;
      }
      if (this.data.sendFileList.length) {
        wx.showModal({
          title: "提示",
          content: "上传附件后不支持联网搜索",
        });
        return;
      }
      this.setData({
        useWebSearch: !this.data.useWebSearch,
      });
    },
    fetchAudioUrlByContent: async function (recordId, content) {
      // 缓存有读缓存
      if (this.data.audioSrcMap[recordId]) {
        return this.data.audioSrcMap[recordId];
      }
      // 发起文本转语音请求
      const res = await new Promise((resolve, reject) => {
        commonRequest({
          path: `bots/${this.data.bot.botId}/text-to-speech`,
          header: {},
          data: {
            text: content,
            voiceType: this.data.bot.voiceSettings?.outputType,
          },
          method: "POST",
          success: (res) => {
            resolve(res);
          },
          fail(e) {
            console.log("create text-to-speech task e", e);
            reject(e);
          },
        });
      });
      const { data } = res;
      if (data && data.TaskId) {
        const taskId = data.TaskId;
        // 轮训获取音频url
        let loopQueryStatus = true;
        let audioUrl = "";
        while (loopQueryStatus) {
          const res = await new Promise((resolve, reject) => {
            commonRequest({
              path: `bots/${this.data.bot.botId}/text-to-speech`,
              header: {},
              data: {
                taskId,
              },
              method: "GET",
              success: (res) => {
                resolve(res);
              },
              fail(e) {
                console.log("create text-to-speech task e", e);
                reject(e);
              },
            });
          });
          const { data } = res;
          if (data.code || data.Status === 2) {
            loopQueryStatus = false;
          }
          if (data.Status === 2) {
            audioUrl = data.ResultUrl;
            this.setData({
              audioSrcMap: {
                ...this.data.audioSrcMap,
                [recordId]: audioUrl,
              },
            });
          }
          if (loopQueryStatus) {
            await sleep(1000);
          }
        }
        return audioUrl;
      }
      return "";
    },
    handlePlayAudio: async function (e) {
      console.log("handlePlayAudio e", e);
      const { recordid: botRecordId, content } = e.target.dataset;
      const audioContext = this.data.audioContext;
      if (audioContext.context) {
        // 判断当前管理的 audioContext 所属 chatRecord 是否与点击播放的 chatRecord 一致
        if (audioContext.recordId === botRecordId) {
          // 是则直接播放
          audioContext.playStatus = 2;
          audioContext.showSpeedList = false;
          // audioContext.currentSpeed = 1.25;
          this.setData({
            audioContext: audioContext,
          });
          audioContext.context.playbackRate = audioContext.currentSpeed;
          audioContext.context.play();
        } else {
          // 需销毁当前的 audioContext TODO:, 先测试复用content, 直接更换src
          audioContext.context.stop(); // 旧的停止
          audioContext.recordId = botRecordId;
          audioContext.playStatus = 1;
          audioContext.showSpeedList = false;
          audioContext.currentSpeed = 1.25;
          this.setData({
            audioContext: {
              ...audioContext,
            },
          });
          const audioUrl = await this.fetchAudioUrlByContent(botRecordId, content);
          if (audioUrl) {
            audioContext.context.src = audioUrl;
            audioContext.context.seek(0); // 播放进度拉回到0
            audioContext.context.playbackRate = audioContext.currentSpeed;
            audioContext.context.play();
            this.setData({
              audioContext: {
                ...audioContext,
                playStatus: 2,
              },
            });
          } else {
            console.log("文本转语音失败");
            this.setData({
              audioContext: {
                ...audioContext,
                playStatus: 0,
              },
            });
          }
        }
      } else {
        // 创建audioContext
        const audioContext = {
          recordId: botRecordId,
          playStatus: 1,
          showSpeedList: false,
          currentSpeed: 1.25,
        };
        const innerAudioContext = wx.createInnerAudioContext({
          useWebAudioImplement: false, // 是否使用 WebAudio 作为底层音频驱动，默认关闭。对于短音频、播放频繁的音频建议开启此选项，开启后将获得更优的性能表现。由于开启此选项后也会带来一定的内存增长，因此对于长音频建议关闭此选项
        });
        try {
          await wx.setInnerAudioOption({
            obeyMuteSwitch: false, // 是否遵循系统静音开关，默认遵循
          });
        } catch (e) {
          console.log("不遵循静音模式控制", e);
        }
        innerAudioContext.onEnded(() => {
          // 音频自然播放至结束触发
          this.setData({
            audioContext: {
              ...this.data.audioContext,
              playStatus: 0,
            },
          });
        });
        audioContext.context = innerAudioContext;
        this.setData({
          audioContext: audioContext,
        });
        const audioUrl = await this.fetchAudioUrlByContent(botRecordId, content);
        if (audioUrl) {
          audioContext.context.src = audioUrl;
          audioContext.context.playbackRate = audioContext.currentSpeed; // 播放速率，范围 0.5~2.0，默认 1.0
          audioContext.context.play();
          this.setData({
            audioContext: {
              ...audioContext,
              playStatus: 2,
            },
          });
        } else {
          console.log("文本转语音失败");
          this.setData({
            audioContext: {
              ...audioContext,
              playStatus: 0,
            },
          });
        }
      }
    },
    handlePauseAudio: function (e) {
      console.log("handlePauseAudio e", e);
      const { recordid: botRecordId } = e.target.dataset;
      const audioContext = this.data.audioContext;
      if (botRecordId === audioContext.recordId && audioContext.context) {
        audioContext.context.pause();
        audioContext.playStatus = 0;
        this.setData({
          audioContext: {
            ...audioContext,
          },
        });
      } else {
        console.log("暂停异常");
      }
    },
    toggleSpeedList(e) {
      this.setData({
        audioContext: {
          ...this.data.audioContext,
          showSpeedList: !this.data.audioContext.showSpeedList,
        },
      });
    },
    chooseSpeed(e) {
      const speed = e.currentTarget.dataset.speed;
      const audioContext = this.data.audioContext;
      audioContext.showSpeedList = !this.data.audioContext.showSpeedList;
      audioContext.currentSpeed = Number(speed);
      audioContext.context.pause();
      audioContext.context.playbackRate = audioContext.currentSpeed;
      audioContext.context.play();
      this.setData({
        audioContext: {
          ...this.data.audioContext,
          ...audioContext,
        },
      });
    },
    // 触摸开始
    handleTouchStart(e) {
      if (this.data.chatStatus !== 0 || this.data.voiceRecognizing === true) {
        wx.showToast({
          title: "请等待对话完成",
          icon: "error",
        });
        return;
      }
      console.log("touchstart e", e);
      const { clientY } = e.touches[0];
      this.setData({
        startY: clientY,
        longPressTriggered: false,
      });

      // 设置长按定时器（500ms）
      this.data.longPressTimer = setTimeout(() => {
        // 触发长按，同时进入待发送态
        this.setData({ longPressTriggered: true, sendStatus: 1 });
        // 这里可添加长按反馈（如震动）
        wx.vibrateShort();
        this.startRecord();
      }, 300);
    },
    // 触摸移动
    handleTouchMove(e) {
      if (this.data.chatStatus !== 0 || this.data.voiceRecognizing === true) {
        wx.showToast({
          title: "请等待对话完成",
          icon: "error",
        });
        return;
      }
      if (!this.data.longPressTriggered) return;
      const { clientY } = e.touches[0];
      const deltaY = clientY - this.data.startY;
      // 计算垂直滑动距离
      if (Math.abs(deltaY) > this.data.moveThreshold) {
        // 滑动超过阈值时置为待取消态
        // clearTimeout(this.data.longPressTimer);
        console.log("touchMove 待取消");
        if (this.data.sendStatus !== 2) {
          this.setData({ sendStatus: 2 });
        }
      } else {
        console.log("touchMove 待发送");
        if (this.data.sendStatus !== 1) {
          this.setData({ sendStatus: 1 });
        }
      }
    },
    // 触摸结束
    handleTouchEnd(e) {
      if (this.data.chatStatus !== 0 || this.data.voiceRecognizing === true) {
        wx.showToast({
          title: "请等待对话完成",
          icon: "error",
        });
        return;
      }
      console.log("touchEnd e", e);
      clearTimeout(this.data.longPressTimer);
      if (this.data.longPressTriggered) {
        const { clientY } = e.changedTouches[0];
        const deltaY = clientY - this.data.startY;
        // 判断是否向上滑动超过阈值
        if (deltaY < -this.data.moveThreshold) {
          this.cancelSendVoice(); // 执行滑动后的逻辑
        } else {
          this.sendVoice(); // 执行普通松开逻辑
        }
      }
      this.setData({ longPressTriggered: false });
    },
    sendVoice() {
      // 发送语音消息
      console.log("发送语音");
      if (this.data.recorderManager) {
        this.setData({
          sendStatus: 3,
          voiceRecognizing: true,
        });
        this.data.recorderManager.stop();
      }
    },
    cancelSendVoice() {
      // 取消语音发送
      console.log("取消发送");
      if (this.data.recorderManager) {
        this.setData({
          sendStatus: 4,
        });
        console.log("停止录音");
        this.data.recorderManager.stop();
      }
    },
    startRecord() {
      console.log("startRecord sendStatus", this.data.sendStatus);
      if (this.data.recorderManager && this.data.sendStatus === 1) {
        console.log("开始录音");
        this.data.recorderManager.start(this.data.recordOptions);
      }
    },
  },
});
