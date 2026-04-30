function rand(min, max) {
  return Math.random() * (max - min) + min;
}

const UPCOMING_SUMMARY_CACHE_KEY = 'upcomingSummaryCache';
const UPCOMING_SUMMARY_CACHE_TTL = 60 * 60 * 1000;
const UPCOMING_SUMMARY_CACHE_VERSION = 2;

const STAR_PALETTE = [
  ['255,255,255', '200,220,255', 0.7],
  ['255,255,255', '255,255,255', 0.65],
  ['155,120,255', '155,120,255', 0.68],
  ['100,140,255', '100,140,255', 0.7],
  ['210,80,100', '210,80,100', 0.62],
  ['80,200,255', '80,200,255', 0.68],
  ['200,120,255', '200,120,255', 0.65],
];

const METEOR_PALETTE = [
  ['210,220,255', '160,165,255', 0.62],
  ['225,235,255', '140,180,255', 0.58],
  ['210,190,255', '150,120,235', 0.56],
  ['250,220,240', '180,110,170', 0.52],
];

Page({
  data: {
    diaryList: [],
    stars: [],
    meteors: [],
    sparkles: [],
    modelExpand: false,
    isAdmin: false,
    activeOverviewTab: "diary",
    upcomingRange: "next",
    upcomingRefreshing: false,
    upcomingCalendarList: [],
    upcomingBookkeepingList: [],
    rawCalendarList: [],
    rawBookkeepingList: []
  },

  onLoad() {
    this.generateScene();
    this.checkAdmin();
  },

  onShow() {
    const diaryList = this.normalizeDiaryList(wx.getStorageSync('diaryList') || []);
    this.setData({ diaryList });
    this.loadUpcomingSummary();
  },

  normalizeTags(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
    }
    return String(value || '')
      .split(/[,，;；\s]+/)
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 8);
  },

  normalizeDiaryList(list = []) {
    return (list || []).map((item) => ({
      ...item,
      tags: this.normalizeTags(item.tags),
    }));
  },

  getTodayDateText() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getDateOffsetText(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  pickNextCalendarItem(calendarList = []) {
    const today = this.getTodayDateText();
    const future = (calendarList || [])
      .filter((item) => String(item.date || '') >= today)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    return future[0] || null;
  },

  pickNextBookkeepingItem(bookkeepingList = []) {
    const pending = (bookkeepingList || [])
      .filter((item) => Number(item.outstandingAmount || 0) > 0)
      .sort((a, b) => String(a.promiseDate || '').localeCompare(String(b.promiseDate || '')));
    return pending[0] || null;
  },

  formatCalendarDisplayItem(item = {}) {
    const title = String(item.title || '').trim() || '日程';
    const note = String(item.note || '').trim();
    return {
      id: String(item.id || item._id || `${item.date}-${title}`).trim(),
      date: String(item.date || '').trim(),
      title,
      detail: note || '无备注',
    };
  },

  formatBookkeepingDisplayItem(item = {}) {
    const fromName = String(item.fromName || '').trim() || '转出人';
    const toName = String(item.toName || '').trim() || '收款人';
    const amount = Number(item.outstandingAmount || 0);
    return {
      id: String(item.id || item._id || `${item.promiseDate}-${item.purchaseItem}`).trim(),
      date: String(item.promiseDate || '').trim() || '未定日期',
      title: String(item.purchaseItem || '').trim() || '账单',
      detail: `${toName}还${fromName} ¥${amount}${item.overdue ? '（已超期）' : ''}`,
    };
  },

  filterUpcomingCalendarItems(calendarList = [], range = 'next') {
    const today = this.getTodayDateText();
    const future = (calendarList || [])
      .filter((item) => String(item.date || '') >= today)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    if (range === 'next') {
      return future.slice(0, 1).map((item) => this.formatCalendarDisplayItem(item));
    }

    const limitDate = range === 'day' ? this.getDateOffsetText(1) : range === 'week' ? this.getDateOffsetText(7) : this.getDateOffsetText(30);
    return future
      .filter((item) => String(item.date || '') <= limitDate)
      .slice(0, 12)
      .map((item) => this.formatCalendarDisplayItem(item));
  },

  filterUpcomingBookkeepingItems(bookkeepingList = [], range = 'next') {
    const today = this.getTodayDateText();
    const pending = (bookkeepingList || [])
      .filter((item) => Number(item.outstandingAmount || 0) > 0)
      .filter((item) => String(item.promiseDate || '9999-12-31') >= today)
      .sort((a, b) => String(a.promiseDate || '').localeCompare(String(b.promiseDate || '')));

    if (range === 'next') {
      return pending.slice(0, 1).map((item) => this.formatBookkeepingDisplayItem(item));
    }

    const limitDate = range === 'day' ? this.getDateOffsetText(1) : range === 'week' ? this.getDateOffsetText(7) : this.getDateOffsetText(30);
    return pending
      .filter((item) => String(item.promiseDate || '9999-12-31') <= limitDate)
      .slice(0, 12)
      .map((item) => this.formatBookkeepingDisplayItem(item));
  },

  updateUpcomingDisplay(range = this.data.upcomingRange, calendarList = this.data.rawCalendarList, bookkeepingList = this.data.rawBookkeepingList) {
    this.setData({
      upcomingRange: range,
      upcomingCalendarList: this.filterUpcomingCalendarItems(calendarList, range),
      upcomingBookkeepingList: this.filterUpcomingBookkeepingItems(bookkeepingList, range),
    });
  },

  getUpcomingSummaryCache() {
    try {
      const cache = wx.getStorageSync(UPCOMING_SUMMARY_CACHE_KEY);
      if (!cache || typeof cache !== 'object') {
        return null;
      }
      if (Number(cache.version || 0) !== UPCOMING_SUMMARY_CACHE_VERSION) {
        return null;
      }
      const cachedAt = Number(cache.cachedAt || 0);
      if (!cachedAt) {
        return null;
      }
      return {
        cachedAt,
        calendarList: Array.isArray(cache.calendarList) ? cache.calendarList : [],
        bookkeepingList: Array.isArray(cache.bookkeepingList) ? cache.bookkeepingList : [],
      };
    } catch (error) {
      return null;
    }
  },

  setUpcomingSummaryCache(calendarList = [], bookkeepingList = []) {
    try {
      wx.setStorageSync(UPCOMING_SUMMARY_CACHE_KEY, {
        version: UPCOMING_SUMMARY_CACHE_VERSION,
        cachedAt: Date.now(),
        calendarList,
        bookkeepingList,
      });
    } catch (error) {
      // Ignore cache write failures to avoid affecting page rendering.
    }
  },

  clearUpcomingSummaryCache() {
    try {
      wx.removeStorageSync(UPCOMING_SUMMARY_CACHE_KEY);
    } catch (error) {
      // Ignore cache clear failures to avoid affecting page rendering.
    }
  },

  async loadUpcomingSummary(options = {}) {
    const forceRefresh = !!(options && options.forceRefresh);
    const cache = forceRefresh ? null : this.getUpcomingSummaryCache();
    const now = Date.now();
    if (cache && now - cache.cachedAt < UPCOMING_SUMMARY_CACHE_TTL) {
      this.setData({
        rawCalendarList: cache.calendarList,
        rawBookkeepingList: cache.bookkeepingList,
      });
      this.updateUpcomingDisplay(this.data.upcomingRange, cache.calendarList, cache.bookkeepingList);
      return;
    }

    try {
      const [calendarRes, bookkeepingRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'adminAuth',
          data: {
            action: 'listSharedCalendar',
            limit: 80,
            skip: 0,
          },
        }),
        wx.cloud.callFunction({
          name: 'adminAuth',
          data: {
            action: 'listSharedBookkeeping',
            limit: 80,
          },
        }),
      ]);

      const calendarList = (calendarRes && calendarRes.result && calendarRes.result.calendarList) || [];
      const bookkeepingList = (bookkeepingRes && bookkeepingRes.result && bookkeepingRes.result.bookkeepingList) || [];

      this.setData({
        rawCalendarList: calendarList,
        rawBookkeepingList: bookkeepingList,
      });
      this.setUpcomingSummaryCache(calendarList, bookkeepingList);
      this.updateUpcomingDisplay(this.data.upcomingRange, calendarList, bookkeepingList);
    } catch (error) {
      if (cache) {
        this.setData({
          rawCalendarList: cache.calendarList,
          rawBookkeepingList: cache.bookkeepingList,
        });
        this.updateUpcomingDisplay(this.data.upcomingRange, cache.calendarList, cache.bookkeepingList);
      } else {
        this.setData({
          rawCalendarList: [],
          rawBookkeepingList: [],
          upcomingCalendarList: [],
          upcomingBookkeepingList: [],
        });
      }
    }
  },

  async refreshUpcomingSummary() {
    if (this.data.upcomingRefreshing) {
      return;
    }
    this.setData({ upcomingRefreshing: true });
    this.clearUpcomingSummaryCache();
    try {
      await this.loadUpcomingSummary({ forceRefresh: true });
      wx.showToast({
        title: '已刷新',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
      });
    } finally {
      this.setData({ upcomingRefreshing: false });
    }
  },

  generateScene() {
    const stars = Array.from({ length: 120 }).map((_, id) => {
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

    const meteorCount = Math.floor(rand(8, 18));
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

    const sparkles = Array.from({ length: 24 }).map((_, id) => ({
      id,
      left: rand(6, 94).toFixed(2),
      top: rand(8, 90).toFixed(2),
      size: rand(3.5, 9).toFixed(1),
      delay: rand(0, 7).toFixed(2),
      duration: rand(2, 4.6).toFixed(2),
      opacity: rand(0.16, 0.72).toFixed(2)
    }));

    this.setData({ stars, meteors, sparkles });
  },

  async checkAdmin() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'check' }
      });
      this.setData({ isAdmin: !!(result && result.isAdmin) });
    } catch (error) {
      this.setData({ isAdmin: false });
    }
  },

  goAdmin() {
    wx.navigateTo({
      url: '/pages/admin/admin'
    });
  },

  expandAgent() {
    this.setData({ agentExpand: !this.data.agentExpand });
  },

  expandModel() {
    this.setData({ modelExpand: !this.data.modelExpand });
  },

  switchOverviewTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeOverviewTab) {
      return;
    }
    this.setData({ activeOverviewTab: tab });
  },

  switchUpcomingRange(e) {
    const range = e.currentTarget.dataset.range;
    if (!range || range === this.data.upcomingRange) {
      return;
    }
    this.updateUpcomingDisplay(range);
  },

  goChatBot() {
    wx.navigateTo({
      url: '/pages/chatBot/chatBot',
    });
  },

  goChatValentine() {
    wx.navigateTo({
      url: '/pages/chinese-valentine/chinese-valentine',
    });
  },

  goLove() {
    wx.navigateTo({
      url: '/pages/love/love',
    });
  },

  goToHistoryDiary() {
    wx.navigateTo({
      url: '/pages/history-diary/history-diary'
    });
  },

  goBookkeeping() {
    wx.navigateTo({
      url: '/pages/bookkeeping/bookkeeping'
    });
  },

  goRecipes() {
    wx.navigateTo({
      url: '/pages/recipes/recipes'
    });
  },

  goChecklist() {
    wx.navigateTo({
      url: '/pages/checklist/checklist'
    });
  },

  scrollToAnchor(e) {
    const anchorId = e.currentTarget.dataset.anchor;
    const query = wx.createSelectorQuery();
    query.select('#' + anchorId).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      if (res[0]) {
        const scrollTop = res[1].scrollTop + res[0].top;
        wx.pageScrollTo({
          scrollTop,
          duration: 300,
        });
      }
    });
  },

  copyUrl() {
    wx.setClipboardData({
      data: 'https://tcb.cloud.tencent.com/dev',
      success() {
        wx.showToast({
          title: '链接复制成功',
          icon: 'success',
        });
      },
      fail() {
        wx.showToast({
          title: '复制失败',
          icon: 'none',
        });
      },
    });
  },
});
