# GitHub Explorer & Template Generator

一个专为开发者打造的高级 GitHub 仓库搜索与 Markdown 模板生成工具，完全使用原生 HTML/CSS/JS (Vanilla) 构建，无需任何第三方框架依赖。

## ✨ 核心特性

### 1. 强大的搜索能力 (Search API)
* 告别只能查询单一用户的限制，底层全面接入强大的 GitHub Search API (`/search/repositories`)。
* **高级查询面板**：可视化地输入 `Owner`, `Language`, `Min Stars`, `Topic` 等常用条件，后台自动拼装为类似 `user:microsoft language:javascript stars:>=1000` 的高级检索语法。
* **智能下拉推荐**：基于原生 HTML `<datalist>` 技术，当你点击输入框时，会自动弹出目前最潮流的选项推荐：
  * **大厂预设**: `microsoft`, `google`, `openai`, `spring-projects` 等。
  * **潮流语言**: `rust`, `go`, `python`, `typescript` 等。
  * **热门主题**: `ai`, `llm`, `spring-boot`, `machine-learning` 等。
* **全局服务器端排序**：排序操作 (Stars, Forks, Last Updated) 直接交给 GitHub 服务端完成。无论项目库有多大，第一页展现的永远是该领域最顶级的开源项目。

### 2. 开发者友好的 UI 设计
* **GitHub 级复刻体验**：
  * **极速 Git Clone**：与 GitHub 官方一致的 Clone 面板。支持自由切换 `HTTPS`, `SSH`, 和 `GitHub CLI` (`gh repo clone ...`)，并配有一键复制（Copy）功能，复制成功后会展示绿色的 Check 动画图标。
  * **丰富的仓库卡片**：直接展示 Owner 专属圆形头像、完整的 `owner/repo` 仓库名、Star/Fork 数量，甚至包括 🚨 Open Issues 数量以及 ⚖️ License (许可证) 信息。
* **双主题切换**：精心调优的 Light / Dark (暗黑) 模式，丝滑切换且持久化记忆，下拉菜单和所有组件完美适配暗黑主题，告别刺眼高光。

### 3. 超级模板生成器 (Template Preset System)
除了发现优秀项目，本工具还是一款强大的排版利器：
* **多模板预设系统**：内置三种开箱即用的精品模板：
  * `Markdown List`（带引用块的精美列表）
  * `Markdown Table`（规整的 Markdown 表格）
  * `CSV Format`（数据导出格式）
* **即改即存 (Auto-Save)**：所有对模板的修改，将在敲击键盘 0.5 秒后自动隐式保存到浏览器 `localStorage` 中，并在 UI 上闪现 `Auto-saved ✓` 绿色提示。关闭页面、明天再来，你的专属模板依旧在那儿！
* **另存为 (Save As)**：支持将当前模板另存为专属名称（如“我的周报格式”），并支持在非系统默认模板中随意切换和删除。
* **实时动态渲染**：基于正则表达式引擎的 `${key}` 替换语法。左侧无论如何翻页、过滤，右侧都会毫秒级实时生成渲染好的最终排版输出。

### 4. 数据透视 (Raw JSON View)
* 右侧区域支持切换选项卡到 `Raw JSON`，直接美化查看当前这批 Repository 的所有原始数据结构，适合有 API 对接或二次开发需求的用户。

### 5. PAT 速率解锁
* 支持在设置面板 (Settings) 录入 GitHub Personal Access Token (PAT)，一键绕过 IP 级别 60次/小时 的查询限制，提升至 5000次/小时，令牌加密存储在本地，绝对安全。

---
**如何运行?**
无需任何 Node/NPM 依赖安装，直接使用任意静态服务器运行 `index.html` 即可。例如：
```bash
npx http-server -p 3001
```
