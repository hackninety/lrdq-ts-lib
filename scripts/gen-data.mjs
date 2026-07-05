/**
 * 语料生成（大六壬典籍语料库；书目见 CORPUS 注册表）
 *   docs/corpus/<slug>/text/*.txt（转录提取稿）
 *   → src/data/docs-manifest.json （全库篇目：path 带 slug 前缀，携 book/dynasty）
 *   → src/data/docs-<slug>.json   （每书 markdown 载荷，按书分包懒加载）
 *   → src/data/bifa.json / keju.json / shensha.json（《六壬大全》深度结构化分支）
 *
 * 首册：欽定四庫全書本《六壬大全》（ctext.org wiki res=260435）。
 * 卷十一/十二《畢法賦》、卷七~十《課經》、卷一神煞做深度结构化；其余整卷典籍化。
 * 转录笔误按序位归正或照录，记入各 textualIssues，不静默改字。
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// 《六壬大全》底本提取稿（深度结构化分支：毕法/課經/神煞 皆取此）
const textDir = path.join(root, 'docs/corpus/lrdq/text');
const outDir = path.join(root, 'src/data');
mkdirSync(outDir, { recursive: true });

// ---------- 汉数字 ----------
const CN_DIGIT = { 零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnToInt(s) {
  if (!s) return NaN;
  if (s.includes('百')) {
    const rest = s.replace(/^一?百/, '');
    return 100 + (rest ? cnToInt(rest) : 0);
  }
  if (s.includes('十')) {
    const [a, b = ''] = s.split('十');
    const tens = a === '' ? 1 : CN_DIGIT[a];
    const ones = b === '' ? 0 : CN_DIGIT[b];
    if (tens === undefined || ones === undefined) return NaN;
    return tens * 10 + ones;
  }
  // 位并式（第五一 = 51）
  let n = 0;
  for (const ch of s) {
    const d = CN_DIGIT[ch];
    if (d === undefined) return NaN;
    n = n * 10 + d;
  }
  return n;
}

const NUM = '[一二三四五六七八九十百零〇]+';
const COUPLET_RE = new RegExp(`第(${NUM})法[：:]\\s*([^，。；]+)`, 'g');
// 前缀允许含「第」（如“簾幕貴人高甲第”），编号前的「第」可省（如“…無疑一百”），
// 由 feedAnnotationLine 内的赋句前四字/编号双重校验防误匹配
const ANNO_HEAD_RE = new RegExp(`^([^，。：；、\\s]{4,12}?)(第?)(${NUM})法?(?:[\\s　]+(.*))?$`);
const SUB_RE = /^([^，。：；、\s]{2,10}格)(?:[\s　]+(.*))?$/;
const SKIP_RE = /^(六壬大全[卷巻].{0,4}終|欽定四庫全書|六壬大全[卷巻].*)$/;

const read = (f) => readFileSync(path.join(textDir, f), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean); // trim 兼剥行首 BOM（U+FEFF 属 WhiteSpace）

const entries = []; // { no, name, fu, rawNo?, note: [], extras: [], juan }
const textualIssues = [];
const diagnostics = { unmatchedHeaders: [], bodyOrphans: 0 };

// ---------- 卷十一：正文（百句）+ 一~五十注 ----------
{
  const lines = read('11-juan11.txt');
  let mode = 'head';
  let cur = null; // 当前注文目标 { entry, sub }
  for (const line of lines) {
    if (mode === 'head') {
      if (/正文$/.test(line)) mode = 'couplet';
      continue;
    }
    if (mode === 'couplet') {
      if (/正文終/.test(line)) { mode = 'anno'; continue; }
      for (const m of line.matchAll(COUPLET_RE)) {
        const seq = entries.length + 1;
        const raw = cnToInt(m[1]);
        const fu = m[2].trim();
        const e = { no: seq, name: fu.slice(0, 4), fu, note: [], extras: [], juan: seq <= 50 ? 11 : 12 };
        if (raw !== seq) {
          e.rawNo = raw;
          textualIssues.push(`正文第${seq}法底本标作「第${m[1]}法」，按序位归正`);
        }
        entries.push(e);
      }
      continue;
    }
    // anno 模式
    cur = feedAnnotationLine(line, cur, 11);
  }
}

// ---------- 卷十二：五十一~一百注 ----------
{
  const lines = read('12-juan12.txt');
  let cur = null;
  for (const line of lines) {
    cur = feedAnnotationLine(line, cur, 12);
  }
}

/** 注文流处理：标头/附属格/正文行 */
function feedAnnotationLine(line, cur, juan) {
  if (SKIP_RE.test(line)) return cur;

  const head = line.match(ANNO_HEAD_RE);
  if (head) {
    const prefix = head[1];
    const hasDi = head[2] === '第';
    const num = cnToInt(head[3]);
    // 先按赋句前四字匹配；失配且带「第」时按编号；两者皆无则视为普通正文行
    let entry = entries.find((e) => e.fu.startsWith(prefix.slice(0, 4)));
    if (!entry && hasDi && num >= 1 && num <= entries.length) entry = entries[num - 1];
    if (entry) {
      if (entry.no !== num) {
        textualIssues.push(`第${entry.no}法注文标头底本作「第${head[3]}」，依赋句归于第${entry.no}法`);
      }
      if (prefix !== entry.fu && prefix.slice(0, 4) === entry.fu.slice(0, 4)) {
        // 注头与正文句字面有出入（如 網羅/羅網、証/症），记录
        textualIssues.push(`第${entry.no}法注头作「${prefix}」，正文作「${entry.fu}」`);
      }
      if (head[4]) entry.note.push(head[4].trim());
      return { entry, sub: null };
    }
    if (hasDi) diagnostics.unmatchedHeaders.push(`[卷${juan}] ${line.slice(0, 24)}`);
    // 落回正文行处理
  }

  const sub = cur ? line.match(SUB_RE) : null;
  if (sub && cur) {
    const block = { title: sub[1], text: sub[2] ? [sub[2].trim()] : [] };
    cur.entry.extras.push(block);
    return { entry: cur.entry, sub: block };
  }

  if (!cur) {
    diagnostics.bodyOrphans++;
    return cur;
  }
  if (cur.sub) cur.sub.text.push(line);
  else cur.entry.note.push(line);
  return cur;
}

