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
      diaryList: [],
      migrating: false,
      unsyncedCount: 0,
    },
    async onShow() {
      await this.refreshDiaryList();
    },
    buildDiaryDedupKey(item = {}) {
      if (item._id) {
        return `id:${item._id}`;
      }
      const syncKey = item.syncKey || buildDiarySyncKey(item);
      return `sync:${syncKey}`;
    },
    async refreshDiaryList() {
      const diaryList = wx.getStorageSync('diaryList') || [];
      let mergedList = [...diaryList];

      try {
        const { result } = await wx.cloud.callFunction({
          name: 'adminAuth',
          data: {
            action: 'listSharedDiaries',
            limit: 120,
          },
        });

        const sharedDiaryList = (result && result.diaryList) || [];
        const mergedMap = new Map();

        sharedDiaryList.forEach((item) => {
          const normalizedItem = {
            ...item,
            tags: normalizeTags(item.tags),
            _readonlyDelete: !item.isOwner,
            _fromShared: true,
          };
          mergedMap.set(this.buildDiaryDedupKey(normalizedItem), normalizedItem);
        });

        diaryList.forEach((item) => {
          const normalizedItem = {
            ...item,
            tags: normalizeTags(item.tags),
            _readonlyDelete: false,
            _fromShared: false,
          };
          const key = this.buildDiaryDedupKey(normalizedItem);
          if (!mergedMap.has(key)) {
            mergedMap.set(key, normalizedItem);
          }
        });

        mergedList = Array.from(mergedMap.values()).sort((a, b) => {
          const aTime = new Date(a.createdAt || a.date || 0).getTime() || 0;
          const bTime = new Date(b.createdAt || b.date || 0).getTime() || 0;
          return bTime - aTime;
        });
      } catch (error) {}

      this.updateDiaryList(mergedList);
    },
    updateDiaryList(diaryList = []) {
      const unsyncedCount = diaryList.filter((item) => item && !item._id).length;
      this.setData({ diaryList, unsyncedCount });
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
      async migrateLocalDiaries() {
        if (this.data.migrating) {
          return;
        }

        const localDiaryList = wx.getStorageSync('diaryList') || [];
        if (!localDiaryList.length) {
          wx.showToast({ title: '没有本地日记可迁移', icon: 'none' });
          return;
        }

        this.setData({ migrating: true });
        const db = wx.cloud.database();
        let syncedCount = 0;
        let failedCount = 0;
        const nextDiaryList = [...localDiaryList];

        for (let index = 0; index < nextDiaryList.length; index += 1) {
          const item = nextDiaryList[index] || {};
          if (item._id) {
            continue;
          }

          const syncKey = item.syncKey || buildDiarySyncKey(item);
          const payload = {
            image: item.image || '',
            text: item.text || '',
            date: item.date || '',
            important: !!item.important,
            syncKey,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          };

          try {
            const existingRes = await db.collection('diaryList').where({ syncKey }).limit(1).get();
            if (existingRes.data && existingRes.data.length) {
              nextDiaryList[index] = {
                ...item,
                _id: existingRes.data[0]._id,
                syncKey,
              };
              syncedCount += 1;
              continue;
            }

            const addRes = await db.collection('diaryList').add({ data: payload });
            nextDiaryList[index] = {
              ...item,
              _id: addRes && addRes._id ? addRes._id : '',
              syncKey,
            };
            syncedCount += 1;
          } catch (error) {
            failedCount += 1;
            nextDiaryList[index] = {
              ...item,
              syncKey,
            };
          }
        }

        wx.setStorageSync('diaryList', nextDiaryList);
        this.updateDiaryList(nextDiaryList);
        this.setData({ migrating: false });

        if (failedCount === 0) {
          wx.showToast({ title: `已迁移 ${syncedCount} 条`, icon: 'success' });
          return;
        }

        wx.showToast({ title: `成功 ${syncedCount} 条，失败 ${failedCount} 条`, icon: 'none' });
      },
      deleteDiary(e) {
        const index = e.currentTarget.dataset.index;
        const id = e.currentTarget.dataset.id;
        const syncKey = e.currentTarget.dataset.syncKey || '';
        const currentDiary = this.data.diaryList[index] || {};
        if (currentDiary._readonlyDelete) {
          wx.showToast({ title: '仅创建者可删除', icon: 'none' });
          return;
        }

        wx.showModal({
          title: '确认删除',
          content: '确定要删除这篇日记吗？',
          success: async (res) => {
            if (res.confirm) {
              let diaryList = wx.getStorageSync('diaryList') || [];
              const localIndex = diaryList.findIndex((item) => {
                if (id && item._id === id) {
                  return true;
                }
                const itemSyncKey = item.syncKey || buildDiarySyncKey(item);
                return !!syncKey && itemSyncKey === syncKey;
              });
              const localDiary = localIndex >= 0 ? diaryList[localIndex] : {};

              if (currentDiary._id) {
                try {
                  const db = wx.cloud.database();
                  await db.collection('diaryList').doc(currentDiary._id).remove();
                } catch (error) {}
              }

              if (localIndex >= 0) {
                diaryList.splice(localIndex, 1);
              }
              wx.setStorageSync('diaryList', diaryList);
              await this.refreshDiaryList();
            }
          }
        });
      }
  });