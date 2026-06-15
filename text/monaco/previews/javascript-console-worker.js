const format = value => {
  if (typeof value === "string") return value;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "function") return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;

  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, item) => {
      if (typeof item === "bigint") return `${item}n`;
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      return item;
    }, 2);
  } catch {
    return String(value);
  }
};

self.onmessage = async event => {
  const rows = [];
  ["log", "info", "warn", "error"].forEach(level => {
    console[level] = (...values) => {
      rows.push({
        type: level,
        value: values.map(format).join(" ")
      });
    };
  });

  try {
    const result = (0, eval)(event.data);
    if (result && typeof result.then === "function") {
      await result;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  } catch (error) {
    rows.push({
      type: "error",
      value: format(error)
    });
  }

  self.postMessage(rows);
};