// ---------- 校验与落盘 ----------
if (entries.length !== 100) {
  console.error(`✗ 正文法数 ${entries.length} ≠ 100`);
  process.exit(1);
}
const noNote = entries.filter((e) => e.note.length === 0).map((e) => e.no);

const bifa = {
  source: 'ctext.org wiki res=260435（欽定四庫全書本《六壬大全》卷十一、卷十二《畢法賦》）',
  author: '宋·凌福之撰；明《六壬大全》辑（郭載騋校）',
  entries: entries.map((e) => ({
    no: e.no,
    name: e.name,
    fu: e.fu,
    ...(e.rawNo ? { rawNo: e.rawNo } : {}),
    juan: e.juan,
    note: e.note.join('\n\n'),
    extras: e.extras.map((x) => ({ title: x.title, text: x.text.join('\n\n') })),
  })),
  textualIssues,
};
writeFileSync(path.join(outDir, 'bifa.json'), JSON.stringify(bifa, null, 1), 'utf8');

// ---------- 典籍 markdown ----------
function entryMd(e) {
  const L = [`### 第${e.no}法　${e.fu}`, ''];
  if (e.note.length) L.push(e.note.join('\n\n'), '');
  for (const x of e.extras) L.push(`#### 附：${x.title}`, '', x.text.join('\n\n'), '');
  return L.join('\n');
}
const zongMu = entries.map((e) => `${e.no}. ${e.fu}`).join('\n');
const juan11Md = [
  '# 六壬大全卷十一 《畢法賦》上',
  '',
  '> 底本：欽定四庫全書本《六壬大全》（ctext.org wiki res=260435 转录）。宋·凌福之《畢法賦》百法，卷十一收正文与第一～五十法注，卷十二收第五十一～一百法注。',
  '',
  '## 《六壬畢法》正文（百法總目）',
  '',
  zongMu,
  '',
  '## 分法詳解（第一法～第五十法）',
  '',
  entries.filter((e) => e.no <= 50).map(entryMd).join('\n'),
].join('\n');
const juan12Md = [
  '# 六壬大全卷十二 《畢法賦》下',
  '',
  '## 分法詳解（第五十一法～第一百法）',
  '',
  entries.filter((e) => e.no > 50).map(entryMd).join('\n'),
].join('\n');

