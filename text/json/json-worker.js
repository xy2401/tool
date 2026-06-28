let globalParsedObj = null;

self.onmessage = async (event) => {
  const message = event.data || {};
  if (message.type === 'analyze_node' || message.action === 'analyze_node') {
    const { path, val: customVal, mode, reqId, advancedOptions } = message;
    const options = normalizeOptions({ ...(advancedOptions || {}), ...(message.options || {}) });
    let val = customVal !== undefined ? customVal : globalParsedObj;
    if (customVal === undefined && path && path.length > 0) {
      const actualPath = path[0] === 'main' ? path.slice(1) : path;
      for (const p of actualPath) {
        if (val === undefined || val === null) break;
        if (typeof val === 'string') {
          if (p.startsWith('json_')) {
            const idx = parseInt(p.replace('json_', ''), 10);
            const substrings = extractJSONSubstrings(val);
            val = substrings[idx] ? substrings[idx].obj : undefined;
            continue;
          } else {
            const parsed = tryParseJSONString(val, { allowUnescape: true });
            if (parsed !== null) {
              val = parsed;
            } else {
              val = undefined;
              break;
            }
          }
        }
        if (val !== undefined && val !== null) {
          val = val[p];
        }
      }
    }
    
    // If the final evaluated node is itself a stringified JSON, parse it for preview and stats
    if (typeof val === 'string' && options.parseStringifiedJson) {
      const parsed = tryParseJSONString(val, { allowUnescape: true });
      if (parsed !== null) {
        val = parsed;
      }
    }

    const previewResult = formatPreview(val, options, !path || path.length === 0);
    const info = buildNodeInfo(val, options, mode, 0, false);
    postMessage({
      type: 'analyze_result',
      reqId,
      payload: {
        editText: previewResult.text,
        isPreviewTruncated: previewResult.truncated,
        jsonStats: info.stats,
        jsonPathsList: info.paths && info.paths.items ? info.paths.items : info.paths,
        pathsTruncated: info.paths && info.paths.isTruncated ? info.paths.isTruncated : false,
        jsonSchemaText: info.schemaText,
        jsonSchemaObject: info.schemaObject
      }
    });
    return;
  }
  
  if (message.type !== 'parse-text' && message.type !== 'parse-file') return;

  const options = normalizeOptions(message.options);
  try {
    if (message.type === 'parse-file') {
      await parseFile(message.file, options);
    } else {
      await parseText(message.text || '', options, message.sourceName || '');
    }
  } catch (error) {
    postMessage({
      type: 'error',
      message: error && error.message ? error.message : '解析失败'
    });
  }
};

const MB = 1024 * 1024;
const MAX_NODES_NORMAL = 12000;
const MAX_NODES_LARGE = 5000;
const MAX_NODES_ULTRA = 1500;
const MAX_PREVIEW_CHARS = MB;

function normalizeOptions(options) {
  return Object.assign({
    parseStringifiedJson: true,
    scanStringJsonSubstrings: true,
    mergeLines: false,
    previewLimit: 1048576,
    generateStats: true,
    generatePaths: true,
    inferSchema: true,
    mode: 'normal',
    sizeBytes: 0,
    includeRootRaw: true,
    includeParsedObj: true
  }, options || {});
}

async function parseFile(file, options) {
  if (!file) throw new Error('未读取到文件');
  progress('读取文件', 0);
  const text = await readFileText(file, options);
  await parseText(text, Object.assign({}, options, {
    sourceName: file.name || options.sourceName || '',
    sizeBytes: file.size || options.sizeBytes || text.length
  }), file.name || '');
}

async function readFileText(file, options) {
  if (!file.stream || !TextDecoder) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || '');
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  const total = file.size || 0;
  const reader = file.stream().getReader();
  const decoder = new TextDecoder('utf-8');
  const chunks = [];
  let loaded = 0;
  let lastPercent = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength || 0;
    chunks.push(decoder.decode(value, { stream: true }));
    if (total) {
      const percent = Math.min(24, Math.floor((loaded / total) * 24));
      if (percent !== lastPercent) {
        lastPercent = percent;
        progress('读取文件', percent);
      }
    }
  }

  const tail = decoder.decode();
  if (tail) chunks.push(tail);
  progress('读取完成', 24);
  return chunks.join('');
}

