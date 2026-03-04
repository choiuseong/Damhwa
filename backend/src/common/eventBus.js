// logger.js
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const info = (message) => {
  console.info(`[${new Date().toISOString()}] INFO: ${message}`);
};

const warn = (message) => {
  console.warn(`[${new Date().toISOString()}] WARN: ${message}`);
};

const error = (message) => {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
};

module.exports = { log, info, warn, error };