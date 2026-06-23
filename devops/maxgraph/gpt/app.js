(() => {
  "use strict";

  const DEFAULT_ARGS = {
    width: 1100,
    height: 760,
    rubberBand: true,
    contextMenu: false,
    grid: true,
    label: "",
  };

  const refs = {
    assetSearch: document.getElementById("assetSearch"),
    palettePanel: document.getElementById("palettePanel"),
    demoPanel: document.getElementById("demoPanel"),
    demoTree: document.getElementById("demoTree"),
    workspaceMode: document.getElementById("workspaceMode"),
    demoMode: document.getElementById("demoMode"),
    workspaceSurface: document.getElementById("workspaceSurface"),
    demoSurface: document.getElementById("demoSurface"),
    workspaceHost: document.getElementById("workspaceHost"),
    demoMount: document.getElementById("demoMount"),
    stageTitle: document.getElementById("stageTitle"),
    extractDemo: document.getElementById("extractDemo"),
    sourceDemo: document.getElementById("sourceDemo"),
    fileInput: document.getElementById("fileInput"),
    statusText: document.getElementById("statusText"),
    graphStats: document.getElementById("graphStats"),
    gridToggle: document.getElementById("gridToggle"),
    snapToggle: document.getElementById("snapToggle"),
    connectToggle: document.getElementById("connectToggle"),
    selectionSummary: document.getElementById("selectionSummary"),
    emptyInspector: document.getElementById("emptyInspector"),
    propertyForm: document.getElementById("propertyForm"),
    labelInput: document.getElementById("labelInput"),
    outline: document.getElementById("outline"),
    zoomLabel: document.getElementById("zoomLabel"),
    sourceDialog: document.getElementById("sourceDialog"),
    sourceTitle: document.getElementById("sourceTitle"),
    sourceCode: document.getElementById("sourceCode"),
    copySource: document.getElementById("copySource"),
    closeSource: document.getElementById("closeSource"),
    toast: document.getElementById("toast"),
  };

  const paletteGroups = [
    {
      title: "通用",
      icon: "./images/rectangle.gif",
      items: [
        shape("rect", "矩形", 120, 58, {
          shape: "rectangle",
          fillColor: "#ffffff",
          strokeColor: "#475569",
          fontColor: "#111827",
        }),
        shape("round", "圆角", 128, 58, {
          rounded: true,
          fillColor: "#ecfeff",
          strokeColor: "#0891b2",
          fontColor: "#164e63",
        }),
        shape("text", "文本", 150, 42, {
          shape: "text",
          strokeColor: "none",
          fillColor: "none",
          fontColor: "#111827",
          fontSize: 16,
        }),
        shape("note", "便签", 118, 78, {
          rounded: true,
          fillColor: "#fef9c3",
          strokeColor: "#ca8a04",
          fontColor: "#713f12",
          spacing: 8,
        }),
        shape("label", "标签", 110, 46, {
          shape: "label",
          rounded: true,
          fillColor: "#f8fafc",
          strokeColor: "#94a3b8",
          fontColor: "#334155",
        }),
        shape("frame", "分组", 220, 150, {
          fillColor: "#ffffff",
          strokeColor: "#94a3b8",
          dashed: true,
          rounded: true,
          fontColor: "#334155",
        }),
      ],
    },
    {
      title: "基础形状",
      icon: "./images/ellipse.gif",
      items: [
        shape("ellipse", "椭圆", 96, 62, {
          shape: "ellipse",
          fillColor: "#f0fdf4",
          strokeColor: "#16a34a",
          fontColor: "#14532d",
        }),
        shape("diamond", "菱形", 92, 92, {
          shape: "rhombus",
          fillColor: "#fff7ed",
          strokeColor: "#ea580c",
          fontColor: "#7c2d12",
        }),
        shape("triangle", "三角", 90, 82, {
          shape: "triangle",
          fillColor: "#fef2f2",
          strokeColor: "#dc2626",
          fontColor: "#7f1d1d",
        }),
        shape("hexagon", "六边形", 112, 70, {
          shape: "hexagon",
          fillColor: "#f8fafc",
          strokeColor: "#64748b",
          fontColor: "#1e293b",
        }),
        shape("cylinder", "圆柱", 92, 78, {
          shape: "cylinder",
          fillColor: "#ecfeff",
          strokeColor: "#0891b2",
          fontColor: "#164e63",
        }),
        shape("cloud", "云", 118, 72, {
          shape: "cloud",
          fillColor: "#eef2ff",
          strokeColor: "#4f46e5",
          fontColor: "#312e81",
        }),
        shape("actor", "角色", 76, 96, {
          shape: "actor",
          fillColor: "#fff7ed",
          strokeColor: "#c2410c",
          fontColor: "#7c2d12",
        }),
        shape("double-ellipse", "双圆", 94, 66, {
          shape: "doubleEllipse",
          fillColor: "#f8fafc",
          strokeColor: "#475569",
          fontColor: "#111827",
        }),
        imageShape("server", "服务器", 98, 74, "./images/server.png"),
      ],
    },
    {
      title: "流程图",
      icon: "./images/diagram.gif",
      items: [
        shape("start", "开始", 120, 48, {
          shape: "ellipse",
          fillColor: "#dcfce7",
          strokeColor: "#16a34a",
          fontColor: "#14532d",
        }),
        shape("process", "过程", 132, 58, {
          fillColor: "#ffffff",
          strokeColor: "#475569",
          fontColor: "#111827",
        }),
        shape("decision", "判断", 104, 104, {
          shape: "rhombus",
          fillColor: "#fef9c3",
          strokeColor: "#ca8a04",
          fontColor: "#713f12",
        }),
        shape("data", "数据", 132, 58, {
          shape: "hexagon",
          fillColor: "#ecfeff",
          strokeColor: "#0891b2",
          fontColor: "#164e63",
        }),
        shape("document", "文档", 132, 68, {
          rounded: true,
          fillColor: "#fff7ed",
          strokeColor: "#ea580c",
          fontColor: "#7c2d12",
          dashed: true,
        }),
        shape("delay", "延迟", 112, 58, {
          rounded: true,
          fillColor: "#f1f5f9",
          strokeColor: "#64748b",
          fontColor: "#334155",
        }),
      ],
    },
    {
      title: "架构 / UML",
      icon: "./images/package.png",
      items: [
        shape("class", "类", 150, 94, {
          shape: "swimlane",
          startSize: 24,
          fillColor: "#ffffff",
          strokeColor: "#475569",
          fontColor: "#111827",
        }),
        shape("interface", "接口", 150, 70, {
          rounded: true,
          dashed: true,
          fillColor: "#f8fafc",
          strokeColor: "#475569",
          fontColor: "#334155",
        }),
        imageShape("database", "数据库", 102, 78, "./images/cylinder.gif", {
          shape: "cylinder",
          fillColor: "#ecfeff",
          strokeColor: "#0891b2",
          fontColor: "#164e63",
        }),
        imageShape("service", "服务", 112, 76, "./images/gear.png"),
        imageShape("package", "包", 120, 74, "./images/package.png"),
        imageShape("workplace", "终端", 112, 74, "./images/workplace.png"),
      ],
    },
    {
      title: "连接线",
      icon: "./images/connector.gif",
      items: [
        connector("edge", "直线", {
          endArrow: "classic",
          strokeColor: "#334155",
          strokeWidth: 2,
        }),
        connector("edge-orth", "正交", {
          edgeStyle: "orthogonalEdgeStyle",
          rounded: true,
          endArrow: "classic",
          strokeColor: "#0f766e",
          strokeWidth: 2,
        }),
        connector("edge-dashed", "虚线", {
          edgeStyle: "orthogonalEdgeStyle",
          rounded: true,
          dashed: true,
          endArrow: "open",
          strokeColor: "#c2410c",
          strokeWidth: 2,
        }),
        connector("edge-two-way", "双向", {
          edgeStyle: "orthogonalEdgeStyle",
          rounded: true,
          startArrow: "classic",
          endArrow: "classic",
          strokeColor: "#475569",
          strokeWidth: 2,
        }),
        connector("edge-open", "开放", {
          endArrow: "open",
          strokeColor: "#64748b",
          strokeWidth: 2,
        }),
        connector("edge-block", "块箭头", {
          edgeStyle: "orthogonalEdgeStyle",
          endArrow: "block",
          strokeColor: "#ca8a04",
          strokeWidth: 3,
        }),
      ],
    },
    {
      title: "容器",
      icon: "./images/swimlane.gif",
      items: [
        shape("swimlane", "泳道", 240, 160, {
          shape: "swimlane",
          startSize: 30,
          fillColor: "#ffffff",
          strokeColor: "#475569",
          fontColor: "#111827",
          swimlaneFillColor: "#f1f5f9",
        }),
        shape("pool", "泳池", 320, 190, {
          shape: "swimlane",
          startSize: 34,
          horizontal: false,
          fillColor: "#ffffff",
          strokeColor: "#0f766e",
          fontColor: "#134e4a",
        }),
        shape("boundary", "边界", 260, 180, {
          rounded: true,
          dashed: true,
          fillColor: "#ffffff",
          strokeColor: "#94a3b8",
          fontColor: "#334155",
        }),
      ],
    },
  ];

  const paletteById = new Map();
  const demos = new Map();
  let storiesMeta = {};
  let workspaceGraph = null;
  let activeDemoGraph = null;
  let activeDemoId = null;
  let activeMode = "workspace";
  let selectedCells = [];
  let clipboardCells = [];
  let history = [];
  let historyIndex = -1;
  let restoring = false;
  let historyTimer = 0;
  let insertOffset = 0;
  let toastTimer = 0;

  function shape(id, label, width, height, style = {}) {
    return {
      id,
      kind: "vertex",
      label,
      width,
      height,
      style: {
        whiteSpace: "wrap",
        overflow: "fill",
        spacing: 8,
        rounded: false,
        ...style,
      },
    };
  }

  function imageShape(id, label, width, height, image, style = {}) {
    return {
      ...shape(id, label, width, height, {
        shape: style.shape || "image",
        image,
        verticalLabelPosition: "bottom",
        verticalAlign: "top",
        fillColor: style.fillColor || "none",
        strokeColor: style.strokeColor || "none",
        fontColor: style.fontColor || "#334155",
        ...style,
      }),
      previewImage: image,
    };
  }

  function connector(id, label, style = {}) {
    return {
      id,
      kind: "edge",
      label,
      width: 90,
      height: 40,
      style: {
        edgeStyle: "orthogonalEdgeStyle",
        rounded: true,
        fontColor: "#334155",
        ...style,
      },
    };
  }

  function init() {
    if (!window.MaxGraphStories || !window.MaxGraphStories["basic-helloworld--default"]) {
      setStatus("未找到 stories-entry.js，请先生成官方 demo bundle");
      return;
    }

    buildPalette();
    buildDemoTree();
    loadStoryMetadata();
    wireUi();
    initWorkspace();
    openInitialRoute();
    setStatus("就绪");
  }

  function openInitialRoute() {
    const params = new URLSearchParams(window.location.search);
    const template = params.get("template");
    const demo = params.get("demo");

    if (template) {
      window.setTimeout(() => insertTemplate(template), 0);
    } else if (demo && demos.has(demo)) {
      window.setTimeout(() => openDemo(demo), 0);
    }
  }

  function buildPalette() {
    refs.palettePanel.innerHTML = "";
    paletteById.clear();

    paletteGroups.forEach((group) => {
      const section = document.createElement("section");
      section.className = "palette-group";
      section.dataset.title = group.title.toLowerCase();

      const head = document.createElement("button");
      head.className = "group-head";
      head.type = "button";
      head.innerHTML = `<span><img src="${group.icon}" alt="">${escapeHtml(group.title)}</span><strong>-</strong>`;
      section.appendChild(head);

      const body = document.createElement("div");
      body.className = "group-body";
      section.appendChild(body);

      group.items.forEach((item) => {
        paletteById.set(item.id, item);
        const button = document.createElement("button");
        button.className = "palette-item";
        button.type = "button";
        button.draggable = true;
        button.dataset.shapeId = item.id;
        button.dataset.search = `${group.title} ${item.label}`.toLowerCase();
        button.appendChild(createShapePreview(item));

        const label = document.createElement("small");
        label.textContent = item.label;
        button.appendChild(label);

        button.addEventListener("dragstart", (evt) => {
          evt.dataTransfer.setData("application/x-maxgraph-shape", item.id);
          evt.dataTransfer.effectAllowed = "copy";
        });
        button.addEventListener("click", () => insertPaletteItem(item, null, null));
        body.appendChild(button);
      });

      head.addEventListener("click", () => {
        const collapsed = body.classList.toggle("hidden");
        head.querySelector("strong").textContent = collapsed ? "+" : "-";
      });

      refs.palettePanel.appendChild(section);
    });
  }

  function createShapePreview(item) {
    const preview = document.createElement("span");
    const style = item.style || {};
    const shapeName = style.shape || (style.rounded ? "rounded" : "rectangle");

    preview.className = `shape-preview ${shapeClass(shapeName, style, item.kind)}`;
    preview.style.setProperty("--preview-fill", toCssColor(style.fillColor, "#ffffff"));
    preview.style.setProperty("--preview-stroke", toCssColor(style.strokeColor, "#334155"));

    if (item.previewImage && item.kind !== "edge") {
      const img = document.createElement("img");
      img.src = item.previewImage;
      img.alt = "";
      preview.appendChild(img);
    }

    return preview;
  }

  function shapeClass(shapeName, style, kind) {
    if (kind === "edge") return "connector";
    if (style.rounded) return "rounded";
    if (shapeName === "rhombus") return "rhombus";
    if (shapeName === "ellipse" || shapeName === "doubleEllipse") return "ellipse";
    if (shapeName === "triangle") return "triangle";
    if (shapeName === "cylinder") return "cylinder";
    if (shapeName === "cloud") return "cloud";
    if (shapeName === "swimlane") return "swimlane";
    return "rectangle";
  }

  function buildDemoTree() {
    refs.demoTree.innerHTML = "";
    demos.clear();

    Object.entries(window.MaxGraphStories)
      .filter(([id]) => id !== "ModelXmlSerializer")
      .map(([id, mod]) => {
        const title = mod.default?.title || id;
        const parts = title.split("/");
        return {
          id,
          title,
          group: parts[0] || "Misc",
          name: parts.slice(1).join("/") || title,
          module: mod,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((entry) => demos.set(entry.id, entry));

    const byGroup = new Map();
    demos.forEach((demo) => {
      if (!byGroup.has(demo.group)) byGroup.set(demo.group, []);
      byGroup.get(demo.group).push(demo);
    });

    byGroup.forEach((items, groupName) => {
      const section = document.createElement("section");
      section.className = "demo-group";

      const head = document.createElement("button");
      head.type = "button";
      head.className = "group-head";
      head.innerHTML = `<span><img src="./images/script.gif" alt="">${escapeHtml(groupName)}</span><strong>-</strong>`;
      section.appendChild(head);

      const list = document.createElement("div");
      list.className = "demo-list";
      section.appendChild(list);

      items.forEach((demo) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.demoId = demo.id;
        button.dataset.search = `${demo.group} ${demo.name} ${demo.id}`.toLowerCase();
        button.innerHTML = `<img src="./images/script.gif" alt=""><span>${escapeHtml(demo.name)}</span>`;
        button.addEventListener("click", () => openDemo(demo.id));
        list.appendChild(button);
      });

      head.addEventListener("click", () => {
        const collapsed = list.classList.toggle("hidden");
        head.querySelector("strong").textContent = collapsed ? "+" : "-";
      });

      refs.demoTree.appendChild(section);
    });
  }

  async function loadStoryMetadata() {
    try {
      const response = await fetch("./stories.json", { cache: "no-store" });
      const data = await response.json();
      storiesMeta = data.entries || {};
    } catch {
      storiesMeta = {};
    }
  }

  function wireUi() {
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => runAction(button.dataset.action));
    });

    document.querySelectorAll("[data-side-tab]").forEach((button) => {
      button.addEventListener("click", () => switchSideTab(button.dataset.sideTab));
    });

    refs.workspaceMode.addEventListener("click", () => switchMode("workspace"));
    refs.demoMode.addEventListener("click", () => switchMode("demo"));
    refs.extractDemo.addEventListener("click", extractDemoToWorkspace);
    refs.sourceDemo.addEventListener("click", showDemoSource);
    refs.fileInput.addEventListener("change", importFile);
    refs.assetSearch.addEventListener("input", filterAssets);

    refs.gridToggle.addEventListener("change", () => {
      if (workspaceGraph) {
        setGridVisible(refs.gridToggle.checked);
        setStatus(refs.gridToggle.checked ? "网格已开启" : "网格已关闭");
      }
    });

    refs.snapToggle.addEventListener("change", () => {
      if (workspaceGraph) {
        workspaceGraph.gridEnabled = refs.snapToggle.checked;
        setStatus(refs.snapToggle.checked ? "吸附已开启" : "吸附已关闭");
      }
    });

    refs.connectToggle.addEventListener("change", () => {
      if (workspaceGraph) {
        workspaceGraph.setConnectable(refs.connectToggle.checked);
        setStatus(refs.connectToggle.checked ? "连接已开启" : "连接已关闭");
      }
    });

    refs.workspaceHost.addEventListener("dragover", (evt) => {
      evt.preventDefault();
      evt.dataTransfer.dropEffect = "copy";
    });

    refs.workspaceHost.addEventListener("drop", (evt) => {
      evt.preventDefault();
      const id = evt.dataTransfer.getData("application/x-maxgraph-shape");
      const item = paletteById.get(id);
      if (item) {
        const point = getGraphDropPoint(evt);
        insertPaletteItem(item, point.x, point.y);
      }
    });

    refs.propertyForm.addEventListener("input", (evt) => {
      const field = evt.target.closest("[data-prop]");
      if (field) applyProperty(field);
    });
    refs.propertyForm.addEventListener("change", (evt) => {
      const field = evt.target.closest("[data-prop]");
      if (field) applyProperty(field);
    });

    document.querySelectorAll("[data-swatch]").forEach((button) => {
      const colors = button.dataset.swatch.split(",");
      button.style.background = `linear-gradient(90deg, ${colors[0]} 0 33%, ${colors[1]} 33% 66%, ${colors[2]} 66%)`;
      button.addEventListener("click", () => applySwatch(colors));
    });

    document.querySelectorAll("[data-template]").forEach((button) => {
      button.addEventListener("click", () => insertTemplate(button.dataset.template));
    });

    refs.closeSource.addEventListener("click", () => refs.sourceDialog.close());
    refs.copySource.addEventListener("click", copySource);

    document.addEventListener("keydown", handleKeyboard);
    window.addEventListener("resize", () => {
      if (workspaceGraph) {
        workspaceGraph.sizeDidChange?.();
        workspaceGraph.refresh?.();
        renderOutline();
      }
    });
  }

  function initWorkspace() {
    const mod = window.MaxGraphStories["basic-helloworld--default"];
    const args = storyArgs(mod);
    refs.workspaceHost.innerHTML = "";

    const graphContainer = mod.Default(args);
    graphContainer.classList.add("workspace-graph");
    graphContainer.style.width = "100%";
    graphContainer.style.height = "100%";
    refs.workspaceHost.appendChild(graphContainer);

    workspaceGraph = window.__demo_graph;
    if (!workspaceGraph) {
      setStatus("工作台初始化失败");
      return;
    }

    workspaceGraph.container.setAttribute("tabindex", "0");
    workspaceGraph.setPanning(true);
    workspaceGraph.setConnectable(true);
    workspaceGraph.setMultigraph(false);
    workspaceGraph.gridSize = 10;
    workspaceGraph.gridEnabled = true;
    workspaceGraph.setTooltips?.(true);
    configureDefaultStyles(workspaceGraph);

    restoring = true;
    workspaceGraph.getDataModel().clear();
    workspaceGraph.refresh?.();
    restoring = false;

    setGridVisible(true);
    attachGraphListeners(workspaceGraph);
    pushHistory(true);
    syncSelection();
    updateGraphStats();
    renderOutline();
  }

  function configureDefaultStyles(graph) {
    const vertexStyle = graph.getStylesheet().getDefaultVertexStyle();
    Object.assign(vertexStyle, {
      rounded: true,
      shadow: false,
      whiteSpace: "wrap",
      overflow: "fill",
      spacing: 8,
      fillColor: "#ffffff",
      strokeColor: "#475569",
      fontColor: "#111827",
      fontSize: 13,
      strokeWidth: 2,
    });

    const edgeStyle = graph.getStylesheet().getDefaultEdgeStyle();
    Object.assign(edgeStyle, {
      edgeStyle: "orthogonalEdgeStyle",
      rounded: true,
      endArrow: "classic",
      strokeColor: "#475569",
      fontColor: "#334155",
      strokeWidth: 2,
    });
  }

  function attachGraphListeners(graph) {
    graph.getSelectionModel().addListener("change", () => {
      syncSelection();
      renderOutline();
    });

    graph.getDataModel().addListener("change", () => {
      if (!restoring) scheduleHistory();
      updateGraphStats();
      syncSelection();
      renderOutline();
    });

    graph.getView().addListener?.("scale", () => updateZoomLabel());
    graph.getView().addListener?.("scaleAndTranslate", () => {
      updateZoomLabel();
      renderOutline();
    });
    graph.getView().addListener?.("translate", renderOutline);
  }

  function storyArgs(mod) {
    const width = Math.max(700, refs.workspaceHost.clientWidth || refs.demoMount.clientWidth || 1100);
    const height = Math.max(480, refs.workspaceHost.clientHeight || refs.demoMount.clientHeight || 760);
    return {
      ...DEFAULT_ARGS,
      ...(mod.default?.args || {}),
      width,
      height,
      rubberBand: true,
      contextMenu: false,
    };
  }

  function runAction(action) {
    if (!workspaceGraph && action !== "open") return;
    switch (action) {
      case "new":
        newDiagram();
        break;
      case "open":
        refs.fileInput.click();
        break;
      case "save":
        exportFile();
        break;
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      case "copy":
        copySelection();
        break;
      case "paste":
        pasteSelection();
        break;
      case "delete":
        deleteSelection();
        break;
      case "zoom-in":
        workspaceGraph.zoomIn();
        afterViewChange();
        break;
      case "zoom-out":
        workspaceGraph.zoomOut();
        afterViewChange();
        break;
      case "zoom-actual":
        workspaceGraph.zoomActual();
        afterViewChange();
        break;
      case "fit":
        fitGraph();
        break;
    }
  }

  function switchSideTab(tab) {
    document.querySelectorAll("[data-side-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.sideTab === tab);
    });
    refs.palettePanel.classList.toggle("hidden", tab !== "palette");
    refs.demoPanel.classList.toggle("hidden", tab !== "demos");
    filterAssets();
  }

  function switchMode(mode) {
    activeMode = mode;
    refs.workspaceMode.classList.toggle("active", mode === "workspace");
    refs.demoMode.classList.toggle("active", mode === "demo");
    refs.workspaceSurface.classList.toggle("active", mode === "workspace");
    refs.demoSurface.classList.toggle("active", mode === "demo");
    refs.extractDemo.classList.toggle("hidden", mode !== "demo");
    refs.sourceDemo.classList.toggle("hidden", mode !== "demo");
    refs.stageTitle.textContent =
      mode === "workspace" ? "工作台" : demos.get(activeDemoId)?.title || "官方 Demo";
  }

  function filterAssets() {
    const query = refs.assetSearch.value.trim().toLowerCase();
    document.querySelectorAll(".palette-item, .demo-list button").forEach((item) => {
      const match = !query || item.dataset.search.includes(query);
      item.classList.toggle("hidden", !match);
    });

    document.querySelectorAll(".palette-group").forEach((group) => {
      const visible = group.querySelector(".palette-item:not(.hidden)");
      group.classList.toggle("hidden", !visible);
    });

    document.querySelectorAll(".demo-group").forEach((group) => {
      const visible = group.querySelector(".demo-list button:not(.hidden)");
      group.classList.toggle("hidden", !visible);
    });
  }

  function insertPaletteItem(item, x, y) {
    if (!workspaceGraph) return;
    switchMode("workspace");

    if (item.kind === "edge") {
      insertConnector(item);
      return;
    }

    const point = x == null || y == null ? nextInsertPoint() : { x, y };
    const parent = workspaceGraph.getDefaultParent();
    let cell = null;

    workspaceGraph.batchUpdate(() => {
      cell = workspaceGraph.insertVertex({
        parent,
        value: item.label,
        position: [snap(point.x), snap(point.y)],
        size: [item.width, item.height],
        style: cloneStyle(item.style),
      });
    });

    if (cell) workspaceGraph.setSelectionCell(cell);
    setStatus(`${item.label} 已添加`);
  }

  function insertConnector(item) {
    const vertices = selectedCells.filter((cell) => cell?.isVertex?.());
    if (vertices.length < 2) {
      toast("选择两个节点后添加连接线");
      return;
    }

    let edge = null;
    workspaceGraph.batchUpdate(() => {
      edge = workspaceGraph.insertEdge({
        parent: workspaceGraph.getDefaultParent(),
        value: "",
        source: vertices[0],
        target: vertices[1],
        style: cloneStyle(item.style),
      });
    });

    if (edge) workspaceGraph.setSelectionCell(edge);
    setStatus("连接线已添加");
  }

  function nextInsertPoint() {
    const baseX = 80 + insertOffset;
    const baseY = 80 + insertOffset;
    insertOffset = (insertOffset + 28) % 196;
    return { x: baseX, y: baseY };
  }

  function getGraphDropPoint(evt) {
    if (workspaceGraph?.getPointForEvent) {
      const point = workspaceGraph.getPointForEvent(evt);
      return { x: point.x, y: point.y };
    }

    const rect = workspaceGraph.container.getBoundingClientRect();
    const view = workspaceGraph.getView();
    return {
      x: (evt.clientX - rect.left) / view.scale - view.translate.x,
      y: (evt.clientY - rect.top) / view.scale - view.translate.y,
    };
  }

  function snap(value) {
    if (!refs.snapToggle.checked) return Math.round(value);
    const size = workspaceGraph?.gridSize || 10;
    return Math.round(value / size) * size;
  }

  function setGridVisible(visible) {
    workspaceGraph.container.style.backgroundImage = visible ? "url(./images/grid.gif)" : "none";
  }

  function openDemo(id) {
    const demo = demos.get(id);
    if (!demo) return;

    activeDemoId = id;
    activeDemoGraph = null;
    refs.demoMount.innerHTML = "";
    switchMode("demo");
    refs.stageTitle.textContent = demo.title;

    document.querySelectorAll("[data-demo-id]").forEach((button) => {
      button.classList.toggle("active", button.dataset.demoId === id);
    });

    try {
      const args = {
        ...DEFAULT_ARGS,
        ...(demo.module.default?.args || {}),
        width: Math.max(760, refs.demoMount.clientWidth - 42),
        height: Math.max(520, refs.demoMount.clientHeight - 42),
        rubberBand: true,
        contextMenu: false,
      };
      const node = demo.module.Default(args);
      refs.demoMount.appendChild(node);
      activeDemoGraph = window.__demo_graph || null;
      setStatus(`${demo.title} 已载入`);
    } catch (error) {
      const message = document.createElement("div");
      message.className = "empty-state";
      message.textContent = `Demo 渲染失败：${error.message}`;
      refs.demoMount.appendChild(message);
      setStatus("Demo 渲染失败");
    }
  }

  function extractDemoToWorkspace() {
    if (!activeDemoGraph) {
      toast("当前 Demo 没有可提取的图数据");
      return;
    }

    try {
      const xml = exportGraph(activeDemoGraph);
      importXmlToWorkspace(xml, true);
      switchMode("workspace");
      setStatus("Demo 数据已提取到工作台");
    } catch (error) {
      toast(`提取失败：${error.message}`);
    }
  }

  async function showDemoSource() {
    if (!activeDemoId) {
      toast("先打开一个 Demo");
      return;
    }

    const demo = demos.get(activeDemoId);
    const meta = storiesMeta[activeDemoId];
    const importPath = meta?.importPath?.replace(/^\.\//, "") || "";
    refs.sourceTitle.textContent = demo?.title || "源码";
    refs.sourceCode.textContent = "Loading...";

    try {
      if (!importPath) throw new Error("没有找到源码路径");
      const response = await fetch(`./${importPath}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      refs.sourceCode.textContent = await response.text();
    } catch (error) {
      refs.sourceCode.textContent = `// ${error.message}`;
    }

    refs.sourceDialog.showModal();
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(refs.sourceCode.textContent);
      toast("源码已复制");
    } catch {
      toast("复制失败");
    }
  }

  function newDiagram() {
    restoring = true;
    workspaceGraph.getDataModel().clear();
    workspaceGraph.refresh?.();
    restoring = false;
    pushHistory(true);
    syncSelection();
    updateGraphStats();
    renderOutline();
    setStatus("新画布已创建");
  }

  function exportFile() {
    try {
      const xml = exportGraph(workspaceGraph);
      const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "maxgraph-diagram.xml";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("XML 已导出");
    } catch (error) {
      toast(`导出失败：${error.message}`);
    }
  }

  async function importFile() {
    const [file] = refs.fileInput.files;
    refs.fileInput.value = "";
    if (!file) return;

    try {
      const xml = normalizeXml(await file.text());
      importXmlToWorkspace(xml, true);
      switchMode("workspace");
      setStatus(`${file.name} 已导入`);
    } catch (error) {
      toast(`导入失败：${error.message}`);
    }
  }

  function normalizeXml(xml) {
    const trimmed = xml.trim();
    if (!trimmed.includes("<mxfile")) return trimmed;

    const doc = new DOMParser().parseFromString(trimmed, "text/xml");
    const diagram = doc.querySelector("diagram");
    const text = diagram?.textContent?.trim() || "";
    if (text.startsWith("<mxGraphModel")) return text;

    const decoded = decodeXmlEntities(text);
    if (decoded.startsWith("<mxGraphModel")) return decoded;

    throw new Error("压缩 draw.io 文件暂不支持，请导出未压缩 XML 或 mxGraphModel");
  }

  function decodeXmlEntities(text) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }

  function exportGraph(graph) {
    const Serializer = window.MaxGraphStories.ModelXmlSerializer;
    return new Serializer(graph.getDataModel()).export();
  }

  function importXmlToWorkspace(xml, record) {
    const Serializer = window.MaxGraphStories.ModelXmlSerializer;
    restoring = true;
    new Serializer(workspaceGraph.getDataModel()).import(xml);
    workspaceGraph.refresh?.();
    restoring = false;

    if (record) pushHistory(true);
    syncSelection();
    updateGraphStats();
    renderOutline();
  }

  function scheduleHistory() {
    window.clearTimeout(historyTimer);
    historyTimer = window.setTimeout(() => pushHistory(false), 180);
  }

  function pushHistory(force) {
    if (!workspaceGraph || restoring) return;
    try {
      const xml = exportGraph(workspaceGraph);
      if (!force && history[historyIndex] === xml) return;

      history = history.slice(0, historyIndex + 1);
      history.push(xml);
      if (history.length > 80) history.shift();
      historyIndex = history.length - 1;
      updateHistoryButtons();
    } catch {
      updateHistoryButtons();
    }
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    importXmlToWorkspace(history[historyIndex], false);
    updateHistoryButtons();
    setStatus("已撤销");
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    importXmlToWorkspace(history[historyIndex], false);
    updateHistoryButtons();
    setStatus("已重做");
  }

  function updateHistoryButtons() {
    const undoButton = document.querySelector('[data-action="undo"]');
    const redoButton = document.querySelector('[data-action="redo"]');
    if (undoButton) undoButton.disabled = historyIndex <= 0;
    if (redoButton) redoButton.disabled = historyIndex >= history.length - 1;
  }

  function copySelection() {
    clipboardCells = [...selectedCells];
    toast(clipboardCells.length ? "已复制选区" : "没有可复制的选区");
  }

  function pasteSelection() {
    if (!clipboardCells.length) {
      toast("剪贴板为空");
      return;
    }

    try {
      const imported = workspaceGraph.importCells(
        clipboardCells,
        28,
        28,
        workspaceGraph.getDefaultParent()
      );
      if (imported?.length) workspaceGraph.setSelectionCells(imported);
      setStatus("已粘贴");
    } catch (error) {
      toast(`粘贴失败：${error.message}`);
    }
  }

  function deleteSelection() {
    if (!selectedCells.length) {
      toast("没有选中对象");
      return;
    }
    workspaceGraph.removeCells(selectedCells);
    setStatus("已删除");
  }

  function fitGraph() {
    const fit = workspaceGraph.getPlugin?.("fit");
    if (fit?.fitCenter) fit.fitCenter({ margin: 28 });
    else {
      workspaceGraph.fit?.();
      workspaceGraph.center?.();
    }
    afterViewChange();
  }

  function afterViewChange() {
    updateZoomLabel();
    renderOutline();
    workspaceGraph.container.focus();
  }

  function syncSelection() {
    if (!workspaceGraph) return;
    selectedCells = workspaceGraph.getSelectionCells?.() || [];
    const cell = workspaceGraph.getSelectionCell?.() || selectedCells[0] || null;
    refs.emptyInspector.classList.toggle("hidden", !!cell);
    refs.propertyForm.classList.toggle("hidden", !cell);
    refs.selectionSummary.textContent = cell
      ? selectedCells.length > 1
        ? `${selectedCells.length} 个对象`
        : cellLabel(cell) || cell.getId?.() || "对象"
      : "未选中";

    if (!cell) return;

    const geometry = cell.getGeometry?.();
    const style = getStyleObject(cell);
    setField("label", cellLabel(cell));
    setField("x", geometry?.x ?? "");
    setField("y", geometry?.y ?? "");
    setField("width", geometry?.width ?? "");
    setField("height", geometry?.height ?? "");
    setField("shape", style.shape || "");
    setField("fillColor", normalizeColor(style.fillColor, "#ffffff"));
    setField("strokeColor", normalizeColor(style.strokeColor, "#475569"));
    setField("fontColor", normalizeColor(style.fontColor, "#111827"));
    setField("strokeWidth", style.strokeWidth ?? 2);
    setField("rounded", booleanStyle(style.rounded));
    setField("shadow", booleanStyle(style.shadow));
    setField("dashed", booleanStyle(style.dashed));
    setField("html", booleanStyle(style.html));
  }

  function setField(prop, value) {
    const field = refs.propertyForm.querySelector(`[data-prop="${prop}"]`);
    if (!field) return;
    if (field.type === "checkbox") field.checked = !!value;
    else field.value = value ?? "";
  }

  function applyProperty(field) {
    if (!selectedCells.length || restoring) return;
    const prop = field.dataset.prop;
    const value = field.type === "checkbox" ? field.checked : field.value;

    workspaceGraph.batchUpdate(() => {
      selectedCells.forEach((cell, index) => {
        if (prop === "label") {
          if (index === 0) workspaceGraph.getDataModel().setValue(cell, value);
          return;
        }

        if (["x", "y", "width", "height"].includes(prop)) {
          setGeometryValue(cell, prop, Number(value));
          return;
        }

        const next = getStyleObject(cell);
        if (["rounded", "shadow", "dashed", "html"].includes(prop)) {
          next[prop] = value;
        } else if (prop === "strokeWidth") {
          next[prop] = Number(value) || 1;
        } else if (prop === "shape") {
          if (value) next.shape = value;
          else delete next.shape;
        } else {
          next[prop] = value;
        }
        workspaceGraph.getDataModel().setStyle(cell, next);
      });
    });

    workspaceGraph.refresh?.();
    renderOutline();
  }

  function setGeometryValue(cell, prop, value) {
    if (!Number.isFinite(value)) return;
    const geometry = cell.getGeometry?.();
    if (!geometry?.clone) return;
    const next = geometry.clone();
    next[prop] = Math.max(prop === "width" || prop === "height" ? 1 : -100000, value);
    workspaceGraph.getDataModel().setGeometry(cell, next);
  }

  function applySwatch(colors) {
    if (!selectedCells.length) return;
    workspaceGraph.batchUpdate(() => {
      selectedCells.forEach((cell) => {
        const next = getStyleObject(cell);
        next.fillColor = colors[0];
        next.strokeColor = colors[1];
        next.fontColor = colors[2];
        workspaceGraph.getDataModel().setStyle(cell, next);
      });
    });
    syncSelection();
    setStatus("配色已应用");
  }

  function insertTemplate(type) {
    if (!workspaceGraph) return;
    switchMode("workspace");
    newDiagram();

    if (type === "flow") insertFlowTemplate();
    if (type === "network") insertNetworkTemplate();
    if (type === "swimlane") insertSwimlaneTemplate();
    if (type === "org") insertOrgTemplate();

    fitGraph();
    setStatus("模板已创建");
  }

  function insertFlowTemplate() {
    const start = addVertex("开始", 80, 60, 118, 46, paletteById.get("start").style);
    const process = addVertex("处理请求", 80, 150, 132, 58, paletteById.get("process").style);
    const decision = addVertex("是否通过", 96, 255, 104, 104, paletteById.get("decision").style);
    const pass = addVertex("发布", 310, 272, 122, 58, paletteById.get("round").style);
    const retry = addVertex("修正", 80, 410, 122, 58, paletteById.get("note").style);
    addEdge(start, process);
    addEdge(process, decision);
    addEdge(decision, pass, "是");
    addEdge(decision, retry, "否");
    addEdge(retry, process);
  }

  function insertNetworkTemplate() {
    const cloud = addVertex("云服务", 310, 70, 132, 78, paletteById.get("cloud").style);
    const gateway = addVertex("网关", 330, 210, 120, 58, paletteById.get("hexagon").style);
    const app = addVertex("应用服务", 120, 340, 120, 74, paletteById.get("service").style);
    const db = addVertex("数据存储", 510, 340, 110, 82, paletteById.get("database").style);
    addEdge(cloud, gateway);
    addEdge(gateway, app);
    addEdge(gateway, db);
    addEdge(app, db, "读写");
  }

  function insertSwimlaneTemplate() {
    const lane = addVertex("业务流程", 50, 50, 720, 320, paletteById.get("swimlane").style);
    const intake = addVertex("收集", 120, 120, 120, 58, paletteById.get("process").style);
    const review = addVertex("审核", 310, 120, 120, 58, paletteById.get("decision").style);
    const ship = addVertex("交付", 510, 120, 120, 58, paletteById.get("round").style);
    addEdge(intake, review);
    addEdge(review, ship);
    workspaceGraph.setSelectionCell(lane);
  }

  function insertOrgTemplate() {
    const lead = addVertex("负责人", 320, 60, 130, 58, paletteById.get("round").style);
    const design = addVertex("设计", 110, 190, 122, 58, paletteById.get("rect").style);
    const dev = addVertex("开发", 320, 190, 122, 58, paletteById.get("rect").style);
    const ops = addVertex("运维", 530, 190, 122, 58, paletteById.get("rect").style);
    addEdge(lead, design);
    addEdge(lead, dev);
    addEdge(lead, ops);
  }

  function addVertex(label, x, y, width, height, style) {
    let cell = null;
    workspaceGraph.batchUpdate(() => {
      cell = workspaceGraph.insertVertex({
        parent: workspaceGraph.getDefaultParent(),
        value: label,
        position: [x, y],
        size: [width, height],
        style: cloneStyle(style),
      });
    });
    return cell;
  }

  function addEdge(source, target, label = "") {
    return workspaceGraph.insertEdge({
      parent: workspaceGraph.getDefaultParent(),
      value: label,
      source,
      target,
      style: {
        edgeStyle: "orthogonalEdgeStyle",
        rounded: true,
        endArrow: "classic",
        strokeColor: "#475569",
        strokeWidth: 2,
        fontColor: "#334155",
      },
    });
  }

  function updateGraphStats() {
    if (!workspaceGraph) return;
    const cells = collectCells(workspaceGraph.getDefaultParent());
    const vertices = cells.filter((cell) => cell?.isVertex?.()).length;
    const edges = cells.filter((cell) => cell?.isEdge?.()).length;
    refs.graphStats.textContent = `${vertices} 节点 / ${edges} 连线`;
    updateZoomLabel();
  }

  function updateZoomLabel() {
    if (!workspaceGraph) return;
    const scale = workspaceGraph.getView().scale || 1;
    refs.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  function renderOutline() {
    if (!workspaceGraph) return;
    const cells = collectCells(workspaceGraph.getDefaultParent()).filter((cell) => cell?.isVertex?.());
    refs.outline.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 240 140");
    refs.outline.appendChild(svg);

    if (!cells.length) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", "120");
      text.setAttribute("y", "72");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#94a3b8");
      text.setAttribute("font-size", "11");
      text.textContent = "空画布";
      svg.appendChild(text);
      return;
    }

    const bounds = computeBounds(cells);
    const margin = 10;
    const scale = Math.min(
      (240 - margin * 2) / Math.max(bounds.width, 1),
      (140 - margin * 2) / Math.max(bounds.height, 1)
    );

    cells.forEach((cell) => {
      const geometry = cell.getGeometry?.();
      if (!geometry) return;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(margin + (geometry.x - bounds.x) * scale));
      rect.setAttribute("y", String(margin + (geometry.y - bounds.y) * scale));
      rect.setAttribute("width", String(Math.max(2, geometry.width * scale)));
      rect.setAttribute("height", String(Math.max(2, geometry.height * scale)));
      rect.setAttribute("rx", "2");
      rect.setAttribute("fill", selectedCells.includes(cell) ? "#14b8a6" : "#cbd5e1");
      rect.setAttribute("stroke", selectedCells.includes(cell) ? "#0f766e" : "#94a3b8");
      svg.appendChild(rect);
    });
  }

  function collectCells(parent) {
    const result = [];
    const visit = (cell) => {
      if (!cell) return;
      result.push(cell);
      const count = cell.getChildCount?.() || 0;
      for (let i = 0; i < count; i += 1) visit(cell.getChildAt(i));
    };
    const count = parent?.getChildCount?.() || 0;
    for (let i = 0; i < count; i += 1) visit(parent.getChildAt(i));
    return result;
  }

  function computeBounds(cells) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    cells.forEach((cell) => {
      const geometry = cell.getGeometry?.();
      if (!geometry) return;
      minX = Math.min(minX, geometry.x);
      minY = Math.min(minY, geometry.y);
      maxX = Math.max(maxX, geometry.x + geometry.width);
      maxY = Math.max(maxY, geometry.y + geometry.height);
    });
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  function handleKeyboard(evt) {
    const tag = evt.target?.tagName?.toLowerCase();
    const editing = ["input", "textarea", "select"].includes(tag) || evt.target?.isContentEditable;
    if (editing) return;

    const ctrl = evt.ctrlKey || evt.metaKey;
    if (evt.key === "Delete" || evt.key === "Backspace") {
      evt.preventDefault();
      deleteSelection();
    } else if (ctrl && evt.key.toLowerCase() === "z") {
      evt.preventDefault();
      undo();
    } else if (ctrl && (evt.key.toLowerCase() === "y" || (evt.shiftKey && evt.key.toLowerCase() === "z"))) {
      evt.preventDefault();
      redo();
    } else if (ctrl && evt.key.toLowerCase() === "c") {
      evt.preventDefault();
      copySelection();
    } else if (ctrl && evt.key.toLowerCase() === "v") {
      evt.preventDefault();
      pasteSelection();
    }
  }

  function setStatus(message) {
    refs.statusText.textContent = message;
  }

  function toast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => refs.toast.classList.remove("show"), 2400);
  }

  function cellLabel(cell) {
    try {
      return workspaceGraph?.getLabel?.(cell) || String(cell.value ?? "");
    } catch {
      return String(cell?.value ?? "");
    }
  }

  function getStyleObject(cell) {
    const raw = cell?.getStyle?.() ?? cell?.style ?? {};
    if (typeof raw === "string") return parseStyle(raw);
    return { ...(raw || {}) };
  }

  function parseStyle(styleText) {
    return styleText.split(";").reduce((style, pair) => {
      if (!pair) return style;
      const [key, value] = pair.split("=");
      if (key) style[key] = value ?? true;
      return style;
    }, {});
  }

  function cloneStyle(style) {
    return { ...(style || {}) };
  }

  function booleanStyle(value) {
    return value === true || value === "1" || value === 1 || value === "true";
  }

  function normalizeColor(value, fallback) {
    if (!value || value === "none") return fallback;
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    if (/^#[0-9a-f]{3}$/i.test(value)) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return fallback;
  }

  function toCssColor(value, fallback) {
    if (!value || value === "none") return "transparent";
    return value || fallback;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[char];
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
