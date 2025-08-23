Page({
  data: {
    diaryList: []
  },
  onShow() {
    const diaryList = wx.getStorageSync('diaryList') || [];
    this.setData({ diaryList });
  },
  expandAgent: function () {
    this.setData({ agentExpand: !this.data.agentExpand });
  },
  expandModel: function () {
    this.setData({ modelExpand: !this.data.modelExpand });
  },
  goChatBot: function () {
    wx.navigateTo({
      // url: "/pages/chatGpt41/chatGpt41",
      url: "/pages/chatBot/chatBot",
    });
  },
  goDiary: function () {
      wx.navigateTo({
        url: '/pages/diary/diary',
      })
  },
  goToHistoryDiary() {
    wx.navigateTo({
      url: '/pages/history-diary/history-diary'
    })
  },
  scrollToAnchor: function (e) {
    // 获取点击的锚点 ID
    const anchorId = e.currentTarget.dataset.anchor;
    // 使用 wx.createSelectorQuery() 获取锚点元素的位置
    const query = wx.createSelectorQuery();
    query.select("#" + anchorId).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      if (res[0]) {
        // 获取锚点元素距离页面顶部的距离
        const scrollTop = res[1].scrollTop + res[0].top;
        // 使用 wx.pageScrollTo 方法将页面滚动到锚点位置
        wx.pageScrollTo({
          scrollTop: scrollTop,
          duration: 300, // 滚动动画的持续时间，单位为毫秒
        });
      }
    });
  },
  copyUrl: function () {
    wx.setClipboardData({
      data: "https://tcb.cloud.tencent.com/dev",
      success: function (res) {
        wx.showToast({
          title: "链接复制成功",
          icon: "success",
        });
      },
      fail: function (err) {
        wx.showToast({
          title: "复制失败",
          icon: "none",
        });
      },
    });
  },
});
