function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function getTodayString() {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDateToString(date) {
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateParts(dateText = '') {
  const match = String(dateText || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function computeAnniversaryYears(dateText = '') {
  const parts = parseDateParts(dateText);
  if (!parts) {
    return 0;
  }
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  let targetYear = currentYear;
  if (currentMonth > parts.month || (currentMonth === parts.month && currentDay > parts.day)) {
    targetYear += 1;
  }
  return Math.max(0, targetYear - parts.year);
}

const STAR_PALETTE = [
  ['255,255,255', '200,220,255', 0.7],
  ['255,255,255', '255,255,255', 0.65],
  ['255,255,255', '220,235,255', 0.72],
  ['155,120,255', '155,120,255', 0.68],
  ['100,140,255', '100,140,255', 0.7],
  ['210,80,100',  '210,80,100',  0.65],
  ['80,200,255',  '80,200,255',  0.68],
  ['200,120,255', '200,120,255', 0.65],
  ['120,180,255', '120,180,255', 0.7],
];

const METEOR_PALETTE = [
  ['210,220,255', '160,165,255', 0.62],
  ['225,235,255', '140,180,255', 0.58],
  ['210,190,255', '150,120,235', 0.56],
  ['250,220,240', '180,110,170', 0.52],
];

Page({
  data: {
    stars: [],
    meteors: [],
    sparkles: [],
    currentMonth: getTodayString().slice(0, 7), // YYYY-MM
    selectedDate: getTodayString(),
    calendarDays: [], // Array of day objects
    daysWithEvents: {}, // { 'YYYY-MM-DD': count }
    eventTitle: '',
    eventNote: '',
    viewerLabel: '',
    calendarList: [],
    calendarCount: 0,
    calendarLoading: false,
    adding: false,
    deletingId: '',
    calendarSubscribedMap: {},
    anniversarySubscribedMap: {},
    anniversaryAllSubscribed: false,
    anniversaries: [],
    reminderConfig: {
      anniversary: {
        enabled: false,
        templateId: '',
        options: [],
      },
      calendar: {
        enabled: false,
        templateId: '',
        options: [],
      },
    },
  },

  async onLoad(options = {}) {
    const selectedDate = String(options.date || '').trim();
    if (selectedDate) {
      this.setData({
        selectedDate,
        currentMonth: selectedDate.slice(0, 7),
      });
    }
    this.generateScene();
    this.generateCalendarDays();
    await this.loadReminderConfig();
    await this.refreshReminderSubscriptionState();
    await this.initSharedCalendar();
  },

  async onShow() {
    await this.refreshReminderSubscriptionState();
    await this.loadAllMonthData();
  },

  toSubscribedMap(subscriptions = []) {
    const map = {};
    (subscriptions || []).forEach((item) => {
      const sourceId = String((item && item.sourceId) || '').trim();
      if (sourceId) {
        map[sourceId] = true;
      }
    });
    return map;
  },

  syncAnniversarySubscribeSummary(overrides = {}) {
    const anniversaries = Array.isArray(overrides.anniversaries) ? overrides.anniversaries : (this.data.anniversaries || []);
    const subscribedMap = overrides.anniversarySubscribedMap || this.data.anniversarySubscribedMap || {};
    const allSubscribed = anniversaries.length > 0 && anniversaries.every((item) => !!subscribedMap[String((item && item.id) || '').trim()]);
    this.setData({ anniversaryAllSubscribed: allSubscribed });
  },

  pickDefaultReminderOption(options = []) {
    const reminderOptions = Array.isArray(options) ? options : [];
    if (!reminderOptions.length) {
      return null;
    }
    const recommended = reminderOptions.find((item) => item && item.recommended);
    return recommended || reminderOptions[0];
  },

  decorateAnniversaryItem(item = {}) {
    const normalized = { ...item };
    if (normalized.type === 'milestone' && normalized.date) {
      const years = computeAnniversaryYears(normalized.date);
      if (years > 0) {
        normalized.anniversaryLabel = `${years}周年`;
      }
    }
    return normalized;
  },

  decorateAnniversaries(list = []) {
    return (Array.isArray(list) ? list : []).map((item) => this.decorateAnniversaryItem(item));
  },

  async refreshReminderSubscriptionState() {
    try {
      const [calendarRes, anniversaryRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'adminAuth',
          data: { action: 'listMyReminderSubscriptions', sourceType: 'calendar' },
        }),
        wx.cloud.callFunction({
          name: 'adminAuth',
          data: { action: 'listMyReminderSubscriptions', sourceType: 'anniversary' },
        }),
      ]);

      const calendarSubs = (calendarRes && calendarRes.result && calendarRes.result.subscriptions) || [];
      const anniversarySubs = (anniversaryRes && anniversaryRes.result && anniversaryRes.result.subscriptions) || [];

      const calendarSubscribedMap = this.toSubscribedMap(calendarSubs);
      const anniversarySubscribedMap = this.toSubscribedMap(anniversarySubs);

      this.setData({
        calendarSubscribedMap,
        anniversarySubscribedMap,
      });
      this.syncAnniversarySubscribeSummary({ anniversarySubscribedMap });
    } catch (error) {
      // silent
    }
  },

  async initSharedCalendar() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'getViewerIdentity' },
      });
      this.setData({
        viewerLabel: (result && (result.userLabel || result.personName)) || '',
      });
    } catch (error) {
      console.error('initSharedCalendar error:', error);
    }
    // Load calendar data after getting viewer identity
    await this.loadAllMonthData();
  },

  async loadReminderConfig() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'getReminderSubscribeConfig' },
      });
      this.setData({
        reminderConfig: (result && result.reminderConfig) || {
          anniversary: { enabled: false, templateId: '', options: [] },
          calendar: { enabled: false, templateId: '', options: [] },
        },
        anniversaries: this.decorateAnniversaries((result && result.reminderConfig && result.reminderConfig.anniversaries) || []),
      });
      this.syncAnniversarySubscribeSummary({
        anniversaries: this.decorateAnniversaries((result && result.reminderConfig && result.reminderConfig.anniversaries) || []),
      });
    } catch (error) {
      this.setData({
        reminderConfig: {
          anniversary: { enabled: false, templateId: '', options: [] },
          calendar: { enabled: false, templateId: '', options: [] },
        },
        anniversaries: [],
        anniversaryAllSubscribed: false,
      });
    }
  },

  async requestReminderSubscribe(sourceType, sourceId, options = []) {
    const config = (this.data.reminderConfig && this.data.reminderConfig[sourceType]) || {};
    const templateId = String(config.templateId || '').trim();
    const reminderOptions = Array.isArray(options) ? options : [];
    if (!templateId) {
      wx.showToast({ title: '请先配置提醒模板', icon: 'none' });
      return;
    }
    if (!sourceId || !reminderOptions.length) {
      wx.showToast({ title: '提醒配置不可用', icon: 'none' });
      return;
    }

    const pickedIndex = await new Promise((resolve) => {
      wx.showActionSheet({
        itemList: reminderOptions.map((item) => item.label),
        success: (res) => resolve(res.tapIndex),
        fail: () => resolve(-1),
      });
    });
    if (pickedIndex < 0 || !reminderOptions[pickedIndex]) {
      return;
    }
    const picked = reminderOptions[pickedIndex];

    let subscribeRes;
    try {
      subscribeRes = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: [templateId],
          success: resolve,
          fail: reject,
        });
      });
    } catch (error) {
      wx.showToast({ title: '订阅授权失败', icon: 'none' });
      return;
    }

    if (String(subscribeRes[templateId] || '') !== 'accept') {
      wx.showToast({ title: '未授权微信提醒', icon: 'none' });
      return;
    }

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'subscribeReminderNotification',
          sourceType,
          sourceId,
          reminderType: picked.value,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || '订阅失败');
      }
      if (sourceType === 'calendar' || sourceType === 'anniversary') {
        const mapKey = sourceType === 'calendar' ? 'calendarSubscribedMap' : 'anniversarySubscribedMap';
        this.setData({
          [`${mapKey}.${sourceId}`]: true,
        });
        if (sourceType === 'anniversary') {
          this.syncAnniversarySubscribeSummary();
        }
      }
      this.refreshReminderSubscriptionState();
      wx.showToast({ title: `已订阅${picked.label}`, icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '订阅失败', icon: 'none' });
    }
  },

  async chooseReminderOption(options = []) {
    const reminderOptions = Array.isArray(options) ? options : [];
    if (!reminderOptions.length) {
      return null;
    }
    const pickedIndex = await new Promise((resolve) => {
      wx.showActionSheet({
        itemList: reminderOptions.map((item) => item.label),
        success: (res) => resolve(res.tapIndex),
        fail: () => resolve(-1),
      });
    });
    return pickedIndex >= 0 && reminderOptions[pickedIndex] ? reminderOptions[pickedIndex] : null;
  },

  async requestTemplateConsent(templateId = '') {
    const finalTemplateId = String(templateId || '').trim();
    if (!finalTemplateId) {
      return false;
    }
    try {
      const subscribeRes = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: [finalTemplateId],
          success: resolve,
          fail: reject,
        });
      });
      return String(subscribeRes[finalTemplateId] || '') === 'accept';
    } catch (error) {
      return false;
    }
  },

  async testReminderSend(sourceType, sourceId, options = []) {
    const config = (this.data.reminderConfig && this.data.reminderConfig[sourceType]) || {};
    const templateId = String(config.templateId || '').trim();
    const picked = await this.chooseReminderOption(options);
    if (!picked) {
      return;
    }
    const accepted = await this.requestTemplateConsent(templateId);
    if (!accepted) {
      wx.showToast({ title: '未授权微信提醒', icon: 'none' });
      return;
    }
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'testSendReminderNotification',
          sourceType,
          sourceId,
          reminderType: picked.value,
        },
      });
      if (!(result && result.success)) {
        const debug = (result && result.debug) || {};
        const debugText = [
          result && result.error ? `error: ${result.error}` : '',
          debug.errCode !== undefined && debug.errCode !== null ? `errCode: ${debug.errCode}` : '',
          debug.errMsg ? `errMsg: ${debug.errMsg}` : '',
          debug.templateId ? `templateId: ${debug.templateId}` : '',
          debug.templatePayload ? `payload: ${JSON.stringify(debug.templatePayload)}` : '',
        ].filter(Boolean).join('\n');
        console.error('testReminderSend failed:', result);
        await new Promise((resolve) => {
          wx.showModal({
            title: '测试发送失败',
            content: debugText || '请检查云函数日志',
            showCancel: false,
            success: () => resolve(),
            fail: () => resolve(),
          });
        });
        return;
      }
      wx.showToast({ title: '测试已发送', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '测试发送失败', icon: 'none' });
    }
  },

  async subscribeCalendarReminder(event) {
    const sourceId = String(event.currentTarget.dataset.id || '').trim();
    const options = (((this.data.reminderConfig || {}).calendar || {}).options) || [];
    await this.requestReminderSubscribe('calendar', sourceId, options);
  },

  async testCalendarReminder(event) {
    const sourceId = String(event.currentTarget.dataset.id || '').trim();
    const options = (((this.data.reminderConfig || {}).calendar || {}).options) || [];
    await this.testReminderSend('calendar', sourceId, options);
  },

  async subscribeAnniversaryReminder(event) {
    const sourceId = String(event.currentTarget.dataset.id || '').trim();
    const options = (((this.data.reminderConfig || {}).anniversary || {}).options) || [];
    await this.requestReminderSubscribe('anniversary', sourceId, options);
  },

  async subscribeAllAnniversaryReminders() {
    const anniversaries = Array.isArray(this.data.anniversaries) ? this.data.anniversaries : [];
    if (!anniversaries.length) {
      wx.showToast({ title: '暂无可订阅纪念日', icon: 'none' });
      return;
    }
    if (this.data.anniversaryAllSubscribed) {
      wx.showToast({ title: '已全部订阅', icon: 'none' });
      return;
    }

    const config = (this.data.reminderConfig && this.data.reminderConfig.anniversary) || {};
    const templateId = String(config.templateId || '').trim();
    const picked = this.pickDefaultReminderOption(config.options || []);
    if (!templateId || !picked || !picked.value) {
      wx.showToast({ title: '提醒配置不可用', icon: 'none' });
      return;
    }

    const accepted = await this.requestTemplateConsent(templateId);
    if (!accepted) {
      wx.showToast({ title: '未授权微信提醒', icon: 'none' });
      return;
    }

    const nextMap = { ...(this.data.anniversarySubscribedMap || {}) };
    let successCount = 0;
    let failCount = 0;

    for (const item of anniversaries) {
      const sourceId = String((item && item.id) || '').trim();
      if (!sourceId || nextMap[sourceId]) {
        continue;
      }
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'adminAuth',
          data: {
            action: 'subscribeReminderNotification',
            sourceType: 'anniversary',
            sourceId,
            reminderType: picked.value,
          },
        });
        if (result && result.success) {
          nextMap[sourceId] = true;
          successCount += 1;
        } else {
          failCount += 1;
        }
      } catch (error) {
        failCount += 1;
      }
    }

    this.setData({ anniversarySubscribedMap: nextMap });
    this.syncAnniversarySubscribeSummary({ anniversarySubscribedMap: nextMap });
    this.refreshReminderSubscriptionState();

    if (successCount > 0 && failCount === 0) {
      wx.showToast({ title: `已订阅${successCount}项`, icon: 'success' });
      return;
    }
    if (successCount > 0) {
      wx.showToast({ title: `成功${successCount}项，失败${failCount}项`, icon: 'none' });
      return;
    }
    wx.showToast({ title: '订阅失败，请重试', icon: 'none' });
  },

  async testAnniversaryReminder(event) {
    const sourceId = String(event.currentTarget.dataset.id || '').trim();
    const options = (((this.data.reminderConfig || {}).anniversary || {}).options) || [];
    await this.testReminderSend('anniversary', sourceId, options);
  },

  generateCalendarDays() {
    const [year, month] = this.data.currentMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = formatDateToString(date);
      days.push({
        dateStr,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === month - 1,
        isToday: dateStr === getTodayString(),
        hasEvents: false, // will be updated after loading data
      });
    }

    this.setData({ calendarDays: days });
  },

  async loadAllMonthData() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'listSharedCalendarMonth',
          yearMonth: this.data.currentMonth,
          limit: 300,
        },
      });

      console.log('loadAllMonthData result:', result);

      if (!result) {
        throw new Error('服务器无响应');
      }

      if (result.error) {
        throw new Error(result.error);
      }

      // Count events by date
      const daysWithEvents = {};
      (result.calendarList || []).forEach(item => {
        if (!daysWithEvents[item.date]) {
          daysWithEvents[item.date] = 0;
        }
        daysWithEvents[item.date]++;
      });

      // Update calendar days to mark which have events
      const updatedDays = this.data.calendarDays.map(day => ({
        ...day,
        hasEvents: !!daysWithEvents[day.dateStr],
      }));

      this.setData({
        daysWithEvents,
        calendarDays: updatedDays,
      });

      // Load today's or selected date's events
      await this.loadSharedCalendar();
    } catch (error) {
      console.error('loadAllMonthData error:', error);
      wx.showToast({ title: `加载日历失败: ${error.message}`, icon: 'none' });
    }
  },

  async loadSharedCalendar() {
    this.setData({ calendarLoading: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'listSharedCalendar',
          date: this.data.selectedDate,
          limit: 120,
          skip: 0,
        },
      });

      if (!result) {
        throw new Error('服务器无响应');
      }

      if (result.error) {
        throw new Error(result.error);
      }
      const calendarList = (result.calendarList || []).map((item) => ({
        ...item,
        createdAtText: formatDateTime(item.createdAt),
        displayUser: item.userLabel || '用户',
      }));

      this.setData({
        calendarList,
        calendarCount: Number(result.calendarCount) || calendarList.length,
        calendarLoading: false,
      });
    } catch (error) {
      console.error('loadSharedCalendar error:', error);
      this.setData({ calendarLoading: false });
      wx.showToast({ title: `加载失败: ${error.message}`, icon: 'none' });
    }
  },

  onSelectDate(event) {
    const dateStr = String(event.currentTarget.dataset.date || '').trim();
    if (!dateStr) {
      return;
    }
    this.setData({ selectedDate: dateStr });
    this.loadSharedCalendar();
  },

  prevMonth() {
    const [year, month] = this.data.currentMonth.split('-').map(Number);
    const prev = new Date(year, month - 2, 1);
    const newMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    this.setData({ currentMonth: newMonth });
    this.generateCalendarDays();
    this.loadAllMonthData();
  },

  nextMonth() {
    const [year, month] = this.data.currentMonth.split('-').map(Number);
    const next = new Date(year, month, 1);
    const newMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    this.setData({ currentMonth: newMonth });
    this.generateCalendarDays();
    this.loadAllMonthData();
  },

  onTitleInput(event) {
    this.setData({ eventTitle: event.detail.value });
  },

  onNoteInput(event) {
    this.setData({ eventNote: event.detail.value });
  },

  async addCalendarItem() {
    if (this.data.adding) {
      return;
    }

    const date = String(this.data.selectedDate || '').trim();
    const title = String(this.data.eventTitle || '').trim();
    const note = String(this.data.eventNote || '').trim();
    if (!date) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    if (!title && !note) {
      wx.showToast({ title: '请填写标题或备注', icon: 'none' });
      return;
    }

    this.setData({ adding: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'addSharedCalendar',
          date,
          title,
          note,
        },
      });

      console.log('addCalendarItem result:', JSON.stringify(result));

      if (!result || !result.success) {
        throw new Error((result && result.error) || '新增失败');
      }

      this.setData({
        adding: false,
        eventTitle: '',
        eventNote: '',
      });
      wx.showToast({ title: '已添加', icon: 'success' });
      await this.loadAllMonthData();
    } catch (error) {
      this.setData({ adding: false });
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  async checkCalendarItemExists(id) {
    const docId = String(id || '').trim();
    if (!docId) {
      return null;
    }
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'listSharedCalendar',
          limit: 120,
        },
      });
      const list = (result && result.calendarList) || [];
      return list.some((item) => String((item && item._id) || '').trim() === docId);
    } catch (error) {
      return null;
    }
  },

  deleteCalendarItem(event) {
    const id = String(event.currentTarget.dataset.id || '');
    if (!id) {
      return;
    }

    wx.showModal({
      title: '删除日历事项',
      content: '确认删除这条日历事项吗？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        this.setData({ deletingId: id });
        try {
          const { result } = await wx.cloud.callFunction({
            name: 'adminAuth',
            data: {
              action: 'deleteSharedCalendar',
              id,
            },
          });
          if (!result || !result.success) {
            throw new Error((result && result.error) || '删除失败');
          }

          this.setData({ deletingId: '' });
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.loadAllMonthData();
        } catch (error) {
          const stillExists = await this.checkCalendarItemExists(id);
          this.setData({ deletingId: '' });
          if (stillExists === false) {
            wx.showToast({ title: '已删除', icon: 'success' });
            await this.loadAllMonthData();
            return;
          }
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  generateScene() {
    const stars = Array.from({ length: 140 }).map((_, id) => {
      const [c, g, alpha] = STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)];
      const glow = rand(4, 12).toFixed(1);
      const colorStyle = `background: radial-gradient(circle, rgba(${c},0.98) 0%, rgba(${c},0.1) 80%); box-shadow: 0 0 ${glow}rpx rgba(${g},${alpha});`;
      return {
        id,
        size: rand(2.5, 10).toFixed(1),
        left: rand(0, 100).toFixed(2),
        top: rand(0, 88).toFixed(2),
        delay: rand(0, 8).toFixed(2),
        duration: rand(2.8, 8).toFixed(2),
        colorStyle
      };
    });

    const meteorCount = Math.floor(rand(10, 20));
    const meteors = Array.from({ length: meteorCount }).map((_, id) => {
      const [head, glow, alpha] = METEOR_PALETTE[Math.floor(Math.random() * METEOR_PALETTE.length)];
      const tailSoftness = rand(0.24, 0.42).toFixed(2);
      return {
        id,
        left: rand(-30, 108).toFixed(2),
        top: rand(-36, 104).toFixed(2),
        delay: rand(0, 28).toFixed(2),
        duration: rand(22, 30).toFixed(2),
        tail: rand(140, 320).toFixed(0),
        angle: rand(34, 66).toFixed(1),
        scale: rand(0.4, 1.8).toFixed(2),
        opacity: rand(0.3, 0.72).toFixed(2),
        tailStyle: `background: linear-gradient(90deg, rgba(${head},0) 0%, rgba(${glow},${tailSoftness}) 35%, rgba(${head},0.88) 100%); box-shadow: 0 0 12rpx rgba(${glow},${alpha});`,
        glowStyle: `background: radial-gradient(circle, rgba(${head},0.88) 0%, rgba(${glow},${alpha}) 52%, rgba(${head},0) 100%);`,
        headStyle: `background: radial-gradient(circle, rgba(${head},1) 0%, rgba(${head},0.7) 60%, rgba(${head},0.16) 100%); box-shadow: 0 0 12rpx rgba(${glow},${alpha});`
      };
    });

    const sparkles = Array.from({ length: 28 }).map((_, id) => ({
      id,
      left: rand(4, 96).toFixed(2),
      top: rand(6, 90).toFixed(2),
      size: rand(3.5, 9).toFixed(1),
      delay: rand(0, 7).toFixed(2),
      duration: rand(2, 4.6).toFixed(2),
      opacity: rand(0.16, 0.72).toFixed(2)
    }));

    this.setData({ stars, meteors, sparkles });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
