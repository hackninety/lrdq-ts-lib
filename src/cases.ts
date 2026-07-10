/**
 * 占例库子入口 —— `import { getZhanLi, findSimilarCases } from 'lrdq-ts-lib/cases'`
 *
 * 《六壬指南注解》卷三《會纂占驗指南》全部编号占例结构化：
 * 占驗＝明末清初·陳公獻原案，占例/增補課例＝今·張洪补注案（augmented）。
 * 头部字段（年/月/日干支/时支/月将/课体标签/旬空）由生成管线保守解析，
 * 案文照录（含课式盘图原行）；findSimilarCases 按章/课体/日干支/旬空加权检索，
 * 供宿主把相似占例作 few-shot 范例附进 AI 断课 Prompt。
 * 与主入口分包，宿主 dynamic import 惰性拉取，不进主包。
 */
import casesData from './data/cases.json';
import { foldKeName } from './keju';

export interface ZhanLiEntry {
  /** 全卷序号（1 起） */
  seq: number;
  /** 占驗＝陳公獻原案；占例＝注者今案 */
  kind: '占驗' | '占例';
  /** 底本编号汉数字（增補无编号案为空串） */
  no: string;
  /** 注者增補案（占例、增補課例标记后诸案） */
  augmented?: boolean;
  /** 所属章（如「疾病章第九」，与 lrzn/book/juan03.md 节题一致） */
  chapter: string;
  /** 年干支 */
  year?: string;
  /** 月（底本原写法：三月／未月／正月…） */
  month?: string;
  /** 日干支 */
  day?: string;
  /** 占时支 */
  hourZhi?: string;
  /** 月将支（少数案明书） */
  jiang?: string;
  /** 头部课体标签（底本原字，繁体） */
  keti: string[];
  /** 旬空二支（底本所记） */
  kong: string[];
  /** 空亡落宫二支（底本所记） */
  luoKong: string[];
  /** 案文全块照录（含课式盘图原行，行以 \n 分隔） */
  text: string;
}

interface CasesShape {
  source: string;
  entries: ZhanLiEntry[];
  textualIssues: string[];
}
const data = casesData as unknown as CasesShape;

/** 全部占例（按卷内原序） */
export function getZhanLi(): ZhanLiEntry[] {
  return data.entries;
}

/** 底本转录校记（日干支↔旬空互证偏差等，照录未改字） */
export function getZhanLiIssues(): string[] {
  return data.textualIssues;
}

/** 占例展示名：疾病章第九·占驗一／婚姻章第七·增補占例二 */
export function zhanLiLabel(e: ZhanLiEntry): string {
  return `${e.chapter}·${e.augmented ? '增補' : ''}${e.kind}${e.no}`;
}

export interface SimilarQuery {
  /** 当前盘课体名清单（简繁均可，折叠匹配） */
  keti?: string[];
  /** 当前盘日干支 */
  day?: string;
  /** 定向占事对应的章名清单（与 entry.chapter 全等匹配） */
  chapters?: string[];
  /** 当前盘旬空 */
  kong?: string[];
  /** 返回条数上限（默认 3） */
  limit?: number;
}

export interface SimilarHit {
  entry: ZhanLiEntry;
  score: number;
  /** 相似点说明（同章／课体同…／同日干支…） */
  why: string[];
}

/**
 * 相似占例检索：同章 +4；课体每同一项 +3（至多 +6）；
 * 日干支全同 +2（仅同干或同支各 +1）；旬空同 +1。仅返回得分 > 0 者。
 */
export function findSimilarCases(q: SimilarQuery): SimilarHit[] {
  const qKeti = new Set((q.keti ?? []).map(foldKeName).filter(Boolean));
  const qChapters = new Set(q.chapters ?? []);
  const qKong = [...(q.kong ?? [])].sort().join('');
  const hits: SimilarHit[] = [];
  for (const entry of data.entries) {
    let score = 0;
    const why: string[] = [];
    if (qChapters.has(entry.chapter)) {
      score += 4;
      why.push(`同章「${entry.chapter}」`);
    }
    const shared = entry.keti.filter((k) => qKeti.has(foldKeName(k)));
    if (shared.length) {
      score += Math.min(shared.length * 3, 6);
      why.push(`课体同「${shared.join('、')}」`);
    }
    if (q.day && entry.day) {
      if (entry.day === q.day) {
        score += 2;
        why.push(`同日干支${entry.day}`);
      } else {
        if (entry.day[0] === q.day[0]) {
          score += 1;
          why.push(`同日干${entry.day[0]}`);
        }
        if (entry.day[1] === q.day[1]) {
          score += 1;
          why.push(`同日支${entry.day[1]}`);
        }
      }
    }
    if (qKong && entry.kong.length && [...entry.kong].sort().join('') === qKong) {
      score += 1;
      why.push('同旬空');
    }
    if (score > 0) hits.push({ entry, score, why });
  }
  hits.sort((a, b) => b.score - a.score || a.entry.seq - b.entry.seq);
  return hits.slice(0, q.limit ?? 3);
}