async function parseText(text, options, sourceName) {
  const sizeBytes = options.sizeBytes || estimateBytes(text);
  const mode = getMode(sizeBytes);
  const effectiveOptions = getEffectiveOptions(Object.assign({}, options, { mode, sizeBytes }));

  if (effectiveOptions.mergeLines) {
    progress('合并多行', 25);
    text = text.replace(/\r?\n/g, '');
  }

  progress('定位主 JSON', 26);
  const parsedMatch = findAndParseRootJSON(text, (percent) => {
    progress('定位主 JSON', 26 + Math.floor(percent * 0.24));
  });
  if (!parsedMatch) throw new Error('未在文本中检测到合法的 JSON 结构。');

  const found = parsedMatch.found;
  const rootText = parsedMatch.rootText;
  const parsed = parsedMatch.parsed;

  progress('生成节点树', 58);
  const treeResult = buildTree(parsed, effectiveOptions, (percent) => {
    progress('生成节点树', 58 + Math.floor(percent * 0.22));
  });

  progress('生成预览', 82);
  const selectedNode = treeResult.nodes[0] || null;
  const previewResult = selectedNode
    ? formatPreview(selectedNode.val, effectiveOptions, true)
    : { text: '', truncated: false };

  const info = buildNodeInfo(parsed, effectiveOptions, mode, sizeBytes, treeResult.truncated);
  progress('完成', 100);

  postMessage({
    type: 'result',
    payload: {
      parsedRoot: {
        raw: effectiveOptions.includeRootRaw ? rootText : '',
        rawLength: rootText.length,
        obj: effectiveOptions.includeParsedObj === false ? null : parsed,
        startIndex: found.startIndex,
        endIndex: found.endIndex
      },
      nodes: treeResult.nodes,
      selectedNodeId: selectedNode ? selectedNode.id : '',
      editText: previewResult.text,
      isPreviewTruncated: previewResult.truncated,
      jsonStats: info.stats,
      jsonPathsList: info.paths && info.paths.items ? info.paths.items : info.paths,
      pathsTruncated: info.paths && info.paths.isTruncated ? info.paths.isTruncated : false,
      jsonSchemaText: info.schemaText,
      jsonSchemaObject: info.schemaObject,
      mode,
      sizeBytes,
      sourceName: sourceName || options.sourceName || '',
      options: effectiveOptions,
      warnings: info.warnings.concat(treeResult.warnings)
    }
  });
  
  globalParsedObj = parsed;
}

function getMode(sizeBytes) {
  if (sizeBytes > 10 * MB) return 'ultra';
  if (sizeBytes > MB) return 'large';
  return 'normal';
}

function getEffectiveOptions(options) {
  return Object.assign({}, options);
}

function progress(status, percent, indeterminate) {
  postMessage({
    type: 'progress',
    status,
    percent: percent === null || percent === undefined ? 0 : Math.max(0, Math.min(100, percent)),
    indeterminate: !!indeterminate
  });
}

function estimateBytes(text) {
  if (!text) return 0;
  if (typeof Blob !== 'undefined') {
    try {
      return new Blob([text]).size;
    } catch (e) {}
  }
  return text.length * 2;
}

function findAndParseRootJSON(text, onProgress) {
  let startAt = 0;
  while (startAt < text.length) {
    const found = findRootJSON(text, startAt, onProgress);
    if (!found) return null;
    const rootText = text.slice(found.startIndex, found.endIndex);
    progress('解析 JSON', null, true);
    try {
      return { found, rootText, parsed: JSON.parse(rootText) };
    } catch (firstError) {
      const fallback = tryParseJSONString(rootText, { allowUnescape: true });
      if (fallback !== null) return { found, rootText, parsed: fallback };
      startAt = found.startIndex + 1;
    }
  }
  return null;
}