// ---------- 其余各卷（序 + 卷一~卷十）：整卷典籍化 ----------
// 只做高置信排版：卷题行→H1；「…第X」「XX課」独行→小节标题；其余逐行成段。
// 底本版面（盘式图、神煞表行）不臆断重构，保持原行原序。
const PROVENANCE = '> 底本：欽定四庫全書本《六壬大全》（ctext.org wiki res=260435 转录）。';
const FURNITURE_RE = /^(欽定四庫全書|六壬大全[卷巻].{1,4}終)$/;
const TITLE_RE = /^六壬大全[卷巻](\S{1,3})[\s　]+(.+)$/;
const SECTION_RES = [
  /^[^，。；：、？！\s　]{2,10}第[一二三四五六七八九十]+$/, // 如「時事休咎第一」
  /^[^，。；：、？！\s　]{1,6}課$/, // 課經节：元首課／官爵課…
  /^[^，。；：、？！\s　]{2,6}論$/, // 神將釋节：大神總論／貴人論…
  /^(登明|神后|大吉|功曹|太衝|天罡|太乙|勝光|小吉|傳送|從魁|河魁)[子丑寅卯辰巳午未申酉戌亥]$/, // 十二月将分节
  /^十二宮分野[上下]$/,
];

const BOOK_PAGES = [
  { file: '00-xu.txt', path: 'book/xu.md', title: '提要（四庫總目）', fallbackH1: '《六壬大全》提要（四庫全書總目）' },
  { file: '01-juan01.txt', path: 'book/juan01.md', title: '卷一 起例' },
  { file: '02-juan02.txt', path: 'book/juan02.md', title: '卷二 神將釋' },
  { file: '03-juan03.txt', path: 'book/juan03.md', title: '卷三 歌賦' },
  { file: '04-juan04.txt', path: 'book/juan04.md', title: '卷四 歌賦（續）', fallbackH1: '六壬大全卷四　歌賦（續：括囊賦、雲霄賦等）' },
  { file: '05-juan05.txt', path: 'book/juan05.md', title: '卷五 兵占' },
  { file: '06-juan06.txt', path: 'book/juan06.md', title: '卷六 宿度分野' },
  { file: '07-juan07.txt', path: 'book/juan07.md', title: '卷七 課經集一' },
  { file: '08-juan08.txt', path: 'book/juan08.md', title: '卷八 課經集二' },
  { file: '09-juan09.txt', path: 'book/juan09.md', title: '卷九 課經集三' },
  { file: '10-juan10.txt', path: 'book/juan10.md', title: '卷十 課經集四' },
];

// 《大六壬心鏡》（唐·徐道符）：八门分类占法手册，門→节两级；无卷题行（各页 fallbackH1）
const LRXJ_SECTION_RES = [
  /^[^，。；：、？！\s　]{2,8}門$/, // 門级分组：釋課元微門／占宅門…
  /^[^，。；：、？！\s　]{2,8}[卦課](?:[^，。；：、？！\s　]{1,4}附)?$/, // 卦体节：元首卦／天禍課／蒿矢卦彈射卦附
  /^[^，。；：、？！\s　]{2,10}第[一二三四五六七八九十]+(?:[一二三四五六七八九十]{1,2}首)?$/, // 克賊第一／伏吟第七三首
  /^(登明|河魁|從魁|傳送|小吉|勝光|太乙|天罡|太衝|功曹|大吉|神後)[子丑寅卯辰巳午未申酉戌亥]神$/, // 雜神門十二神
  /^占[^，。；：、？！\s　]{1,9}$/, // 占目：占人宅／占天晴否…
];
const LRXJ_PAGES = [
  { file: '00-xu.txt', path: 'book/xu.md', title: '序·總目', fallbackH1: '《大六壬心鏡》序·總目', noSections: true },
  { file: '01-juan01.txt', path: 'book/juan01.md', title: '卷一 釋課元微·宗首九科', fallbackH1: '大六壬心鏡卷一　釋課元微·宗首九科·淫泆' },
  { file: '02-juan02.txt', path: 'book/juan02.md', title: '卷二 新孕·隱匿·乖別·十雜', fallbackH1: '大六壬心鏡卷二　新孕·隱匿·乖別·十雜' },
  { file: '03-juan03.txt', path: 'book/juan03.md', title: '卷三 凶否·吉泰', fallbackH1: '大六壬心鏡卷三　凶否·吉泰' },
  { file: '04-juan04.txt', path: 'book/juan04.md', title: '卷四 雜神·雜將·三宮時', fallbackH1: '大六壬心鏡卷四　雜神·雜將·三宮時' },
  { file: '05-juan05.txt', path: 'book/juan05.md', title: '卷五 占宅·婚產·田蠶', fallbackH1: '大六壬心鏡卷五　占宅·修造·黃黑道·婚姻·產育·田蠶' },
  { file: '06-juan06.txt', path: 'book/juan06.md', title: '卷六 商賈·官職·亡盜·官訟', fallbackH1: '大六壬心鏡卷六　商賈·假借·奴婢·六畜·官職·亡盜·官訟' },
  { file: '07-juan07.txt', path: 'book/juan07.md', title: '卷七 疾病·行人·天時·雜課', fallbackH1: '大六壬心鏡卷七　疾病·行人·天時·雜課' },
  { file: '08-juan08.txt', path: 'book/juan08.md', title: '卷八 兵占', fallbackH1: '大六壬心鏡卷八　兵占' },
];

