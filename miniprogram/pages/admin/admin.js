Page({
  data: {
    loading: true,
    isAdmin: false,
    envId: '',
    pageSize: 20,
    userFilterOptions: ['all', '宋陶颖', '孙励天'],
    selectedUserFilter: 'all',
    diaryList: [],
    diaryCount: 0,
    diarySkip: 0,
    diaryHasMore: false,
    diaryLoadingMore: false,
    chatLogList: [],
    chatLogCount: 0,
    chatLogSkip: 0,
    chatLogHasMore: false,
    chatLogLoadingMore: false,
    chatErrorCount: 0,
    loadErrors: [],
    detailLoadingId: '',
    deletingDiaryId: '',
    deletingChatLogId: '',
  },

  onLoad() {
    this.verifyAndLoad();
  },

  async verifyAndLoad() {
    this.setData({ loading: true });
    try {
      const pageSize = this.data.pageSize;
      const selectedUserFilter = this.data.selectedUserFilter;
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'listAdminData', diaryLimit: pageSize, chatLogLimit: pageSize, userFilter: selectedUserFilter },
      });

      if (!result || !result.isAdmin) {
        this.setData({
          loading: false,
          isAdmin: false,
          envId: (result && result.envId) || '',
          diaryList: [],
          diaryCount: 0,
          diarySkip: 0,
          diaryHasMore: false,
          chatLogList: [],
          chatLogCount: 0,
          chatLogSkip: 0,
          chatLogHasMore: false,
          chatErrorCount: 0,
          loadErrors: [],
        });
        return;
      }

      const diaryList = this.decorateDiaryList(result.diaryList || []);
      const chatLogList = this.decorateChatLogList(result.chatLogList || []);
      const loadErrors = result.loadErrors || [];
      this.setData({
        loading: false,
        isAdmin: true,
        envId: result.envId || '',
        selectedUserFilter: result.userFilter || selectedUserFilter,
        diaryList,
        diaryCount: Number(result.diaryCount) || 0,
        diarySkip: diaryList.length,
        diaryHasMore: diaryList.length < (Number(result.diaryCount) || 0),
        diaryLoadingMore: false,
        chatLogList,
        chatLogCount: Number(result.chatLogCount) || 0,
        chatLogSkip: chatLogList.length,
        chatLogHasMore: chatLogList.length < (Number(result.chatLogCount) || 0),
        chatLogLoadingMore: false,
        chatErrorCount: chatLogList.filter((item) => item.hasError).length,
        loadErrors,
        detailLoadingId: '',
        deletingDiaryId: '',
        deletingChatLogId: '',
      });
    } catch (error) {
      this.setData({
        loading: false,
        isAdmin: false,
      });
      wx.showToast({
        title: '鉴权失败，请部署云函数',
        icon: 'none',
      });
    }
  },

  getUserFilterLabel(value) {
    if (value === 'all') {
      return '全部';
    }
    return value || '全部';
  },

  onSelectUserFilter(event) {
    const nextFilter = String(event.currentTarget.dataset.value || 'all');
    if (nextFilter === this.data.selectedUserFilter) {
      return;
    }
    this.setData({ selectedUserFilter: nextFilter });
    this.reloadDataByFilter(nextFilter);
  },

  async reloadDataByFilter(userFilter) {
    try {
      const pageSize = this.data.pageSize;
      const [diaryRes, chatRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'adminAuth',
          data: {
            action: 'listPage',
            section: 'diary',
            limit: pageSize,
            skip: 0,
            userFilter,
          },
        }),
        wx.cloud.callFunction({
          name: 'adminAuth',
          data: {
            action: 'listPage',
            section: 'chatLog',
            limit: pageSize,
            skip: 0,
            userFilter,
          },
        }),
      ]);

      const diaryResult = (diaryRes && diaryRes.result) || {};
      const chatResult = (chatRes && chatRes.result) || {};
      if (diaryResult.error || chatResult.error) {
        throw new Error((diaryResult.error && diaryResult.error.message) || (chatResult.error && chatResult.error.message) || '加载失败');
      }

      const diaryList = this.decorateDiaryList(diaryResult.list || []);
      const chatLogList = this.decorateChatLogList(chatResult.list || []);
      const diaryCount = Number(diaryResult.total) || 0;
      const chatLogCount = Number(chatResult.total) || 0;

      this.setData({
        diaryList,
        diaryCount,
        diarySkip: diaryList.length,
        diaryHasMore: diaryList.length < diaryCount,
        diaryLoadingMore: false,
        chatLogList,
        chatLogCount,
        chatLogSkip: chatLogList.length,
        chatLogHasMore: chatLogList.length < chatLogCount,
        chatLogLoadingMore: false,
        chatErrorCount: chatLogList.filter((item) => item.hasError).length,
        loadErrors: [],
        detailLoadingId: '',
      });
    } catch (error) {
      wx.showToast({ title: '筛选加载失败', icon: 'none' });
    }
  },

  decorateDiaryList(list = []) {
    return list.map((item) => ({
      ...item,
      createdAtText: this.formatDateText(item.createdAt || item._createTime || item.date),
      userLabelText: item.userLabel || this.maskMiddle(item._openid || '', 6, 5),
      openidMasked: this.maskMiddle(item._openid || '', 6, 5),
    }));
  },

  decorateChatLogList(list = []) {
    return list.map((item) => ({
      ...item,
      createdAtText: this.formatDateText(item.createdAt || item.requestEndedAt || item._createTime),
      durationText: item.durationMs ? `${item.durationMs}ms` : '0ms',
      statusText: item.hasError ? '失败' : '成功',
      errorText: item.errorReason || item.error || '',
      userLabelText: item.userLabel || '',
      openidMasked: this.maskMiddle(item._openid || '', 6, 5),
      userDisplay: this.buildUserDisplay(item.userLabel || '', item._openid || ''),
      answerSummary: item.answerPreview || '点击查看详情',
      detailLoaded: false,
      detailExpanded: false,
    }));
  },

  formatDateText(value) {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  },

  maskMiddle(value, left = 6, right = 5) {
    const text = String(value || '');
    if (!text) {
      return '未知';
    }
    if (text.length <= left + right + 3) {
      return text;
    }
    return `${text.slice(0, left)}...${text.slice(-right)}`;
  },

  toShortId(value, maxLen = 18) {
    const text = String(value || '');
    if (!text) {
      return '未知';
    }
    if (text.length <= maxLen) {
      return text;
    }
    return `${text.slice(0, maxLen)}...`;
  },

  buildUserDisplay(userLabel, openid) {
    if (userLabel) {
      return userLabel;
    }
    if (openid) {
      return `用户(${this.maskMiddle(openid, 6, 5)})`;
    }
    return '未知用户';
  },

  async loadMoreDiaries() {
    if (this.data.diaryLoadingMore || !this.data.diaryHasMore) {
      return;
    }

    this.setData({ diaryLoadingMore: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'listPage',
          section: 'diary',
          limit: this.data.pageSize,
          skip: this.data.diarySkip,
          userFilter: this.data.selectedUserFilter,
        },
      });

      if (!result || result.error) {
        throw new Error((result && result.error && result.error.message) || '加载失败');
      }

      const nextList = this.decorateDiaryList(result.list || []);
      const mergedList = [...this.data.diaryList, ...nextList];
      const total = Number(result.total) || this.data.diaryCount;
      this.setData({
        diaryList: mergedList,
        diaryCount: total,
        diarySkip: mergedList.length,
        diaryHasMore: mergedList.length < total,
        diaryLoadingMore: false,
      });
    } catch (error) {
      this.setData({ diaryLoadingMore: false });
      wx.showToast({ title: '加载更多失败', icon: 'none' });
    }
  },

  async loadMoreChatLogs() {
    if (this.data.chatLogLoadingMore || !this.data.chatLogHasMore) {
      return;
    }

    this.setData({ chatLogLoadingMore: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'listPage',
          section: 'chatLog',
          limit: this.data.pageSize,
          skip: this.data.chatLogSkip,
          userFilter: this.data.selectedUserFilter,
        },
      });

      if (!result || result.error) {
        throw new Error((result && result.error && result.error.message) || '加载失败');
      }

      const nextList = this.decorateChatLogList(result.list || []);
      const mergedList = [...this.data.chatLogList, ...nextList];
      const total = Number(result.total) || this.data.chatLogCount;
      this.setData({
        chatLogList: mergedList,
        chatLogCount: total,
        chatLogSkip: mergedList.length,
        chatLogHasMore: mergedList.length < total,
        chatLogLoadingMore: false,
        chatErrorCount: mergedList.filter((item) => item.hasError).length,
      });
    } catch (error) {
      this.setData({ chatLogLoadingMore: false });
      wx.showToast({ title: '加载更多失败', icon: 'none' });
    }
  },

  async toggleChatLogDetail(event) {
    const id = event.currentTarget.dataset.id;
    const index = Number(event.currentTarget.dataset.index);
    const currentItem = this.data.chatLogList[index];
    if (!currentItem || currentItem._id !== id) {
      return;
    }

    if (currentItem.detailLoaded) {
      this.setData({
        [`chatLogList[${index}].detailExpanded`]: !currentItem.detailExpanded,
      });
      return;
    }

    this.setData({ detailLoadingId: id });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'adminAuth',
        data: {
          action: 'getChatLogDetail',
          id,
        },
      });

      if (!result || result.error || !result.detail) {
        throw new Error((result && result.error) || '详情加载失败');
      }

      this.setData({
        [`chatLogList[${index}].answer`]: result.detail.answer || '',
        [`chatLogList[${index}].errorText`]: result.detail.errorReason || result.detail.error || currentItem.errorText,
        [`chatLogList[${index}].detailLoaded`]: true,
        [`chatLogList[${index}].detailExpanded`]: true,
        detailLoadingId: '',
      });
    } catch (error) {
      this.setData({ detailLoadingId: '' });
      wx.showToast({ title: '详情加载失败', icon: 'none' });
    }
  },

  deleteDiary(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      return;
    }

    wx.showModal({
      title: '删除日记',
      content: '确认删除这条日记吗？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        this.setData({ deletingDiaryId: id });
        try {
          const { result } = await wx.cloud.callFunction({
            name: 'adminAuth',
            data: { action: 'deleteItem', section: 'diary', id },
          });

          if (!result || !result.success) {
            throw new Error((result && result.error) || '删除失败');
          }

          const diaryList = this.data.diaryList.filter((item) => item._id !== id);
          const diaryCount = Math.max(0, this.data.diaryCount - 1);
          this.setData({
            diaryList,
            diaryCount,
            diarySkip: diaryList.length,
            diaryHasMore: diaryList.length < diaryCount,
            deletingDiaryId: '',
          });
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch (error) {
          this.setData({ deletingDiaryId: '' });
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  deleteChatLog(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      return;
    }

    wx.showModal({
      title: '删除问答日志',
      content: '确认删除这条问答日志吗？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        this.setData({ deletingChatLogId: id });
        try {
          const { result } = await wx.cloud.callFunction({
            name: 'adminAuth',
            data: { action: 'deleteItem', section: 'chatLog', id },
          });

          if (!result || !result.success) {
            throw new Error((result && result.error) || '删除失败');
          }

          const chatLogList = this.data.chatLogList.filter((item) => item._id !== id);
          const chatLogCount = Math.max(0, this.data.chatLogCount - 1);
          this.setData({
            chatLogList,
            chatLogCount,
            chatLogSkip: chatLogList.length,
            chatLogHasMore: chatLogList.length < chatLogCount,
            chatErrorCount: chatLogList.filter((item) => item.hasError).length,
            deletingChatLogId: '',
          });
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch (error) {
          this.setData({ deletingChatLogId: '' });
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  refreshData() {
    this.verifyAndLoad();
  },

  goBack() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },
});
