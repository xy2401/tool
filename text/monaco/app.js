require.config({
  paths: {
    vs: `${MONACO_BASE_URL}vs`
  }
});

require(["vs/editor/editor.main"], async () => {
  const workspaceNode = document.getElementById("workspace");
  const editorNode = document.getElementById("editor");
  const htmlPreviewFrame = document.getElementById("html-preview");
  const languageSelect = document.getElementById("language");
  const autoSelect = document.getElementById("auto");
  const demoSelect = document.getElementById("demo");
  const themeSelect = document.getElementById("theme");
  const minimapInput = document.getElementById("minimap");
  const diffEnabledInput = document.getElementById("diff-enabled");
  const diffModeSelect = document.getElementById("diff-mode");
  const sortJsonDiffButton = document.getElementById("sort-json-diff");
  const htmlPreviewControl = document.querySelector(
    ".html-preview-control"
  );
  const htmlPreviewInput = document.getElementById(
    "html-preview-enabled"
  );
  const htmlToMarkdownButton = document.getElementById(
    "html-to-markdown"
  );
  const undoHtmlToMarkdownButton = document.getElementById(
    "undo-html-to-markdown"
  );
  const markdownPreviewControl = document.querySelector(
    ".markdown-preview-control"
  );
  const markdownPreviewInput = document.getElementById(
    "markdown-preview-enabled"
  );
  const javascriptPreviewControl = document.querySelector(
    ".javascript-preview-control"
  );
  const javascriptPreviewInput = document.getElementById(
    "javascript-preview-enabled"
  );
  const svgPreviewControl = document.querySelector(
    ".svg-preview-control"
  );
  const svgPreviewInput = document.getElementById(
    "svg-preview-enabled"
  );
  const base64PreviewControl = document.querySelector(
    ".base64-preview-control"
  );
  const base64PreviewInput = document.getElementById(
    "base64-preview-enabled"
  );
  const jsonToYamlButton = document.getElementById("json-to-yaml");
  const yamlToJsonButton = document.getElementById("yaml-to-json");
  const minifyOneLineButton = document.getElementById("minify-one-line");
  const conversionStatus = document.getElementById("conversion-status");
  const openFileButton = document.getElementById("open-file");
  const fileInput = document.getElementById("file-input");
  const fileStatus = document.getElementById("file-status");
  let sampleFiles = {};
  const javascriptConsoleTemplatePromise = fetch(
    "./previews/javascript-console.html",
    {
      cache: "no-store"
    }
  ).then(response => {
    if (!response.ok) {
      throw new Error("JavaScript Console 模板加载失败");
    }

    return response.text();
  });

  try {
    const response = await fetch("./languages/index.json", {
      cache: "no-store"
    });
    if (response.ok) {
      sampleFiles = await response.json();
    }
  } catch (error) {
    console.warn("语言示例清单加载失败", error);
  }

  async function loadSample(language) {
    const file = sampleFiles[language];

    if (!file) {
      return "";
    }

    try {
      const response = await fetch(`./languages/${file}`, {
        cache: "no-store"
      });
      return response.ok ? await response.text() : "";
    } catch (error) {
      console.warn(`${language} 示例加载失败`, error);
      return "";
    }
  }

  const HIGHLIGHT_LANGUAGE_MAP = {
    bash: "shell",
    css: "css",
    go: "go",
    java: "java",
    javascript: "javascript",
    json: "json",
    markdown: "markdown",
    php: "php",
    python: "python",
    sql: "sql",
    typescript: "typescript",
    xml: "xml",
    yaml: "yaml"
  };

  function normalizeDetectedLanguage(language, value) {
    if (language !== "xml") {
      return HIGHLIGHT_LANGUAGE_MAP[language] || language;
    }

    const start = value.replace(/^\uFEFF/, "").trimStart();
    return /^(?:<!doctype\s+html\b|<(?:html|head|body)\b)/i.test(start)
      ? "html"
      : "xml";
  }

  function detectLanguage(value) {
    const text = value.trim();

    if (!text || !window.hljs) {
      return {
        language: null,
        ranking: [],
        details: {}
      };
    }

    const subset = Object.keys(HIGHLIGHT_LANGUAGE_MAP)
      .filter(language => hljs.getLanguage(language));
    const detected = hljs.highlightAuto(text, subset);
    const candidates = [detected, detected.secondBest]
      .filter(candidate => candidate?.language)
      .map(candidate => [
        normalizeDetectedLanguage(candidate.language, value),
        candidate.relevance
      ]);
    const ranking = Array.from(
      new Map(candidates.map(([language, relevance]) => [
        language,
        Math.max(
          relevance,
          ...candidates
            .filter(candidate => candidate[0] === language)
            .map(candidate => candidate[1])
        )
      ]))
    ).sort((left, right) => right[1] - left[1]);
    const [bestLanguage, bestScore = 0] = ranking[0] || [];
    const language = bestScore >= 2 ? bestLanguage : null;
    const details = Object.fromEntries(
      ranking.map(([candidate, relevance]) => [
        candidate,
        [{
          points: relevance,
          unitPoints: relevance,
          count: 1,
          reason: "highlight.js 语法相关度"
        }]
      ])
    );

    return {
      language,
      ranking,
      details
    };
  }

  function legacyDetectLanguage(value) {
    const text = value.trim();

    if (!text) {
      return {
        language: null,
        ranking: [],
        details: {}
      };
    }

    const lines = text.split(/\r?\n/);
    const firstContentLine =
      lines.find(line => line.replace(/^\uFEFF/, "").trim())?.replace(/^\uFEFF/, "").trim() || "";
    const scores = {
      css: 0,
      go: 0,
      html: 0,
      java: 0,
      javascript: 0,
      json: 0,
      markdown: 0,
      php: 0,
      python: 0,
      sql: 0,
      typescript: 0,
      xml: 0,
      yaml: 0
    };
    const details = Object.fromEntries(
      Object.keys(scores).map(language => [language, []])
    );
    const record = (language, points, reason, count = 1, unitPoints = points) => {
      scores[language] += points;
      details[language].push({
        points,
        unitPoints,
        count,
        reason
      });
    };
    const addText = (language, points, pattern, reason) => {
      const flags = Array.from(new Set(
        `${pattern.flags.replace("y", "")}g`.split("")
      )).join("");
      const globalPattern = new RegExp(pattern.source, flags);
      const count = Array.from(text.matchAll(globalPattern)).length;

      if (count) {
        record(language, points * count, reason, count, points);
      }
    };
    const addLine = (language, points, pattern, reason) => {
      const linePattern = new RegExp(
        pattern.source,
        pattern.flags.replace(/[gy]/g, "")
      );
      const count = lines.reduce(
        (total, line) => total + (linePattern.test(line) ? 1 : 0),
        0
      );

      if (count) {
        record(language, points * count, reason, count, points);
      }
    };

    try {
      JSON.parse(text);
      record("json", 100, "可以被 JSON.parse 完整解析");
    } catch {}

    // PHP：文件通常以 <?php 开始，并大量使用 $变量和 echo。
    addLine("php", 12, /^\s*<\?php\b/i, "以 <?php 开头");
    addLine("php", 4, /\$\w+\s*=/, "出现 PHP 变量赋值");
    addLine("php", 3, /\becho\s+["']/, "出现 echo 输出");

    // HTML：首个有效行的 doctype/html 标签是文档级强特征。
    if (/^<!doctype\s+html\b/i.test(firstContentLine)) {
      record("html", 60, "首个有效行是 HTML doctype");
    } else if (/^<html\b[\s>]/i.test(firstContentLine)) {
      record("html", 50, "首个有效行是 html 根标签");
    } else if (/^<(head|body)\b[\s>]/i.test(firstContentLine)) {
      record("html", 30, "首个有效行是 HTML 文档标签");
    }
    addText("html", 20, /<html\b[\s>][\s\S]*<\/html>/i, "出现完整 html 根标签");
    addLine("html", 4, /<(head|body)\b[\s>]|<\/(head|body)>/i, "出现 head/body 标签");
    addLine("html", 3, /<(div|section|main|header|footer|article)\b[\s>]|<\/(div|section|main|header|footer|article)>/i, "出现 HTML 语义标签");
    addLine("html", 3, /<(script|style)\b[\s>]|<\/(script|style)>/i, "出现 script/style 标签");
    addLine("html", 2, /<[a-z][\w-]*(?:\s+[^<>]*)?>/i, "出现普通 HTML 标签");

    // XML：声明、根节点和成对标签共同判断，命名空间与单引号属性也应支持。
    const xmlBody = text.replace(/^\uFEFF/, "")
      .replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "")
      .replace(/^\s*<!--[\s\S]*?-->\s*/, "");
    const xmlRootMatch = xmlBody.match(
      /^<([\w:-]+)(?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*>[\s\S]*<\/\1>\s*$/
    );
    const xmlRootName = xmlRootMatch?.[1] || "";
    const hasXmlDeclaration = /^<\?xml\b/i.test(firstContentLine);
    const isHtmlRoot = xmlRootName.toLowerCase() === "html";
    const hasXmlRoot = Boolean(xmlRootMatch) && !isHtmlRoot;
    const firstXmlLine = xmlBody.split(/\r?\n/, 1)[0].trim();
    const startsWithXmlRoot =
      hasXmlRoot &&
      new RegExp(`^<${xmlRootName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|>)`).test(firstXmlLine);
    const xmlTagCount =
      (xmlBody.match(/<\/?[\w:-]+(?:\s+[^<>]*?)?\s*\/?>/g) || []).length;
    const isLikelyXml =
      hasXmlDeclaration || (hasXmlRoot && xmlTagCount >= 2);

    if (hasXmlDeclaration) {
      record("xml", 70, "首个有效行是 XML 声明");
    }
    if (startsWithXmlRoot) {
      record("xml", 45, `文档以 XML 根标签 <${xmlRootName}> 开始`);
    }
    if (hasXmlRoot) {
      record("xml", 25, "整体是完整且首尾匹配的 XML 根节点");
    }
    if (isLikelyXml && xmlTagCount >= 2) {
      record(
        "xml",
        Math.min(xmlTagCount, 8),
        `出现 ${xmlTagCount} 个 XML 标签`
      );
    }
    if (!isHtmlRoot) {
      addLine("xml", 3, /<\/[\w:-]+>/, "出现 XML 闭合标签");
    }

    // Markdown：代码围栏和井号标题都是强特征。
    // ```html 里的 html 表示内嵌代码，不表示整篇文档是 HTML。
    const fencedLanguages = lines
      .map(line => line.match(/^\s*```([a-zA-Z0-9_+-]*)/))
      .filter(Boolean)
      .map(match => match[1].toLowerCase());
    if (fencedLanguages.length) {
      record(
        "markdown",
        10 + Math.min((fencedLanguages.length - 1) * 2, 6),
        `出现 ${fencedLanguages.length} 个 Markdown 代码围栏`
      );

      const fencedLanguageMap = {
        bash: "shell",
        css: "css",
        go: "go",
        html: "html",
        java: "java",
        javascript: "javascript",
        js: "javascript",
        json: "json",
        markdown: "markdown",
        md: "markdown",
        php: "php",
        python: "python",
        py: "python",
        sql: "sql",
        typescript: "typescript",
        ts: "typescript",
        xml: "xml",
        yaml: "yaml",
        yml: "yaml"
      };

      fencedLanguages.forEach(label => {
        const embeddedLanguage = fencedLanguageMap[label];
        if (embeddedLanguage && embeddedLanguage !== "markdown" && scores[embeddedLanguage] !== undefined) {
          record(
            embeddedLanguage,
            -8,
            `代码围栏标记为 ${label}，它是内嵌代码而非外层文档`
          );
        }
      });
    }

    // 井号后带空格的标题行是强特征，多级标题越多可信度越高。
    addLine("markdown", 8, /^\s{0,3}#{1,6}\s+\S/, "出现井号 Markdown 标题");
    // 其余结构用于继续叠加判断：链接、引用、列表、粗体和表格。
    addLine("markdown", 3, /\[[^\]]+\]\([^)]+\)/, "出现 Markdown 链接");
    addLine("markdown", 2, /^\s*>\s+\S/, "出现 Markdown 引用");
    addLine("markdown", 2, /^\s*[-*+]\s+\S/, "出现无序列表");
    addLine("markdown", 2, /^\s*\d+\.\s+\S/, "出现有序列表");
    addLine("markdown", 2, /\*\*[^*]+\*\*/, "出现粗体标记");
    addLine("markdown", 2, /^\s*\|.+\|\s*$/, "出现 Markdown 表格行");
    // 出现完整 HTML 文档时降低 Markdown 得分，避免被正文中的 # 或列表误导。
    addLine("markdown", -4, /^\s*(?:<!doctype\s+html\b|<html\b[\s>])/i, "出现完整 HTML 文档特征");
    // 同时出现标题和另一种 Markdown 结构时，说明它更像一篇 Markdown 文档。
    if (
      lines.some(line => /^\s{0,3}#{1,6}\s+\S/.test(line)) &&
      lines.some(line =>
        /^\s*[-*+]\s+\S/.test(line) ||
        /\[[^\]]+\]\([^)]+\)/.test(line) ||
        /\*\*[^*]+\*\*/.test(line) ||
        /^\s*```/.test(line)
      )
    ) {
      record("markdown", 4, "同时出现标题和其他 Markdown 结构");
    }

    // SQL：语句开头与 FROM、WHERE、JOIN 等子句组合出现时可信度较高。
    const hasSqlStatement = lines.some(line =>
      /^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(line)
    );
    addLine("sql", 6, /^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i, "出现 SQL 主语句");
    addLine("sql", 3, /\b(FROM|VALUES|SET|TABLE|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY)\b/i, "出现 SQL 子句");
    if (hasSqlStatement && /;\s*$/.test(text)) {
      record("sql", 2, "SQL 语句以分号结束");
    }
    if (isLikelyXml) {
      record("sql", -12, "整体具有明确 XML 文档结构");
    }

    // Go：package、func 和 fmt 输出调用是常见且较独特的语法。
    addLine("go", 8, /^\s*package\s+\w+/, "出现 Go package 声明");
    addLine("go", 5, /^\s*func\s+\w+\s*\(/, "出现 Go func 函数");
    addLine("go", 3, /\bfmt\.(Print|Printf|Println)\s*\(/, "出现 fmt 输出调用");

    // Java：访问修饰符、main 方法和 System.out.println 是主要特征。
    addLine("java", 7, /\b(public|private|protected)\s+(class|interface|static|void)\b/, "出现 Java 访问修饰符和类型声明");
    addLine("java", 5, /\bSystem\.out\.println\s*\(/, "出现 System.out.println");
    addLine("java", 3, /\bpublic\s+static\s+void\s+main\s*\(/, "出现 Java main 方法");

    // Python：以冒号结尾的 def/class、导入语句、print 和缩进关键字用于判断。
    addLine("python", 6, /^\s*(def|class)\s+\w+.*:\s*$/, "出现 Python def/class 和行尾冒号");
    addLine("python", 4, /^\s*(from\s+\w+\s+import|import\s+\w+)/, "出现 Python import");
    addLine("python", 3, /^\s*print\s*\(/, "出现 Python print");
    addLine("python", 2, /^\s+(return|yield|pass)\b/, "出现 Python 缩进语句");

    // TypeScript：类型声明和类型标注用于区别普通 JavaScript。
    addLine("typescript", 6, /^\s*(interface|type|enum)\s+\w+/, "出现 TypeScript 类型声明");
    addLine("typescript", 5, /:\s*(string|number|boolean|unknown|never|void)(?:\[\])?\b/, "出现 TypeScript 类型标注");
    addLine("typescript", 3, /\b(import|export)\s+type\b/, "出现类型导入或导出");

    // CSS：选择器块、属性声明和 @media 等 at-rule 共同构成主要特征。
    addLine("css", 5, /^\s*[.#]?[a-zA-Z][\w-]*(?:\s+[.#]?[\w-]+)*\s*\{/, "出现 CSS 选择器块");
    addLine("css", 4, /^\s*(?:--)?[\w-]+\s*:\s*[^;{}]+;/, "出现 CSS 属性声明");
    addLine("css", 3, /^\s*@(?:media|supports|keyframes|import)\b/, "出现 CSS at-rule");
    if (isLikelyXml) {
      record("css", -12, "整体具有明确 XML 文档结构");
    }

    // YAML：键值、数组项和缩进键用于判断；出现分号或花括号时主动扣分。
    addLine("yaml", 4, /^[\w.-]+\s*:\s*(?:\S.*)?$/, "出现 YAML 顶层键值");
    addLine("yaml", 3, /^\s+-\s+[\w"']/, "出现 YAML 数组项");
    addLine("yaml", 2, /^\s{2,}[\w.-]+\s*:/, "出现 YAML 缩进键值");
    addLine("yaml", -5, /[;{}]/, "出现分号或花括号，不像 YAML");

    // JavaScript：声明、console、箭头函数和模块语法加分；类型标注更偏向 TypeScript。
    addLine("javascript", 4, /\b(function|const|let|var|class|async)\b/, "出现 JavaScript 声明关键字");
    addLine("javascript", 4, /\bconsole\.(log|error|warn)\s*\(/, "出现 console 调用");
    addLine("javascript", 3, /=>/, "出现箭头函数");
    addLine("javascript", 2, /\b(import|export)\b/, "出现模块导入或导出");
    addLine("javascript", -3, /:\s*(string|number|boolean|unknown|never|void)(?:\[\])?\b/, "出现类型标注，更像 TypeScript");

    const ranking = Object.entries(scores)
      .sort((left, right) => right[1] - left[1]);
    const [bestLanguage, bestScore] = ranking[0];
    const secondScore = ranking[1][1];

    // 低于 4 分不自动识别；低分候选差距不足 2 分时也保持当前语言。
    const language =
      bestScore >= 4 && (bestScore >= 8 || bestScore - secondScore >= 2)
        ? bestLanguage
        : null;

    return {
      language,
      ranking,
      details
    };
  }

  function renderAutoScores(result) {
    const summary = document.createElement("option");
    summary.value = "";
    summary.textContent = result.language
      ? `识别：${result.language}`
      : "未能确定";
    summary.selected = true;

    const options = result.ranking.map(([language, score]) => {
      const option = document.createElement("option");
      option.value = language;
      option.textContent = `${language} · ${score}`;
      return option;
    });

    autoSelect.replaceChildren(summary, ...options);
    autoSelect.disabled = result.ranking.length === 0;
  }

  function logLanguageScore(result, language) {
    const total = result.ranking.find(item => item[0] === language)?.[1] || 0;
    const rows = (result.details[language] || []).map(item => ({
      语言: language,
      单次权重: item.unitPoints > 0 ? `+${item.unitPoints}` : item.unitPoints,
      命中次数: item.count,
      累计分数: item.points > 0 ? `+${item.points}` : item.points,
      原因: item.reason
    }));

    console.groupCollapsed(`[语法识别] ${language} 总分：${total}`);
    if (rows.length) {
      console.table(rows);
    } else {
      console.log("没有命中任何评分规则。");
    }
    console.groupEnd();
  }

  function logDetection(result) {
    console.groupCollapsed(
      `[语法识别] 自动结果：${result.language || "未确定"}`
    );
    console.table(
      result.ranking.map(([language, score]) => ({
        语言: language,
        总分: score
      }))
    );
    console.groupEnd();

    if (result.language) {
      logLanguageScore(result, result.language);
    }
  }

  function languageFromFilename(filename, languageDefinitions) {
    const lowerName = filename.toLowerCase();
    const exactMatch = languageDefinitions.find(language =>
      (language.filenames || []).some(name => name.toLowerCase() === lowerName)
    );

    if (exactMatch) {
      return exactMatch.id;
    }

    const extensionMatches = languageDefinitions
      .flatMap(language =>
        (language.extensions || []).map(extension => ({
          extension: extension.toLowerCase(),
          language: language.id
        }))
      )
      .filter(item => lowerName.endsWith(item.extension))
      .sort((left, right) => right.extension.length - left.extension.length);

    return extensionMatches[0]?.language || null;
  }

  const initialValue = await loadSample("javascript");
  let lastDetectionResult = {
    language: null,
    ranking: [],
    details: {}
  };
  editorNode.replaceChildren();

  const editorOptions = {
    automaticLayout: true,
    minimap: {
      enabled: false
    },
    fontSize: 14,
    padding: {
      top: 14
    },
    scrollBeyondLastLine: false
  };
  const primaryModel = monaco.editor.createModel(
    initialValue,
    "javascript"
  );
  let editor = null;
  let diffEditor = null;
  let diffOriginalModel = null;
  let diffModifiedModel = null;
  let pasteDisposable = null;
  let contentChangeDisposable = null;
  let previewTimer = null;
  let previewRenderVersion = 0;
  let htmlConversionSnapshot = null;

  const getActiveEditor = () =>
    diffEditor ? diffEditor.getModifiedEditor() : editor;
  const getActiveModel = () => getActiveEditor().getModel();
  const focusEditor = () => getActiveEditor().focus();

  function createMarkdownDocument(markdown) {
    if (!window.marked || !window.DOMPurify) {
      return "";
    }

    const rendered = marked.parse(markdown, {
      gfm: true,
      breaks: false
    });
    const clean = DOMPurify.sanitize(rendered, {
      USE_PROFILES: {
        html: true
      }
    });

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
:root { color-scheme: light; font-family: system-ui, sans-serif; }
body { max-width: 900px; margin: 0 auto; padding: 32px; color: #1f2328; background: #fff; line-height: 1.65; overflow-wrap: break-word; }
h1, h2, h3, h4, h5, h6 { color: #1f2328; line-height: 1.25; }
h1, h2 { padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
img { max-width: 100%; }
pre { overflow: auto; padding: 16px; border-radius: 6px; color: #1f2328; background: #f6f8fa; }
code { font-family: "Cascadia Code", Consolas, monospace; }
:not(pre) > code { padding: 0.15em 0.35em; border-radius: 4px; color: #1f2328; background: #eff1f3; }
blockquote { margin-left: 0; padding-left: 1em; border-left: 4px solid #d0d7de; color: #57606a; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px 12px; border: 1px solid #d0d7de; color: #1f2328; text-align: left; }
tr:nth-child(2n) { background: #f6f8fa; }
a { color: #0969da; }
  </style>
</head>
<body>${clean}</body>
</html>`;
  }

  function isSvgContent(value) {
    return /^\s*(?:<\?xml[\s\S]*?\?>\s*)?<svg\b/i.test(value);
  }

  function parseBase64DataUrl(value) {
    const match = value.trim().match(
      /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([a-z0-9+/=\s]+)$/i
    );

    if (!match) {
      return null;
    }

    return {
      mimeType: match[1].toLowerCase(),
      url: value.trim().replace(/\s+/g, "")
    };
  }

  function createMediaPreviewDocument(content) {
    const escapeHtml = value => value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const escapedContent = escapeHtml(content);

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
html, body { width: 100%; height: 100%; margin: 0; }
body { display: grid; padding: 24px; background: #f6f8fa; place-items: center; box-sizing: border-box; }
img, svg, video, object { max-width: 100%; max-height: 100%; }
audio { width: min(560px, 100%); }
pre { overflow: auto; width: 100%; height: 100%; margin: 0; color: #1f2328; white-space: pre-wrap; overflow-wrap: anywhere; }
.message { color: #57606a; font: 14px system-ui, sans-serif; }
  </style>
</head>
<body>${content.startsWith("<") ? content : escapedContent}</body>
</html>`;
  }

  function createSvgPreviewDocument(value) {
    if (!window.DOMPurify) {
      return createMediaPreviewDocument(
        '<p class="message">SVG 预览组件加载失败</p>'
      );
    }

    const clean = DOMPurify.sanitize(value, {
      USE_PROFILES: {
        svg: true,
        svgFilters: true
      }
    });
    return createMediaPreviewDocument(clean);
  }

  function createBase64PreviewDocument(value) {
    const data = parseBase64DataUrl(value);

    if (!data) {
      return createMediaPreviewDocument(
        '<p class="message">不是有效的 Base64 Data URL</p>'
      );
    }

    const escapedUrl = data.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

    if (data.mimeType.startsWith("image/")) {
      return createMediaPreviewDocument(
        `<img src="${escapedUrl}" alt="Base64 图片预览">`
      );
    }
    if (data.mimeType.startsWith("audio/")) {
      return createMediaPreviewDocument(
        `<audio src="${escapedUrl}" controls></audio>`
      );
    }
    if (data.mimeType.startsWith("video/")) {
      return createMediaPreviewDocument(
        `<video src="${escapedUrl}" controls></video>`
      );
    }
    if (data.mimeType === "application/pdf") {
      return createMediaPreviewDocument(
        `<object data="${escapedUrl}" type="application/pdf" width="100%" height="100%"><p class="message">浏览器无法显示此 PDF。</p></object>`
      );
    }
    if (data.mimeType.startsWith("text/")) {
      try {
        const encoded = data.url.slice(data.url.indexOf(",") + 1);
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, character =>
          character.charCodeAt(0)
        );
        const text = new TextDecoder().decode(bytes);
        const escapedText = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return createMediaPreviewDocument(`<pre>${escapedText}</pre>`);
      } catch {
        return createMediaPreviewDocument(
          '<p class="message">Base64 文本解码失败</p>'
        );
      }
    }

    const escapedMimeType = data.mimeType
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return createMediaPreviewDocument(
      `<p class="message">暂不支持预览 ${escapedMimeType}</p>`
    );
  }

  async function createJavaScriptPreviewDocument(value) {
    const template = await javascriptConsoleTemplatePromise;
    const serializedValue = JSON.stringify(value).replace(/</g, "\\u003c");
    const workerUrl = new URL(
      "./previews/javascript-console-worker.js",
      window.location.href
    );

    return template
      .replace("__JAVASCRIPT_SOURCE__", serializedValue)
      .replace("__WORKER_URL__", JSON.stringify(workerUrl.href))
      .replace("__WORKER_ORIGIN__", workerUrl.origin);
  }

  function renderPreview() {
    const isHtmlPreview = htmlPreviewInput.checked;
    const isMarkdownPreview = markdownPreviewInput.checked;
    const isJavaScriptPreview = javascriptPreviewInput.checked;
    const isSvgPreview = svgPreviewInput.checked;
    const isBase64Preview = base64PreviewInput.checked;

    if (
      !isHtmlPreview &&
      !isMarkdownPreview &&
      !isJavaScriptPreview &&
      !isSvgPreview &&
      !isBase64Preview
    ) {
      return;
    }

    const renderVersion = ++previewRenderVersion;
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(async () => {
      const value = getActiveEditor().getValue();
      try {
        const documentContent = isMarkdownPreview
          ? createMarkdownDocument(value)
          : isJavaScriptPreview
            ? await createJavaScriptPreviewDocument(value)
            : isSvgPreview
              ? createSvgPreviewDocument(value)
              : isBase64Preview
                ? createBase64PreviewDocument(value)
                : value;

        if (renderVersion === previewRenderVersion) {
          htmlPreviewFrame.setAttribute(
            "sandbox",
            isJavaScriptPreview
              ? "allow-scripts allow-same-origin"
              : "allow-scripts"
          );
          htmlPreviewFrame.srcdoc = documentContent;
        }
      } catch (error) {
        if (renderVersion === previewRenderVersion) {
          htmlPreviewFrame.srcdoc = createMediaPreviewDocument(
            `<p class="message">${error.message}</p>`
          );
        }
      }
    }, 120);
  }

  function bindPasteDetection(codeEditor) {
    pasteDisposable?.dispose();
    contentChangeDisposable?.dispose();
    pasteDisposable = codeEditor.onDidPaste(() => {
      window.setTimeout(() => {
        applyDetectedLanguage(codeEditor.getValue());
      }, 0);
    });
    contentChangeDisposable = codeEditor.onDidChangeModelContent(() => {
      syncPreviewAvailability();
      renderPreview();
    });
  }

  function closePreview() {
    htmlPreviewInput.checked = false;
    markdownPreviewInput.checked = false;
    javascriptPreviewInput.checked = false;
    svgPreviewInput.checked = false;
    base64PreviewInput.checked = false;
    previewRenderVersion += 1;
    htmlPreviewFrame.setAttribute("sandbox", "allow-scripts");
    workspaceNode.classList.remove("is-previewing");
    htmlPreviewFrame.srcdoc = "";
    if (typeof saveState === "function") saveState();
  }

  function syncPreviewAvailability() {
    const isHtml = languageSelect.value === "html";
    const isJavaScript = languageSelect.value === "javascript";
    const isMarkdown = languageSelect.value === "markdown";
    const isJson = languageSelect.value === "json";
    const isXml = languageSelect.value === "xml";
    const isYaml = languageSelect.value === "yaml";
    const value = getActiveEditor()?.getValue() || "";
    const isSvg = isSvgContent(value);
    const isBase64 = Boolean(parseBase64DataUrl(value));
    htmlPreviewControl.hidden = !isHtml;
    htmlToMarkdownButton.hidden = !isHtml;
    markdownPreviewControl.hidden = !isMarkdown;
    javascriptPreviewControl.hidden = !isJavaScript;
    svgPreviewControl.hidden = !isSvg;
    base64PreviewControl.hidden = !isBase64;
    jsonToYamlButton.hidden = !isJson;
    yamlToJsonButton.hidden = !isYaml;
    minifyOneLineButton.hidden = !(isJson || isXml);
    minifyOneLineButton.textContent = isXml
      ? "XML 压缩为一行"
      : "JSON 压缩为一行";
    sortJsonDiffButton.hidden = !(isJson && diffEditor);

    if (
      (!isHtml && htmlPreviewInput.checked) ||
      (!isMarkdown && markdownPreviewInput.checked) ||
      (!isJavaScript && javascriptPreviewInput.checked) ||
      (!isSvg && svgPreviewInput.checked) ||
      (!isBase64 && base64PreviewInput.checked)
    ) {
      closePreview();
    }
  }

  function setConversionStatus(message, isError = false) {
    conversionStatus.textContent = message;
    conversionStatus.classList.toggle("is-error", isError);
  }

  function replaceContentAfterConversion(value, language, source) {
    const activeEditor = getActiveEditor();
    const model = activeEditor.getModel();

    activeEditor.pushUndoStop();
    activeEditor.executeEdits(source, [{
      range: model.getFullModelRange(),
      text: value
    }]);
    activeEditor.pushUndoStop();
    languageSelect.value = language;
    monaco.editor.setModelLanguage(primaryModel, language);
    monaco.editor.setModelLanguage(model, language);
    if (diffOriginalModel) {
      monaco.editor.setModelLanguage(diffOriginalModel, language);
    }
    syncPreviewAvailability();
    activeEditor.setPosition({ lineNumber: 1, column: 1 });
    focusEditor();
  }

  function describeConversionError(error) {
    if (error?.mark) {
      return `${error.reason || error.message}（第 ${error.mark.line + 1} 行，第 ${error.mark.column + 1} 列）`;
    }

    return error?.message || "转换失败";
  }

  const naturalKeyCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base"
  });

  function compareJsonKeys(left, right) {
    const naturalOrder = naturalKeyCollator.compare(left, right);

    if (naturalOrder) {
      return naturalOrder;
    }

    return left < right ? -1 : left > right ? 1 : 0;
  }

  function sortJsonObjectKeys(value) {
    if (Array.isArray(value)) {
      return value.map(sortJsonObjectKeys);
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    return Object.keys(value)
      .sort(compareJsonKeys)
      .reduce((sorted, key) => {
        sorted[key] = sortJsonObjectKeys(value[key]);
        return sorted;
      }, {});
  }

  function sortJsonText(value, side) {
    try {
      return `${JSON.stringify(
        sortJsonObjectKeys(JSON.parse(value)),
        null,
        2
      )}\n`;
    } catch (error) {
      throw new Error(`${side} JSON：${error.message}`);
    }
  }

  function replaceEditorValue(codeEditor, value, source) {
    const model = codeEditor.getModel();
    codeEditor.pushUndoStop();
    codeEditor.executeEdits(source, [{
      range: model.getFullModelRange(),
      text: value
    }]);
    codeEditor.pushUndoStop();
  }

  function minifyXml(value) {
    const documentNode = new DOMParser().parseFromString(
      value,
      "application/xml"
    );
    const parserError = documentNode.querySelector("parsererror");

    if (parserError) {
      throw new Error(
        parserError.textContent.replace(/\s+/g, " ").trim()
      );
    }

    const removeWhitespaceNodes = node => {
      Array.from(node.childNodes).forEach(child => {
        if (
          child.nodeType === Node.TEXT_NODE &&
          /^[\t\r\n ]+$/.test(child.nodeValue) &&
          /[\t\r\n]/.test(child.nodeValue)
        ) {
          child.remove();
          return;
        }

        removeWhitespaceNodes(child);
      });
    };

    removeWhitespaceNodes(documentNode);
    return new XMLSerializer()
      .serializeToString(documentNode)
      .replace(/[\r\n\t]+/g, "");
  }

  function createStandaloneEditor() {
    editorNode.replaceChildren();
    editor = monaco.editor.create(editorNode, {
      ...editorOptions,
      model: primaryModel,
      minimap: {
        enabled: minimapInput.checked
      },
      theme: themeSelect.value
    });
    bindPasteDetection(editor);
  }

  function createDiffEditor() {
    closePreview();
    const language = languageSelect.value || "plaintext";
    diffOriginalModel = monaco.editor.createModel(
      primaryModel.getValue(),
      language
    );
    diffModifiedModel = monaco.editor.createModel(
      primaryModel.getValue(),
      language
    );
    editor?.dispose();
    editor = null;
    editorNode.replaceChildren();
    diffEditor = monaco.editor.createDiffEditor(editorNode, {
      ...editorOptions,
      renderSideBySide: diffModeSelect.value === "side-by-side",
      originalEditable: true,
      theme: themeSelect.value
    });
    diffEditor.setModel({
      original: diffOriginalModel,
      modified: diffModifiedModel
    });
    diffEditor.getOriginalEditor().updateOptions({
      minimap: {
        enabled: minimapInput.checked
      }
    });
    diffEditor.getModifiedEditor().updateOptions({
      minimap: {
        enabled: minimapInput.checked
      }
    });
    bindPasteDetection(diffEditor.getModifiedEditor());
    syncPreviewAvailability();
  }

  function closeDiffEditor() {
    primaryModel.setValue(diffModifiedModel.getValue());
    diffEditor.dispose();
    diffEditor = null;
    diffOriginalModel.dispose();
    diffOriginalModel = null;
    diffModifiedModel.dispose();
    diffModifiedModel = null;
    createStandaloneEditor();
    syncPreviewAvailability();
  }

  createStandaloneEditor();

  const languageDefinitions = monaco.languages.getLanguages();
  const languages = languageDefinitions
    .map(language => language.id)
    .sort((left, right) => left.localeCompare(right));
  const commonFormats = [
    "plaintext",
    "javascript",
    "typescript",
    "html",
    "css",
    "json",
    "xml",
    "yaml",
    "markdown",
    "ini",
    "python",
    "java",
    "sql",
    "shell",
    "powershell",
    "bat",
    "dockerfile",
    "graphql",
    "go",
    "php",
    "c",
    "cpp",
    "csharp"
  ].filter(language => languages.includes(language));
  const otherLanguages = languages
    .filter(language => !commonFormats.includes(language));
  const createLanguageGroup = (label, languageIds) => {
    const group = document.createElement("optgroup");
    group.label = label;
    group.append(
      ...languageIds.map(language => {
        const option = document.createElement("option");
        option.value = language;
        option.textContent = language;
        option.selected = language === "javascript";
        return option;
      })
    );
    return group;
  };

  languageSelect.replaceChildren(
    createLanguageGroup("常用格式", commonFormats),
    createLanguageGroup("其他格式", otherLanguages)
  );
  languageSelect.disabled = false;

  const demos = Object.keys(sampleFiles)
    .sort((left, right) => left.localeCompare(right));
  const demoLanguageMap = {
    base64: "plaintext",
    "javascript-run": "javascript",
    svg: "xml"
  };
  demoSelect.replaceChildren(
    ...demos.map(language => {
      const option = document.createElement("option");
      option.value = language;
      option.textContent = language;
      option.selected = language === "javascript";
      return option;
    })
  );
  demoSelect.disabled = false;

  if (!window.hljs) {
    autoSelect.options[0].textContent = "自动识别加载失败";
  }

  function applyDetectedLanguage(value, filename = "") {
    const result = detectLanguage(value);
    const filenameLanguage = filename
      ? languageFromFilename(filename, languageDefinitions)
      : null;
    const language = filenameLanguage || result.language;
    lastDetectionResult = result;
    renderAutoScores(result);
    logDetection(result);

    if (!language || !languages.includes(language)) {
      return;
    }

    languageSelect.value = language;
    monaco.editor.setModelLanguage(primaryModel, language);
    monaco.editor.setModelLanguage(getActiveModel(), language);
    if (diffOriginalModel) {
      monaco.editor.setModelLanguage(diffOriginalModel, language);
    }
    syncPreviewAvailability();
  }

  async function openFile(file) {
    if (!file) {
      return;
    }

    try {
      const value = await file.text();

      if (value.includes("\0")) {
        throw new Error("不支持二进制文件");
      }

      const activeEditor = getActiveEditor();
      activeEditor.setValue(value);
      activeEditor.setPosition({ lineNumber: 1, column: 1 });
      applyDetectedLanguage(value, file.name);
      fileStatus.textContent = file.name;
      fileStatus.title = file.name;
      focusEditor();
    } catch (error) {
      fileStatus.textContent = error.message || "文件读取失败";
      fileStatus.title = "";
      console.warn(`${file.name} 读取失败`, error);
    } finally {
      fileInput.value = "";
    }
  }

  openFileButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    openFile(fileInput.files[0]);
  });

  const isFileDrag = event =>
    Array.from(event.dataTransfer?.types || []).includes("Files");
  let dragDepth = 0;
  editorNode.addEventListener("dragenter", event => {
    if (!isFileDrag(event)) {
      return;
    }

    event.preventDefault();
    dragDepth += 1;
    editorNode.classList.add("is-dragging");
  });

  editorNode.addEventListener("dragover", event => {
    if (!isFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });

  editorNode.addEventListener("dragleave", () => {
    if (!editorNode.classList.contains("is-dragging")) {
      return;
    }

    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      editorNode.classList.remove("is-dragging");
    }
  });

  editorNode.addEventListener("drop", event => {
    const file = event.dataTransfer.files[0];
    if (!file) {
      return;
    }

    event.preventDefault();
    dragDepth = 0;
    editorNode.classList.remove("is-dragging");
    openFile(file);
  });

  languageSelect.addEventListener("change", async () => {
    monaco.editor.setModelLanguage(primaryModel, languageSelect.value);
    monaco.editor.setModelLanguage(getActiveModel(), languageSelect.value);
    if (diffOriginalModel) {
      monaco.editor.setModelLanguage(
        diffOriginalModel,
        languageSelect.value
      );
    }
    syncPreviewAvailability();
    focusEditor();
    if (typeof saveState === "function") saveState();
  });

  autoSelect.addEventListener("change", () => {
    if (!autoSelect.value) {
      return;
    }

    logLanguageScore(lastDetectionResult, autoSelect.value);
    languageSelect.value = autoSelect.value;
    monaco.editor.setModelLanguage(primaryModel, autoSelect.value);
    monaco.editor.setModelLanguage(getActiveModel(), autoSelect.value);
    if (diffOriginalModel) {
      monaco.editor.setModelLanguage(diffOriginalModel, autoSelect.value);
    }
    syncPreviewAvailability();
    focusEditor();
    if (typeof saveState === "function") saveState();
  });

  demoSelect.addEventListener("change", async () => {
    const demo = demoSelect.value;
    const language = demoLanguageMap[demo] || demo;
    const value = await loadSample(demo);
    languageSelect.value = language;
    monaco.editor.setModelLanguage(primaryModel, language);
    monaco.editor.setModelLanguage(getActiveModel(), language);
    if (diffOriginalModel) {
      monaco.editor.setModelLanguage(diffOriginalModel, language);
    }
    const activeEditor = getActiveEditor();
    activeEditor.setValue(value);
    activeEditor.setPosition({ lineNumber: 1, column: 1 });
    syncPreviewAvailability();
    focusEditor();
    if (typeof saveState === "function") saveState();
  });

  themeSelect.addEventListener("change", () => {
    monaco.editor.setTheme(themeSelect.value);
    if (typeof saveState === "function") saveState();
  });

  minimapInput.addEventListener("change", () => {
    const minimap = {
      enabled: minimapInput.checked
    };
    getActiveEditor().updateOptions({
      minimap
    });
    if (diffEditor) {
      diffEditor.getOriginalEditor().updateOptions({
        minimap
      });
    }
    focusEditor();
    if (typeof saveState === "function") saveState();
  });

  diffEnabledInput.addEventListener("change", () => {
    diffModeSelect.disabled = !diffEnabledInput.checked;

    if (diffEnabledInput.checked) {
      createDiffEditor();
    } else {
      closeDiffEditor();
    }

    focusEditor();
    if (typeof saveState === "function") saveState();
  });

  sortJsonDiffButton.addEventListener("click", () => {
    if (!diffEditor) {
      return;
    }

    const originalEditor = diffEditor.getOriginalEditor();
    const modifiedEditor = diffEditor.getModifiedEditor();

    try {
      const original = sortJsonText(originalEditor.getValue(), "左侧");
      const modified = sortJsonText(modifiedEditor.getValue(), "右侧");
      replaceEditorValue(
        originalEditor,
        original,
        "sort-json-diff-original"
      );
      replaceEditorValue(
        modifiedEditor,
        modified,
        "sort-json-diff-modified"
      );
      setConversionStatus("已按属性名自然排序左右 JSON");
      modifiedEditor.focus();
    } catch (error) {
      setConversionStatus(
        `JSON 排序失败：${describeConversionError(error)}`,
        true
      );
      focusEditor();
    }
  });

  const previewInputs = [
    htmlPreviewInput,
    markdownPreviewInput,
    javascriptPreviewInput,
    svgPreviewInput,
    base64PreviewInput
  ];

  function handlePreviewChange(activeInput) {
    if (activeInput.checked) {
      if (diffEnabledInput.checked) {
        diffEnabledInput.checked = false;
        diffModeSelect.disabled = true;
        closeDiffEditor();
      }

      previewInputs
        .filter(input => input !== activeInput)
        .forEach(input => {
          input.checked = false;
        });
      workspaceNode.classList.add("is-previewing");
      renderPreview();
    } else {
      closePreview();
    }

    getActiveEditor().layout();
    focusEditor();
    if (typeof saveState === "function") saveState();
  }

  htmlPreviewInput.addEventListener("change", () => {
    handlePreviewChange(htmlPreviewInput);
  });

  markdownPreviewInput.addEventListener("change", () => {
    handlePreviewChange(markdownPreviewInput);
  });

  javascriptPreviewInput.addEventListener("change", () => {
    handlePreviewChange(javascriptPreviewInput);
  });

  svgPreviewInput.addEventListener("change", () => {
    handlePreviewChange(svgPreviewInput);
  });

  base64PreviewInput.addEventListener("change", () => {
    handlePreviewChange(base64PreviewInput);
  });

  jsonToYamlButton.addEventListener("click", () => {
    if (!window.jsyaml) {
      return;
    }

    try {
      const value = JSON.parse(getActiveEditor().getValue());
      const yaml = jsyaml.dump(value, {
        noRefs: true,
        lineWidth: -1,
        noCompatMode: true
      });
      replaceContentAfterConversion(yaml, "yaml", "json-to-yaml");
      setConversionStatus("已转换为 YAML");
    } catch (error) {
      setConversionStatus(describeConversionError(error), true);
      focusEditor();
    }
  });

  yamlToJsonButton.addEventListener("click", () => {
    if (!window.jsyaml) {
      return;
    }

    try {
      const value = jsyaml.load(getActiveEditor().getValue());
      if (value === undefined) {
        throw new Error("YAML 内容为空");
      }

      const json = `${JSON.stringify(value, null, 2)}\n`;
      replaceContentAfterConversion(json, "json", "yaml-to-json");
      setConversionStatus("已转换为 JSON");
    } catch (error) {
      setConversionStatus(describeConversionError(error), true);
      focusEditor();
    }
  });

  minifyOneLineButton.addEventListener("click", () => {
    const language = languageSelect.value;

    try {
      const value = getActiveEditor().getValue();
      const minified = language === "json"
        ? JSON.stringify(JSON.parse(value))
        : minifyXml(value);
      replaceEditorValue(
        getActiveEditor(),
        minified,
        `${language}-minify-one-line`
      );
      setConversionStatus(
        `${language.toUpperCase()} 已压缩为一行`
      );
      getActiveEditor().setPosition({ lineNumber: 1, column: 1 });
      focusEditor();
    } catch (error) {
      setConversionStatus(
        `${language.toUpperCase()} 压缩失败：${describeConversionError(error)}`,
        true
      );
      focusEditor();
    }
  });

  htmlToMarkdownButton.addEventListener("click", () => {
    if (!window.TurndownService) {
      return;
    }

    const activeEditor = getActiveEditor();
    const model = activeEditor.getModel();
    htmlConversionSnapshot = {
      value: model.getValue(),
      position: activeEditor.getPosition(),
      previewEnabled: htmlPreviewInput.checked
    };
    const turndown = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
      strongDelimiter: "**"
    });
    turndown.remove(["script", "style", "noscript"]);
    const markdown = turndown.turndown(model.getValue());

    closePreview();
    activeEditor.pushUndoStop();
    activeEditor.executeEdits("html-to-markdown", [{
      range: model.getFullModelRange(),
      text: markdown
    }]);
    activeEditor.pushUndoStop();
    languageSelect.value = "markdown";
    monaco.editor.setModelLanguage(primaryModel, "markdown");
    monaco.editor.setModelLanguage(model, "markdown");
    if (diffOriginalModel) {
      monaco.editor.setModelLanguage(diffOriginalModel, "markdown");
    }
    undoHtmlToMarkdownButton.hidden = false;
    syncPreviewAvailability();
    activeEditor.setPosition({ lineNumber: 1, column: 1 });
    focusEditor();
  });

  undoHtmlToMarkdownButton.addEventListener("click", () => {
    if (!htmlConversionSnapshot) {
      return;
    }

    const snapshot = htmlConversionSnapshot;
    const activeEditor = getActiveEditor();
    const model = activeEditor.getModel();

    closePreview();
    activeEditor.pushUndoStop();
    activeEditor.executeEdits("undo-html-to-markdown", [{
      range: model.getFullModelRange(),
      text: snapshot.value
    }]);
    activeEditor.pushUndoStop();
    languageSelect.value = "html";
    monaco.editor.setModelLanguage(primaryModel, "html");
    monaco.editor.setModelLanguage(model, "html");
    if (diffOriginalModel) {
      monaco.editor.setModelLanguage(diffOriginalModel, "html");
    }
    htmlConversionSnapshot = null;
    undoHtmlToMarkdownButton.hidden = true;
    syncPreviewAvailability();
    activeEditor.setPosition(snapshot.position || {
      lineNumber: 1,
      column: 1
    });

    if (snapshot.previewEnabled) {
      htmlPreviewInput.checked = true;
      workspaceNode.classList.add("is-previewing");
      renderPreview();
      activeEditor.layout();
    }

    focusEditor();
  });

  diffModeSelect.addEventListener("change", () => {
    if (!diffEditor) {
      return;
    }

    diffEditor.updateOptions({
      renderSideBySide: diffModeSelect.value === "side-by-side"
    });
    focusEditor();
    if (typeof saveState === "function") saveState();
  });

  if (!window.marked || !window.DOMPurify) {
    markdownPreviewInput.disabled = true;
    markdownPreviewControl.title = "Markdown 预览组件加载失败";
  }
  if (!window.TurndownService) {
    htmlToMarkdownButton.disabled = true;
    htmlToMarkdownButton.title = "HTML 转 Markdown 组件加载失败";
  }
  if (!window.jsyaml) {
    jsonToYamlButton.disabled = true;
    yamlToJsonButton.disabled = true;
    jsonToYamlButton.title = "JSON/YAML 转换组件加载失败";
    yamlToJsonButton.title = "JSON/YAML 转换组件加载失败";
  }

  function saveState() {
    const parts = [];
    if (minimapInput.checked) parts.push("m");
    if (diffEnabledInput.checked) parts.push("d");
    if (diffModeSelect.value === "inline") parts.push("dm=i");
    if (languageSelect.value !== "javascript") parts.push(`l=${encodeURIComponent(languageSelect.value)}`);

    const activePreview = [
      htmlPreviewInput,
      markdownPreviewInput,
      javascriptPreviewInput,
      svgPreviewInput,
      base64PreviewInput
    ].find(i => i.checked);
    if (activePreview) {
      parts.push(`p=${encodeURIComponent(activePreview.id.replace("-preview-enabled", ""))}`);
    }

    const hash = parts.join("&");
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", hash ? `#${hash}` : cleanUrl);
    
    if (hash) {
      localStorage.setItem("monaco-toolbox-state", hash);
    } else {
      localStorage.removeItem("monaco-toolbox-state");
    }
    
    // Theme is saved separately to avoid polluting the URL hash
    localStorage.setItem("monaco-toolbox-theme", themeSelect.value);
  }

  function restoreState() {
    let hash = window.location.hash.slice(1);
    if (!hash && window.location.hash !== "#") {
      hash = localStorage.getItem("monaco-toolbox-state") || "";
    }
    if (!hash) return;

    const params = new URLSearchParams(hash);
    
    // Restore theme from localStorage (or hash for backward compatibility)
    if (params.has("theme")) params.set("t", params.get("theme"));
    const theme = params.get("t") || localStorage.getItem("monaco-toolbox-theme");
    if (theme) {
      themeSelect.value = theme;
      monaco.editor.setTheme(theme);
    }
    
    if (params.has("minimap")) params.set("m", params.get("minimap"));
    if (params.has("m")) {
      const val = params.get("m");
      minimapInput.checked = val !== "0" && val !== "false";
      const minimap = { enabled: minimapInput.checked };
      if (editor) editor.updateOptions({ minimap });
      if (diffEditor) {
        diffEditor.getOriginalEditor().updateOptions({ minimap });
        diffEditor.getModifiedEditor().updateOptions({ minimap });
      }
    }
    
    if (params.has("language")) params.set("l", params.get("language"));
    const lang = params.get("l");
    if (lang && languages.includes(lang)) {
      languageSelect.value = lang;
      monaco.editor.setModelLanguage(primaryModel, lang);
      if (diffOriginalModel) {
        monaco.editor.setModelLanguage(diffOriginalModel, lang);
      }
    }
    
    if (params.has("diff")) params.set("d", params.get("diff"));
    if (params.has("d")) {
      const val = params.get("d");
      diffEnabledInput.checked = val !== "0" && val !== "false";
      diffModeSelect.disabled = !diffEnabledInput.checked;
      if (diffEnabledInput.checked) {
        if (!diffEditor) createDiffEditor();
      } else {
        if (diffEditor) closeDiffEditor();
      }
    }
    
    if (params.has("diffMode")) params.set("dm", params.get("diffMode"));
    const dmVal = params.get("dm");
    if (dmVal) {
      const mode = dmVal === "i" ? "inline" : (dmVal === "s" ? "side-by-side" : dmVal);
      diffModeSelect.value = mode;
      if (diffEditor) {
        diffEditor.updateOptions({ renderSideBySide: mode === "side-by-side" });
      }
    }
    
    if (params.has("preview")) {
      params.set("p", params.get("preview").replace("-preview-enabled", ""));
    }
    const pVal = params.get("p");
    if (pVal) {
      const previewInput = document.getElementById(`${pVal}-preview-enabled`);
      if (previewInput) {
        previewInput.checked = true;
        handlePreviewChange(previewInput);
      }
    }
  }

  restoreState();
  syncPreviewAvailability();

  window.addEventListener("hashchange", restoreState);

});
