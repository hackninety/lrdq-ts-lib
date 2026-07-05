/**
 * 《畢法賦》格局命中检测 —— 首批 23 法
 *
 * 判定条件依卷十一/十二注文（郭氏辑注）提炼：
 * - certainty='exact'：注文条件明确，可字面直判
 * - certainty='approx'：口径存在取舍（寄宫/别义等），详见 docs/algorithm/bifa-detect.md
 * 其余 77 法以语料形式收录（bifa.entries），待后续分批实现。
 */
import bifaData from './data/bifa.json';
import type { BifaChartInput, BifaHit } from './types';
import {
  GAN_WX, JI_GONG, LIU_HE, LU, MA, MU_ZHI, WX_KE, WX_SHENG, YANG_ZHI, ZHI_WX,
  liuQinOf, nextZhi, normalizeTianJiang,
} from './normalize';

interface Ctx {
  riGan: string;
  riZhi: string;
  nianZhi: string;
  kong: Set<string>;
  /** 三传支 */
  cz: string[];
  /** 三传天将（归一化） */
  cj: string[];
  /** 三传遁干集合 */
  dun: Set<string>;
  /** 三传对日干六亲（本库自算，不依赖宿主命名） */
  liuQin: string[];
  /** 四课上神 */
  keShang: string[];
  ganShang: string;
  zhiShang: string;
  ganShangJiang: string;
  zhiShangJiang: string;
  jiGong: string;
  /** 地盘支 → 天盘支（无天地盘时为 null） */
  tianZhiAt: ((diZhi: string) => string | undefined) | null;
}

function buildCtx(input: BifaChartInput): Ctx | null {
  const bazi = (input.dateInfo?.bazi ?? '').split(' ');
  const riGan = bazi[2]?.charAt(0) ?? '';
  const riZhi = bazi[2]?.charAt(1) ?? '';
  if (!riGan || !riZhi) return null;
  const { chu, zhong, mo } = input.sanChuan ?? {};
  const cz = [chu?.zhi ?? '', zhong?.zhi ?? '', mo?.zhi ?? ''];
  if (cz.some((z) => !z)) return null;

  const gongMap = new Map<string, { tianZhi: string }>();
  for (const g of input.gong ?? []) gongMap.set(g.diZhi, { tianZhi: g.tianZhi });

  return {
    riGan,
    riZhi,
    nianZhi: bazi[0]?.charAt(1) ?? '',
    kong: new Set(input.dateInfo?.kongWang ?? []),
    cz,
    cj: [chu, zhong, mo].map((c) => normalizeTianJiang(c?.tianJiang)),
    dun: new Set([chu, zhong, mo].map((c) => c?.dunGan).filter((d): d is string => !!d)),
    liuQin: cz.map((z) => liuQinOf(riGan, z)),
    keShang: (input.siKe ?? []).map((k) => k.shang).filter(Boolean),
    ganShang: input.siKe?.[0]?.shang ?? '',
    zhiShang: input.siKe?.[2]?.shang ?? '',
    ganShangJiang: normalizeTianJiang(input.siKe?.[0]?.tianJiang),
    zhiShangJiang: normalizeTianJiang(input.siKe?.[2]?.tianJiang),
    jiGong: JI_GONG[riGan] ?? '',
    tianZhiAt: gongMap.size === 12 ? (d) => gongMap.get(d)?.tianZhi : null,
  };
}

const sheng = (a?: string, b?: string) => !!a && !!b && WX_SHENG[a] === b;
const ke = (a?: string, b?: string) => !!a && !!b && WX_KE[a] === b;

interface Rule {
  no: number;
  certainty: 'exact' | 'approx';
  test(c: Ctx): string | null;
}

