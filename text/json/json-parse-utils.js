(function (global) {
  function tryParseJSONString(str, settings) {
    if (typeof str !== 'string') return null;
    const options = Object.assign({
      allowUnescape: true,
      allowAggressiveUnescape: false,
      maxUnescapeLength: 512 * 1024
    }, settings || {});
    const text = str.trim();
    if (!((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']')))) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (e) {}

    if (!options.allowUnescape || text.length > options.maxUnescapeLength) return null;

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

    if (!options.allowAggressiveUnescape) return null;

    try {
      const unescaped = text.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (match, token) => {
        if (token.startsWith('u')) return String.fromCharCode(parseInt(token.slice(1), 16));
        if (token.startsWith('x')) return String.fromCharCode(parseInt(token.slice(1), 16));
        switch (token) {
          case 'n': return '\n';
          case 'r': return '\r';
          case 't': return '\t';
          case 'b': return '\b';
          case 'f': return '\f';
          case '"': return '"';
          case "'": return "'";
          case '\\': return '\\';
          case '/': return '/';
          default: return token;
        }
      });
      return JSON.parse(unescaped);
    } catch (e) {}

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

  function findAndParseRootJSON(text, options) {
    const settings = Object.assign({}, options || {});
    let startAt = settings.startAt || 0;
    while (startAt < text.length) {
      const found = findRootJSON(text, startAt, settings.onProgress);
      if (!found) return null;
      const rootText = text.slice(found.startIndex, found.endIndex);
      if (settings.onBeforeParse) settings.onBeforeParse(found, rootText);
      try {
        return { found, rootText, parsed: JSON.parse(rootText) };
      } catch (firstError) {
        const fallback = tryParseJSONString(rootText, settings.parseOptions);
        if (fallback !== null) return { found, rootText, parsed: fallback };
        startAt = found.startIndex + 1;
      }
    }
    return null;
  }

  function extractJSONSubstrings(str, options) {
    const settings = Object.assign({
      maxResults: 20,
      parseOptions: { allowUnescape: true }
    }, options || {});
    const results = [];
    let index = 0;

    while (index < str.length && results.length < settings.maxResults) {
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
        const parsed = tryParseJSONString(str.slice(start, end), settings.parseOptions);
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

  global.JsonParseUtils = {
    tryParseJSONString,
    findRootJSON,
    findAndParseRootJSON,
    extractJSONSubstrings
  };
})(typeof self !== 'undefined' ? self : window);
