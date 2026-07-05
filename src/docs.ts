/**
 * 典籍库子入口 —— `import { getDocsManifest, getDocMarkdown } from 'lrdq-ts-lib/docs'`
 *
 * 《六壬大全》全书十三篇（序 + 卷一~卷十二）随包内置，离线可用。
 * 与检测主入口分包：全书文本体量大，宿主惰性加载典籍界面时才拉取，
 * 主包只背 detectBifa 及其百法语料。
 * 接口与 zslj-ts-lib 同形，宿主典籍库可多库并册。
 */
import docsData from './data/docs.json';
import type { DocMeta } from './types';

export type { DocMeta } from './types';

interface DocsShape {
  manifest: DocMeta[];
  docs: Record<string, string>;
}
const docs = docsData as unknown as DocsShape;

/** 典籍文档目录（book=原文十三篇，algorithm=检测口径说明） */
export function getDocsManifest(): DocMeta[] {
  return docs.manifest;
}

/** 取某篇文档 markdown（path 用 manifest 中的值） */
export function getDocMarkdown(path: string): string | undefined {
  return docs.docs[path];
}
