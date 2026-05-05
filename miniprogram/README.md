# MilkySunlit-AIAgent

基于微信小程序的 AI 陪聊与日记应用，包含星空视觉主页、流星特效页面、聊天能力、日记记录，以及仅管理员可见的后台入口（基于云函数鉴权）。

## 目前功能

### 1. 首页与视觉
- 首页使用深蓝星空主题背景，包含星点、流星、闪烁粒子。
- 流星覆盖全屏范围，支持随机角度、透明度、尾迹长度和神秘色系变化。
- 提供核心入口：奶菠日记、奶菠陪聊、心动星空。
- 当云函数鉴权通过时，首页显示 Admin 入口。

### 2. 心动星空页面
- 独立星空场景页，包含全屏流星雨、彩色星点、闪光粒子。
- 右上角悬浮返回首页按钮。

### 3. 奶菠陪聊
- 使用通用 agent-ui 组件承载聊天界面。
- 当前配置为 model 模式，模型提供商为 deepseek，快速响应模型为 deepseek-v3。
- 支持语音、文件、图片、工具调用展示、多会话等能力（按组件配置开启）。

### 4. 日记系统
- 当前日记写入本地缓存（wx.setStorageSync / wx.getStorageSync）。
- 支持新增、查看、删除、图片预览、重要标记。

### 5. Admin 后台（仅管理员）
- 通过云函数 adminAuth 做服务端鉴权。
- 白名单 OpenID 可见 Admin 数据面板，非白名单账号不可见。
- 支持读取云数据库集合 diaryList 的最近数据。

### 6. 云开发
- 小程序已初始化云开发环境。
- 已提供 cloudfunctions/adminAuth 云函数骨架。
- 需要在云函数中配置管理员 OpenID 并部署后，Admin 才能正常显示与访问。

## Detail：框架结构信息

### 一、整体目录

- miniprogram/
	- app.js：小程序启动与云开发初始化。
	- app.json：全局页面路由与窗口配置。
	- pages/
		- index/：首页（星空主视觉 + 功能入口 + Admin 入口显示逻辑）。
		- love/：心动星空页（全屏流星与星点动画）。
		- chatBot/：奶菠陪聊入口页（挂载 agent-ui 组件）。
		- chatGpt41/：另一聊天页（独立页面配置）。
		- diary/：新增日记页面。
		- history-diary/：历史日记列表页面。
		- admin/：后台管理页面（管理员鉴权后展示数据）。
	- components/
		- agent-ui/：聊天 UI 主组件。
			- index.js：聊天逻辑主入口。
			- tools.js：云实例与请求能力封装。
			- wd-markdown/：Markdown 渲染组件。
			- chatFile/、feedback/、customCard/：文件、反馈、卡片工具组件。

- cloudfunctions/
	- adminAuth/
		- index.js：管理员鉴权与后台数据读取。
		- package.json：云函数依赖配置（wx-server-sdk）。

### 二、关键数据流

1. 日记本地数据流
- diary 页面保存日记到本地缓存 diaryList。
- history-diary 与 index 页面从本地缓存读取并展示。

2. Admin 鉴权数据流
- index 页面 onLoad 调用云函数 adminAuth(action=check)。
- 返回 isAdmin=true 时显示 Admin 按钮。
- admin 页面调用 adminAuth(action=listDiaries) 获取云数据库数据。

3. 聊天数据流
- chatBot 页面通过 agent-ui 承接交互。
- agent-ui 基于 wx.cloud.extend.AI 发起会话请求。

### 三、你需要自行配置的项

- cloudfunctions/adminAuth/index.js 中的管理员白名单 OpenID。
- 云函数部署（adminAuth 上传并部署）。
- 云数据库集合 diaryList 的权限策略与索引策略。

## 快速启动建议

1. 打开微信开发者工具并导入项目。
2. 确认云开发环境 ID 与 app.js 一致。
3. 部署 cloudfunctions/adminAuth。
4. 配置管理员 OpenID 后重新部署。
5. 预览首页确认 Admin 入口是否出现。
