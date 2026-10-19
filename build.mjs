import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { minify } from 'html-minifier-terser';
import { minify as minifyJavaScript } from 'terser';

const sourcePath = new URL('./index.html', import.meta.url);
const outputDir = new URL('./dist/', import.meta.url);
const outputPath = new URL('./dist/index.html', import.meta.url);

const source = await readFile(sourcePath, 'utf8');
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let obfuscatedSource = '';
let lastIndex = 0;

for (const match of source.matchAll(scriptPattern)) {
  const [tag, attributes, code] = match;
  const start = match.index;
  obfuscatedSource += source.slice(lastIndex, start);

  if (!code.trim() || /\bsrc\s*=/i.test(attributes)) {
    obfuscatedSource += tag;
  } else {
    const result = await minifyJavaScript(code, {
      compress: true,
      mangle: true,
      format: { comments: false }
    });

    if (!result.code) throw new Error('Terser produced no JavaScript output.');
    obfuscatedSource += `<script${attributes}>${result.code}</script>`;
  }

  lastIndex = start + tag.length;
}

obfuscatedSource += source.slice(lastIndex);

const output = await minify(obfuscatedSource, {
  collapseBooleanAttributes: true,
  collapseWhitespace: true,
  decodeEntities: true,
  minifyCSS: true,
  minifyJS: true,
  removeComments: true,
  removeOptionalTags: false,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true
});

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${output}\n`, 'utf8');
console.log('Production site created at dist/index.html (inline JavaScript minified with Terser)');
