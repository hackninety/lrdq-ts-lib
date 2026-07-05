/**
 * 典籍库子入口 —— `import { getDocsManifest, getDocMarkdown } from 'lrdq-ts-lib/docs'`
 *
 * 多书语料库入口（v0.6.0 起）：本模块只内联轻量 manifest（全库篇目 + book/dynasty），
 * 各书 markdown 载荷按书分包（src/books/<slug>），`getDocMarkdown` **异步**按
 * path 的 slug 前缀路由并缓存 —— 宿主打开某书篇目才拉取该书载荷 chunk。
 * 接口与 zslj-ts-lib 同形程度：getDocsManifest 同步同形；getDocMarkdown 变异步。
 */
import manifestData from './data/docs-manifest.json';
import type { DocMeta } from './types';

export type { DocMeta } from './types';

const manifest = (manifestData as unknown as { manifest: DocMeta[] }).manifest;

/** 各书载荷加载器（新书登记于此，与 gen-data CORPUS 对应） */
const LOADERS: Record<string, () => Promise<{ payload: { docs: Record<string, string> } }>> = {
  lrdq: () => import('./books/lrdq'),
  lrxj: () => import('./books/lrxj'),
};

const cache = new Map<string, Record<string, string>>();

/** 典籍文档目录（全库篇目，含 book/dynasty；轻量，同步） */
export function getDocsManifest(): DocMeta[] {
  return manifest;
}

/** 取某篇文档 markdown（异步：按 path 的书 slug 路由，首次拉取该书载荷并缓存） */
export async function getDocMarkdown(path: string): Promise<string | undefined> {
  const slug = path.split('/')[0];
  let docs = cache.get(slug);
  if (!docs) {
    const loader = LOADERS[slug];
    if (!loader) return undefined;
    docs = (await loader()).payload.docs;
    cache.set(slug, docs);
  }
  return docs[path];
}
