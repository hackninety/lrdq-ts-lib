/**
 * 语料生成：docs/book/text/*.txt（ctext 转录提取稿，13 页全书）
 *   → src/data/bifa.json  （《畢法賦》百法：编号/格名/赋句/注文/附属格）
 *   → src/data/docs.json  （典籍库 markdown：序 + 卷一~卷十二 + docs/algorithm/*.md）
 *
 * 底本：欽定四庫全書本《六壬大全》（ctext.org wiki res=260435）。
 * 卷十一/十二《畢法賦》做深度结构化；其余各卷整卷典籍化（只做高置信排版）。
 * 转录笔误（如正文「第五十一法…第五十三法」重出）按序位归正，并记入 textualIssues。
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const textDir = path.join(root, 'docs/book/text');
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

/** 整卷 txt → 典籍 markdown（保守排版） */
function juanToMd(page) {
  const body = [];
  let h1 = null;
  let sections = 0;
  for (const line of read(page.file)) {
    if (FURNITURE_RE.test(line)) continue;
    if (!h1) {
      const t = line.match(TITLE_RE);
      if (t) {
        h1 = `六壬大全卷${t[1]}　${t[2].trim()}`;
        continue;
      }
    }
    if (SECTION_RES.some((re) => re.test(line))) {
      body.push(`## ${line}`);
      sections++;
      continue;
    }
    body.push(line);
  }
  h1 ??= page.fallbackH1; // 序无卷题行；卷四底本缺卷题行
  if (!h1) throw new Error(`✗ ${page.file} 未识别卷题且无 fallback`);
  return { md: [`# ${h1}`, '', PROVENANCE, '', body.join('\n\n')].join('\n'), sections };
}

const manifest = [];
const docs = {};
for (const p of BOOK_PAGES) {
  const { md, sections } = juanToMd(p);
  manifest.push({ path: p.path, title: p.title, group: 'book' });
  docs[p.path] = md;
  console.log(`${p.path}: ${(md.length / 1024).toFixed(0)}KB，小节 ${sections}`);
}
manifest.push({ path: 'book/juan11.md', title: '卷十一 畢法賦上', group: 'book' });
manifest.push({ path: 'book/juan12.md', title: '卷十二 畢法賦下', group: 'book' });
docs['book/juan11.md'] = juan11Md;
docs['book/juan12.md'] = juan12Md;

const algoDir = path.join(root, 'docs/algorithm');
if (existsSync(algoDir)) {
  for (const f of readdirSync(algoDir).filter((f) => f.endsWith('.md'))) {
    const md = readFileSync(path.join(algoDir, f), 'utf8');
    const title = (md.match(/^#\s+(.+)$/m) || [])[1] ?? f;
    manifest.push({ path: `algorithm/${f}`, title, group: 'algorithm' });
    docs[`algorithm/${f}`] = md;
  }
}
writeFileSync(path.join(outDir, 'docs.json'), JSON.stringify({ manifest, docs }, null, 1), 'utf8');

console.log(`bifa.json: ${entries.length} 法；无注文: [${noNote.join(',') || '无'}]`);
console.log(`附属格总数: ${entries.reduce((s, e) => s + e.extras.length, 0)}`);
console.log(`textualIssues: ${textualIssues.length} 条`);
if (diagnostics.unmatchedHeaders.length) console.log('未匹配标头:', diagnostics.unmatchedHeaders);
console.log(`docs.json: ${manifest.length} 篇`);
