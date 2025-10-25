module.exports = {
  root: true,
  extends: ['@vue/eslint-config-typescript/recommended'],
  overrides: [
    { files: ['src/world/bridge.ts', 'src/pages/Play.vue'], rules: { 'no-console': 'off' } },
  ],
}
