const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// burnt web support (Expo Web)
config.resolver.sourceExts.push('mjs');
config.resolver.sourceExts.push('cjs');

module.exports = withNativeWind(config, {
  input: './global.css',
});
