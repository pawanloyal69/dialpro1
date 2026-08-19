const path = require('path');

module.exports = function override(config) {
  // Add alias for @
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname, 'src'),
  };
  
  return config;
};