const RULES: Rule[] = [
  {
    no: 5, certainty: 'exact',
    test(c) {
      const seven = [...c.keShang, ...c.cz];
      if (c.keShang.length < 4) return null;
      return seven.every((z) => YANG_ZHI.has(z)) ? '四課三傳七處純陽' : null;
    },
  },
  {
    no: 6, certainty: 'exact',
    test(c) {
      const seven = [...c.keShang, ...c.cz];
      if (c.keShang.length < 4) return null;
      return seven.every((z) => z && !YANG_ZHI.has(z)) ? '四課三傳七處純陰' : null;
    },
  },
  {
    no: 7, certainty: 'exact',
    test: (c) => (c.ganShang && c.ganShang === LU[c.riGan] ? `日祿${LU[c.riGan]}臨干上` : null),
  },
  {
    no: 8, certainty: 'exact',
    test: (c) => (c.zhiShang && c.zhiShang === LU[c.riGan] ? `日祿${LU[c.riGan]}臨支上` : null),
  },
  {
    no: 14, certainty: 'exact',
    test: (c) => (c.liuQin.every((q) => q === '妻财') ? '三傳皆財爻' : null),
  },
  {
    no: 16, certainty: 'exact',
    test(c) {
      const i = c.cz.findIndex((z, k) => c.kong.has(z) && c.cj[k] === '天空');
      return i >= 0 ? `傳中${c.cz[i]}落空亡復乘天空` : null;
    },
  },
  {
    no: 17, certainty: 'exact',
    test(c) {
      const jin = nextZhi(c.cz[0]) === c.cz[1] && nextZhi(c.cz[1]) === c.cz[2];
      const k = c.cz.find((z) => c.kong.has(z));
      return jin && k ? `三傳進連茹而${k}落空亡` : null;
    },
  },
  {
    no: 18, certainty: 'approx',
    test(c) {
      const tui = nextZhi(c.cz[1]) === c.cz[0] && nextZhi(c.cz[2]) === c.cz[1];
      const k = c.cz.find((z) => c.kong.has(z));
      return tui && k ? `三傳退連茹而${k}落空亡（踏腳取退茹逢空義）` : null;
    },
  },
  {
    no: 21, certainty: 'approx',
    test(c) {
      return c.ganShang && c.zhiShang && LIU_HE[c.ganShang] === c.riZhi && LIU_HE[c.zhiShang] === c.jiGong
        ? `干上${c.ganShang}合日支、支上${c.zhiShang}合干寄宮（交互相合）`
        : null;
    },
  },
  {
    no: 22, certainty: 'approx',
    test(c) {
      return c.ganShang && c.zhiShang && LIU_HE[c.ganShang] === c.jiGong && LIU_HE[c.zhiShang] === c.riZhi
        ? `干上${c.ganShang}合干寄宮、支上${c.zhiShang}合日支`
        : null;
    },
  },
  {
    no: 25, certainty: 'exact',
    test: (c) => (GAN_WX[c.riGan] === '金' && c.dun.has('丁') ? '金日而三傳遁得丁神' : null),
  },
  {
    no: 26, certainty: 'exact',
    test: (c) => (GAN_WX[c.riGan] === '水' && c.dun.has('丁') ? '水日而三傳遁得丁神' : null),
  },
  {
    no: 27, certainty: 'approx',
    test: (c) => (c.liuQin[0] === '妻财' && c.liuQin[2] === '官鬼' ? '初傳財爻而末傳化鬼' : null),
  },
  {
    no: 31, certainty: 'exact',
    test(c) {
      const [a, b, d] = c.cz.map((z) => ZHI_WX[z]);
      return sheng(a, b) && sheng(b, d) ? '初生中、中生末，遞生不絕' : null;
    },
  },
  {
    no: 32, certainty: 'approx',
    test(c) {
      const [a, b, d] = c.cz.map((z) => ZHI_WX[z]);
      return ke(a, b) && ke(b, d) ? '初克中、中克末（互克取遞克義）' : null;
    },
  },
  {
    no: 41, certainty: 'exact',
    test(c) {
      const lu = LU[c.riGan];
      const ma = MA[c.riZhi];
      const shang = [c.ganShang, c.zhiShang];
      return lu && ma && shang.includes(lu) && shang.includes(ma)
        ? `日祿${lu}、驛馬${ma}俱見於干支之上`
        : null;
    },
  },
  {
    no: 42, certainty: 'approx',
    test: (c) =>
      ['乙', '丙', '丁'].every((g) => c.dun.has(g)) ? '三傳遁干乙丙丁三奇俱全（取遁奇義）' : null,
  },
  {
    no: 51, certainty: 'exact',
    test(c) {
      if (!c.tianZhiAt) return null;
      return c.tianZhiAt('亥') === '戌' && c.cz[0] === '戌' ? '天魁戌加天門亥發用' : null;
    },
  },
  {
    no: 52, certainty: 'exact',
    test(c) {
      if (!c.tianZhiAt) return null;
      return c.tianZhiAt('寅') === '辰' ? '天罡辰加鬼戶寅（不論在傳與否）' : null;
    },
  },
  {
    no: 55, certainty: 'approx',
    test(c) {
      return c.ganShang === nextZhi(c.jiGong) && c.zhiShang === nextZhi(c.riZhi)
        ? '干上乘寄宮前一辰、支上乘支前一辰（羅網兜裹）'
        : null;
    },
  },
  {
    no: 61, certainty: 'exact',
    test(c) {
      const mu = MU_ZHI[GAN_WX[c.riGan]];
      return c.ganShang === mu && c.ganShangJiang === '白虎' ? `干上${mu}為日墓復乘白虎` : null;
    },
  },
  {
    no: 62, certainty: 'exact',
    test(c) {
      const mu = MU_ZHI[ZHI_WX[c.riZhi]];
      return c.zhiShang === mu && c.zhiShangJiang === '白虎' ? `支上${mu}為支墓復乘白虎` : null;
    },
  },
  {
    no: 72, certainty: 'approx',
    test(c) {
      if (!c.nianZhi) return null;
      const sang = nextZhi(c.nianZhi, 2);
      const diao = nextZhi(c.nianZhi, -2);
      const pool = new Set([...c.keShang, ...c.cz]);
      return pool.has(sang) && pool.has(diao)
        ? `喪門${sang}、吊客${diao}俱入課傳`
        : null;
    },
  },
];

/** 已实现检测的法号列表 */
export const DETECTOR_NOS: number[] = RULES.map((r) => r.no);

interface BifaDataShape {
  entries: { no: number; name: string; fu: string }[];
}
const entryByNo = new Map(
  (bifaData as unknown as BifaDataShape).entries.map((e) => [e.no, e]),
);

/** 对排盘结果做毕法百法命中检测（宿主统一模型可直接传入） */
export function detectBifa(input: BifaChartInput): BifaHit[] {
  const ctx = buildCtx(input);
  if (!ctx) return [];
  const hits: BifaHit[] = [];
  for (const rule of RULES) {
    let why: string | null = null;
    try {
      why = rule.test(ctx);
    } catch {
      why = null;
    }
    if (!why) continue;
    const e = entryByNo.get(rule.no);
    if (!e) continue;
    hits.push({ no: rule.no, name: e.name, fu: e.fu, certainty: rule.certainty, why });
  }
  return hits.sort((a, b) => a.no - b.no);
}