function findRootJSON(text, startAt, onProgress) {
  let rootStart = -1;
  let depth = 0;
  let rootOpen = '';
  let inString = false;
  let escapeNext = false;
  let lastProgress = -1;
  const total = text.length || 1;

  for (let i = startAt || 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);

    if (rootStart !== -1) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === 92) {
        escapeNext = true;
      } else if (ch === 34) {
        inString = !inString;
      } else if (!inString) {
        if (ch === 123 || ch === 91) {
          depth++;
        } else if (ch === 125 || ch === 93) {
          depth--;
          if (depth === 0) {
            if ((rootOpen === '{' && ch === 125) || (rootOpen === '[' && ch === 93)) {
              return { startIndex: rootStart, endIndex: i + 1 };
            }
            rootStart = -1;
            rootOpen = '';
          }
        }
      }
    } else if (ch === 123 || ch === 91) {
      rootStart = i;
      rootOpen = ch === 123 ? '{' : '[';
      depth = 1;
      inString = false;
      escapeNext = false;
    }

    if (onProgress && i % 32768 === 0) {
      const progressValue = Math.floor((i / total) * 100);
      if (progressValue !== lastProgress) {
        lastProgress = progressValue;
        onProgress(progressValue);
      }
    }
  }

  return null;
}

function buildTree(root, options, onProgress) {
  const nodes = [];
  const warnings = [];
  const maxNodes = options.mode === 'ultra' ? MAX_NODES_ULTRA : options.mode === 'large' ? MAX_NODES_LARGE : MAX_NODES_NORMAL;
  const stack = [{ val: root, path: ['main'], isStringifiedInParent: false }];
  let processed = 0;
  let truncated = false;

  while (stack.length) {
    const item = stack.pop();
    if (nodes.length >= maxNodes) {
      truncated = true;
      break;
    }

    const id = item.path.join('.');
    const name = item.path[item.path.length - 1];
    const type = item.isStringifiedInParent
      ? 'String(JSON)'
      : Array.isArray(item.val)
        ? 'Array'
        : item.val !== null && typeof item.val === 'object'
          ? 'Object'
          : getDisplayType(item.val);

    nodes.push({
      id,
      path: item.path,
      name,
      val: item.val,
      isStringifiedInParent: item.isStringifiedInParent,
      type
    });

    processed++;
    if (onProgress && processed % 250 === 0) {
      onProgress(Math.min(100, (nodes.length / maxNodes) * 100));
    }

    if (!item.val || typeof item.val !== 'object') continue;

    const entries = Array.isArray(item.val)
      ? item.val.map((value, index) => [String(index), value])
      : Object.keys(item.val).map((key) => [key, item.val[key]]);

    for (let i = entries.length - 1; i >= 0; i--) {
      const key = entries[i][0];
      const childVal = entries[i][1];
      const childPath = item.path.concat(key);

      if (childVal && typeof childVal === 'object') {
        stack.push({ val: childVal, path: childPath, isStringifiedInParent: false });
      } else if (typeof childVal === 'string') {
        if (options.parseStringifiedJson) {
          const parsedChild = tryParseJSONString(childVal, { allowUnescape: true });
          if (parsedChild !== null) {
            stack.push({ val: parsedChild, path: childPath, isStringifiedInParent: true });
            continue;
          }
        }

        if (options.scanStringJsonSubstrings && childVal.length <= 256 * 1024) {
          const substrings = extractJSONSubstrings(childVal);
          if (substrings.length) {
            if (nodes.length < maxNodes) {
              nodes.push({
                id: childPath.join('.'),
                path: childPath,
                name: key,
                val: childVal,
                isStringifiedInParent: false,
                type: 'String(Log)'
              });
            }
            for (let subIdx = substrings.length - 1; subIdx >= 0; subIdx--) {
              stack.push({
                val: substrings[subIdx].obj,
                path: childPath.concat(`json_${subIdx}`),
                isStringifiedInParent: true
              });
            }
          }
        }
      }
    }
  }

  if (truncated) {
    warnings.push(`节点树已限制为 ${maxNodes} 个节点，避免界面渲染过载。`);
  }
  if (options.mode === 'ultra' && !options.parseStringifiedJson && !options.scanStringJsonSubstrings) {
    warnings.push('超大文本模式默认关闭字符串深挖，可手动启用高级功能后重新提取。');
  }
  onProgress && onProgress(100);
  return { nodes, truncated, warnings };
}

function tryParseJSONString(str, settings) {
  if (typeof str !== 'string') return null;
  const allowUnescape = settings && settings.allowUnescape;
  const text = str.trim();
  if (!((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']')))) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (e) {}

  if (!allowUnescape || text.length > 512 * 1024) return null;

  try {
    const unescaped = text
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\\//g, '/')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
    return JSON.parse(unescaped);
  } catch (e) {}

  return null;
}

