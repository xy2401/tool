# Dev Tools

一个面向所有人的在线工具集合，无需安装，打开网页即可使用。

## 功能导航

### text

- [文本工具](./text/) - 常用文本编码、摘要和随机内容生成。
- [Monaco 编辑器](./text/monaco/) - 使用最新稳定版 Monaco Editor 在线编辑文本和代码。
- [JSON 查看](./text/json/) - 从日志或不规则文本中深度提取 JSON，支持转义解构与局部回填。

### data

- [JSON 工具](./data/json.html) - 格式化、压缩和校验 JSON 数据。

### time

- [时间戳工具](./time/) - 在 Unix 时间戳与日期时间之间转换。

### human

- [JSON 查看](./human/json.html) - 从文本中提取、格式化并查看 JSON 数据。
- [JSON Editor](./human/jsoneditor.html) - 可视化查看、编辑和提取 JSON 数据。
- [Monaco Editor](./human/monaco.html) - 在线体验多语言代码编辑器。
- [Monaco Diff](./human/monaco-diff.html) - 并排或行内比较两段代码。
- [Monaco Playground](./human/monaco-playground.html) - 编辑并运行 JavaScript、HTML 和 CSS。

## 功能列表

### text

#### [文本工具](./text/)

集中放置界面和操作方式相近的文本处理功能。计划包含 Base64、URL
编解码、哈希摘要、UUID、密码和随机字符串等常用操作。

#### [Monaco 编辑器](./text/monaco/)

使用 Monaco Editor `0.55.1` 提供在线文本和代码编辑能力，支持语言切换、
深浅主题、自动布局和文档格式化。

#### [JSON 查看](./text/json/)

从日志或不规则文本中深度提取 JSON，支持解析多次转义的嵌套 JSON 并递归生成节点树，
提供缩进与过滤格式化，并支持局部修改反向合并更新源文本。

### data

#### [JSON 工具](./data/json.html)

用于格式化、压缩和校验 JSON 数据。该页面为结构化数据工具预留独立的
操作空间，目前仍处于页面骨架阶段。

### time

#### [时间戳工具](./time/)

用于 Unix 时间戳与日期时间之间的转换，后续可支持秒、毫秒、时区和常用
日期格式。

### human

#### [JSON 查看](./human/json.html)

手写原生页面。从混合文本中提取并格式化 JSON，支持自动解构多次转义的 JSON
字符串，递归解析内部嵌套 JSON 并生成节点树，支持字段过滤与局部修改反向合并。

#### [JSON Editor](./human/jsoneditor.html)

基于 `jsoneditor` 库的页面。支持从混合文本提取 JSON，通过代码编辑器与树形
编辑器双栏同步展示，便于对深层嵌套的对象与数组进行可视化查看和编辑。

#### [Monaco Editor](./human/monaco.html)

基于 Monaco Editor 的多语言在线代码编辑页面，可以切换语言和编辑器主题。

#### [Monaco Diff](./human/monaco-diff.html)

使用 Monaco Diff Editor 比较两段代码，支持并排差异和行内差异显示。

#### [Monaco Playground](./human/monaco-playground.html)

提供 JavaScript、HTML 和 CSS 三个编辑区域，可以加载示例并直接运行查看
结果。

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
│  └─ index.html       # 文本类工具
├─ data/
│  └─ json.html        # JSON 工具
├─ time/
│  └─ index.html       # 时间类工具
├─ human/
│  └─ README.md        # 人工手写、非 AI 生成的功能
└─ README.md
```

目录会随着工具类型增加而扩展，但不为每个小功能单独创建文件夹。
界面和交互方式相近的功能应尽量合并在同一个页面中。

## 页面约定

每个工具页面应包含完整的 HTML、CSS 和 JavaScript：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>工具名称</title>
  <style>
    /* 当前页面的全部样式 */
  </style>
</head>
<body>
  <div id="app"></div>

  <script src="https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js"></script>
  <script>
    const { createApp } = Vue;

    createApp({
      data() {
        return {};
      },
      methods: {}
    }).mount("#app");
  </script>
</body>
</html>
```

页面之间可以通过普通链接跳转，但不应通过相对路径加载其他页面的资源。

## 分类思路

分类优先考虑页面结构和交互方式是否相似，而不是只按功能名称或操作类型划分。

例如，以下功能可以集中在文本工具页面：

- Base64 编码与解码
- URL 编码与解码
- 哈希摘要
- UUID 生成
- 密码生成
- 随机字符串生成

JSON 工具具有格式化、压缩、校验和结构展示等独特交互，因此可以使用独立页面。

## 静态部署

项目不需要构建，直接将整个目录发布即可。适用于：

- GitHub Pages
- Cloudflare Pages
- Netlify
- Nginx
- 任意对象存储或静态文件服务器

由于 Vue 和其他第三方库通过 CDN 加载，直接打开页面时需要网络连接。

## 当前状态

当前只完成了项目结构和页面骨架，具体工具功能尚未实现。
