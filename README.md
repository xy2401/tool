# Web Tools

一个面向所有人的在线工具集合，无需安装，打开网页即可使用。

## 功能导航

### text

- [Any - 智能识别](./text/any/) - 粘贴任意文本自动识别类型（哈希、时间戳、Base64、UUID、IP、颜色等）并提供转换操作。
- [Monaco 工具箱](./text/monaco/) - 集文本与代码编辑、对比、格式转换、内容预览和 JavaScript Console 于一体。
- [JSON 查看](./text/json/) - 从日志或不规则文本中深度提取 JSON，支持转义解构与局部回填。
- [JSON 节点编辑](./text/json/editor.html) - 基于 Svelte-JSONEditor 的现代 JSON 对比与可视化树形编辑工具。



### kit

- [微信群接龙助手](./kit/wechain/) - 粘贴微信群接龙文本，维护人员列表，按日期统计打卡/未打卡人员，并生成有温度的群通知文案。

### devops

- [GitHub Explorer](./devops/github/) - 基于 GitHub Search API 的高阶仓库搜索与定制化 Markdown/JSON 模板生成器。
- [maxGraph 专业绘图工作台](./devops/maxgraph/) - 基于 `@maxgraph/core` 构建的浏览器端专业级绘图与拓扑工作台。
- [Mermaid Live Editor](./devops/mermaid/) - 基于 Mermaid.js 的纯文本画图工作台，支持双栏实时预览与导出。

### human

- [JSON 查看](./human/json.html) - 从文本中提取、格式化并查看 JSON 数据。
- [JSON Editor](./human/jsoneditor.html) - 可视化查看、编辑和提取 JSON 数据。
- [Monaco Editor](./human/monaco.html) - 在线体验多语言代码编辑器。
- [Monaco Diff](./human/monaco-diff.html) - 并排或行内比较两段代码。
- [Monaco Playground](./human/monaco-playground.html) - 编辑并运行 JavaScript、HTML 和 CSS。

## 功能列表

### text

#### [Any - 智能识别](./text/any/)

多面板智能文本识别与转换工具。将任意文本粘贴到输入框，自动识别内容类型并展示解析结果，同时支持对任意输入执行计算操作。识别范围包括：

- **哈希指纹**：自动识别 MD5（32位）/ SHA-1（40位）/ SHA-256（64位）/ SHA-512（128位），显示大写/小写形式。
- **Unix 时间戳**：自动区分秒级（10位）与毫秒级（13位），输出本地时间、UTC、ISO 8601 及相对时间（距今多久）。
- **Base64**：自动解码，若解码结果为 JWT 则优先按 JWT 处理。
- **JWT Token**：自动解码 Header 与 Payload，展示算法、过期时间、签发时间等所有 Claims。
- **IPv4 地址**：识别私有/公网/回环等地址类型，并转换为整数、十六进制、二进制点分格式。
- **Hex 颜色值**：支持 #RGB / #RRGGBB / #RRGGBBAA，实时预览色块并转换为 RGB、HSL。
- **UUID**：识别 v1/v4 等版本，提供大写及去分隔符形式。
- **URL**：拆分协议、主机、路径、查询参数和锚点。
- **邮件地址**：拆分用户名与域名，生成 mailto 链接。
- **十六进制数（0x）/ 二进制（0b）/ 十进制**：互相进制转换。
- **计算操作（任意输入均可触发）**：MD5 / SHA-1 / SHA-256 / SHA-512 哈希、Base64 编解码、URL 编解码、Hex 编解码、大小写转换、字符反转、JSON 转义/反转义、字符统计。
- **多面板设计**：支持同时开多个输入面板，各自独立识别，方便对比。

#### [Monaco 工具箱](./text/monaco/)

基于 Monaco Editor `0.55.1` 构建的浏览器端文本与代码工作台，所有输入默认只在本地处理。主要能力包括：

