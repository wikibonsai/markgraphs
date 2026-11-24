import { readFileSync } from 'node:fs';
import { libBuild } from '@wikibonsai/soil-kit/rollup';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// one bundle per subpath export, as esm and cjs (the last of libBuild's configs)
export default ['tree', 'web', 'markdown', 'look'].map((name) => libBuild(
  { ...pkg, main: `./dist/${name}.cjs`, module: `./dist/${name}.mjs`, browser: `./dist/${name}.mjs` },
  { input: `src/${name}/index.ts` },
).at(-1));
