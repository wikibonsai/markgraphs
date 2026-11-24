import base from '@wikibonsai/soil-kit/eslint';

export default [
  ...base,
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
];
