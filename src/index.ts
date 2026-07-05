/**
 * lrdq-ts-lib —— 《六壬大全》典籍库 与 《畢法賦》百法命中检测
 *
 * 语料：欽定四庫全書本《六壬大全》（公版古籍；卷十一/十二《畢法賦》深度结构化）
 * 检测：detectBifa(chart) —— 输入结构兼容 react-liuren 统一模型
 * 典籍：走子入口 `lrdq-ts-lib/docs`（getDocsManifest / getDocMarkdown）。
 *       全书文本与检测主入口分包，宿主主包不背整部书卷。
 */
import bifaData from './data/bifa.json';
import type { BifaEntry } from './types';

export * from './types';
export { detectBifa, DETECTOR_NOS } from './detect';
export { normalizeTianJiang, liuQinOf } from './normalize';

interface BifaCorpus {
  source: string;
  author: string;
  entries: BifaEntry[];
  textualIssues: string[];
}

/** 《畢法賦》结构化语料（百法全量） */
export const bifa = bifaData as unknown as BifaCorpus;

/** 按法号取单条（1–100） */
export function getBifaEntry(no: number): BifaEntry | undefined {
  return bifa.entries.find((e) => e.no === no);
}