function extractJSONSubstrings(str) {
  const results = [];
  let index = 0;
  while (index < str.length && results.length < 20) {
    const nextBrace = str.indexOf('{', index);
    const nextBracket = str.indexOf('[', index);
    let startIdx = -1;
    if (nextBrace !== -1 && (nextBracket === -1 || nextBrace < nextBracket)) {
      startIdx = nextBrace;
    } else if (nextBracket !== -1) {
      startIdx = nextBracket;
    } else {
      break;
    }

    const found = findRootJSON(str.slice(startIdx), 0);
    if (found) {
      const start = startIdx + found.startIndex;
      const end = startIdx + found.endIndex;
      const parsed = tryParseJSONString(str.slice(start, end), { allowUnescape: true });
      if (parsed !== null) {
        results.push({ obj: parsed, start, end });
        index = end;
        continue;
      }
    }
    index = startIdx + 1;
  }
  return results;
}

function formatPreview(val, options, isRoot) {
  let space = '';
  if (options.indent === '2') {
    space = '  ';
  } else if (options.indent === '4' || options.mode === 'normal') {
    space = '    ';
  } else if (options.indent === 'tabs') {
    space = '\t';
  } else if (options.indent === 'compact') {
    space = '';
  } else if (!options.indent) {
    space = options.mode === 'normal' ? '    ' : '  ';
  }

  const limit = options.previewLimit;
  const excludedNodes = options.excludedNodes || [];
  const excludedProperties = options.excludedProperties || [];
  const basePath = options.basePath || (isRoot ? ['$'] : []);

  let targetVal = val;
  const pathMap = new Map();
  
  if (Array.isArray(val)) {
    targetVal = [];
    val.forEach((item, idx) => {
      const itemPath = [...basePath, String(idx)];
      const itemId = itemPath.join('.');
      if (!excludedNodes.includes(itemId)) {
        targetVal.push(item);
        if (item && typeof item === 'object') {
          pathMap.set(item, itemPath);
        }
      }
    });
  }
  
  pathMap.set(targetVal, basePath);

  const replacer = function(key, value) {
    if (key === '') return value;

    const parentPath = pathMap.get(this);
    if (!parentPath) return value;

    let currentPath;
    if (value && typeof value === 'object' && pathMap.has(value)) {
      currentPath = pathMap.get(value);
    } else {
      currentPath = [...parentPath, key];
    }
    
    const currentId = currentPath.join('.');

    if (value && typeof value === 'object') {
      pathMap.set(value, currentPath);
    }

    if (!Array.isArray(this) && excludedNodes.includes(currentId)) {
      return undefined;
    }

    const isDirectChild = parentPath.join('.') === basePath.join('.');
    if (!Array.isArray(this) && isDirectChild && excludedProperties.includes(key)) {
      return undefined;
    }

    if (Array.isArray(value)) {
      const filteredArray = [];
      value.forEach((item, idx) => {
        const itemPath = [...currentPath, String(idx)];
        const itemId = itemPath.join('.');
        if (!excludedNodes.includes(itemId)) {
          filteredArray.push(item);
          if (item && typeof item === 'object') {
            pathMap.set(item, itemPath);
          }
        }
      });
      pathMap.set(filteredArray, currentPath);
      return filteredArray;
    }

    return value;
  };

  let text = '';
  try {
    text = JSON.stringify(targetVal, replacer, space) ?? '';
  } catch (e) {
    text = String(val) ?? '';
  }

  if (limit > 0 && text.length > limit) {
    return {
      text: buildTruncatedPreview(text, limit, formatSize),
      truncated: true
    };
  }
  return { text, truncated: false };
}

function buildTruncatedPreview(text, limit, formatSizeFn) {
  let topPart = text.slice(0, limit);
  let totalLines = 1;
  let idx = text.indexOf('\n');
  while (idx !== -1) { totalLines++; idx = text.indexOf('\n', idx + 1); }
  
  let topLines = 1;
  idx = topPart.indexOf('\n');
  while (idx !== -1) { topLines++; idx = topPart.indexOf('\n', idx + 1); }
  
  let tailIdx = text.length - 1;
  let tailNewlines = 0;
  while (tailIdx >= limit && tailNewlines < 10) {
    if (text[tailIdx] === '\n') tailNewlines++;
    if (tailNewlines === 10) break;
    tailIdx--;
  }
  let bottomPart = tailIdx < limit ? text.slice(limit) : text.slice(tailIdx + 1);
  if (bottomPart.length > 10000) bottomPart = bottomPart.slice(-10000);
  
  let bottomLines = 1;
  idx = bottomPart.indexOf('\n');
  while (idx !== -1) { bottomLines++; idx = bottomPart.indexOf('\n', idx + 1); }
  
  let skippedLines = totalLines - topLines - bottomLines;
  if (skippedLines < 0) skippedLines = 0;
  
  return topPart + `\n\n/* 预览已截断，仅显示前 ${formatSizeFn(limit)}。隐藏了 ${skippedLines} 行。可下载或选择更小节点查看完整内容。 */\n\n` + bottomPart;
}

