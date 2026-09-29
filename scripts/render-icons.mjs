// Renders the extension icons from assets/logo.svg. Run with `pnpm icons`.
import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const svg = await readFile(new URL('../assets/logo.svg', import.meta.url));

for (const size of [16, 32, 48, 96, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(new URL(`../public/icon/${size}.png`, import.meta.url), png);
}
