# maxGraph 专业绘图工作台

这是一个基于 [@maxgraph/core](https://github.com/maxgraph/maxGraph) 构建的现代化、极客范儿的纯前端拓扑/流程图绘制工作台。不仅包含了类似 Draw.io 的控件拖拽编辑器，还完美融合了官方的 Storybook Demo 源码预览与深度数据互通功能。

## 📜 背景与技术栈演进 (History & Tech Stack)

在深入了解本项目之前，有必要了解支撑这一切的强大底层技术的演进历程：

1. **[mxGraph] 传奇的诞生**: <br>
   2005 年发布的 mxGraph 是一款纯 JavaScript 编写的矢量绘图库，它定义了浏览器端流程图绘制的行业标杆，以极其强大和灵活的底层架构著称，但由于年代久远，其代码主要基于 ES5，缺乏模块化支持。

2. **[Draw.io (diagrams.net)] 商业的巅峰**: <br>
   这是基于 mxGraph 打造的全球最著名的开源在线流程图绘制软件。Draw.io 的巨大成功证明了 mxGraph 引擎的商业价值。后来官方宣布 mxGraph 停止维护并将其彻底开源。<br>
   👉 体验地址: [https://app.diagrams.net/](https://app.diagrams.net/)

3. **[maxGraph] 现代化的重生**: <br>
   由于原版 mxGraph 无法满足现代前端工程化（如 TypeScript、ES Modules、Tree-shaking）的需求，开源社区基于 mxGraph 发起了彻底的重构项目 —— **maxGraph**。它保留了 mxGraph 强大的数据模型与渲染引擎，但使用了现代 TypeScript 进行了完全重写。<br>
   👉 官方 Demo 演示区: [https://maxgraph.github.io/maxGraph/demo/](https://maxgraph.github.io/maxGraph/demo/)

本项目即是基于 **maxGraph** 最新生态构建的现代 Web 绘图工作台，旨在提供媲美 Draw.io 体验的同时，探索新一代 API 的最佳实践。

## 🌟 核心特性 (Features)

1. **Draw.io 级控件网格面板 (Palette)**
   - 纯手工绘制的 SVG 发光感缩略图，按照功能分为 **通用、基础、流程图、箭头、容器 (泳道)** 五大类别。
   - 所有分类支持折叠/展开，采用响应式网格布局，空间利用率极高。
   - 完全支持拖拽生成 (Drag and Drop) 并且自动初始化特定的内置样式。

2. **双核引擎工作模式 (Dual-Mode Engine)**
   - **✏️ 工作台 (Workspace)**: 您的专属绘图画布。支持鹰眼小地图 (Outline)、多节点选取框 (RubberBand)、自定义节点文本等常用功能。
   - **🚀 官方 Demo 预览 (Demo Explorer)**: 动态加载并渲染 `@maxgraph/core` 官方仓库提供的百余个演示用例。树状目录自动按照真实结构组织（解析 `/` 路径）。

3. **"提取数据到工作台" (Data Interoperability)**
   - 最硬核的功能：遇到官方 Demo 中展示的华丽效果或复杂图表时，您可以直接点击**提取数据到工作台**，一键将官方演示的 XML 结构无损抓取并覆盖到您自己的画布中继续编辑。
   - *（技术难点：解决了不同内存上下文导致序列化产生的 `too much recursion` 与跨领域 `instanceof` 检测失效问题）*。

4. **原生本地文件读写 (Native File I/O)**
   - 摒弃了落后的文本框复制粘贴。
   - 支持一键导出并下载标准的 `maxgraph-diagram.xml` 文件到本地。
   - 支持通过系统文件选择器，本地挑选 `.xml` 瞬间覆盖导入画布。

5. **沙盒构建系统与源码检视**
   - 通过 `esbuild` 动态打包整个官方 Demo 目录 (`stories-build.js`) 并导出至全局作用域 `window.MaxGraphStories`。
   - **查看本地源码** 功能允许您在研究 Demo 效果时，直接在界面上呼出弹窗检视该效果的原始 TypeScript 源码并一键复制。

---

## 🛠️ 技术架构 (Architecture)

1. **纯前端与 CDN (Zero-Setup UI)**
   - 主体 UI 全部在 `index.html` 中实现。
   - 基于 Vue 3 (CDN 引入) 进行状态与事件绑定管理，无缝衔接非响应式的 `maxGraph` 原生 DOM。
   - 使用现代 CSS Grid 和 Flexbox 完成毛玻璃 (Glassmorphism) 与暗色系极客 UI，未使用繁重的组件库。

2. **构建脚本 (`stories-build.js`)**
   - 使用 `esbuild` 处理模块导入与 TypeScript。
   - **Babel 插件动态注入**：为彻底解决第三方老旧代码带来的 `must call super constructor before using 'this' in derived class constructor` 报错，构建脚本内置了 AST 修改，强制通过 `Reflect.construct` 代理部分原型的继承。
   - **统一依赖输出**：在构建输出中，强制将官方 Demo 使用的 `ModelXmlSerializer` 暴露在 `window.MaxGraphStories.ModelXmlSerializer` 中，确保业务层面的 `XML` 序列化与反序列化发生在同一个内存 realm，避免引用死循环。

---

## 📖 使用指南 (User Guide)

### 1. 运行项目
在项目根目录运行 HTTP 服务：
```bash
npx http-server -p 3011 -c-1
```
或使用 Python：
```bash
python -m http.server 3011 --bind 127.0.0.1
```
随后在浏览器中打开：`http://127.0.0.1:3011/gpt/index.html`

### 2. 认识主界面
界面分为三大区域：
- **左侧边栏 (Sidebar)**：可以在 `🎨 控件` 和 `📚 官方 Demo` 两个选项卡之间切换。
- **中间主区域 (Main Canvas)**：工作台编辑区与 Demo 渲染区。
- **右侧面板 (Property & Outline)**：显示当前选中节点的属性修改框（可修改文字），并在下方实时展示画布的鹰眼试图（可以拖动蓝色框框漫游画布）。

### 3. 如何编辑节点
- 在左侧控件栏长按您喜欢的图标，**拖拽**到画布松手。
- 单击选中节点后，按 `Delete` 或 `Backspace` 可删除节点。
- 选中节点后，**右侧的「属性设置」栏** 会出现输入框，在此输入文字即可修改节点 Label（文本）。
- 图形之间可以通过悬浮在节点上方出现的绿色提示点（箭头图标）向外拖动连线。

### 4. 玩转官方 Demo
1. 点击左侧栏的 `📚 官方 Demo`。
2. 展开任意分类并点击带有 `📄` 图标的页面名称。
3. 中间区域会自动切换到 `🚀 官方 Demo 预览` 并在沙盒容器内运行该脚本。
4. 如果对该 Demo 的代码实现感兴趣，请点击右上角的 **👨‍💻 查看本地源码**。
5. 如果希望基于该 Demo 接着画图，点击右上角的 **📥 提取数据到工作台**，系统会瞬间将该 Demo 切回您的工作台并导入数据！

### 5. 文件导入与导出
通过顶部的工具栏进行文件 I/O：
- **💾 导出文件 (.xml)**：会唤起浏览器下载，生成 `maxgraph-diagram.xml` 保存在电脑里。
- **📂 导入文件 (.xml)**：会唤起系统文件选择窗口，选中后直接覆盖当前画布。
- 这两个按钮旁边还附带了非常实用的 `放大 (+)`、`缩小 (-)` 以及 `1:1 (还原)` 视图按钮，也支持一键 **清空** 画布。