// ---------- 语料库书目注册表（新书在此登记：整卷典籍化即配即产；深度结构化另开分支） ----------
const CORPUS = [
  {
    slug: 'lrdq',
    book: '六壬大全',
    dynasty: '明',
    textDir,
    provenance: PROVENANCE,
    furnitureRe: FURNITURE_RE,
    titleRe: TITLE_RE,
    titleH1: (m) => `六壬大全卷${m[1]}　${m[2].trim()}`,
    sectionRes: SECTION_RES,
    pages: BOOK_PAGES,
  },
  {
    slug: 'lrxj',
    book: '六壬心鏡',
    dynasty: '唐',
    author: '徐道符',
    textDir: path.join(root, 'docs/corpus/lrxj/text'),
    provenance: '> 底本：ctext.org wiki res=486357 转录《大六壬心鏡》（唐·徐道符撰，清程樹勛手錄本）。',
    furnitureRe: /$^/, // 转录无页衬行
    titleRe: /$^/, // 底本无卷题行，各页用 fallbackH1
    titleH1: () => '',
    sectionRes: LRXJ_SECTION_RES,
    pages: LRXJ_PAGES,
  },
  {
    slug: 'lrzn',
    book: '六壬指南注解',
    dynasty: '明',
    author: '陳公獻撰·張洪注',
    textDir: path.join(root, 'docs/corpus/lrzn/text'),
    provenance:
      '> 底本：ctext.org wiki res=516644 转录《六壬指南注解》——明末清初·陳公獻《大六壬指南》（順治壬辰刊系统，含周元曙、程起鸞原序），今·張洪注解本（自序落款庚辰年，2000）。陳注与張注混排无标记，依底本照录；今注版权属注者，本库以非商用许可（CC BY-NC 4.0）汇编研习，如权利人异议即撤。',
    furnitureRe: /$^/,
    titleRe: /^卷(之?[一二三四五六七八九十]{1,3})[\s　]+(.+)$/,
    titleH1: (m) => `六壬指南注解卷${m[1]}　${m[2].trim()}`,
    sectionRes: [/^[^，。；：、？！\s　]{2,10}第[一二三四五六七八九十]+$/], // 會纂占驗分章：總論章第一…
    pages: [
      { file: '00-xu.txt', path: 'book/xu.md', title: '序·目錄·原序', fallbackH1: '《六壬指南注解》序·目錄·原序', noSections: true },
      { file: '01-juan01.txt', path: 'book/juan01.md', title: '卷一 注釋心印賦', fallbackH1: '六壬指南注解卷一　注釋大六壬心印賦' },
      { file: '02-juan02.txt', path: 'book/juan02.md', title: '卷二 注釋指掌賦', fallbackH1: '六壬指南注解卷二　大六壬九天玄女指掌賦' },
      { file: '03-juan03.txt', path: 'book/juan03.md', title: '卷三 會纂占驗指南', fallbackH1: '六壬指南注解卷三　大六壬會纂占驗指南' },
      { file: '04-juan04.txt', path: 'book/juan04.md', title: '卷四 神煞指南', fallbackH1: '六壬指南注解卷之四　大六壬神煞指南' },
    ],
  },
];

