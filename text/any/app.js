'use strict';
const { createApp } = Vue;

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */
function jwtDecode(part) {
  const pad = s => s + '='.repeat((4 - s.length % 4) % 4);
  return JSON.parse(atob(pad(part.replace(/-/g, '+').replace(/_/g, '/'))));
}
function b64Decode(s) {
  const bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function b64Encode(s) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}
function jsonDepth(obj, d = 0) {
  if (typeof obj !== 'object' || obj === null) return d;
  const children = Array.isArray(obj) ? obj : Object.values(obj);
  if (!children.length) return d + 1;
  return Math.max(...children.map(c => jsonDepth(c, d + 1)));
}
function expandIPv6(addr) {
  let parts = addr.split('::');
  let left = parts[0] ? parts[0].split(':') : [];
  let right = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
  let mid = Array(8 - left.length - right.length).fill('0000');
  return [...left, ...mid, ...right].map(p => p.padStart(4, '0')).join(':');
}
function ipv6Type(addr) {
  const exp = expandIPv6(addr).toLowerCase();
  if (exp === '0000:0000:0000:0000:0000:0000:0000:0001') return '回环地址 (Loopback)';
  if (exp.startsWith('fe80')) return '链路本地 (Link-Local)';
  if (exp.startsWith('fc') || exp.startsWith('fd')) return '唯一本地 (ULA)';
  if (exp.startsWith('ff')) return '多播地址 (Multicast)';
  if (exp === '0000:0000:0000:0000:0000:0000:0000:0000') return '未指定地址';
  if (exp.startsWith('2001:0db8')) return '文档示例地址';
  return '全局单播 (Global Unicast)';
}
function isIPv6(str) {
  if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(str)) return true;
  if (!str.includes('::')) return false;
  const parts = str.split('::');
  if (parts.length !== 2) return false;
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  if (left.length + right.length > 7) return false;
  return left.concat(right).every(p => /^[0-9a-fA-F]{0,4}$/.test(p));
}
function cidrCalc(ip, prefix) {
  const ipNum = ip.split('.').reduce((a, p) => (a << 8) + parseInt(p), 0) >>> 0;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = (ipNum & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const hosts = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.pow(2, 32 - prefix) - 2;
  const n2ip = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  return {
    network: n2ip(network), broadcast: n2ip(broadcast), mask: n2ip(mask),
    hosts, first: prefix >= 31 ? n2ip(network) : n2ip(network + 1),
    last: prefix >= 31 ? n2ip(broadcast) : n2ip(broadcast - 1),
  };
}
function phoneCarrier(phone) {
  const p3 = phone.slice(0, 3);
  if ('134,135,136,137,138,139,147,148,150,151,152,157,158,159,172,178,182,183,184,187,188,195,197,198'.split(',').includes(p3)) return '中国移动';
  if ('130,131,132,145,146,155,156,166,167,171,175,176,185,186,196'.split(',').includes(p3)) return '中国联通';
  if ('133,149,153,173,174,177,180,181,189,190,191,193,199'.split(',').includes(p3)) return '中国电信';
  return '未知运营商';
}
function describeCron(parts) {
  const [min, hour, dom, month, dow] = parts;
  const dowNames = ['周日','周一','周二','周三','周四','周五','周六'];
  if (parts.every(p => p === '*')) return '每分钟执行';
  const s = [];
  if (min === '*') {}
  else if (min.startsWith('*/')) s.push(`每 ${min.slice(2)} 分钟`);
  else s.push(`在第 ${min} 分钟`);
  if (hour === '*') { if (min !== '*' && !min.startsWith('*/')) s.push('每小时'); }
  else if (hour.startsWith('*/')) s.push(`每 ${hour.slice(2)} 小时`);
  else s.push(`${hour} 时`);
  if (dom !== '*') { if (dom.startsWith('*/')) s.push(`每 ${dom.slice(2)} 天`); else s.push(`每月第 ${dom} 天`); }
  if (month !== '*') { if (month.startsWith('*/')) s.push(`每 ${month.slice(2)} 个月`); else s.push(`${month} 月`); }
  if (dow !== '*') { const d = parseInt(dow); s.push(!isNaN(d) && d >= 0 && d <= 6 ? dowNames[d] : `周${dow}`); }
  return s.join('，') || '每分钟执行';
}
function splitWords(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── Morse Code ── */
const MORSE_TABLE = {
  'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---',
  'K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-',
  'U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....',
  '6':'-....','7':'--...','8':'---..','9':'----.',
  '.':'.-.-.-',',':'--..--','?':'..--..','!':'-.-.--','/':'-..-.','-':'-....-',
  '(':'-.--.',')':'-.--.-','&':'.-...',':':'---...',';':'-.-.-.',
  '=':'-...-','+':'.-.-.',"'":'.----.','"':'.-..-.','@':'.--.-.',
  ' ':'/'
};
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE_TABLE).map(([k,v]) => [v, k]));

function morseEncode(text) {
  return text.toUpperCase().split('').map(ch => {
    if (ch === ' ') return '/';
    return MORSE_TABLE[ch] || `[${ch}]`;
  }).join(' ');
}
function morseDecode(morse) {
  return morse.trim().split(/\s+/).map(code => {
    if (code === '/') return ' ';
    return MORSE_REVERSE[code] || `[${code}]`;
  }).join('');
}

/* ══════════════════════════════════════════════════
   DETECTION ENGINE
   ══════════════════════════════════════════════════ */
