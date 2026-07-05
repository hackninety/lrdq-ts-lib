/**
 * 神煞表子入口 —— `import { getShenShaSections, findShenSha } from 'lrdq-ts-lib/shensha'`
 *
 * 《六壬大全》卷一神煞结构化：
 * - 歲神煞（年支 12 值）／十天干神煞（日干 10 值）／十二地支神煞（日支 12 值）→ 映射条
 * - 月令杂列块 → 严格模式提按月映射，其余整行列存为规则条（rule 含全行原文）
 * 底本笔误记 textualIssues（表头「戊巳庚」之「巳」归正为「己」等），不静默改字。
 */
import shenShaData from './data/shensha.json';

export interface ShenShaEntry {
  /** 神煞名（规则条的 name 仅作索引提示，全文在 rule） */
  name: string;
  /** 键 → 值映射（basis 见所在 section） */
  map?: Record<string, string>;
  /** 规则条原文（起例口诀、非表格行） */
  rule?: string;
  /** 尾注（值串后的小注） */
  note?: string;
}

export interface ShenShaSection {
  id: string;
  section: string;
  /** 映射键的取用依据：年支／日干／日支／月 */
  basis: string;
  keys: string[];
  entries: ShenShaEntry[];
}

/** 逐月立成单宫：栏别依底本版面（通行立成表式上吉下凶），内容逐字照收 */
export interface MonthlyGong {
  zhi: string;
  /** 上栏（吉神栏） */
  ji: string[];
  /** 下栏（凶神栏） */
  xiong: string[];
}

export interface MonthlyShenSha {
  /** 正月~十二月 */
  month: string;
  /** 十二宫（子~亥序） */
  gong: MonthlyGong[];
}

interface ShenShaShape {
  source: string;
  sections: ShenShaSection[];
  monthly: MonthlyShenSha[];
  textualIssues: string[];
}
const data = shenShaData as unknown as ShenShaShape;

/** 四节神煞表（歲／十天干／十二地支／月令杂列） */
export function getShenShaSections(): ShenShaSection[] {
  return data.sections;
}

/** 底本文字校记 */
export function getShenShaIssues(): string[] {
  return data.textualIssues;
}

/** 按名跨节查找（同名多见如金神/天解，全部返回） */
export function findShenSha(name: string): { section: ShenShaSection; entry: ShenShaEntry }[] {
  const out: { section: ShenShaSection; entry: ShenShaEntry }[] = [];
  for (const section of data.sections) {
    for (const entry of section.entries) {
      if (entry.name === name) out.push({ section, entry });
    }
  }
  return out;
}

/** 取某神煞在某键（年支/日干/日支/月名）下的值（映射条才有；可能多节同名多值） */
export function shenShaValue(name: string, key: string): string[] {
  return findShenSha(name)
    .map(({ entry }) => entry.map?.[key])
    .filter((v): v is string => !!v);
}

/** 逐月神煞立成（正月~十二月 × 十二宫） */
export function getMonthlyShenSha(): MonthlyShenSha[] {
  return data.monthly;
}

/** 某月某宫的上/下栏神煞 */
export function monthlyAt(month: string, zhi: string): MonthlyGong | undefined {
  return data.monthly.find((m) => m.month === month)?.gong.find((g) => g.zhi === zhi);
}

/** 反查某神煞逐月落宫（side: ji=上栏／xiong=下栏） */
export function findMonthlyShenSha(name: string): { month: string; zhi: string; side: 'ji' | 'xiong' }[] {
  const out: { month: string; zhi: string; side: 'ji' | 'xiong' }[] = [];
  for (const m of data.monthly) {
    for (const g of m.gong) {
      if (g.ji.includes(name)) out.push({ month: m.month, zhi: g.zhi, side: 'ji' });
      if (g.xiong.includes(name)) out.push({ month: m.month, zhi: g.zhi, side: 'xiong' });
    }
  }
  return out;
}