- **编辑与识别**：支持大量编程语言和文本格式、自动语言识别、主题切换、小地图、示例加载，以及打开或拖入本地文件。
- **文本对比**：支持并排和行内 Diff；JSON 对比可递归按属性名自然排序，消除仅由键顺序导致的差异。
- **格式转换**：支持 JSON 与 YAML 双向转换、HTML 转 Markdown，并保留 Monaco 撤销历史。
- **格式压缩**：支持 JSON 和 XML 校验后压缩为单行。
- **实时预览**：支持 HTML、Markdown、SVG 和 Base64 Data URL；Base64 可展示图片、音频、视频、PDF 和文本。
- **JavaScript Console**：采用类似 MDN “Try it”的整段代码运行方式，在隔离 Worker 中捕获 `console.log/info/warn/error` 和运行异常，并提供超时保护。
- **模块化静态页面**：HTML、CSS、应用脚本、Console 模板和 Worker 独立组织，无需构建即可部署。

#### [JSON 查看](./text/json/)

从日志或不规则文本中深度提取 JSON，自动解构多次转义的嵌套 JSON 结构并递归生成可视化节点树，支持以下高级功能：
- **智能免点击解析**：自动监听输入框文本变化并静默执行提取，无需手动触发。
- **本地历史记录**：自动记录最近10条用户输入数据，支持去重与排除示例文件，以 `时间: 文本预览` 命名，支持随时回载或清空。
- **文件拖入支持**：支持直接拖拽本地的日志、文本或 JSON 文件到输入卡片，通过 HTML5 File API 本地快速读取并解析。
- **多维度全屏查看**：支持双击编辑区标题栏或卡片空白处，亦或通过文本框右上角悬浮显示的图标一键全屏，按 `Esc` 键可迅速还原。
- **便捷同步与输出**：内嵌缩进选择与字段过滤器，支持一键复制，或将当前节点数据下载保存为本地 `.json` 文件。

#### [JSON 节点编辑](./text/json/editor.html)

