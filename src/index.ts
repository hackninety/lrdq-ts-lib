/**
 * lrdq-ts-lib —— 《六壬大全》典籍库 与 《畢法賦》百法命中检测
 *
 * 语料：欽定四庫全書本《六壬大全》卷十一/十二（宋·凌福之《畢法賦》，公版古籍）
 * 检测：detectBifa(chart) —— 输入结构兼容 react-liuren 统一模型
 * 典籍：getDocsManifest / getDocMarkdown（与 zslj-ts-lib 同形，宿主典籍库可并册）
 */
import bifaData from './data/bifa.json';
import docsData from './data/docs.json';
import type { BifaEntry, DocMeta } from './types';

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

interface DocsShape {
  manifest: DocMeta[];
  docs: Record<string, string>;
}
const docs = docsData as unknown as DocsShape;

/** 典籍文档目录（book=原文，algorithm=检测口径说明） */
export function getDocsManifest(): DocMeta[] {
  return docs.manifest;
}

/** 取某篇文档 markdown（path 用 manifest 中的值） */
export function getDocMarkdown(path: string): string | undefined {
  return docs.docs[path];
}