function buildNodeInfo(val, options, mode, sizeBytes, treeTruncated) {
  const warnings = [];
  const stats = {
    path: 'main',
    type: getDisplayType(val),
    keyCount: 0,
    maxDepth: 0,
    estimatedSize: formatSize(sizeBytes),
    stringCount: 0,
    numberCount: 0,
    booleanCount: 0,
    nullCount: 0,
    objectCount: 0,
    arrayCount: 0,
    mode,
    skipped: []
  };

  let paths = [];
  let schemaText = '';
  let schemaObject = null;

  const statsVisitLimit = mode === 'ultra' ? 80000 : mode === 'large' ? 120000 : 400000;
  const pathsVisitLimit = mode === 'ultra' ? 30000 : mode === 'large' ? 60000 : 200000;
  const schemaVisitLimit = mode === 'ultra' ? 20000 : mode === 'large' ? 40000 : 120000;

  if (options.generateStats) {
    const calculated = calculateDepthAndKeys(val, statsVisitLimit);
    stats.keyCount = calculated.keys;
    stats.maxDepth = calculated.depth;
    stats.stringCount = calculated.stringCount;
    stats.numberCount = calculated.numberCount;
    stats.booleanCount = calculated.booleanCount;
    stats.nullCount = calculated.nullCount;
    stats.objectCount = calculated.objectCount;
    stats.arrayCount = calculated.arrayCount;
  } else {
    stats.skipped.push('统计');
  }

  if (options.generatePaths) {
    paths = generateJSONPaths(val, pathsVisitLimit);
  } else {
    stats.skipped.push('路径');
  }

  if (options.inferSchema) {
    const schemaObj = inferSchema(val, schemaVisitLimit);
    const finalSchema = Object.assign({ $schema: 'http://json-schema.org/draft-07/schema#' }, schemaObj);
    schemaObject = finalSchema;
    schemaText = JSON.stringify(finalSchema, null, 2);
  } else {
    stats.skipped.push('Schema');
    schemaText = '当前模式未生成 Schema。';
  }

  if (treeTruncated) stats.skipped.push('完整节点树');
  if (mode === 'ultra') warnings.push('已进入超大文本模式。');

  return { stats, paths, schemaText, schemaObject, warnings };
}

function calculateDepthAndKeys(obj, visitLimit) {
  let maxChildDepth = 0;
  let keys = 0;
  let stringCount = 0;
  let numberCount = 0;
  let booleanCount = 0;
  let nullCount = 0;
  let objectCount = 0;
  let arrayCount = 0;
  let visited = 0;
  const stack = [{ node: obj, depth: 1 }];

  while (stack.length && visited < visitLimit) {
    const item = stack.pop();
    const node = item.node;
    visited++;
    if (item.depth > maxChildDepth) maxChildDepth = item.depth;

    if (node === null) {
      nullCount++;
      continue;
    }
    const type = typeof node;
    if (type === 'string') stringCount++;
    else if (type === 'number') numberCount++;
    else if (type === 'boolean') booleanCount++;
    else if (Array.isArray(node)) {
      arrayCount++;
      keys += node.length;
      for (let i = node.length - 1; i >= 0; i--) stack.push({ node: node[i], depth: item.depth + 1 });
    } else if (type === 'object') {
      objectCount++;
      const objKeys = Object.keys(node);
      keys += objKeys.length;
      for (let i = objKeys.length - 1; i >= 0; i--) stack.push({ node: node[objKeys[i]], depth: item.depth + 1 });
    }
  }

  return { depth: maxChildDepth, keys, stringCount, numberCount, booleanCount, nullCount, objectCount, arrayCount };
}