基于 Svelte-JSONEditor 库构建的双栏 JSON 对比与编辑器。左栏支持代码模式，右栏支持树形模式，并包含以下功能：
- **左右双栏独立与同步**：支持左侧到右侧、右侧到左侧的单向一键数据同步，操作灵活、对称分布。
- **强大的 Transform 数据过滤**：通过 vanilla-jsoneditor 原生功能集成，支持 JMESPath、Lodash、JavaScript 查询过滤，支持快速提取字段、条件排序等复杂数据转换。
- **无感化智能汉化体系**：采用模块外部加载策略与 MutationObserver DOM 监听，完美汉化包括主菜单、快捷菜单、内置查找替换及数据转换弹窗等所有原生界面。（注：由于 vanilla-jsoneditor 官方 CDN 当前发布的 v3.12.0 尚未发布 native `language` 汉化传参，因此本方案通过 observer 规避了该限制。待官方支持后，可根据 [josdejong/svelte-jsoneditor PR #565](https://github.com/josdejong/svelte-jsoneditor/pull/565) 和 [Issue #368](https://github.com/josdejong/svelte-jsoneditor/issues/368) 升级为官方原生汉化配置方案。）
- **模块化结构**：将 HTML 结构、CSS 样式 (`editor.css`) 及 ES 模块 JS 逻辑 (`editor.js`) 完全解耦，使得页面极为精炼和易于维护。




### kit

#### [微信群接龙助手](./kit/wechain/)

一个移动优先的微信群接龙统计页面，用于健身群、学习群、读书群等长期打卡场景。页面不依赖微信接口，用户点击日期后粘贴微信群官方接龙文本，即可自动识别人名、更新当天打卡状态，并在浏览器本地保存人员和打卡数据。

> 💡 **实用技巧**：在微信群的「查找聊天记录 -> 日期」里，直接选择 `x月y日`，就能非常方便地定位到 `x月y-1日`（昨天）晚上发出的最后一条接龙消息了。

主要能力包括：

- **移动优先打卡矩阵**：人员列固定，日期列横向滚动；默认显示今天前后 3 天，若存在边界外数据则只向对应方向扩展。
- **日期状态选择**：日期表头使用 `○ / ✓ / - / ◎` 表示默认、打卡、未打卡、全选；刷新或切换列表时默认回到当天全选。
- **接龙文本解析**：支持粘贴 `#接龙` 文本，识别常见序号行；只移除序号，序号后的文本原样作为人员昵称。
- **新人确认**：更新接龙后若发现新人，先更新已存在人员，再提示是否将新人加入人员列表并标记完成。
- **人员列表自维护**：人员按拼音/字母自然分组，支持点击表头新增；移动端长按或左滑删除，删除分组中可恢复或彻底删除。
- **多群列表管理**：点击群名打开列表管理；群名可直接编辑，每行提供 `CSV`、`下载` 和红色删除操作。
- **实时顶部状态**：顶部一行按左中右排列群名、当前日期选择和文案入口，例如 `健身群⌄    06-17 全选    💬`。
- **文案与截图面板**：点击 `💬` 打开文案面板，上方提供 `复制 / 仅@名单 / 换一句`，下方展示居中的完成/未完成名单。
- **鼓励视觉反馈**：完成区域使用整体烟花动效；选中几天，完成区域标题显示几个 `👑`；未完成者按已完成天数显示 `🌺`，并配柔和鼓励动效。
- **自动时间文案**：根据本地时间自动选择早上、中午、下午、晚上、深夜语气；模板池包含单日、多日、一周、全选、空名单等多类文案。
- **CSV 查看与下载**：CSV 只包含至少有一人打卡的日期列；查看窗口不换行，可横向滚动；下载内容与查看内容一致。
- **本地保存**：所有群列表、人员、删除状态、打卡数据和日期状态保存在浏览器 `localStorage` 中。

该工具由 `index.html`、`app.css`、`app.js` 和 `templates.json` 组成，无需构建即可部署。

### devops

#### [maxGraph 专业绘图工作台](./devops/maxgraph/)

基于 `@maxgraph/core` 的专业级浏览器端绘图与拓扑工作台，包含以下主要能力：

- **丰富的控件库**：内置通用、基础、流程图、箭头、容器等多类图形，支持拖拽创建。
- **官方 Demo 集成**：侧边栏无缝接入官方故事集（Stories），支持按分类浏览并在隔离区运行，同时可一键提取数据到个人工作台。
- **双栏与鹰眼导航**：左侧控件与 Demo 列表，中间核心画布，右侧属性设置与实时鹰眼（Outline）小地图。
- **本地 XML 导入导出**：支持与标准 XML 文件之间的数据互通，亦可在线查看本地源码文件。
- **内置常见模板**：提供标准业务流程图、云网络拓扑图等快捷启动模板。

#### [Mermaid Live Editor](./devops/mermaid/)

基于 `Mermaid.js` ESM 构建的纯文本画图工作台，支持通过编写结构化文本实时生成图表。主要能力包括：

- **左右双栏实时预览**：左侧集成 Monaco Editor 提供沉浸式编码体验，右侧通过防抖机制毫秒级实时渲染 SVG。
- **丰富的预设模板**：内置流程图、时序图、甘特图、类图等常用图表模板，一键加载。
- **高级缩放与平移**：集成了 SVG Pan Zoom，支持使用鼠标滚轮无极缩放和拖拽漫游，轻松应对超大型复杂拓扑图。
- **多格式导出与容错**：支持一键下载高质量的 SVG 和 PNG 图片；内置语法错误捕捉机制，在代码报错时优雅地悬浮提示详细信息而不导致页面崩溃。

#### [GitHub Explorer](./devops/github/)

一个专为开发者打造的高级 GitHub 仓库检索与 Markdown 模板生成工具，核心能力包括：

- **高级搜索查询**：全面接入 GitHub Search API，可通过可视化的高级面板（支持 Owner、Language、Min Stars 等）或原生查询语法，实现跨组织、跨语言的高效开源发掘。
- **智能推荐交互**：通过原生 `<datalist>` 提供大厂、语言、AI/LLM 潮流主题等智能下拉建议，并提供 GitHub 风格的极速 Git Clone (含 HTTPS, SSH, CLI) 交互。
- **实时排版与多模板预设**：左侧检索，右侧毫秒级实时生成基于 `${key}` 语法的排版输出。内置 Markdown 列表、表格与 CSV 模板，支持编辑自动保存 (Auto-save) 及自定义模板“另存为”。
- **性能与安全**：纯原生前端实现（无第三方框架），支持配置 PAT (Personal Access Token) 以将检索速率提升至 5000次/小时，Token 仅保存在浏览器本地，绝对安全。


### human

#### [JSON 查看](./human/json.html)

手写原生页面。从混合文本中提取并格式化 JSON，支持自动解构多次转义的 JSON
字符串，递归解析内部嵌套 JSON 并生成节点树，支持字段过滤与局部修改反向合并。
Written by humuam, Aug 5, 2019 .

#### [JSON Editor](./human/jsoneditor.html)

基于 `jsoneditor` 库的页面。支持从混合文本提取 JSON，通过代码编辑器与树形
编辑器双栏同步展示，便于对深层嵌套的对象与数组进行可视化查看和编辑。
Written by humuam, Jul 30, 2019 .

#### [Monaco Editor](./human/monaco.html)

基于 Monaco Editor 的多语言在线代码编辑页面，可以切换语言和编辑器主题。
Written by humuam, Sep 21, 2019 .


#### [Monaco Diff](./human/monaco-diff.html)

使用 Monaco Diff Editor 比较两段代码，支持并排差异和行内差异显示。  
Written by humuam, Sep 21, 2019 .

#### [Monaco Playground](./human/monaco-playground.html)

提供 JavaScript、HTML 和 CSS 三个编辑区域，可以加载示例并直接运行查看结果。
Written by humuam, Sep 21, 2019 .

## 项目原则

- 纯静态网页，不需要安装依赖、编译或构建。
- 使用 Vue 3 CDN 版本增强页面交互。
- 第三方库通过 CDN 引入，并锁定具体版本。
- 按工具大类划分文件夹。
- 每个 HTML 页面完全独立。
- 页面不依赖公共 CSS、JavaScript、Header 或组件。
- 工具数据默认只在浏览器本地处理，不上传到服务器。
- 可直接打开 HTML，也可部署到任意静态托管服务。

## 目录结构

```text
tool/
├─ index.html          # 工具分类入口
├─ text/
│  ├─ any/
│  │  └─ index.html   # Any 智能识别工具
│  ├─ json/
│  │  ├─ index.html   # JSON 提取查看
│  │  ├─ editor.html  # JSON 节点编辑（Svelte-JSONEditor）
│  │  ├─ editor.css
│  │  └─ editor.js
│  └─ monaco/
│     ├─ index.html       # Monaco 工具箱页面结构
│     ├─ styles.css       # 页面样式
│     ├─ monaco-config.js # Monaco Worker 与 CDN 配置
│     ├─ app.js           # 编辑、转换、对比和预览逻辑
│     ├─ languages/       # 各语言与功能 Demo
│     └─ previews/        # JS Console 模板与 Worker
├─ human/
│  └─ README.md        # 人工手写、非 AI 生成的功能
├─ kit/
│  └─ wechain/
│     ├─ index.html       # 微信群接龙助手页面
│     ├─ app.css          # 页面样式
│     ├─ app.js           # Vue 交互逻辑
│     ├─ templates.json   # 通知文案模板
│     └─ readme.md        # 功能设计说明
├─ devops/
│  ├─ mermaid/
│  │  ├─ index.html       # Mermaid Live Editor 界面
│  │  ├─ style.css        # 页面样式与双栏布局
│  │  └─ app.js           # Vue 交互与实时渲染逻辑
│  ├─ maxgraph/
│  │  └─ index.html       # maxGraph 专业绘图工作台
│  └─ github/
│     ├─ index.html       # GitHub Explorer 入口
│     ├─ style.css        # 页面样式与双主题切换
│     ├─ app.js           # 搜索逻辑与模板渲染引擎
│     └─ README.md        # 工具详细说明
└─ README.md
```

目录会随着工具类型增加而扩展，但不为每个小功能单独创建文件夹。
界面和交互方式相近的功能应尽量合并在同一个页面中。

## 页面约定

简单工具可以使用单个 HTML 文件；功能较多的工具可以将 HTML、CSS、JavaScript、模板和 Worker 按职责拆分，但应保持目录自包含、无需构建即可运行。例如：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>工具名称</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="app"></div>

  <script src="./app.js"></script>
</body>
</html>
```

页面之间可以通过普通链接跳转。工具自身的 CSS、JavaScript、模板和示例资源应放在同一工具目录中，避免依赖其他工具目录的内部文件。

## 分类思路

分类优先考虑页面结构和交互方式是否相似，而不是只按功能名称或操作类型划分。

例如，Any 工具将以下功能集中在同一个多面板页面中，因为它们都属于"识别并转换单段文本"的交互模式：

- 哈希指纹识别与计算（MD5 / SHA-1 / SHA-256 / SHA-512）
- Base64 / URL / Hex 编解码
- Unix 时间戳解析
- JWT Token 解码
- IPv4 地址解析
- 颜色值转换
- UUID / 进制数字识别

而 JSON 工具涉及结构化树形展示与跨字段导航等独特交互，因此使用独立页面。

## 静态部署

项目不需要构建，直接将整个目录发布即可。适用于：

- GitHub Pages
- Cloudflare Pages
- Netlify
- Nginx
- 任意对象存储或静态文件服务器

由于 Vue 和其他第三方库通过 CDN 加载，直接打开页面时需要网络连接。

## 当前状态

当前已完成核心工具的实现与上线：

- `Any 智能识别`：多面板智能文本识别与转换，覆盖哈希、时间戳、Base64、JWT、IPv4、颜色、UUID、URL 等类型，并支持计算操作。
- `Monaco 工具箱`：多语言编辑、文本对比、格式转换、内容预览和隔离 JavaScript Console。
- `JSON 查看`：从日志或不规则文本中深度提取并可视化 JSON。
- `JSON 节点编辑`：基于 Svelte-JSONEditor 的双栏对比与编辑工具，含完整汉化。
- `微信群接龙助手`：移动端接龙打卡统计、人员维护、通知文案生成、CSV 查看与下载。
- `GitHub Explorer`：深度调用 GitHub Search API，支持高级条件组合、智能下拉推荐、暗黑主题以及实时的自定义多模板排版生成。
- `maxGraph 专业绘图工作台`：集成 `@maxgraph/core` 提供拖拽式建模与官方 Demo 实战演练环境。
- `Mermaid Live Editor`：基于 Mermaid.js 实现了代码转图表的实时工作流，内置防抖渲染、拖拽缩放与图片导出功能。

## 开发规划与 TODO

- **JSON 节点编辑 (Svelte-JSONEditor) 汉化方案更新**：
  - **现状**：Svelte-JSONEditor 的最新稳定发布版 CDN (`v3.12.0`) 尚未合并 native `language` 汉化配置，因此目前在 [editor.js](./text/json/editor.js) 中使用 `MutationObserver` 结合 `onRenderMenu` 的双层翻译引擎来处理。
  - **TODO**：待 Svelte-JSONEditor 的官方稳定版 CDN 正式发布并支持 native 汉化属性后（合并了 PR #565 / 相关 issue #368 后），应将翻译机制精简，直接将翻译字典传递给 native 的 `language` 配置项。
  - **参考链接**：
    - [Svelte-JSONEditor GitHub PR 565](https://github.com/josdejong/svelte-jsoneditor/pull/565)
    - [Svelte-JSONEditor GitHub Issue 368](https://github.com/josdejong/svelte-jsoneditor/issues/368)
