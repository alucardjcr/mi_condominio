// Ronda 24: antes de este cambio el proyecto no tenía babel.config.js — no
// hacía falta porque Metro aplica un preset base por defecto. Ahora sí hace
// falta uno explícito porque react-native-reanimated (usado por el menú
// lateral de administrador, @react-navigation/drawer) requiere su propio
// plugin de Babel, y ese plugin SIEMPRE tiene que ir último en la lista.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};