function runDetect(raw) {
  const v = raw.trim();
  if (!v) return [];
  const r = [];

  // ── Timestamp seconds (10 digits, year 2001-2099)
  if (/^\d{10}$/.test(v)) {
    const ts = parseInt(v) * 1000;
    const yr = new Date(ts).getFullYear();
    if (yr >= 2001 && yr <= 2099)
      r.push({ type: 'ts_s', label: '时间戳(秒)', color: '#60a5fa', ts });
  }

  // ── Timestamp milliseconds (13 digits)
  if (/^\d{13}$/.test(v)) {
    const ts = parseInt(v);
    const yr = new Date(ts).getFullYear();
    if (yr >= 2001 && yr <= 2099)
      r.push({ type: 'ts_ms', label: '时间戳(毫秒)', color: '#93c5fd', ts });
  }

  // ── Hash fingerprints
  const isHex = /^[0-9a-fA-F]+$/.test(v);
  if (isHex && v.length === 32)  r.push({ type: 'md5',    label: 'MD5',    color: '#f87171' });
  if (isHex && v.length === 40)  r.push({ type: 'sha1',   label: 'SHA-1',  color: '#fb923c' });
  if (isHex && v.length === 64)  r.push({ type: 'sha256', label: 'SHA-256',color: '#fbbf24' });
  if (isHex && v.length === 128) r.push({ type: 'sha512', label: 'SHA-512',color: '#a3e635' });

  // ── UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
    r.push({ type: 'uuid', label: 'UUID', color: '#22d3ee' });

  // ── Hex color (#RGB / #RRGGBB / #RRGGBBAA)
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v))
    r.push({ type: 'color', label: '颜色值', color: '#f472b6' });

  // ── IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) {
    const pts = v.split('.').map(Number);
    if (pts.every(n => n >= 0 && n <= 255))
      r.push({ type: 'ipv4', label: 'IPv4 地址', color: '#fb923c' });
  }

  // ── IPv6
  if (isIPv6(v)) {
    r.push({ type: 'ipv6', label: 'IPv6 地址', color: '#fdba74', expanded: expandIPv6(v), addrType: ipv6Type(v) });
  }

  // ── CIDR
  const cidrM = v.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (cidrM) {
    const ip = cidrM[1];
    const prefix = parseInt(cidrM[2]);
    const pts = ip.split('.').map(Number);
    if (pts.every(n => n >= 0 && n <= 255) && prefix >= 0 && prefix <= 32) {
      r.push({ type: 'cidr', label: 'CIDR 无类域间路由', color: '#fb923c', prefix, calc: cidrCalc(ip, prefix) });
    }
  }

  // ── MAC address (AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF)
  if (/^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/.test(v))
    r.push({ type: 'mac', label: 'MAC 地址', color: '#c084fc' });

  // ── Email
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v))
    r.push({ type: 'email', label: '邮箱地址', color: '#f472b6' });

  // ── URL
  if (/^(https?|ftp):\/\/.{3,}/.test(v)) {
    try { const url = new URL(v); r.push({ type: 'url', label: 'URL', color: '#38bdf8', url }); } catch(e) {}
  }

  // ── Chinese phone number
  if (/^1[3-9]\d{9}$/.test(v))
    r.push({ type: 'phone_cn', label: '手机号(中国)', color: '#f472b6', carrier: phoneCarrier(v) });

  // ── Domain (without protocol)
  if (/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(v) && !v.includes(' ') && !r.find(x => x.type === 'email'))
    r.push({ type: 'domain', label: '域名', color: '#38bdf8' });

  // ── JWT
  const jwtPts = v.split('.');
  if (jwtPts.length === 3 && jwtPts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) {
    try {
      const h = jwtDecode(jwtPts[0]);
      if (h && (h.alg || h.typ)) {
        const payload = (() => { try { return jwtDecode(jwtPts[1]); } catch(e) { return {}; } })();
        r.push({ type: 'jwt', label: 'JWT Token', color: '#a78bfa', header: h, payload });
      }
    } catch(e) {}
  }

  // ── Base64 (skip if JWT)
  if (!r.find(x => x.type === 'jwt')) {
    if (/^[A-Za-z0-9+/]+=*$/.test(v) && v.length % 4 === 0 && v.length >= 8) {
      try { const dec = b64Decode(v); r.push({ type: 'base64', label: 'Base64', color: '#34d399', decoded: dec }); } catch(e) {}
    }
  }

  // ── JSON
  if (v.length >= 2 && ((v[0] === '{' && v[v.length-1] === '}') || (v[0] === '[' && v[v.length-1] === ']'))) {
    try {
      const parsed = JSON.parse(v);
      const isArr = Array.isArray(parsed);
      r.push({ type: 'json', label: 'JSON ' + (isArr ? '数组' : '对象'), color: '#fcd34d',
        isArray: isArr, count: isArr ? parsed.length : Object.keys(parsed).length,
        depth: jsonDepth(parsed), size: v.length });
    } catch(e) {}
  }

  // ── Semantic Version
  const svM = v.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?(?:\+([a-zA-Z0-9.]+))?$/);
  if (svM && !r.find(x => x.type === 'ipv4'))
    r.push({ type: 'semver', label: '语义版本号', color: '#a3e635', major: svM[1], minor: svM[2], patch: svM[3], pre: svM[4] || '', build: svM[5] || '' });

  // ── Cron expression (5 fields)
  const cronParts = v.split(/\s+/);
  if (cronParts.length === 5 && cronParts.every(p => /^(\*|(\d+(-\d+)?(,\d+(-\d+)?)*)(\/((\d+(-\d+)?(,\d+(-\d+)?)*)))?|\*\/\d+)$/.test(p)))
    r.push({ type: 'cron', label: 'Cron 表达式', color: '#14b8a6', desc: describeCron(cronParts), parts: cronParts });

  // ── Regex (/pattern/flags)
  const rxM = v.match(/^\/(.+)\/([gimsuy]*)$/);
  if (rxM) {
    try { new RegExp(rxM[1], rxM[2]); r.push({ type: 'regex', label: '正则表达式', color: '#e879f9', pattern: rxM[1], flags: rxM[2] }); } catch(e) {}
  }

  // ── Date string
  if (/^\d{4}[-/]\d{2}[-/]\d{2}([\sT]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) {
    const d = new Date(v.replace(/\//g, '-'));
    if (!isNaN(d.getTime())) r.push({ type: 'datestr', label: '日期字符串', color: '#60a5fa', ts: d.getTime() });
  }

  // ── Hex number (0x…)
  if (/^0[xX][0-9a-fA-F]+$/.test(v))
    r.push({ type: 'hexnum', label: '十六进制数', color: '#86efac', num: parseInt(v, 16) });

  // ── Binary
  if (/^0[bB][01]+$/.test(v))
    r.push({ type: 'binary', label: '二进制', color: '#67e8f9', num: parseInt(v.slice(2), 2) });
  else if (/^[01]+$/.test(v) && v.length >= 8 && v.length % 8 === 0 && !r.length)
    r.push({ type: 'binraw', label: '二进制串', color: '#67e8f9', num: parseInt(v, 2) });

  // ── Decimal / float number
  const alreadyTs = r.some(x => x.type.startsWith('ts_'));
  if (!alreadyTs && !r.find(x => x.type === 'hexnum') && !r.find(x => x.type.startsWith('bin')) && !r.find(x => x.type === 'phone_cn')) {
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) {
      const num = parseFloat(v);
      if (!isNaN(num)) r.push({ type: 'number', label: '数字', color: '#86efac', num });
    }
  }

  return r;
}

/* ══════════════════════════════════════════════════
   VUE APP
   ══════════════════════════════════════════════════ */
createApp({
  data() {
    return {
      panels: [
        { id: 1, value: '', computedList: [], activeOps: {}, detections: [], collapsed: false, dragging: false, wifiForm: { ssid: '', password: '', encryption: 'WPA', hidden: false } },
        { id: 2, value: '', computedList: [], activeOps: {}, detections: [], collapsed: false, dragging: false, wifiForm: { ssid: '', password: '', encryption: 'WPA', hidden: false } },
      ],
      _uid: 3,
      toast: '',
      selLen: 0,
      opsCollapsed: {},

      opGroups: [
        { name: '哈希', ops: [
          { id: 'md5',         label: 'MD5',            desc: '计算 MD5 哈希值（128位，32位十六进制）' },
          { id: 'sha1',        label: 'SHA-1',           desc: '计算 SHA-1 哈希值（160位，40位十六进制）' },
          { id: 'sha256',      label: 'SHA-256',         desc: '计算 SHA-256 哈希值（256位，64位十六进制）' },
          { id: 'sha512',      label: 'SHA-512',         desc: '计算 SHA-512 哈希值（512位，128位十六进制）' },
          { id: 'sha512x1000', label: 'SHA-512 ×1000',  desc: '对 SHA-512 结果连续迭代 1000 次，增强安全强度' },
        ]},
        { name: '编码 / 解码', paired: true, ops: [
          [{ id: 'b64enc',    label: 'Base64 编码',    desc: '将文本编码为 Base64 字符串（RFC 4648）' },
           { id: 'b64dec',    label: 'Base64 解码',    desc: '将 Base64 字符串解码还原为原始文本' }],
          [{ id: 'urlenc',    label: 'URL 编码',       desc: '对特殊字符进行 percent-encoding（encodeURIComponent）' },
           { id: 'urldec',    label: 'URL 解码',       desc: '将 percent-encoding 还原为可读字符' }],
          [{ id: 'hexenc',    label: 'Hex 编码',       desc: '将文本的每个字节转换为十六进制字符串（UTF-8）' },
           { id: 'hexdec',    label: 'Hex 解码',       desc: '将十六进制字符串按 UTF-8 解码为文本' }],
          [{ id: 'htmlenc',   label: 'HTML 编码',      desc: '将 & < > " \' 等特殊字符转义为 HTML 实体' },
           { id: 'htmldec',   label: 'HTML 解码',      desc: '将 HTML 实体（&amp; &lt; 等）还原为字符' }],
          [{ id: 'uniesc',    label: 'Unicode 转义',   desc: '将非 ASCII 字符转换为 \\uXXXX 或 \\u{XXXXX} 形式' },
           { id: 'uniunesc',  label: 'Unicode 反转义', desc: '将 \\uXXXX / \\u{XXXXX} 转义还原为 Unicode 字符' }],
          [{ id: 'escjson',   label: 'JSON 转义',      desc: '对字符串内容进行 JSON 转义（用于嵌入 JSON 字段值）' },
           { id: 'unescjson', label: 'JSON 反转义',    desc: '将 JSON 转义字符串（\\n \\t \\\\ 等）还原' }],
          [{ id: 'escnl',     label: '转义换行符',     desc: '将换行符(\\n)、回车(\\r)、制表符(\\t)转为转义字符串' },
           { id: 'unescnl',   label: '反转义换行符',   desc: '将 \\n \\r \\t 等转义字符串还原为实际控制字符' }],
          [{ id: 'morseenc',  label: '莫尔斯编码',     desc: '将文本转换为莫尔斯电码（点/划表示）' },
           { id: 'morsedec',  label: '莫尔斯解码',     desc: '将莫尔斯电码（.- 格式）解码还原为文本' }],
        ]},
        { name: '文本变换', ops: [
          { id: 'upper',   label: '转大写',      desc: '将所有英文字母转换为大写' },
          { id: 'lower',   label: '转小写',      desc: '将所有英文字母转换为小写' },
          { id: 'reverse', label: '反转字符',    desc: '将字符串中每个字符的顺序反转' },
          { id: 'rot13',   label: 'ROT13',       desc: '英文字母循环移位 13 位（加解密对称）' },
          { id: 'camel',   label: 'camelCase',   desc: '转换为小驼峰命名（如 helloWorld）' },
          { id: 'snake',   label: 'snake_case',  desc: '转换为下划线命名（如 hello_world）' },
          { id: 'kebab',   label: 'kebab-case',  desc: '转换为连字符命名（如 hello-world）' },
          { id: 'pascal',  label: 'PascalCase',  desc: '转换为大驼峰命名（如 HelloWorld）' },
        ]},
        { name: '行操作', ops: [
          { id: 'sortasc',  label: '行排序 ↑', desc: '按字典序升序排列各行（支持中文）' },
          { id: 'sortdesc', label: '行排序 ↓', desc: '按字典序降序排列各行（支持中文）' },
          { id: 'dedup',    label: '去重行',   desc: '删除完全相同的重复行，保留首次出现' },
          { id: 'rmempty',  label: '去空行',   desc: '移除所有空白行（含仅含空格的行）' },
          { id: 'addln',    label: '添加行号', desc: '在每行前加上从 1 开始的行号' },
        ]},
        { name: '提取', ops: [
          { id: 'exturls',   label: '提取 URL', desc: '从文本中提取所有 http/https URL 地址' },
          { id: 'extemails', label: '提取邮箱', desc: '从文本中提取所有邮箱地址' },
          { id: 'extips',    label: '提取 IP',  desc: '从文本中提取所有合法的 IPv4 地址' },
          { id: 'extnums',   label: '提取数字', desc: '从文本中提取所有整数和小数' },
        ]},
        { name: '格式化', ops: [
          { id: 'numfmt', label: '千分位格式化', desc: '将数字格式化为带千分位分隔符的形式（如 1,234,567）' },
        ]},
        { name: '统计 & 匹配', ops: [
          { id: 'count',    label: '字符统计', desc: '统计字符数、中文字数、词数、字节数和行数' },
          { id: 'regmatch', label: '正则提取', desc: '输入正则表达式，提取文本中所有匹配项' },
        ]},
        { name: '二维码', ops: [
          { id: 'qrgen',   label: '生成二维码', desc: '将文本内容生成二维码图片（支持中文和 URL）' },
          { id: 'wifiqr',  label: 'WiFi 二维码', desc: '生成 WiFi 连接二维码，手机扫码即可连接 WiFi' },
        ]},
      ],
    };
  },

  computed: {
    allOps() { return this.opGroups.flatMap(g => g.paired ? g.ops.flat() : g.ops); },
  },

  created() {
    this._loaded = false;
    this._saveTimer = null;
    this._tt = null;
  },

  mounted() {
    this.loadFromStorage();
    this.$nextTick(() => {
      this._loaded = true;
      // Auto-resize textareas for loaded content
      document.querySelectorAll('.panel-input').forEach(el => {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 380) + 'px';
      });
    });
    // Track text selection length for manual copy
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      this.selLen = sel ? sel.toString().length : 0;
    });
  },

  watch: {
    panels: {
      handler() { if (this._loaded) this.debounceSave(); },
      deep: true,
    },
  },

  methods: {
    // ── Panel management ──
    mkPanel() {
      return { id: this._uid++, value: '', computedList: [], activeOps: {}, detections: [], collapsed: false, dragging: false, wifiForm: { ssid: '', password: '', encryption: 'WPA', hidden: false } };
    },
    addPanel() { this.panels.push(this.mkPanel()); },
    removePanel(idx) { if (this.panels.length > 1) this.panels.splice(idx, 1); },
    clearPanel(p) { p.value = ''; p.computedList = []; p.activeOps = {}; p.detections = []; },
    toggleCollapse(p) { p.collapsed = !p.collapsed; },
    async pasteTo(p) {
      try {
        const text = await navigator.clipboard.readText();
        p.value = text;
        p.computedList = []; p.activeOps = {};
        this.updateDetections(p);
      } catch(e) { this.showToast('❌ 无法访问剪贴板，请手动粘贴'); }
    },

    // ── Input handling ──
    onInput(e, p) {
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 380) + 'px';
      this.updateDetections(p);
      this.recompute(p);
    },
    doTrim(p) {
      p.value = p.value.trim();
      this.updateDetections(p);
      this.recompute(p);
    },
    doFormat(p) {
      try {
        p.value = JSON.stringify(JSON.parse(p.value.trim()), null, 2);
        this.updateDetections(p);
        this.recompute(p);
        this.showToast('JSON 已格式化 ✓');
      } catch(e) { this.showToast('❌ 非有效 JSON'); }
    },
    doMinify(p) {
      try {
        p.value = JSON.stringify(JSON.parse(p.value.trim()));
        this.updateDetections(p);
        this.recompute(p);
        this.showToast('JSON 已压缩 ✓');
      } catch(e) { this.showToast('❌ 非有效 JSON'); }
    },
    hasDetection(p, type) {
      return p.detections && p.detections.some(d => d.type === type);
    },

    // ── Detection ──
    updateDetections(p) { p.detections = runDetect(p.value); },

    // ── Generators ──
    genUUID(p) {
      p.value = uuidv4();
      this.updateDetections(p);
      this.recompute(p);
      this.showToast('已生成 UUID v4 ✓');
    },
    genTimestamp(p) {
      p.value = String(Math.floor(Date.now() / 1000));
      this.updateDetections(p);
      this.recompute(p);
      this.showToast('已填入当前时间戳 ✓');
    },
    genNow(p) {
      p.value = new Date().toISOString();
      this.updateDetections(p);
      this.recompute(p);
      this.showToast('已填入当前时间 ✓');
    },

    // ── Drag & Drop ──
    onDragEnter(e, p) {
      p._dragCount = (p._dragCount || 0) + 1;
      p.dragging = true;
    },
    onDragLeave(e, p) {
      p._dragCount = (p._dragCount || 1) - 1;
      if (p._dragCount <= 0) { p.dragging = false; p._dragCount = 0; }
    },
    onDrop(e, p) {
      p.dragging = false; p._dragCount = 0;
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { this.showToast('❌ 文件过大(>5MB)'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        p.value = ev.target.result;
        p.computedList = []; p.activeOps = {};
        this.updateDetections(p);
        this.showToast(`已读取 ${file.name} ✓`);
      };
      reader.readAsText(file);
    },

    // ── Send to new panel ──
    sendToPanel(value) {
      const p = this.mkPanel();
      p.value = value;
      this.panels.push(p);
      this.$nextTick(() => this.updateDetections(p));
      this.showToast('已发送到新面板 ✓');
    },

    // ── Compute operations ──
    compute(panel, op) {
      // Toggle off
      if (panel.activeOps[op.id]) {
        panel.computedList = panel.computedList.filter(c => c.id !== op.id);
        panel.activeOps = { ...panel.activeOps, [op.id]: false };
        if (op.id === 'regmatch') delete panel._lastRegex;
        // Remove QR canvas if toggling off
        if (op.id === 'qrgen') {
          this.$nextTick(() => {
            const container = document.getElementById('qr-' + panel.id);
            if (container) container.innerHTML = '';
          });
        }
        if (op.id === 'wifiqr') {
          this.$nextTick(() => {
            const container = document.getElementById('wifiqr-' + panel.id);
            if (container) container.innerHTML = '';
          });
        }
        return;
      }

      // Input-free ops: show form immediately without requiring textarea value
      if (op.id === 'wifiqr') {
        panel.computedList = [...panel.computedList, { id: op.id, label: op.label, value: '__WIFIQR__' }];
        panel.activeOps = { ...panel.activeOps, [op.id]: true };
        this.$nextTick(() => this.renderWifiQR(panel));
        return;
      }
      if (op.id === 'regmatch') {
        if (!panel._lastRegex) panel._lastRegex = '\\d+';
        if (!panel._regexFlags) panel._regexFlags = 'g';
        const v = panel.value.trim();
        const result = v ? this.runRegex(v, panel._lastRegex, panel._regexFlags) : '✨ 在左侧输入文本，在上方输入正则表达式';
        panel.computedList = [...panel.computedList, { id: op.id, label: op.label, value: result }];
        panel.activeOps = { ...panel.activeOps, [op.id]: true };
        return;
      }

      const v = panel.value.trim();
      if (!v) return;

      const result = this.runOp(op.id, v);
      panel.computedList = [...panel.computedList, { id: op.id, label: op.label, value: result }];
      panel.activeOps = { ...panel.activeOps, [op.id]: true };

      // Render QR code after DOM update
      if (op.id === 'qrgen') {
        this.$nextTick(() => this.renderQR(panel));
      }
    },

    recompute(panel) {
      const v = panel.value.trim();
      const activeIds = Object.keys(panel.activeOps).filter(k => panel.activeOps[k]);
      // Ops that don't depend on textarea input
      const inputFreeOps = ['wifiqr', 'regmatch'];
      if (!v) {
        // Keep input-independent ops, clear the rest
        const keepIds = activeIds.filter(id => inputFreeOps.includes(id));
        if (!keepIds.length) {
          panel.computedList = []; panel.activeOps = {}; return;
        }
        // Remove non-kept ops
        const removeIds = activeIds.filter(id => !inputFreeOps.includes(id));
        removeIds.forEach(id => { panel.activeOps[id] = false; });
        panel.computedList = panel.computedList.filter(c => inputFreeOps.includes(c.id));
        // Update regmatch result text
        panel.computedList.forEach(c => {
          if (c.id === 'regmatch') c.value = '✨ 在左侧输入文本，在上方输入正则表达式';
        });
        // Re-render WiFi QR if active
        if (keepIds.includes('wifiqr')) {
          this.$nextTick(() => this.renderWifiQR(panel));
        }
        return;
      }
      if (!activeIds.length) return;
      panel.computedList = activeIds.map(opId => {
        const op = this.allOps.find(o => o.id === opId);
        if (!op) return null;
        // WiFi QR keeps its placeholder value
        if (opId === 'wifiqr') return { id: opId, label: op.label, value: '__WIFIQR__' };
        // Regex uses inline form pattern
        if (opId === 'regmatch') {
          const result = panel._lastRegex ? this.runRegex(v, panel._lastRegex, panel._regexFlags || 'g') : '✨ 输入正则表达式开始匹配';
          return { id: opId, label: op.label, value: result };
        }
        const result = this.runOp(opId, v);
        return { id: opId, label: op.label, value: result };
      }).filter(Boolean);
      // Re-render QR if active
      if (activeIds.includes('qrgen')) {
        this.$nextTick(() => this.renderQR(panel));
      }
      if (activeIds.includes('wifiqr')) {
        this.$nextTick(() => this.renderWifiQR(panel));
      }
    },

    runRegex(v, pattern, flags) {
      try {
        flags = flags || 'g';
        const re = new RegExp(pattern, flags);
        const allMatches = [...v.matchAll(re)];
        if (!allMatches.length) return `/${pattern}/${flags} → 未找到匹配`;
        const hasGroups = allMatches.some(m => m.length > 1 || m.groups);
        const lines = allMatches.map((m, i) => {
          let line = m[0];
          if (hasGroups) {
            // Show numbered groups
            const groups = [];
            for (let g = 1; g < m.length; g++) {
              if (m[g] !== undefined) groups.push(`[${g}]=${m[g]}`);
            }
            // Show named groups
            if (m.groups) {
              for (const [name, val] of Object.entries(m.groups)) {
                if (val !== undefined) groups.push(`[${name}]=${val}`);
              }
            }
            if (groups.length) line += '  ←  ' + groups.join('  ');
          }
          return line;
        });
        const header = `/${pattern}/${flags} → 找到 ${allMatches.length} 个匹配` + (hasGroups ? `（含捕获组）` : '') + `：`;
        return header + '\n' + lines.join('\n');
      } catch(e) { return '❌ 无效正则: ' + e.message; }
    },

    onRegexChange(panel) {
      if (!panel.activeOps.regmatch) return;
      const v = panel.value.trim();
      const result = v && panel._lastRegex
        ? this.runRegex(v, panel._lastRegex, panel._regexFlags || 'g')
        : (panel._lastRegex ? '✨ 在左侧输入文本开始匹配' : '✨ 输入正则表达式开始匹配');
      const idx = panel.computedList.findIndex(c => c.id === 'regmatch');
      if (idx >= 0) {
        panel.computedList[idx] = { ...panel.computedList[idx], value: result };
        panel.computedList = [...panel.computedList]; // trigger reactivity
      }
    },
    toggleRegexFlag(panel, flag) {
      let flags = panel._regexFlags || 'g';
      if (flags.includes(flag)) {
        flags = flags.replace(flag, '');
      } else {
        flags += flag;
      }
      // Ensure 'g' is always present for matchAll
      if (!flags.includes('g')) flags = 'g' + flags;
      panel._regexFlags = flags;
      this.onRegexChange(panel);
    },

    runOp(opId, v) {
      try {
        switch (opId) {
          case 'md5':       return CryptoJS.MD5(v).toString();
          case 'sha1':      return CryptoJS.SHA1(v).toString();
          case 'sha256':    return CryptoJS.SHA256(v).toString();
          case 'sha512':    return CryptoJS.SHA512(v).toString();
          case 'sha512x1000': {
            let hash = CryptoJS.SHA512(v);
            for (let i = 1; i < 1000; i++) hash = CryptoJS.SHA512(hash);
            const hex = hash.toString();
            const b64 = hash.toString(CryptoJS.enc.Base64);
            return `HEX (128字符):\n${hex}\n\nBase64 (88字符):\n${b64}`;
          }
          case 'b64enc':    return b64Encode(v);
          case 'b64dec':    try { return b64Decode(v); } catch(e) { return '❌ 无效的 Base64 字符串'; }
          case 'urlenc':    return encodeURIComponent(v);
          case 'urldec':    try { return decodeURIComponent(v); } catch(e) { return '❌ 无效的 URL 编码字符串'; }
          case 'hexenc':    return [...new TextEncoder().encode(v)].map(b => b.toString(16).padStart(2,'0')).join('');
          case 'hexdec': {
            const clean = v.replace(/\s/g,'').replace(/^0x/i,'');
            try { return new TextDecoder().decode(new Uint8Array(clean.match(/.{1,2}/g).map(b => parseInt(b, 16)))); }
            catch(e) { return '❌ 无效的 Hex 字符串'; }
          }
          case 'htmlenc':   return v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
          case 'htmldec': { const el = document.createElement('div'); el.innerHTML = v; return el.textContent; }
          case 'uniesc':    return [...v].map(c => { const cp = c.codePointAt(0); return cp > 127 ? (cp > 0xFFFF ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4,'0')}`) : c; }).join('');
          case 'uniunesc':  try { return v.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))); } catch(e) { return '❌ 无效的 Unicode 转义'; }
          case 'upper':     return v.toUpperCase();
          case 'lower':     return v.toLowerCase();
          case 'reverse':   return [...v].reverse().join('');
          case 'rot13':     return v.replace(/[a-zA-Z]/g, c => { const b = c >= 'a' ? 97 : 65; return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b); });
          case 'camel':     { const w = splitWords(v); return w.map((s, i) => i === 0 ? s : s[0].toUpperCase() + s.slice(1)).join(''); }
          case 'snake':     return splitWords(v).join('_');
          case 'kebab':     return splitWords(v).join('-');
          case 'pascal':    return splitWords(v).map(s => s[0].toUpperCase() + s.slice(1)).join('');
          case 'sortasc':   return v.split('\n').sort((a, b) => a.localeCompare(b, 'zh-CN')).join('\n');
          case 'sortdesc':  return v.split('\n').sort((a, b) => b.localeCompare(a, 'zh-CN')).join('\n');
          case 'dedup':     { const lines = v.split('\n'), u = [...new Set(lines)]; return u.join('\n') + `\n\n(${lines.length} 行 → ${u.length} 行，去除 ${lines.length - u.length} 行重复)`; }
          case 'rmempty':   { const lines = v.split('\n'), kept = lines.filter(l => l.trim()); return kept.join('\n') + `\n\n(${lines.length} 行 → ${kept.length} 行，移除 ${lines.length - kept.length} 个空行)`; }
          case 'addln':     return v.split('\n').map((l, i) => `${String(i + 1).padStart(4)} | ${l}`).join('\n');
          case 'escjson':   return JSON.stringify(v).slice(1,-1);
          case 'unescjson': try { return JSON.parse('"' + v + '"'); } catch(e) { return '❌ 转义解析失败'; }
          case 'jsonmin':   try { return JSON.stringify(JSON.parse(v)); } catch(e) { return '❌ 非有效 JSON'; }
          case 'escnl':     return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
          case 'unescnl':   return v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
          case 'exturls':   { const m = v.match(/https?:\/\/[^\s<>"']+/gi) || []; return m.length ? `找到 ${m.length} 个 URL：\n${[...new Set(m)].join('\n')}` : '未找到 URL'; }
          case 'extemails': { const m = v.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || []; return m.length ? `找到 ${m.length} 个邮箱：\n${[...new Set(m)].join('\n')}` : '未找到邮箱'; }
          case 'extips':    { const m = v.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []; const valid = m.filter(ip => ip.split('.').every(n => +n >= 0 && +n <= 255)); return valid.length ? `找到 ${valid.length} 个 IP：\n${[...new Set(valid)].join('\n')}` : '未找到 IP 地址'; }
          case 'extnums':   { const m = v.match(/-?\d+(\.\d+)?/g) || []; return m.length ? `找到 ${m.length} 个数字：\n${m.join('\n')}` : '未找到数字'; }
          case 'numfmt':    { const nums = v.match(/-?\d+(\.\d+)?/g); if (!nums) return v; let out = v; nums.sort((a,b) => b.length - a.length).forEach(n => { const parts = n.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); out = out.replace(n, parts.join('.')); }); return out; }
          case 'count': {
            const zh  = (v.match(/[\u4e00-\u9fa5]/g)||[]).length;
            const wds = v.trim().split(/\s+/).filter(Boolean).length;
            const byt = new TextEncoder().encode(v).length;
            return `字符数: ${v.length}  |  中文: ${zh}  |  词数: ${wds}  |  字节(UTF-8): ${byt}  |  行数: ${v.split('\n').length}`;
          }
          case 'morseenc':  return morseEncode(v);
          case 'morsedec':  return morseDecode(v);
          case 'qrgen':     return '__QR__' + v;
          default: return '';
        }
      } catch(e) { return '❌ 操作失败: ' + e.message; }
    },

    // ── Utilities (template) ──
    byteLen(s) { return new TextEncoder().encode(s).length; },
    isJson(s) { try { JSON.parse(s); return true; } catch(e) { return false; } },

    fmtLocal(ts) {
      return new Date(ts).toLocaleString('zh-CN', {
        year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false
      });
    },
    fmtUtc(ts) { return new Date(ts).toUTCString(); },
    relTime(ts) {
      const diff = Date.now() - ts;
      const sign = diff < 0 ? '后' : '前';
      const abs = Math.abs(diff);
      const s = Math.floor(abs / 1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24), y = Math.floor(d/365);
      const t = s<60 ? `${s} 秒` : m<60 ? `${m} 分钟` : h<24 ? `${h} 小时 ${m%60} 分` : d<365 ? `${d} 天` : `${y} 年 ${Math.floor((d-y*365)/30)} 个月`;
      return t + sign;
    },

    ip4Type(ip) {
      const [a,b] = ip.split('.').map(Number);
      if (a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168)) return '私有地址 (RFC 1918)';
      if (a===127) return '回环地址 (Loopback)';
      if (a===169&&b===254) return '链路本地 (APIPA)';
      if (a>=224&&a<=239) return '多播地址';
      if (a>=240) return '保留地址';
      return '公网地址';
    },
    ip4Int(ip) { return ip.split('.').reduce((acc,p) => (acc<<8)+parseInt(p), 0) >>> 0; },
    ip4Hex(ip) { return '0x'+ip.split('.').map(p => parseInt(p).toString(16).padStart(2,'0').toUpperCase()).join(''); },
    ip4Bin(ip) { return ip.split('.').map(p => parseInt(p).toString(2).padStart(8,'0')).join('.'); },

    macType(mac) {
      const first = parseInt(mac.replace(/[:-]/g,'').slice(0,2), 16);
      return (first & 1) ? '多播地址' : ((first & 2) ? '本地管理地址' : '全局唯一地址 (OUI)');
    },

    hex2rgb(hex) {
      let h = hex.replace('#','');
      if (h.length===3||h.length===4) h = h.split('').map(c=>c+c).join('');
      h = h.slice(0,6);
      return `rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`;
    },
    hex2hsl(hex) {
      let h = hex.replace('#','');
      if (h.length===3||h.length===4) h = h.split('').map(c=>c+c).join('');
      h = h.slice(0,6);
      let r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
      const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
      let hue=0, sat=0, lum=(mx+mn)/2;
      if (mx!==mn) {
        const d=mx-mn;
        sat = lum>0.5 ? d/(2-mx-mn) : d/(mx+mn);
        switch(mx) {
          case r: hue=((g-b)/d+(g<b?6:0))/6; break;
          case g: hue=((b-r)/d+2)/6; break;
          case b: hue=((r-g)/d+4)/6; break;
        }
      }
      return `hsl(${Math.round(hue*360)}, ${Math.round(sat*100)}%, ${Math.round(lum*100)}%)`;
    },

    // ── QR Code rendering ──
    renderQR(panel) {
      const v = panel.value.trim();
      if (!v) return;
      const containerId = 'qr-' + panel.id;
      this.$nextTick(() => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
          new QRCode(container, {
            text: v,
            width: 200,
            height: 200,
            colorDark: '#e2e8f0',
            colorLight: '#0f172a',
            correctLevel: QRCode.CorrectLevel.M,
          });
        } else {
          container.textContent = '❌ QR 库加载失败';
        }
      });
    },
    downloadQR(panelId) {
      const container = document.getElementById('qr-' + panelId);
      if (!container) return;
      const canvas = container.querySelector('canvas');
      if (!canvas) { this.showToast('❌ 未找到二维码'); return; }
      const link = document.createElement('a');
      link.download = 'qrcode.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.showToast('二维码已下载 ✓');
    },

    // ── WiFi QR Code ──
    buildWifiString(form) {
      // WIFI:T:<auth>;S:<ssid>;P:<password>;H:<hidden>;;
      const escape = s => s.replace(/([\\;,:"'])/g, '\\$1');
      const t = form.encryption || 'WPA';
      let str = `WIFI:T:${t};S:${escape(form.ssid)};`;
      if (t !== 'nopass' && form.password) {
        str += `P:${escape(form.password)};`;
      }
      if (form.hidden) str += 'H:true;';
      str += ';';
      return str;
    },
    renderWifiQR(panel) {
      const form = panel.wifiForm;
      if (!form.ssid) return;
      const wifiStr = this.buildWifiString(form);
      const containerId = 'wifiqr-' + panel.id;
      this.$nextTick(() => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
          new QRCode(container, {
            text: wifiStr,
            width: 200,
            height: 200,
            colorDark: '#e2e8f0',
            colorLight: '#0f172a',
            correctLevel: QRCode.CorrectLevel.M,
          });
        } else {
          container.textContent = '❌ QR 库加载失败';
        }
      });
    },
    onWifiFormChange(panel) {
      if (panel.wifiForm.ssid) {
        this.renderWifiQR(panel);
      }
    },
    downloadWifiQR(panelId) {
      const container = document.getElementById('wifiqr-' + panelId);
      if (!container) return;
      const canvas = container.querySelector('canvas');
      if (!canvas) { this.showToast('❌ 请先填写 SSID'); return; }
      const link = document.createElement('a');
      link.download = 'wifi-qrcode.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.showToast('WiFi 二维码已下载 ✓');
    },

    // ── Copy & Toast ──
    copy(text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => this.showToast('已复制到剪贴板 ✓'));
    },
    copyEl(e) {
      const text = e.target.textContent.trim();
      this.copy(text);
    },
    showToast(msg) {
      this.toast = msg;
      clearTimeout(this._tt);
      this._tt = setTimeout(() => { this.toast = ''; }, 2400);
    },

    // ── Persistence ──
    debounceSave() {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.saveToStorage(), 500);
    },
    saveToStorage() {
      try {
        const data = this.panels.map(p => ({
          id: p.id, value: p.value,
          activeOps: p.activeOps,
          collapsed: p.collapsed,
          _lastRegex: p._lastRegex,
          _regexFlags: p._regexFlags,
          wifiForm: p.wifiForm,
        }));
        localStorage.setItem('any-tool-panels', JSON.stringify(data));
      } catch(e) {}
    },
    loadFromStorage() {
      try {
        const data = JSON.parse(localStorage.getItem('any-tool-panels'));
        if (data && data.length) {
          this.panels = data.map(d => ({
            id: d.id, value: d.value || '',
            activeOps: d.activeOps || {},
            computedList: [], detections: [],
            collapsed: d.collapsed || false,
            dragging: false,
            _lastRegex: d._lastRegex,
            _regexFlags: d._regexFlags || 'g',
            wifiForm: d.wifiForm || { ssid: '', password: '', encryption: 'WPA', hidden: false },
          }));
          this._uid = Math.max(...this.panels.map(p => p.id)) + 1;
          this.panels.forEach(p => {
            this.updateDetections(p);
            // Pre-seed input-independent ops before recompute
            if (p.activeOps.wifiqr) {
              const op = this.allOps.find(o => o.id === 'wifiqr');
              if (op) p.computedList.push({ id: 'wifiqr', label: op.label, value: '__WIFIQR__' });
            }
            if (p.activeOps.regmatch) {
              const op = this.allOps.find(o => o.id === 'regmatch');
              if (op) p.computedList.push({ id: 'regmatch', label: op.label, value: '' });
            }
            this.recompute(p);
          });
        }
      } catch(e) { /* use defaults */ }
    },
  },
}).mount('#app');
