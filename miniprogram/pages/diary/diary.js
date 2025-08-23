Page({
    data: {
      mediaPath: '',
      diaryText: '',
      selectedDate: '请选择日期',
      tags: '',
      isImportant: false
    },
  
    chooseMedia() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image', 'video'],
        success: (res) => {
          this.setData({ mediaPath: res.tempFiles[0].tempFilePath });
        }
      });
    },
  
    onTextInput(e) {
      this.setData({ diaryText: e.detail.value });
    },
  
    onDateChange(e) {
      this.setData({ selectedDate: e.detail.value });
    },
  
    onTagInput(e) {
      this.setData({ tags: e.detail.value });
    },
  
    onImportanceChange(e) {
      this.setData({ isImportant: e.detail.value });
    },
    goBack() {
      wx.navigateBack();
    },
    submitDiary() {
        const { mediaPath, diaryText, selectedDate, isImportant } = this.data;
      
        // 校验文字内容
        if (!diaryText.trim()) {
          wx.showToast({
            title: '请填写文字内容',
            icon: 'none'
          });
          return;
        }
      
        // 校验日期
        if (selectedDate === '请选择日期') {
          wx.showToast({
            title: '请选择日期',
            icon: 'none'
          });
          return;
        }
      
        // 保存日记
        const diaryList = wx.getStorageSync('diaryList') || [];
        diaryList.push({
          image: mediaPath,
          text: diaryText,
          date: selectedDate,
          important: isImportant
        });
      
        wx.setStorageSync('diaryList', diaryList);
        wx.showToast({ title: '日记已保存', icon: 'success' });
      
        // 返回上一页
        wx.navigateBack();
      }
  });
  