function buildDiarySyncKey(entry = {}) {
  return [
    String(entry.date || '').trim(),
    String(entry.text || '').trim(),
    entry.important ? '1' : '0',
    String(entry.image || '').trim(),
    Array.isArray(entry.tags) ? entry.tags.join(',') : String(entry.tags || '').trim(),
  ].join('||');
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
  }
  return String(value || '')
    .split(/[,，;；\s]+/)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

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
    async submitDiary() {
        const { mediaPath, diaryText, selectedDate, isImportant, tags } = this.data;
      
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

        const tagList = normalizeTags(tags);
        const diaryEntry = {
          image: mediaPath,
          text: diaryText,
          date: selectedDate,
          tags: tagList,
          important: isImportant,
          syncKey: buildDiarySyncKey({
            image: mediaPath,
            text: diaryText,
            date: selectedDate,
            tags: tagList,
            important: isImportant,
          }),
          createdAt: new Date(),
        };

        let cloudDiaryId = '';
        try {
          const db = wx.cloud.database();
          const cloudResult = await db.collection('diaryList').add({
            data: diaryEntry,
          });
          cloudDiaryId = cloudResult && cloudResult._id ? cloudResult._id : '';
        } catch (error) {}

        const diaryList = wx.getStorageSync('diaryList') || [];
        diaryList.push({
          ...diaryEntry,
          _id: cloudDiaryId,
        });

        wx.setStorageSync('diaryList', diaryList);

        if (cloudDiaryId) {
          wx.showToast({ title: '日记已保存', icon: 'success' });
        } else {
          wx.showToast({ title: '本地已保存，云端同步失败', icon: 'none' });
        }
      
        // 返回上一页
        wx.navigateBack();
      }
  });
  