/** 整卷 txt → 典籍 markdown（保守排版；配置来自书目注册表） */
function juanToMd(page, bk) {
  const body = [];
  let h1 = null;
  let sections = 0;
  const lines = readFileSync(path.join(bk.textDir, page.file), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (bk.furnitureRe.test(line)) continue;
    if (!h1) {
      const t = line.match(bk.titleRe);
      if (t) {
        h1 = bk.titleH1(t);
        continue;
      }
    }
    if (!page.noSections && bk.sectionRes.some((re) => re.test(line))) {
      body.push(`## ${line}`);
      sections++;
      continue;
    }
    body.push(line);
  }
  h1 ??= page.fallbackH1; // 序无卷题行；大全卷四底本缺卷题行
  if (!h1) throw new Error(`✗ ${page.file} 未识别卷题且无 fallback`);
  return { md: [`# ${h1}`, '', bk.provenance, '', body.join('\n\n')].join('\n'), sections };
}

const manifest = [];
const docsBySlug = {};
for (const bk of CORPUS) {
  const docs = (docsBySlug[bk.slug] ??= {});
  for (const p of bk.pages) {
    const { md, sections } = juanToMd(p, bk);
    const full = `${bk.slug}/${p.path}`;
    manifest.push({
      path: full, title: p.title, group: 'book', book: bk.book, dynasty: bk.dynasty,
      ...(bk.author ? { author: bk.author } : {}),
    });
    docs[full] = md;
    console.log(`${full}: ${(md.length / 1024).toFixed(0)}KB，小节 ${sections}`);
  }
}

// 畢法賦上下（深度结构化产物，大全专属分支）
const lrdqMeta = { group: 'book', book: '六壬大全', dynasty: '明' };
manifest.push({ path: 'lrdq/book/juan11.md', title: '卷十一 畢法賦上', ...lrdqMeta });
manifest.push({ path: 'lrdq/book/juan12.md', title: '卷十二 畢法賦下', ...lrdqMeta });
docsBySlug.lrdq['lrdq/book/juan11.md'] = juan11Md;
docsBySlug.lrdq['lrdq/book/juan12.md'] = juan12Md;

