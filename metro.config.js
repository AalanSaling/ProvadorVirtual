// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.serializer = {
  ...config.serializer,
  getPolyfills: () => [],
};

module.exports = config;
