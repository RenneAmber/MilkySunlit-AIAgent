function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.round(num * 100) / 100;
}

function formatTimeText(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function showErrorToast(error, fallback = "操作失败") {
  const msg = String((error && error.message) || fallback).trim();
  wx.showToast({
    title: msg.slice(0, 20) || fallback,
    icon: "none",
  });
}

Page({
  data: {
    list: [],
    loading: false,
    adding: false,
    hasReminderSubscription: false,
    reminderConfig: {
      bookkeeping: {
        enabled: false,
        templateId: '',
        options: [],
      },
    },
    viewerIdentity: {},
    fromName: "孙励天",
    toName: "宋陶颖",
    transferAmount: "",
    purchaseItem: "",
    promiseDate: "",
    promiseAmount: "",
  },

  onShow() {
    this.loadReminderConfig();
    this.checkReminderSubscription();
    this.loadViewerIdentity();
    this.loadList();
  },

  async loadReminderConfig() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'getReminderSubscribeConfig' },
      });
      this.setData({
        reminderConfig: (result && result.reminderConfig) || {
          bookkeeping: { enabled: false, templateId: '', options: [] },
        },
      });
    } catch (error) {
      this.setData({
        reminderConfig: {
          bookkeeping: { enabled: false, templateId: '', options: [] },
        },
      });
    }
  },

  async checkReminderSubscription() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'listMyReminderSubscriptions', sourceType: 'bookkeeping' },
      });
      this.setData({ hasReminderSubscription: !!(result && result.hasAny) });
    } catch (e) {
      // silent
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
      wx.showToast({ title: `已订阅${picked.label}`, icon: 'success' });
      this.checkReminderSubscription();
    } catch (error) {
      showErrorToast(error, '订阅失败');
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
        throw new Error((result && result.error) || '测试发送失败');
      }
      wx.showToast({ title: '测试已发送', icon: 'success' });
    } catch (error) {
      showErrorToast(error, '测试发送失败');
    }
  },

  async subscribeBookkeepingReminder(e) {
    const id = String(e.currentTarget.dataset.id || '').trim();
    const options = (((this.data.reminderConfig || {}).bookkeeping || {}).options) || [];
    await this.requestReminderSubscribe('bookkeeping', id, options);
  },

  async testBookkeepingReminder(e) {
    const id = String(e.currentTarget.dataset.id || '').trim();
    const options = (((this.data.reminderConfig || {}).bookkeeping || {}).options) || [];
    await this.testReminderSend('bookkeeping', id, options);
  },

  async loadViewerIdentity() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: { action: "getViewerIdentity" },
      });
      this.setData({ viewerIdentity: result || {} });
    } catch (error) {
      this.setData({ viewerIdentity: {} });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ promiseDate: e.detail.value });
  },

  clearUpcomingSummaryCache() {
    try {
      wx.removeStorageSync('upcomingSummaryCache');
    } catch (error) {
      // Ignore cache clear failures
    }
  },

  normalizeBookkeepingList(list = []) {
    return (list || []).map((item) => ({
      ...item,
      createdAtText: formatTimeText(item.createdAt),
    }));
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "listSharedBookkeeping",
          limit: 100,
        },
      });
      this.setData({
        list: this.normalizeBookkeepingList((result && result.bookkeepingList) || []),
      });
    } catch (error) {
      showErrorToast(error, "加载失败");
    } finally {
      this.setData({ loading: false });
    }
  },

  async checkBillExists(id) {
    const docId = String(id || '').trim();
    if (!docId) {
      return null;
    }
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'listSharedBookkeeping',
          limit: 100,
        },
      });
      const list = (result && result.bookkeepingList) || [];
      return list.some((item) => String(item.id || item._id || '').trim() === docId);
    } catch (error) {
      return null;
    }
  },

  async addItem() {
    const transferAmount = formatMoney(this.data.transferAmount);
    const promiseAmount = formatMoney(this.data.promiseAmount || transferAmount);
    const purchaseItem = String(this.data.purchaseItem || "").trim();
    const promiseDate = String(this.data.promiseDate || "").trim();

    if (!transferAmount || !purchaseItem || !promiseDate) {
      wx.showToast({ title: "请填写金额/用途/归还日期", icon: "none" });
      return;
    }

    this.setData({ adding: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "addSharedBookkeeping",
          fromName: this.data.fromName,
          toName: this.data.toName,
          transferAmount,
          purchaseItem,
          promiseDate,
          promiseAmount,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || "新增失败");
      }
      wx.showToast({ title: "已新增", icon: "success" });
      this.clearUpcomingSummaryCache();
      this.setData({
        transferAmount: "",
        purchaseItem: "",
        promiseDate: "",
        promiseAmount: "",
      });
      await this.loadList();
    } catch (error) {
      showErrorToast(error, "新增失败");
    } finally {
      this.setData({ adding: false });
    }
  },

  async deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const { confirm } = await wx.showModal({
      title: "确认删除",
      content: "删除后不可恢复，继续吗？",
    });
    if (!confirm) return;

    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "deleteSharedBookkeeping",
          id,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || "删除失败");
      }
      wx.showToast({ title: "已删除", icon: "success" });
      this.clearUpcomingSummaryCache();
      await this.loadList();
    } catch (error) {
      // If the network fails after backend deletion, verify current state to avoid false error prompts.
      const stillExists = await this.checkBillExists(id);
      if (stillExists === false) {
        wx.showToast({ title: "已删除", icon: "success" });
        this.clearUpcomingSummaryCache();
        await this.loadList();
        return;
      }
      showErrorToast(error, "删除失败");
    }
  },

  async editPromiseDate(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const picked = await new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ["今天", "明天", "后天", "手动输入"],
        success: (res) => resolve(res.tapIndex),
        fail: () => resolve(-1),
      });
    });

    if (picked < 0) return;

    const toDateText = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    let promiseDate = "";
    if (picked <= 2) {
      promiseDate = toDateText(picked);
    } else {
      const res = await wx.showModal({
        title: "修改承诺日期",
        content: "请输入 YYYY-MM-DD",
        editable: true,
        placeholderText: "2026-05-20",
      });
      if (!res.confirm) return;
      promiseDate = String(res.content || "").trim();
    }

    if (!promiseDate) return;

    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "updateSharedBookkeeping",
          id,
          promiseDate,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || "修改失败");
      }
      wx.showToast({ title: "已修改日期", icon: "success" });
      this.clearUpcomingSummaryCache();
      await this.loadList();
    } catch (error) {
      showErrorToast(error, "修改失败");
    }
  },

  async editPromiseAmount(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const res = await wx.showModal({
      title: "修改承诺金额",
      content: "请输入金额",
      editable: true,
      placeholderText: "2800",
    });
    if (!res.confirm) return;
    const promiseAmount = formatMoney(res.content);
    if (!promiseAmount) {
      wx.showToast({ title: "金额无效", icon: "none" });
      return;
    }

    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "updateSharedBookkeeping",
          id,
          promiseAmount,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || "修改失败");
      }
      wx.showToast({ title: "已修改金额", icon: "success" });
      this.clearUpcomingSummaryCache();
      await this.loadList();
    } catch (error) {
      showErrorToast(error, "修改失败");
    }
  },

  async suggestPenalty(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const res = await wx.showModal({
      title: "新增惩罚措施",
      content: "请输入惩罚措施",
      editable: true,
      placeholderText: "如 周末家务全包",
    });
    if (!res.confirm) return;
    const suggestion = String(res.content || "").trim();
    if (!suggestion) {
      wx.showToast({ title: "请填写惩罚措施", icon: "none" });
      return;
    }
    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "suggestSharedPenalty",
          id,
          suggestion,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || "提议失败");
      }
      wx.showToast({ title: "已发起提议", icon: "success" });
      this.clearUpcomingSummaryCache();
      await this.loadList();
    } catch (error) {
      showErrorToast(error, "提议失败");
    }
  },

  async decidePenalty(e) {
    const id = e.currentTarget.dataset.id;
    const decision = e.currentTarget.dataset.decision;
    if (!id || !decision) return;
    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "decideSharedPenalty",
          id,
          decision,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || "签署失败");
      }
      wx.showToast({ title: decision === "accept" ? "已同意" : "已拒绝", icon: "success" });
      this.clearUpcomingSummaryCache();
      await this.loadList();
    } catch (error) {
      showErrorToast(error, "签署失败");
    }
  },
});
