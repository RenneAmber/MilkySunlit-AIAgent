Page({
    data: {
      diaryList: []
    },
    onShow() {
      const diaryList = wx.getStorageSync('diaryList') || [];
      this.setData({ diaryList });
    },
    goToAddDiary() {
        wx.navigateTo({
          url: '/pages/diary/diary'
        });
      },
      previewImage(e) {
        const current = e.currentTarget.dataset.src;
        wx.previewImage({
          current,
          urls: [current]
        });
      },
      deleteDiary(e) {
        const index = e.currentTarget.dataset.index;
        wx.showModal({
          title: '确认删除',
          content: '确定要删除这篇日记吗？',
          success: (res) => {
            if (res.confirm) {
              let diaryList = wx.getStorageSync('diaryList') || [];
              diaryList.splice(index, 1);
              wx.setStorageSync('diaryList', diaryList);
              this.onShow(); // 刷新页面
            }
          }
        });
      }
  });