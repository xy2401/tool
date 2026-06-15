const MONACO_VERSION = "0.55.1";
const MONACO_BASE_URL =
  `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/`;
const MONACO_WORKERS = {
  editorWorkerService: "editor.worker-Be8ye1pW.js",
  css: "css.worker-HnVq6Ewq.js",
  less: "css.worker-HnVq6Ewq.js",
  scss: "css.worker-HnVq6Ewq.js",
  handlebars: "html.worker-B51mlPHg.js",
  html: "html.worker-B51mlPHg.js",
  razor: "html.worker-B51mlPHg.js",
  json: "json.worker-DKiEKt88.js",
  javascript: "ts.worker-CMbG-7ft.js",
  typescript: "ts.worker-CMbG-7ft.js"
};

window.MonacoEnvironment = {
  getWorkerUrl(moduleId, label) {
    const worker = MONACO_WORKERS[label] || MONACO_WORKERS.editorWorkerService;
    const source =
      `importScripts("${MONACO_BASE_URL}vs/assets/${worker}");`;

    return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
  }
};
