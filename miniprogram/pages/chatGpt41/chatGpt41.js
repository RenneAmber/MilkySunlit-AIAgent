// pages/chatGpt41/chatGpt41.js
const axios = require('axios');

Page({
  data: {
    chatHistory: [],
    userInput: "",
    isLoading: false,
    modelConfig: {
      apiKey: "236d2d85c3ce4b5d9fbf5517df1c5e6f",
      deploymentName: "gpt-41_milky",
      apiVersion: "2025-01-01-preview",
      endpointBase: "https://milkysunlit.openai.azure.com",
      welcomeMsg: "你好，我是你的智能助手，有什么可以帮你？",
    },
  },

  onLoad() {
    this.addMessage("assistant", this.data.modelConfig.welcomeMsg);
  },

  onInputChange(e) {
    this.setData({ userInput: e.detail.value });
  },

  async onSend() {
    const text = this.data.userInput.trim();
    if (!text) return;

    this.addMessage("user", text);
    this.setData({ userInput: "", isLoading: true });

    try {
      const result = await this.callOpenAI(text);
      this.addMessage("assistant", result);
    } catch (error) {
      this.addMessage("assistant", "请求失败，请稍后再试。");
    } finally {
      this.setData({ isLoading: false });
    }
  },

  addMessage(role, content) {
    const newMessage = { role, content };
    this.setData({
      chatHistory: [...this.data.chatHistory, newMessage],
    });
  },

  async callOpenAI(text) {
    const { apiKey, deploymentName, apiVersion, endpointBase } = this.data.modelConfig;
    const endpoint = `${endpointBase}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    try {
      const response = await axios.post(endpoint, {
        messages: [{ role: "user", content: text }],
        max_tokens: 100,
      }, {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error("OpenAI API 请求失败", error.response?.data || error.message);
      throw error;
    }
  },
});
