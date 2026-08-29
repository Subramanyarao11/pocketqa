// Silence expected fallback warnings from PocketQaNative when running in Node.
const originalWarn = console.warn;
console.warn = (msg, ...rest) => {
  if (typeof msg === "string" && msg.includes("PocketQaModule not linked")) return;
  originalWarn(msg, ...rest);
};