// 检测口径说明（挂大全册）
const algoDir = path.join(root, 'docs/algorithm');
if (existsSync(algoDir)) {
  for (const f of readdirSync(algoDir).filter((f) => f.endsWith('.md'))) {
    const md = readFileSync(path.join(algoDir, f), 'utf8');
    const title = (md.match(/^#\s+(.+)$/m) || [])[1] ?? f;
    manifest.push({ path: `lrdq/algorithm/${f}`, title, group: 'algorithm', book: '六壬大全', dynasty: '明' });
    docsBySlug.lrdq[`lrdq/algorithm/${f}`] = md;
  }
}
writeFileSync(path.join(outDir, 'docs-manifest.json'), JSON.stringify({ manifest }, null, 1), 'utf8');
for (const [slug, docs] of Object.entries(docsBySlug)) {
  writeFileSync(path.join(outDir, `docs-${slug}.json`), JSON.stringify({ docs }, null, 1), 'utf8');
}

console.log(`bifa.json: ${entries.length} 法；无注文: [${noNote.join(',') || '无'}]`);
console.log(`附属格总数: ${entries.reduce((s, e) => s + e.extras.length, 0)}`);
console.log(`textualIssues: ${textualIssues.length} 条`);
if (diagnostics.unmatchedHeaders.length) console.log('未匹配标头:', diagnostics.unmatchedHeaders);
console.log(
  `docs-manifest.json: ${manifest.length} 篇；载荷 ${Object.keys(docsBySlug).map((s) => `docs-${s}.json`).join('、')}`,
);

// ---------- 课体节库（課經 + 心鏡）：深度结构化，供宿主课体深链 ----------
// 大全課經：每个「XX課」独行节题起一条；卷九「三交課」底本重出两节，照收。
// 心鏡卷一~卷三：九法（克賊第一…）与卦体节（元首卦…天羅地網卦）并入，
// 同名跨书互证（如元首两书各一节）；其余门/神/占目节题只作分界不入库。
{
  // 6 字上限与整卷典籍化口径一致；卷七「順/逆連茹三奇十二課」（8 字）为三奇課内子表头，非独立节
  const KE_HEAD_RE = /^[^，。；：、？！\s　]{1,6}課$/;
  const KEJU_FILES = [
    ['07-juan07.txt', 7],
    ['08-juan08.txt', 8],
    ['09-juan09.txt', 9],
    ['10-juan10.txt', 10],
  ];
  const keJing = [];
  let orphan = 0;
  for (const [file, juan] of KEJU_FILES) {
    let cur = null;
    for (const line of read(file)) {
      if (FURNITURE_RE.test(line) || TITLE_RE.test(line)) continue;
      if (KE_HEAD_RE.test(line)) {
        cur = { name: line.replace(/課$/, ''), book: '六壬大全', juan, order: keJing.length + 1, text: [] };
        keJing.push(cur);
        continue;
      }
      if (cur) cur.text.push(line);
      else orphan++;
    }
  }
  if (keJing.length !== 70) {
    console.error(`✗ 課經节数 ${keJing.length} ≠ 70`);
    process.exit(1);
  }

  // 心鏡卷一~卷三
  const XJ_FA_RE = /^(.{1,6})第[一二三四五六七八九十]+(?:[一二三四五六七八九十]{1,2}首)?$/;
  const XJ_GUA_RE = /^(.{1,10}?)[卦課](?:[^，。；：、？！\s　]{1,4}附)?$/;
  const xjDir = path.join(root, 'docs/corpus/lrxj/text');
  let xjCount = 0;
  for (const [file, juan] of [['01-juan01.txt', 1], ['02-juan02.txt', 2], ['03-juan03.txt', 3]]) {
    const lines = readFileSync(path.join(xjDir, file), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let cur = null;
    for (const line of lines) {
      const fa = line.match(XJ_FA_RE);
      const gua = fa ? null : line.match(XJ_GUA_RE);
      // 「十雜卦」为组题（其下甲己卦等才是节），只作分界不入库
      if (gua && gua[1] === '十雜') {
        cur = null;
        continue;
      }
      if (fa || gua) {
        cur = { name: (fa ?? gua)[1], book: '六壬心鏡', juan, order: keJing.length + 1, text: [] };
        keJing.push(cur);
        xjCount++;
        continue;
      }
      // 其余节题（門/神/占目）只作分界，防止正文误并入上一节
      if (LRXJ_SECTION_RES.some((re) => re.test(line))) {
        cur = null;
        continue;
      }
      if (cur) cur.text.push(line);
    }
  }
  if (xjCount < 60 || xjCount > 90) {
    console.error(`✗ 心鏡课体节数异常: ${xjCount}`);
    process.exit(1);
  }

  const empty = keJing.filter((e) => !e.text.length);
  if (empty.length) {
    console.error('✗ 课体空节:', empty.map((e) => `${e.book}${e.name}`));
    process.exit(1);
  }
  writeFileSync(
    path.join(outDir, 'keju.json'),
    JSON.stringify(
      {
        source:
          '《六壬大全》卷七~卷十《課經集》（ctext res=260435）＋《六壬心鏡》卷一~卷三九法/卦体节（ctext res=486357）',
        entries: keJing.map((e) => ({ name: e.name, book: e.book, juan: e.juan, order: e.order, text: e.text.join('\n\n') })),
      },
      null,
      1,
    ),
    'utf8',
  );
  console.log(`keju.json: 課經 ${keJing.length - xjCount} 节 + 心鏡 ${xjCount} 节${orphan ? `（节前散行 ${orphan}）` : ''}`);
}

// ---------- 神煞（卷一）：三表映射化 + 月令杂列保守解析 ----------
// 歲神煞（年支 12 值）／十天干神煞（日干 10 值）／十二地支神煞（日支 12 值）：
//   「名 + 值串 [+ 尾注]」提为映射，非值串行保留为规则条。
// 月令杂列块（无分隔符混排）：严格「2 字名 + 12 支连串」才提按月映射，
//   其余整行列存（rule 含全行原文，name 仅作索引提示）；断行按「…在$」拼接。
{
  const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const GAN10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const YUE12 = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const ZHI_SET = new Set(ZHI12);
  const ssIssues = [];
  const lines = read('01-juan01.txt');
  const idxOf = (s) => lines.findIndex((l) => l === s);
  const iSui = idxOf('歲神煞');
  const iGan = idxOf('十天干神煞');
  const iZhi = idxOf('十二地支神煞');
  const iZa = idxOf('內天罡行十二經絡');
  const iZaEnd = lines.findIndex((l, i) => i > iZa && /^正月$/.test(l));
  if ([iSui, iGan, iZhi, iZa].some((i) => i < 0) || iZaEnd < 0) {
    console.error('✗ 卷一神煞分节定位失败');
    process.exit(1);
  }

  const zhiRun = (s) => {
    let r = '';
    for (const ch of s) {
      if (ZHI_SET.has(ch)) r += ch;
      else break;
    }
    return r;
  };
  const toMap = (keys, run) => Object.fromEntries(keys.map((k, i) => [k, run[i]]));

  /** 表区解析：键头行跳过；名+值串→映射；其余规则条；无名短行并入上一条 */
  function parseTable(slice, keys, expect) {
    const out = [];
    for (const line of slice) {
      if (/^[子丑寅卯辰巳午未申酉戌亥]{10,12}$/.test(line) || /^[甲乙丙丁戊己巳庚辛壬癸]{9,10}$/.test(line)) continue;
      const m = line.match(/^(\S{2,6}?)[\s　：:]+(.*)$/);
      if (!m) {
        const prev = out[out.length - 1];
        if (prev && (prev.rule === '' || line.length < 16)) {
          prev.note = `${prev.note ?? ''}${prev.note ? '\n' : ''}${line}`;
        } else {
          out.push({ name: line.slice(0, 2), rule: line });
        }
        continue;
      }
      const rest = m[2];
      const run = zhiRun(rest);
      if (run.length === expect && !ZHI_SET.has(rest[expect] ?? '')) {
        const note = rest.slice(expect).trim();
        out.push({ name: m[1], map: toMap(keys, run), ...(note ? { note } : {}) });
      } else {
        out.push({ name: m[1], rule: rest });
      }
    }
    return out;
  }

  // 月令杂列：断行拼接（行尾「在/為/得/加/乘/臨/與」视为断条）
  const zaRaw = lines.slice(iZa, iZaEnd);
  const zaJoined = [];
  for (let i = 0; i < zaRaw.length; i++) {
    let l = zaRaw[i];
    while (/[在為得加乘臨與]$/.test(l) && i + 1 < zaRaw.length) l += zaRaw[++i];
    zaJoined.push(l);
  }
  const zaEntries = [];
  for (const line of zaJoined) {
    const comp = line.match(/^([^\s，。；：、]{2}、[^\s，。；：、]{2})/);
    const name = comp ? comp[1] : line.slice(0, 2);
    const rest = comp ? line.slice(comp[1].length) : line.slice(2);
    const run = zhiRun(rest);
    if (!comp && run.length === 12 && !ZHI_SET.has(rest[12] ?? '')) {
      const note = rest.slice(12).trim();
      zaEntries.push({ name, map: toMap(YUE12, run), ...(note ? { note } : {}) });
    } else {
      zaEntries.push({ name, rule: line });
    }
  }
  if (lines.slice(iGan, iZhi).includes('甲乙丙丁戊巳庚辛壬癸')) {
    ssIssues.push('十天干神煞表头「戊巳庚」之「巳」为「己」之误，按十干序归正');
  }
  if (zaJoined.some((l) => l.startsWith('聖心'))) {
    ssIssues.push('「聖心」行含「己」疑为「巳」之讹，未改字，整行列存为规则条');
  }

  const sections = [
    { id: 'sui', section: '歲神煞', basis: '年支', keys: ZHI12, entries: parseTable(lines.slice(iSui + 1, iGan), ZHI12, 12) },
    { id: 'gan', section: '十天干神煞', basis: '日干', keys: GAN10, entries: parseTable(lines.slice(iGan + 1, iZhi), GAN10, 10) },
    { id: 'zhi', section: '十二地支神煞', basis: '日支', keys: ZHI12, entries: parseTable(lines.slice(iZhi + 1, iZa), ZHI12, 12) },
    { id: 'yue', section: '月令雜列神煞', basis: '月（正~十二）', keys: YUE12, entries: zaEntries },
  ];

  // ---------- 逐月神煞（正月~十二月立成）：每月十二宫，支行上栏＋续行下栏 ----------
  // 栏别依底本版面（通行立成表式上吉下凶），内容逐字照收；连书未分名照录并记校记。
  const iZong = lines.findIndex((l) => l === '總鈐');
  const mIdx = YUE12.map((m) => lines.findIndex((l) => l === m));
  if (iZong < 0 || mIdx.some((i) => i < 0) || mIdx.some((v, i) => i > 0 && v <= mIdx[i - 1]) || mIdx[11] >= iZong) {
    console.error('✗ 逐月神煞分块定位失败');
    process.exit(1);
  }
  const monthly = [];
  const fusedTokens = [];
  for (let mi = 0; mi < 12; mi++) {
    const end = mi < 11 ? mIdx[mi + 1] : iZong;
    const gong = [];
    let cur = null;
    for (let i = mIdx[mi] + 1; i < end; i++) {
      const line = lines[i];
      const bare = line.match(/^([子丑寅卯辰巳午未申酉戌亥])$/);
      const bm = line.match(/^([子丑寅卯辰巳午未申酉戌亥])[\s　]+(.+)$/);
      if (bare || bm) {
        cur = { zhi: (bare ?? bm)[1], ji: bm ? bm[2].split(/[\s　]+/).filter(Boolean) : [], xiong: [] };
        gong.push(cur);
      } else if (cur) {
        cur.xiong.push(...line.split(/[\s　]+/).filter(Boolean));
      } else {
        console.error(`✗ ${YUE12[mi]}块支行前出现散行: ${line.slice(0, 20)}`);
        process.exit(1);
      }
    }
    if (gong.length !== 12 || gong.some((g, i) => g.zhi !== ZHI12[i])) {
      console.error(`✗ ${YUE12[mi]}宫数/支序异常: ${gong.map((g) => g.zhi).join('')}`);
      process.exit(1);
    }
    for (const g of gong) {
      for (const t of [...g.ji, ...g.xiong]) {
        if (t.length >= 4) fusedTokens.push(`${YUE12[mi]}${g.zhi}宫「${t}」`);
      }
    }
    monthly.push({ month: YUE12[mi], gong });
  }
  if (fusedTokens.length) {
    ssIssues.push(`逐月神煞有连书未分名 ${fusedTokens.length} 处（照录未拆）：${fusedTokens.join('、')}`);
  }
  // 生氣系列自检：与「月支后二辰」通行公式比对，偏差照录并记校记
  const JIAN12 = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  monthly.forEach((m, i) => {
    const at = m.gong.find((g) => g.ji.includes('生氣') || g.xiong.includes('生氣'))?.zhi;
    const exp = ZHI12[(ZHI12.indexOf(JIAN12[i]) + 10) % 12];
    if (at && at !== exp) {
      ssIssues.push(`逐月神煞${m.month}「生氣」落${at}，依月支后二辰序当在${exp}，照录未改`);
    }
  });

  writeFileSync(
    path.join(outDir, 'shensha.json'),
    JSON.stringify(
      {
        source: '欽定四庫全書本《六壬大全》卷一（ctext.org wiki res=260435 转录）',
        sections,
        monthly,
        textualIssues: ssIssues,
      },
      null,
      1,
    ),
    'utf8',
  );
  for (const s of sections) {
    const maps = s.entries.filter((e) => e.map).length;
    console.log(`shensha/${s.id}: ${s.entries.length} 条（映射 ${maps}，规则 ${s.entries.length - maps}）`);
  }
  const nShen = monthly.reduce((s, m) => s + m.gong.reduce((a, g) => a + g.ji.length + g.xiong.length, 0), 0);
  console.log(`shensha/monthly: 12 月 × 12 宫，神煞落位 ${nShen} 处；连书 ${fusedTokens.length} 处`);
}
