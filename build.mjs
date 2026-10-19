import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
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

  const typeMatch = attributes.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const scriptType = (typeMatch ? (typeMatch[1] ?? typeMatch[2] ?? typeMatch[3]) : '').trim().toLowerCase();
  const isExecutableJs = !scriptType || [
    'text/javascript',
    'application/javascript',
    'text/ecmascript',
    'application/ecmascript',
    'module'
  ].includes(scriptType);

  if (!code.trim() || /\bsrc\s*=/i.test(attributes)) {
    obfuscatedSource += tag;
  } else if (scriptType === 'application/ld+json' || scriptType === 'application/json') {
    try {
      const minifiedJson = JSON.stringify(JSON.parse(code));
      obfuscatedSource += `<script${attributes}>${minifiedJson}</script>`;
    } catch {
      obfuscatedSource += tag;
    }
  } else if (isExecutableJs) {
    const result = await minifyJavaScript(code, {
      compress: true,
      mangle: true,
      module: scriptType === 'module',
      format: { comments: false }
    });

    if (!result.code) throw new Error('Terser produced no JavaScript output.');
    obfuscatedSource += `<script${attributes}>${result.code}</script>`;
  } else {
    obfuscatedSource += tag;
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

const staticFiles = [
  'robots.txt',
  'sitemap.xml',
  'CNAME',
  'og-image.png',
  'favicon.svg',
  'favicon.png',
  'favicon.ico',
  'apple-touch-icon.png',
  'site.webmanifest'
];

for (const staticFile of staticFiles) {
  try {
    await copyFile(new URL(`./${staticFile}`, import.meta.url), new URL(`./dist/${staticFile}`, import.meta.url));
  } catch {}
}

console.log('Production site created at dist/index.html (with all metadata, favicons, og-image, and assets)');