function generateJSONPaths(obj, visitLimit) {
  const pathCounts = {};
  const pathSizes = {};
  const stack = [{ node: obj, path: '$', keySize: 0 }];
  let visited = 0;

  while (stack.length > 0 && visited < visitLimit) {
    const item = stack.pop();
    const node = item.node;
    const currentPath = item.path;
    const keySize = item.keySize || 0;
    
    visited++;
    if (!pathCounts[currentPath]) {
      pathCounts[currentPath] = 0;
      pathSizes[currentPath] = 0;
    }
    pathCounts[currentPath]++;
    
    let nodeSize = keySize; 
    
    if (node === null) {
      nodeSize += 4;
    } else if (typeof node === 'string') {
      nodeSize += node.length + 2;
    } else if (typeof node === 'number' || typeof node === 'boolean') {
      nodeSize += String(node).length;
    } else if (Array.isArray(node)) {
      nodeSize += 2 + (node.length > 0 ? node.length - 1 : 0);
      for (let i = node.length - 1; i >= 0; i--) {
        let child = node[i];
        if (child !== null && typeof child === 'object') {
          stack.push({ node: child, path: `${currentPath}[*]`, keySize: 0 });
        } else {
          let p = `${currentPath}[*]`;
          if (!pathCounts[p]) { pathCounts[p] = 0; pathSizes[p] = 0; }
          pathCounts[p]++;
          let childSize = 0;
          if (child === null) childSize = 4;
          else if (typeof child === 'string') childSize = child.length + 2;
          else childSize = String(child).length;
          pathSizes[p] += childSize;
        }
      }
    } else if (typeof node === 'object') {
      const keys = Object.keys(node);
      nodeSize += 2 + (keys.length > 0 ? keys.length - 1 : 0);
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        let child = node[key];
        let currentKeySize = key.length + 3;
        let nextPath = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? `${currentPath}.${key}` : `${currentPath}['${key}']`;
        
        if (child !== null && typeof child === 'object') {
          stack.push({ node: child, path: nextPath, keySize: currentKeySize });
        } else {
          if (!pathCounts[nextPath]) { pathCounts[nextPath] = 0; pathSizes[nextPath] = 0; }
          pathCounts[nextPath]++;
          let childSize = currentKeySize;
          if (child === null) childSize += 4;
          else if (typeof child === 'string') childSize += child.length + 2;
          else childSize += String(child).length;
          pathSizes[nextPath] += childSize;
        }
      }
    }
    pathSizes[currentPath] += nodeSize;
  }
  
  const pathsInOrder = Object.keys(pathCounts);
  const pathsForSize = [...pathsInOrder].sort((a, b) => b.length - a.length);
  for (const path of pathsForSize) {
    let parentPath = null;
    if (path.endsWith('[*]')) {
      parentPath = path.slice(0, -3);
    } else {
      const dotIdx = path.lastIndexOf('.');
      const bracketIdx = path.lastIndexOf("['");
      if (dotIdx > bracketIdx && dotIdx > 0) {
        parentPath = path.slice(0, dotIdx);
      } else if (bracketIdx > 0) {
        parentPath = path.slice(0, bracketIdx);
      }
    }
    if (parentPath && pathSizes[parentPath] !== undefined) {
      pathSizes[parentPath] += pathSizes[path];
    }
  }
  
  return pathsInOrder.map(path => ({ 
    path, 
    count: pathCounts[path],
    size: pathSizes[path]
  }));
}

function inferSchema(obj, visitLimit) {
  let visited = 0;
  const recurse = (value) => {
    visited++;
    if (visited > visitLimit) return { type: 'unknown' };
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const schema = { type };
    if (type === 'object') {
      schema.properties = {};
      const keys = Object.keys(value);
      if (keys.length) schema.required = [];
      for (const key of keys) {
        schema.properties[key] = recurse(value[key]);
        schema.required.push(key);
      }
    } else if (type === 'array') {
      if (value.length) {
        const unique = [];
        const seen = new Set();
        const sample = value.slice(0, 200);
        for (const item of sample) {
          const childSchema = recurse(item);
          const key = JSON.stringify(childSchema);
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(childSchema);
          }
        }
        schema.items = unique.length === 1 ? unique[0] : { anyOf: unique };
      } else {
        schema.items = {};
      }
    }
    return schema;
  };
  return recurse(obj);
}

function getDisplayType(val) {
  if (val === null) return 'Null';
  if (Array.isArray(val)) return 'Array';
  const type = typeof val;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
