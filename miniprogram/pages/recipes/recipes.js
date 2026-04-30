function parseLines(text, maxLen = 30) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => String(line || "").replace(/^\s*\d+[.、)）]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, maxLen);
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((it) => String(it || "").trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  if (!text) {
    return [];
  }
  return text
    .split(/[\n,，;；、]+/)
    .map((it) => String(it || "").trim())
    .filter(Boolean);
}

function normalizeRecipeItem(item = {}) {
  const ingredients = toArray(item.ingredients || item.ingredientsText || item.ingredient || item.materials);
  const steps = toArray(item.steps || item.stepsText || item.method || item.instructions).map((line) =>
    String(line || "").replace(/^\s*\d+[.、)）]\s*/, "").trim()
  );
  return {
    ...item,
    ingredients,
    steps,
    ingredientsDisplay: ingredients.join("、"),
    stepsDisplay: steps,
  };
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
    editingId: "",
    showAddForm: false,
    keyword: "",
    name: "",
    ingredientsText: "",
    stepsText: "",
    link: "",
    note: "",
    showAiPanel: false,
    aiGenerating: false,
    aiDescription: "",
    aiImageLocalPath: "",
    aiImageFileID: "",
    aiResult: null, // { mode, generated:{name,ingredients,steps,note}, similar:{item,score} }
  },

  onShow() {
    this.loadList();
  },

  startAddRecipe() {
    this.setData({ showAddForm: true });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "listSharedRecipes",
          keyword: this.data.keyword,
          limit: 100,
        },
      });
      const list = ((result && result.recipeList) || []).map(normalizeRecipeItem);
      this.setData({ list });
    } catch (error) {
      showErrorToast(error, "加载失败");
    } finally {
      this.setData({ loading: false });
    }
  },

  async search() {
    await this.loadList();
  },

  async addRecipe() {
    const editingId = String(this.data.editingId || "").trim();
    const name = String(this.data.name || "").trim();
    const ingredients = parseLines(this.data.ingredientsText, 80);
    const steps = parseLines(this.data.stepsText, 120);
    const link = String(this.data.link || "").trim();
    const note = String(this.data.note || "").trim();

    if (!name || !ingredients.length || !steps.length) {
      wx.showToast({ title: "请填写名称/食材/步骤", icon: "none" });
      return;
    }

    this.setData({ adding: true });
    try {
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: editingId ? "updateSharedRecipe" : "addSharedRecipe",
          id: editingId || undefined,
          name,
          ingredients,
          steps,
          link,
          note,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || (editingId ? "保存失败" : "新增失败"));
      }
      wx.showToast({ title: editingId ? "已保存" : "已新增", icon: "success" });
      this.setData({ showAddForm: false });
      this.cancelEdit({ silent: true });
      await this.loadList();
    } catch (error) {
      showErrorToast(error, editingId ? "保存失败" : "新增失败");
    } finally {
      this.setData({ adding: false });
    }
  },

  startEditRecipe(e) {
    const id = e.currentTarget.dataset.id;
    const target = (this.data.list || []).find((it) => String(it.id) === String(id));
    if (!target) {
      wx.showToast({ title: "未找到菜谱", icon: "none" });
      return;
    }
    this.setData({
      editingId: target.id,
      name: target.name || "",
      ingredientsText: (target.ingredients || []).join("\n"),
      stepsText: (target.steps || []).join("\n"),
      link: target.link || "",
      note: target.note || "",
      showAddForm: true,
    });
  },

  cancelEdit(options = {}) {
    this.setData({
      editingId: "",
      name: "",
      ingredientsText: "",
      stepsText: "",
      link: "",
      note: "",
      showAddForm: false,
    });
    if (!options.silent) {
      wx.showToast({ title: "已取消编辑", icon: "none" });
    }
  },

  async deleteRecipe(e) {
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
          action: "deleteSharedRecipe",
          id,
        },
      });
      if (!(result && result.success)) {
        throw new Error((result && result.error) || "删除失败");
      }
      wx.showToast({ title: "已删除", icon: "success" });
      await this.loadList();
    } catch (error) {
      showErrorToast(error, "删除失败");
    }
  },

  // ========== AI 生成菜谱 ==========

  openAiPanel() {
    this.setData({
      showAiPanel: true,
      aiDescription: "",
      aiImageLocalPath: "",
      aiImageFileID: "",
      aiResult: null,
    });
  },

  closeAiPanel() {
    this.setData({ showAiPanel: false });
  },

  onAiDescInput(e) {
    this.setData({ aiDescription: e.detail.value });
  },

  async chooseAiImage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
      });
      const file = (res && res.tempFiles && res.tempFiles[0]) || null;
      if (!file) return;
      this.setData({ aiImageLocalPath: file.tempFilePath, aiImageFileID: "" });
    } catch (error) {
      // user cancel
    }
  },

  removeAiImage() {
    this.setData({ aiImageLocalPath: "", aiImageFileID: "" });
  },

  async uploadAiImageIfNeeded() {
    const localPath = this.data.aiImageLocalPath;
    if (!localPath) return "";
    if (this.data.aiImageFileID) return this.data.aiImageFileID;
    const ext = (localPath.match(/\.(jpg|jpeg|png|webp|gif)$/i) || [, "jpg"])[1].toLowerCase();
    const cloudPath = `recipe-ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const res = await wx.cloud.uploadFile({ cloudPath, filePath: localPath });
    const fileID = String((res && res.fileID) || "");
    if (fileID) this.setData({ aiImageFileID: fileID });
    return fileID;
  },

  async generateAiRecipe() {
    const description = String(this.data.aiDescription || "").trim();
    if (!description && !this.data.aiImageLocalPath) {
      wx.showToast({ title: "请填写描述或选择图片", icon: "none" });
      return;
    }
    if (this.data.aiGenerating) return;
    this.setData({ aiGenerating: true, aiResult: null });
    try {
      const imageFileID = await this.uploadAiImageIfNeeded();
      const { result } = await wx.cloud.callFunction({
        name: "adminAuth",
        data: {
          action: "generateRecipeFromInput",
          description,
          imageFileID,
        },
      });
      if (!(result && result.success) || !result.data) {
        throw new Error((result && result.error) || "生成失败");
      }
      const data = result.data;
      const decorated = {
        mode: data.mode,
        generated: {
          ...data.generated,
          ingredientsDisplay: (data.generated.ingredients || []).join("、"),
        },
        similar: data.similar
          ? {
              score: data.similar.score,
              scorePercent: Math.round(Number(data.similar.score || 0) * 100),
              item: normalizeRecipeItem(data.similar.item || {}),
            }
          : null,
      };
      this.setData({ aiResult: decorated });
    } catch (error) {
      showErrorToast(error, "生成失败");
    } finally {
      this.setData({ aiGenerating: false });
    }
  },

  viewSimilarRecipe() {
    this.setData({ showAiPanel: false });
    const item = this.data.aiResult && this.data.aiResult.similar && this.data.aiResult.similar.item;
    if (!item) return;
    const keyword = String(item.name || "").trim();
    if (keyword) {
      this.setData({ keyword });
      this.loadList();
    }
  },

  useAiGenerated() {
    const generated = this.data.aiResult && this.data.aiResult.generated;
    if (!generated) return;
    this.setData({
      showAiPanel: false,
      showAddForm: true,
      editingId: "",
      name: generated.name || "",
      ingredientsText: (generated.ingredients || []).join("\n"),
      stepsText: (generated.steps || []).join("\n"),
      link: "",
      note: generated.note || "",
    });
  },

  regenerateAiRecipe() {
    this.setData({ aiResult: null });
    this.generateAiRecipe();
  },
});
