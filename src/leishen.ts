/**
 * 类神子入口 —— `import { findTianJiang, findYueJiang } from 'lrdq-ts-lib/leishen'`
 *
 * 《六壬大全》卷二《神將釋》结构化：十二月将 + 十二天将（+總論），
 * 每节按底本分 論/賦/詩/類 块；brief 为类神要点——月将取「所主/類為/為姓」
 * 前缀行（逐字照录），天将取論首三行（家于/将性/主事定性段）。
 * 与主入口分包，宿主在导出补挂等惰性场景 dynamic import。
 * 天将名查询做归一化（貴人/天一→贵人 等，同 normalizeTianJiang 口径）。
 */
import leiShenData from './data/leishen.json';
import { normalizeTianJiang } from './normalize';

export interface LeiShenBlock {
  /** 論／賦／詩／類 */
  label: string;
  text: string;
}

export interface LeiShenEntry {
  kind: '月将' | '天将' | '總論';
  /** 登明…神后／貴人…天后／大神總論… */
  name: string;
  /** 月将所值支 */
  zhi?: string;
  /** 类神要点（逐字照录的关键行） */
  brief: string;
  blocks: LeiShenBlock[];
}

interface LeiShenShape {
  source: string;
  entries: LeiShenEntry[];
}
const data = leiShenData as unknown as LeiShenShape;

/** 繁→简折叠（天将名比对用；语料本身保持繁体） */
const TJ_FOLD: Record<string, string> = {
  貴人: '贵人', 螣蛇: '螣蛇', 朱雀: '朱雀', 六合: '六合', 勾陳: '勾陈', 青龍: '青龙',
  天空: '天空', 白虎: '白虎', 太常: '太常', 玄武: '玄武', 太陰: '太阴', 天后: '天后',
};

/** 全部节（12 月将 + 12 天将 + 總論） */
export function getLeiShen(): LeiShenEntry[] {
  return data.entries;
}

/** 按天将名取节（简繁/古写均可：贵人/貴人/天一…） */
export function findTianJiang(name: string): LeiShenEntry | undefined {
  const q = normalizeTianJiang(name);
  if (!q) return undefined;
  return data.entries.find((e) => e.kind === '天将' && (TJ_FOLD[e.name] ?? e.name) === q);
}

/** 按月将所值支取节（如 未 → 小吉） */
export function findYueJiang(zhi: string): LeiShenEntry | undefined {
  return data.entries.find((e) => e.kind === '月将' && e.zhi === zhi);
}
