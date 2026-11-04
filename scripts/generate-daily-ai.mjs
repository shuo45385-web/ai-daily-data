import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PROJECT_COUNT = 10;
const OUTPUT_DIR = 'data';
const API_URL = 'https://api.github.com/search/repositories';
const AI_TOPIC_HINTS = new Set(['ai', 'artificial-intelligence', 'machine-learning', 'deep-learning', 'llm', 'large-language-model', 'generative-ai', 'agents', 'agent', 'computer-vision', 'nlp', 'transformers', 'rag', 'mcp']);

function beijingDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

function parseArgs(argv) {
  const args = { date: beijingDate(), force: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--date') args.date = argv[++index];
    if (argv[index] === '--force') args.force = true;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error('--date 必须是 yyyy-MM-dd 格式');
  return args;
}

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function classify(item) {
  const text = `${item.name} ${item.description ?? ''} ${(item.topics ?? []).join(' ')}`.toLowerCase();
  if (/image|vision|diffusion|video|comfy|stable/.test(text)) return '图像/视频';
  if (/model|llm|transformer|inference|training|embedding/.test(text)) return '大模型';
  if (/agent|mcp|copilot|assistant|workflow|rag|memory/.test(text)) return 'Agent/工具';
  if (/speech|audio|voice|tts|asr/.test(text)) return '语音';
  return 'AI 工具';
}

function usageMode(item) {
  const text = `${item.description ?? ''} ${(item.topics ?? []).join(' ')}`.toLowerCase();
  return /docker|self.hosted|self-hosted|local/.test(text) ? '可本地部署' : '开源项目（请查看项目文档确认部署方式）';
}

function score(item) {
  const hints = (item.topics ?? []).filter((topic) => AI_TOPIC_HINTS.has(topic.toLowerCase())).length;
  const ageDays = Math.max(1, (Date.now() - new Date(item.created_at).getTime()) / 86_400_000);
  return (hints * 12) + Math.log10(item.stargazers_count + 1) * 8 + (Math.max(0, 45 - ageDays) / 45) * 10;
}

async function search(query, token) {
  const response = await fetch(`${API_URL}?${new URLSearchParams({ q: query, sort: 'updated', order: 'desc', per_page: '100' })}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ai-daily-data-generator', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw new Error(`GitHub API 请求失败：${response.status} ${await response.text()}`);
  return response.json();
}

function toProject(item, rank) {
  return {
    rank,
    name: item.full_name,
    category: classify(item),
    summary: item.description?.trim() || '项目未提供简介，请查看项目主页。',
    usageMode: usageMode(item),
    hardware: '',
    license: item.license?.spdx_id && item.license.spdx_id !== 'NOASSERTION' ? item.license.spdx_id : '',
    licenseNote: '',
    url: item.html_url,
    github: { stars: item.stargazers_count, forks: item.forks_count, language: item.language ?? '', topics: item.topics ?? [], createdAt: item.created_at, updatedAt: item.updated_at },
  };
}

async function main() {
  const { date, force } = parseArgs(process.argv.slice(2));
  const destination = path.join(OUTPUT_DIR, `${date}.json`);
  if (existsSync(destination) && !force) return console.log(`${destination} 已存在，跳过生成。传入 --force 可覆盖。`);

  const recent = daysAgo(30);
  const queries = ['artificial-intelligence', 'machine-learning', 'llm', 'generative-ai'].map((topic) => `topic:${topic} pushed:>=${recent} archived:false fork:false`);
  const results = await Promise.all(queries.map((query) => search(query, process.env.GITHUB_TOKEN)));
  const candidates = new Map();
  for (const result of results) for (const item of result.items ?? []) {
    if (!item.fork && !item.archived && item.description) candidates.set(item.full_name, item);
  }
  const projects = [...candidates.values()].sort((left, right) => score(right) - score(left)).slice(0, PROJECT_COUNT).map(toProject);
  if (projects.length < PROJECT_COUNT) throw new Error(`只筛选到 ${projects.length} 个项目，未生成不完整的数据文件。`);

  const data = {
    date,
    title: `每日开源AI精选 · ${date}`,
    projects,
    sources: ['https://api.github.com/search/repositories', ...queries.map((query) => `https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`)],
    generatedAt: new Date().toISOString(),
    generator: 'GitHub Actions（按活跃度、热度与 AI 主题自动筛选）',
  };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(destination, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`已生成 ${destination}，共 ${projects.length} 个项目。`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
