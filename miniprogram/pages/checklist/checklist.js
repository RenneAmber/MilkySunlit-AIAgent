function showErrorToast(error, fallback = '操作失败') {
  const msg = String((error && error.message) || fallback).trim();
  wx.showToast({
    title: msg.slice(0, 20) || fallback,
    icon: 'none',
  });
}

Page({
  data: {
    list: [],
    loading: false,
    adding: false,
    newTitle: '',
    newExpectedDate: '',
    itemDrafts: {}, // { [checklistId]: { content, blocker } }
    expandedMap: {}, // { [checklistId]: true }
    showDoneMap: {}, // { [checklistId]: true } 默认隐藏已完成
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'listSharedChecklists' },
      });
      if (result && result.error) {
        showErrorToast({ message: result.error }, '加载失败');
      }
      const list = ((result && result.checklistList) || []).map((item) => this.decorateChecklist(item));
      this.setData({ list });
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  decorateChecklist(item = {}) {
    const itemCount = Number(item.itemCount || 0);
    const doneCount = Number(item.doneCount || 0);
    const percent = itemCount ? Math.round((doneCount / itemCount) * 100) : 0;
    const expanded = !!(this.data.expandedMap && this.data.expandedMap[item.id]);
    const showDone = !!(this.data.showDoneMap && this.data.showDoneMap[item.id]);
    const allItems = Array.isArray(item.items) ? item.items : [];
    const visibleItems = showDone ? allItems : allItems.filter((it) => !it.done);
    const hiddenDoneCount = allItems.length - visibleItems.length;
    return {
      ...item,
      progressText: itemCount ? `${doneCount}/${itemCount} 已完成（${percent}%）` : '暂无事项',
      progressPercent: percent,
      allDone: itemCount > 0 && doneCount === itemCount,
      expanded,
      showDone,
      visibleItems,
      hiddenDoneCount,
    };
  },

  refreshDecorations() {
    const list = (this.data.list || []).map((item) => this.decorateChecklist(item));
    this.setData({ list });
  },

  toggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const expandedMap = { ...this.data.expandedMap };
    expandedMap[id] = !expandedMap[id];
    this.setData({ expandedMap }, () => this.refreshDecorations());
  },

  toggleShowDone(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const showDoneMap = { ...this.data.showDoneMap };
    showDoneMap[id] = !showDoneMap[id];
    this.setData({ showDoneMap }, () => this.refreshDecorations());
  },

  replaceChecklistInList(updated) {
    if (!updated || !updated.id) {
      return;
    }
    const decorated = this.decorateChecklist(updated);
    const list = this.data.list.map((it) => (it.id === updated.id ? decorated : it));
    this.setData({ list });
  },

  onInputNewTitle(e) {
    this.setData({ newTitle: e.detail.value });
  },

  onNewDateChange(e) {
    this.setData({ newExpectedDate: e.detail.value });
  },

  async createChecklist() {
    const title = String(this.data.newTitle || '').trim();
    if (!title) {
      wx.showToast({ title: '请填写清单标题', icon: 'none' });
      return;
    }
    if (this.data.adding) return;
    this.setData({ adding: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'addSharedChecklist',
          title,
          expectedDate: this.data.newExpectedDate || '',
        },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '创建失败');
        return;
      }
      const decorated = this.decorateChecklist(result.item);
      this.setData({
        list: [decorated, ...this.data.list],
        newTitle: '',
        newExpectedDate: '',
        expandedMap: { ...this.data.expandedMap, [result.item.id]: true },
      });
      wx.showToast({ title: '已创建', icon: 'success' });
    } catch (error) {
      showErrorToast(error, '创建失败');
    } finally {
      this.setData({ adding: false });
    }
  },

  async deleteChecklist(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const confirm = await wx.showModal({
      title: '删除清单',
      content: '清单和其中的所有事项都将被删除，确认删除？',
      confirmText: '删除',
      confirmColor: '#c0392b',
    });
    if (!confirm.confirm) return;
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'deleteSharedChecklist', id },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '删除失败');
        return;
      }
      this.setData({
        list: this.data.list.filter((it) => it.id !== id),
      });
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (error) {
      showErrorToast(error, '删除失败');
    }
  },

  async editChecklistTitle(e) {
    const id = e.currentTarget.dataset.id;
    const current = this.data.list.find((it) => it.id === id);
    if (!current) return;
    const res = await wx.showModal({
      title: '修改标题',
      editable: true,
      placeholderText: '清单标题',
      content: current.title || '',
    });
    if (!res.confirm) return;
    const title = String(res.content || '').trim();
    if (!title) {
      wx.showToast({ title: '标题不能为空', icon: 'none' });
      return;
    }
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'updateSharedChecklist', id, title },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '更新失败');
        return;
      }
      this.replaceChecklistInList(result.item);
    } catch (error) {
      showErrorToast(error, '更新失败');
    }
  },

  async editChecklistDate(e) {
    const id = e.currentTarget.dataset.id;
    const expectedDate = e.detail.value || '';
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'updateSharedChecklist', id, expectedDate },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '更新失败');
        return;
      }
      this.replaceChecklistInList(result.item);
    } catch (error) {
      showErrorToast(error, '更新失败');
    }
  },

  onDraftContentInput(e) {
    const id = e.currentTarget.dataset.id;
    const drafts = { ...this.data.itemDrafts };
    drafts[id] = { ...(drafts[id] || {}), content: e.detail.value };
    this.setData({ itemDrafts: drafts });
  },

  onDraftBlockerInput(e) {
    const id = e.currentTarget.dataset.id;
    const drafts = { ...this.data.itemDrafts };
    drafts[id] = { ...(drafts[id] || {}), blocker: e.detail.value };
    this.setData({ itemDrafts: drafts });
  },

  async addItem(e) {
    const id = e.currentTarget.dataset.id;
    const draft = this.data.itemDrafts[id] || {};
    const content = String(draft.content || '').trim();
    const blocker = String(draft.blocker || '').trim();
    if (!content) {
      wx.showToast({ title: '请填写要完成的事项', icon: 'none' });
      return;
    }
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'addChecklistItem', id, content, blocker },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '添加失败');
        return;
      }
      this.replaceChecklistInList(result.item);
      const drafts = { ...this.data.itemDrafts };
      delete drafts[id];
      this.setData({ itemDrafts: drafts });
    } catch (error) {
      showErrorToast(error, '添加失败');
    }
  },

  async toggleItemDone(e) {
    const { id, itemId } = e.currentTarget.dataset;
    const checklist = this.data.list.find((it) => it.id === id);
    if (!checklist) return;
    const target = (checklist.items || []).find((it) => it.id === itemId);
    if (!target) return;
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'updateChecklistItem',
          id,
          itemId,
          done: !target.done,
        },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '更新失败');
        return;
      }
      this.replaceChecklistInList(result.item);
    } catch (error) {
      showErrorToast(error, '更新失败');
    }
  },

  async editItemContent(e) {
    const { id, itemId } = e.currentTarget.dataset;
    const checklist = this.data.list.find((it) => it.id === id);
    const target = checklist && (checklist.items || []).find((it) => it.id === itemId);
    if (!target) return;
    const res = await wx.showModal({
      title: '修改事项',
      editable: true,
      placeholderText: '要完成的事情',
      content: target.content || '',
    });
    if (!res.confirm) return;
    const content = String(res.content || '').trim();
    if (!content) {
      wx.showToast({ title: '内容不能为空', icon: 'none' });
      return;
    }
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'updateChecklistItem', id, itemId, content },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '更新失败');
        return;
      }
      this.replaceChecklistInList(result.item);
    } catch (error) {
      showErrorToast(error, '更新失败');
    }
  },

  async editItemBlocker(e) {
    const { id, itemId } = e.currentTarget.dataset;
    const checklist = this.data.list.find((it) => it.id === id);
    const target = checklist && (checklist.items || []).find((it) => it.id === itemId);
    if (!target) return;
    const res = await wx.showModal({
      title: '修改限制',
      editable: true,
      placeholderText: '限制条件 / 去哪里买（可为空）',
      content: target.blocker || '',
    });
    if (!res.confirm) return;
    const blocker = String(res.content || '').trim();
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'updateChecklistItem', id, itemId, blocker },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '更新失败');
        return;
      }
      this.replaceChecklistInList(result.item);
    } catch (error) {
      showErrorToast(error, '更新失败');
    }
  },

  async deleteItem(e) {
    const { id, itemId } = e.currentTarget.dataset;
    const confirm = await wx.showModal({
      title: '删除事项',
      content: '确认删除该事项？',
      confirmText: '删除',
      confirmColor: '#c0392b',
    });
    if (!confirm.confirm) return;
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'deleteChecklistItem', id, itemId },
      });
      if (!result || !result.success) {
        showErrorToast({ message: (result && result.error) || '' }, '删除失败');
        return;
      }
      this.replaceChecklistInList(result.item);
    } catch (error) {
      showErrorToast(error, '删除失败');
    }
  },
});
