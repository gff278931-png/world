module.exports = {
  root: true,
  extends: ['@vue/eslint-config-typescript/recommended'],
  overrides: [
    // 仅放宽这两处，避免改动业务逻辑
    { files: ['src/world/bridge.ts','src/pages/Play.vue'], rules: { 'no-console':'off' } },
  ],
}
