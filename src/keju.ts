/**
 * 課經子入口 —— `import { getKeJing, findKeJing } from 'lrdq-ts-lib/keju'`
 *
 * 《六壬大全》卷七~卷十《課經集》七十节深度结构化（含卷九「三交課」重出两节）。
 * 与主入口分包，宿主在课体深链等惰性场景 dynamic import，不进主包。
 * 课名匹配做繁简/异体折叠（剋→克、遙→遥、竒→奇 等），并容「課/课」后缀。
 */
import kejuData from './data/keju.json';

export interface KeJingEntry {
  /** 课名（不含「課」字：元首、重審、三交…） */
  name: string;
  /** 所在卷（7~10） */
  juan: number;
  /** 全书节序（1~70） */
  order: number;
  /** 节正文（段落以空行分隔） */
  text: string;
}

interface KeJingShape {
  source: string;
  entries: KeJingEntry[];
}
const keju = kejuData as unknown as KeJingShape;

/** 繁体/异体 → 简体折叠表（覆盖七十课名用字与常见查询写法） */
const FOLD: Record<string, string> = {
  遙: '遥', 剋: '克', 審: '审', 別: '别', 責: '责', 專: '专', 陽: '阳', 儀: '仪',
  時: '时', 龍: '龙', 貴: '贵', 軒: '轩', 蓋: '盖', 鑄: '铸', 輪: '轮', 從: '从',
  榮: '荣', 華: '华', 慶: '庆', 歡: '欢', 斬: '斩', 關: '关', 閉: '闭', 陰: '阴',
  贅: '赘', 衝: '冲', 蕪: '芜', 離: '离', 祿: '禄', 絕: '绝', 傷: '伤', 煩: '烦',
  禍: '祸', 獄: '狱', 網: '网', 戰: '战', 災: '灾', 醜: '丑', 勵: '励', 盤: '盘',
  連: '连', 間: '间', 純: '纯', 雜: '杂', 狀: '状', 類: '类', 竒: '奇', 將: '将',
  神: '神', 遊: '游',
};

/** 课名折叠：去「課/课」后缀 + 繁简/异体归一（供跨引擎课体名匹配） */
export function foldKeName(name: string): string {
  return name
    .replace(/[課课]$/, '')
    .split('')
    .map((ch) => FOLD[ch] ?? ch)
    .join('');
}

/** 全部七十节（含重出节，按全书节序） */
export function getKeJing(): KeJingEntry[] {
  return keju.entries;
}

/** 按课名取节（折叠匹配，首个命中） */
export function getKeJingEntry(name: string): KeJingEntry | undefined {
  const q = foldKeName(name);
  if (!q) return undefined;
  return keju.entries.find((e) => foldKeName(e.name) === q);
}

/** 按课名清单取节（折叠匹配、含同名重出节、按节序去重排序） */
export function findKeJing(names: string[]): KeJingEntry[] {
  const qs = new Set(names.map(foldKeName).filter(Boolean));
  if (!qs.size) return [];
  return keju.entries.filter((e) => qs.has(foldKeName(e.name)));
}
