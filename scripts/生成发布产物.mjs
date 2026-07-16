import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const 当前目录 = dirname(fileURLToPath(import.meta.url));
const 项目目录 = resolve(当前目录, '..');
const 构建目录 = join(项目目录, 'dist');
const 单文件上限 = 20 * 1024 * 1024;
const 总产物上限 = 500 * 1024 * 1024;

function git(...参数) {
  try {
    return execFileSync('git', 参数, { cwd: 项目目录, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function 文件信息(相对路径) {
  const 内容 = await readFile(join(构建目录, 相对路径));
  return {
    path: 相对路径,
    bytes: 内容.byteLength,
    sha256: createHash('sha256').update(内容).digest('hex'),
  };
}

async function 遍历文件(目录, 根目录 = 目录) {
  const 结果 = [];
  for (const 条目 of await readdir(目录, { withFileTypes: true })) {
    const 路径 = join(目录, 条目.name);
    if (条目.isDirectory()) 结果.push(...await 遍历文件(路径, 根目录));
    else if (条目.isFile()) 结果.push({ path: relative(根目录, 路径).replaceAll('\\', '/'), info: await stat(路径) });
  }
  return 结果;
}

await stat(join(构建目录, 'index.html'));
await stat(join(构建目录, 'showcase.json'));
await stat(join(构建目录, 'games/ninth-seat/story.json'));

await mkdir(join(构建目录, 'server'), { recursive: true });
await mkdir(join(构建目录, '.openai'), { recursive: true });
await copyFile(join(项目目录, '部署/sites-worker.js'), join(构建目录, 'server/index.js'));
await copyFile(join(项目目录, '.openai/hosting.json'), join(构建目录, '.openai/hosting.json'));

const 文件们 = await 遍历文件(构建目录);
const 总字节 = 文件们.reduce((和, 文件) => 和 + 文件.info.size, 0);
const 最大文件 = [...文件们].sort((甲, 乙) => 乙.info.size - 甲.info.size)[0];
if (总字节 > 总产物上限) {
  throw new Error(`发布产物 ${Math.ceil(总字节 / 1024 / 1024)} MiB，超过 ${总产物上限 / 1024 / 1024} MiB 门禁。`);
}
if (最大文件?.info.size > 单文件上限) {
  throw new Error(`发布文件 ${最大文件.path} 为 ${Math.ceil(最大文件.info.size / 1024 / 1024)} MiB，超过 ${单文件上限 / 1024 / 1024} MiB 门禁。`);
}

const 包信息 = JSON.parse(await readFile(join(项目目录, 'package.json'), 'utf8'));
const head = git('rev-parse', 'HEAD');
const commit = process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || head || 'unknown';
const sourceStatus = git('status', '--porcelain=v1', '--untracked-files=all');
const sourceClean = Boolean(head) && !sourceStatus;
if (!/^[0-9a-f]{40}$/u.test(commit) || commit !== head) {
  throw new Error('发布提交必须是当前 Git HEAD 的完整 SHA。');
}
const commitTime = git('show', '-s', '--format=%cI', commit === 'unknown' ? 'HEAD' : commit);
const builtAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : (commitTime ? new Date(commitTime).toISOString() : new Date().toISOString());
const 关键产物 = await Promise.all([
  'index.html',
  'showcase.json',
  'games/ninth-seat/story.json',
  'server/index.js',
].map(文件信息));

const 发布清单 = {
  schemaVersion: 1,
  product: 'yanjing-heartscape',
  version: 包信息.version,
  commit,
  builtAt,
  betaMode: 'public-preview',
  aiMode: 'fallback',
  source: {
    clean: sourceClean,
    head,
  },
  artifacts: 关键产物,
  limits: {
    totalBytes: 总字节,
    fileCount: 文件们.length,
    largestFile: 最大文件 ? { path: 最大文件.path, bytes: 最大文件.info.size } : null,
    maxTotalBytes: 总产物上限,
    maxFileBytes: 单文件上限,
  },
};

await writeFile(join(构建目录, 'release.json'), `${JSON.stringify(发布清单, null, 2)}\n`);
console.log(`发布产物已生成：${发布清单.version} · ${commit.slice(0, 12)} · ${Math.ceil(总字节 / 1024 / 1024)} MiB · fallback AI · ${sourceClean ? 'clean source' : 'DIRTY PREVIEW（不可发布）'}`);
