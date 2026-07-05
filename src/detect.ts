/**
 * 《畢法賦》格局命中检测 —— 97/100 法
 *
 * 判定条件依卷十一/十二注文（郭氏辑注）提炼：
 * - certainty='exact'：注文条件明确，可字面直判
 * - certainty='approx'：口径存在取舍（寄宫/五行寄旺/格义推定等），详见 docs/algorithm/bifa-detect.md
 *
 * 不设检测器的 3 法（UNDETECTABLE_NOS）：
 * - 第93法 妄用三傳：起传校勘法，须以本派九宗门重演三传方可判；本库引擎中立，
 *   不同流派三传本应分歧（如占事略決古法），机判恐误伤，由宿主「三传多派对照」承担
 * - 第97法 所筮不入仍憑類 / 第98法 非占現類勿言之：断法方法论（凭类神、勿言非占），
 *   无格局条件可判
 *
 * 可选输入：nianMing（本命/行年）缺省时，年命类条件静默跳过（如第56法）。
 */
import bifaData from './data/bifa.json';
import type { BifaChartInput, BifaHit } from './types';
import {
  GAN_WX, GUI_DAY, GUI_NIGHT, JI_GONG, LIU_HAI, LIU_HE, LU, MA, MU_ZHI,
  TJ_HOME, TJ_WX, WX_KE, WX_SHENG, YANG_ZHI, ZHI_WX,
  csZhi, liuQinOf, nextZhi, normalizeTianJiang, sanHeKey, sanHeOf, sanHuiOf,
  xunGanOf, xunShouZhi,
} from './normalize';

interface GongInfo {
  diZhi: string;
  tianZhi: string;
  tianJiang: string;
}

interface Ctx {
  riGan: string;
  riZhi: string;
  nianZhi: string;
  yueZhi: string;
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
  yueJiang: string;
  /** '昼' | '夜' | ''（未知） */
  dayNight: string;
  benMing: string;
  xingNian: string;
  /** 十二宫（归一化天将名；无天地盘时为空数组） */
  gongs: GongInfo[];
  /** 地盘支 → 天盘支（无天地盘时为 null） */
  tianZhiAt: ((diZhi: string) => string | undefined) | null;
  /** 天盘支 → 所坐地盘支（首个匹配） */
  diOf(tianZhi: string): string;
  /** 天盘支 → 所乘天将 */
  jiangOfTian(tianZhi: string): string;
  /** 伏吟／返吟（有盘按盘判，无盘按课体名） */
  fuYin: boolean;
  fanYin: boolean;
  xunShou: string;
  xunWei: string;
  /** 旬丁支（本旬遁干得丁之支） */
  xunDing: string;
  guiDay: string;
  guiNight: string;
  /** 月内生气／死气（生气=月支后二辰，死气=对冲） */
  shengQi: string;
  siQi: string;
  /** 季节关神（春丑夏辰秋未冬戌；月支不明为 ''） */
  guanShen: string;
  /** 当季旺行（春木夏火秋金冬水） */
  wangWx: string;
  /** 宿主课体/取传法名串（keTi + method，供课名类法匹配） */
  keTiStr: string;
}

function buildCtx(input: BifaChartInput): Ctx | null {
  const bazi = (input.dateInfo?.bazi ?? '').split(' ');
  const riGan = bazi[2]?.charAt(0) ?? '';
  const riZhi = bazi[2]?.charAt(1) ?? '';
  if (!riGan || !riZhi) return null;
  const { chu, zhong, mo } = input.sanChuan ?? {};
  const cz = [chu?.zhi ?? '', zhong?.zhi ?? '', mo?.zhi ?? ''];
  if (cz.some((z) => !z)) return null;

  const gongs: GongInfo[] = (input.gong ?? []).map((g) => ({
    diZhi: g.diZhi,
    tianZhi: g.tianZhi,
    tianJiang: normalizeTianJiang(g.tianJiang),
  }));
  const gongMap = new Map(gongs.map((g) => [g.diZhi, g]));
  const hasPan = gongMap.size === 12;

  const ketiStr = `${input.sanChuan?.keTi ?? ''}${input.sanChuan?.method ?? ''}`;
  const fuYin = hasPan
    ? gongs.every((g) => g.tianZhi === g.diZhi)
    : /伏吟/.test(ketiStr);
  const fanYin = hasPan
    ? gongs.every((g) => g.tianZhi === nextZhi(g.diZhi, 6))
    : /返吟|返呤/.test(ketiStr);

  const yueZhi = bazi[1]?.charAt(1) ?? '';
  const seasonIdx = ['亥子丑', '寅卯辰', '巳午未', '申酉戌'].findIndex((s) => s.includes(yueZhi));
  const xunShou = xunShouZhi(riGan, riZhi);
  const dnRaw = input.dateInfo?.dayNight ?? '';
  const dayNight = /[昼晝日旦]/.test(dnRaw) ? '昼' : /[夜暮]/.test(dnRaw) ? '夜' : '';

  return {
    riGan,
    riZhi,
    nianZhi: bazi[0]?.charAt(1) ?? '',
    yueZhi,
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
    yueJiang: input.dateInfo?.yueJiang ?? '',
    dayNight,
    benMing: input.nianMing?.benMing ?? '',
    xingNian: input.nianMing?.xingNian ?? '',
    gongs,
    tianZhiAt: hasPan ? (d) => gongMap.get(d)?.tianZhi : null,
    diOf: (t) => gongs.find((g) => g.tianZhi === t)?.diZhi ?? '',
    jiangOfTian: (t) => gongs.find((g) => g.tianZhi === t)?.tianJiang ?? '',
    fuYin,
    fanYin,
    xunShou,
    xunWei: xunShou ? nextZhi(xunShou, 9) : '',
    xunDing: xunShou ? nextZhi(xunShou, 3) : '',
    guiDay: GUI_DAY[riGan] ?? '',
    guiNight: GUI_NIGHT[riGan] ?? '',
    shengQi: yueZhi ? nextZhi(yueZhi, -2) : '',
    siQi: yueZhi ? nextZhi(yueZhi, 4) : '',
    guanShen: seasonIdx >= 0 ? ['戌', '丑', '辰', '未'][seasonIdx] : '',
    wangWx: seasonIdx >= 0 ? ['水', '木', '火', '金'][seasonIdx] : '',
    keTiStr: ketiStr,
  };
}

const sheng = (a?: string, b?: string) => !!a && !!b && WX_SHENG[a] === b;
const ke = (a?: string, b?: string) => !!a && !!b && WX_KE[a] === b;
/** 支 a 克支 b */
const zke = (a: string, b: string) => ke(ZHI_WX[a], ZHI_WX[b]);
/** 支 a 生支 b */
const zsheng = (a: string, b: string) => sheng(ZHI_WX[a], ZHI_WX[b]);

/** 支 z 克日干 */
const keRi = (c: Ctx, z: string) => ke(ZHI_WX[z], GAN_WX[c.riGan]);
/** 三传皆日鬼 */
const chuanJieGui = (c: Ctx) => c.cz.every((z) => keRi(c, z));
/** 三传成局五行（三合 → 三会 → 皆同行；无局为 ''） */
function juWxOf(cz: string[]): string {
  const he = sanHeOf(cz);
  if (he) return he;
  const hui = sanHuiOf(cz);
  if (hui) return hui;
  const wx = ZHI_WX[cz[0]];
  return cz.every((z) => ZHI_WX[z] === wx) ? wx : '';
}
/** 三合局配六合之字（第83法：寅午戌未、亥卯未戌、申子辰丑、巳酉丑辰） */
const JU_HE: Record<string, string> = { 寅午戌: '未', 亥卯未: '戌', 申子辰: '丑', 巳酉丑: '辰' };
/** 三合局之刑/害/冲（第84法） */
const JU_SHA: Record<string, Record<string, string>> = {
  寅午戌: { 刑: '午', 害: '丑', 冲: '子' },
  亥卯未: { 刑: '子', 害: '辰', 冲: '酉' },
  申子辰: { 刑: '卯', 害: '未', 冲: '午' },
  巳酉丑: { 刑: '酉', 害: '戌', 冲: '卯' },
};
/** 胎财支（第19/20法注：戊己子、庚辛卯、壬癸午、甲乙酉；火土同宫口径） */
const TAI_CAI: Record<string, string> = {
  甲: '酉', 乙: '酉', 戊: '子', 己: '子', 庚: '卯', 辛: '卯', 壬: '午', 癸: '午',
};
/** 干支绝神（第79法注：土寄寅故绝亥，火土同宫口径） */
const JUE_79: Record<string, string> = { 木: '申', 火: '亥', 金: '寅', 水: '巳', 土: '亥' };
/** 华盖（日支三合局之墓） */
const HUA_GAI: Record<string, string> = {
  申: '辰', 子: '辰', 辰: '辰', 寅: '戌', 午: '戌', 戌: '戌',
  巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未',
};
/** 三刑对（寅巳申、丑戌未两组循环 + 子卯） */
const SAN_XING = new Set(['寅巳', '巳申', '申寅', '丑戌', '戌未', '未丑', '子卯', '卯子']);
/** 昼方（卯~申）；余为夜地 */
const DAY_SIDE = new Set(['卯', '辰', '巳', '午', '未', '申']);

interface Rule {
  no: number;
  certainty: 'exact' | 'approx';
  test(c: Ctx): string | null;
}

const RULES: Rule[] = [
  {
    no: 1, certainty: 'approx',
    test(c) {
      if (c.cz[0] === nextZhi(c.jiGong) && c.cz[2] === nextZhi(c.jiGong, -1)) {
        return `初傳${c.cz[0]}居干（寄宮${c.jiGong}）前、末傳${c.cz[2]}居其後（前引後從，宜進職）`;
      }
      if (c.cz[0] === nextZhi(c.riZhi) && c.cz[2] === nextZhi(c.riZhi, -1)) {
        return `初傳${c.cz[0]}居支${c.riZhi}前、末傳${c.cz[2]}居其後（前引後從，宜遷宅）`;
      }
      return null;
    },
  },
  {
    no: 2, certainty: 'exact',
    test(c) {
      if (!c.xunShou || !c.ganShang || !c.zhiShang) return null;
      if (c.ganShang === c.xunWei && c.zhiShang === c.xunShou) {
        return `干上旬尾${c.xunWei}、支上旬首${c.xunShou}（周而復始格）`;
      }
      if (c.ganShang === c.xunShou && c.zhiShang === c.xunWei) {
        return `干上旬首${c.xunShou}、支上旬尾${c.xunWei}（一旬周遍格）`;
      }
      return null;
    },
  },
  {
    no: 3, certainty: 'exact',
    test(c) {
      if (!c.dayNight) return null;
      const lm = c.dayNight === '昼' ? c.guiNight : c.guiDay;
      if (!lm) return null;
      if (c.ganShang === lm) return `${c.dayNight}占而${c.dayNight === '昼' ? '夜' : '晝'}貴${lm}臨干上（簾幕貴人）`;
      if (c.benMing && c.tianZhiAt?.(c.benMing) === lm) return `簾幕貴人${lm}臨本命${c.benMing}上`;
      return null;
    },
  },
  {
    no: 4, certainty: 'exact',
    test(c) {
      if (!c.ganShang || !keRi(c, c.ganShang) || c.ganShangJiang !== '白虎') return null;
      const xu = c.kong.has(c.ganShang) ? '，鬼空亡防虛信' : '';
      return `日鬼${c.ganShang}乘白虎臨干上（催官使者，占赴任宜${xu}）`;
    },
  },
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
    no: 9, certainty: 'approx',
    test(c) {
      if (!chuanJieGui(c) || !c.ganShang) return null;
      return c.cz.some((z) => zke(c.ganShang, z))
        ? null
        : `三傳${c.cz.join('')}皆日鬼而干上${c.ganShang}無制（四面受敵，宜棄舊圖新）`;
    },
  },
  {
    no: 10, certainty: 'approx',
    test(c) {
      if (c.cz[0] !== '卯' || !c.kong.has('卯') || !c.tianZhiAt) return null;
      const d = c.diOf('卯');
      return ['申', '酉', '戌'].includes(d)
        ? `斫輪之卯坐${d}金鄉復落空亡（朽木不可雕，宜改業別謀）`
        : null;
    },
  },
  {
    no: 11, certainty: 'exact',
    test(c) {
      if (!chuanJieGui(c) || !c.ganShang) return null;
      return c.cz.every((z) => zke(c.ganShang, z))
        ? `三傳${c.cz.join('')}皆日鬼，賴干上${c.ganShang}制鬼為救（眾鬼雖彰全不畏）`
        : null;
    },
  },
  {
    no: 12, certainty: 'approx',
    test(c) {
      const jw = TJ_WX[c.ganShangJiang];
      if (!c.ganShang || !jw || keRi(c, c.ganShang)) return null;
      return ke(jw, GAN_WX[c.riGan])
        ? `干上${c.ganShang}不克日而所乘${c.ganShangJiang}（${jw}）克日（將假神威，憂而非實·格义推定）`
        : null;
    },
  },
  {
    no: 13, certainty: 'exact',
    test(c) {
      if (!chuanJieGui(c) || !c.wangWx) return null;
      const wx = ZHI_WX[c.cz[0]];
      return c.cz.every((z) => ZHI_WX[z] === wx) && wx === c.wangWx
        ? `三傳皆${wx}鬼而${wx}當令乘旺（貪生忘克，當時無畏，防過令禍發）`
        : null;
    },
  },
  {
    no: 14, certainty: 'exact',
    test: (c) => (c.liuQin.every((q) => q === '妻财') ? '三傳皆財爻' : null),
  },
  {
    no: 15, certainty: 'exact',
    test(c) {
      const jw = TJ_WX[c.ganShangJiang];
      if (!c.ganShang || !jw) return null;
      return sheng(GAN_WX[c.riGan], ZHI_WX[c.ganShang]) && sheng(ZHI_WX[c.ganShang], jw)
        ? `日生干上${c.ganShang}，${c.ganShang}復生所乘${c.ganShangJiang}（脫上逢脫防虛詐）`
        : null;
    },
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
    no: 19, certainty: 'exact',
    test(c) {
      const tai = TAI_CAI[c.riGan];
      return tai && c.ganShang === tai && tai === c.shengQi
        ? `胎財${tai}作月內生氣臨干上（占妻有孕）`
        : null;
    },
  },
  {
    no: 20, certainty: 'exact',
    test(c) {
      const tai = TAI_CAI[c.riGan];
      return tai && c.ganShang === tai && tai === c.siQi
        ? `胎財${tai}作月內死氣臨干上（孕防不育）`
        : null;
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
    no: 23, certainty: 'exact',
    test(c) {
      return c.zhiShang && c.ganShang && c.cz[0] === c.zhiShang && c.cz[2] === c.ganShang
        ? `初傳發於支上${c.cz[0]}、末傳歸於干上${c.cz[2]}（彼來求我）`
        : null;
    },
  },
  {
    no: 24, certainty: 'exact',
    test(c) {
      return c.ganShang && c.zhiShang && c.cz[0] === c.ganShang && c.cz[2] === c.zhiShang
        ? `初傳發於干上${c.cz[0]}、末傳歸於支上${c.cz[2]}（我去求彼）`
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
    no: 28, certainty: 'exact',
    test(c) {
      const ju = sanHeOf(c.cz);
      if (!ju || !ke(ju, GAN_WX[c.riGan])) return null;
      const kongs = c.cz.filter((z) => c.kong.has(z));
      const rest = c.cz.find((z) => !c.kong.has(z));
      return kongs.length === 2 && rest && liuQinOf(c.riGan, rest) === '妻财'
        ? `三合${ju}局為鬼，兩傳空亡獨存${rest}作財（全鬼化財，其財險中出）`
        : null;
    },
  },
  {
    no: 29, certainty: 'approx',
    test(c) {
      const e = juWxOf(c.cz);
      return e && sheng(e, GAN_WX[c.riGan]) && sheng(ZHI_WX[c.riZhi], e)
        ? `三傳${e}局生日而支辰反脫（人口豐盈居狹宅，勿遷寬屋）`
        : null;
    },
  },
  {
    no: 30, certainty: 'approx',
    test(c) {
      const e = juWxOf(c.cz);
      return e && sheng(GAN_WX[c.riGan], e) && sheng(e, ZHI_WX[c.riZhi])
        ? `三傳${e}局盜日反生支辰（屋寬人衰，宜別遷居止）`
        : null;
    },
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
    no: 33, certainty: 'exact',
    test(c) {
      const cs = csZhi(GAN_WX[c.riGan], 0);
      const mu = MU_ZHI[GAN_WX[c.riGan]];
      if (c.cz[0] === cs && c.cz[2] === mu) return `初傳${cs}為干長生、末傳${mu}為干墓（自生傳墓，有始無終）`;
      if (c.cz[0] === mu && c.cz[2] === cs) return `初傳${mu}為干墓、末傳${cs}為干長生（自墓傳生，先難後易）`;
      return null;
    },
  },
  {
    no: 34, certainty: 'approx',
    test(c) {
      const [a, b, d] = c.cz;
      if (zsheng(d, b) && zsheng(b, a) && keRi(c, a) && zke(d, a)) {
        return `中末遞生初傳而初${a}克日，賴末傳${d}制初（苦去甘來）`;
      }
      if (zke(a, b) && zke(b, d) && keRi(c, d) && zsheng(d, a) && sheng(ZHI_WX[a], GAN_WX[c.riGan])) {
        return `三傳遞克而末${d}克日，賴末生初、初${a}生日（苦去甘來）`;
      }
      return null;
    },
  },
  {
    no: 35, certainty: 'exact',
    test(c) {
      if (!c.ganShang || !c.zhiShang) return null;
      const gw = GAN_WX[c.riGan];
      const zw = ZHI_WX[c.riZhi];
      if (sheng(gw, ZHI_WX[c.ganShang]) && sheng(zw, ZHI_WX[c.zhiShang])) {
        return '干支上神皆乘脫氣（人宅受脫俱招盜）';
      }
      if (sheng(zw, ZHI_WX[c.ganShang]) && sheng(gw, ZHI_WX[c.zhiShang])) {
        return '干上脫支、支上脫干（遞互相脫，彼此各懷脫賺）';
      }
      return null;
    },
  },
  {
    no: 36, certainty: 'exact',
    test(c) {
      const bg = csZhi(GAN_WX[c.riGan], 1);
      const bz = csZhi(ZHI_WX[c.riZhi], 1);
      return c.ganShang === bg && c.zhiShang === bz
        ? `干上${bg}、支上${bz}皆臨敗氣（干支皆敗事傾頹）`
        : null;
    },
  },
  {
    no: 37, certainty: 'approx',
    test(c) {
      const [a, , d] = c.cz;
      if (!zsheng(d, a)) return null;
      if (keRi(c, a)) return `末傳${d}生助初傳${a}克日（末助初，教唆興訟之象）`;
      if (sheng(ZHI_WX[a], GAN_WX[c.riGan])) return `末傳${d}生助初傳${a}生日（末助初而生干）`;
      if (c.liuQin[0] === '妻财') return `末傳${d}生助初傳${a}作日財（末助初，財動防訟）`;
      return null;
    },
  },
  {
    no: 38, certainty: 'exact',
    test(c) {
      if (!c.xunShou || !c.gongs.length) return null;
      const di = c.gongs.find((g) => g.diZhi === c.xunShou);
      if (di?.tianJiang === '玄武') return `玄武臨地盤旬首${c.xunShou}（閉口卦，宜捕盜追亡）`;
      const tian = c.gongs.find((g) => g.tianZhi === c.xunShou);
      if (tian?.tianJiang === '玄武') return `天盤旬首${c.xunShou}乘玄武（閉口卦）`;
      return null;
    },
  },
  {
    no: 39, certainty: 'exact',
    test(c) {
      if (!c.yueJiang) return null;
      const g = c.gongs.find((x) => x.tianJiang === '玄武');
      return g && g.tianZhi === c.yueJiang
        ? `玄武乘月將${c.yueJiang}（太陽照武，賊形自露宜擒）`
        : null;
    },
  },
  {
    no: 40, certainty: 'exact',
    test(c) {
      const pair = [c.ganShangJiang, c.zhiShangJiang];
      return pair.includes('天后') && pair.includes('六合')
        ? '干支上神分乘天后、六合（後合占婚，防先私後娶）'
        : null;
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
    no: 43, certainty: 'approx',
    test(c) {
      const g = c.gongs.find((x) => x.tianJiang === '贵人');
      if (!g) return null;
      const hai = c.cz.find((z) => LIU_HAI[g.tianZhi] === z);
      return hai ? `貴人乘${g.tianZhi}與傳中${hai}六害（害貴，訟直作曲斷）` : null;
    },
  },
  {
    no: 44, certainty: 'approx',
    test(c) {
      if (!c.guiDay) return null;
      const gs = new Set([c.guiDay, c.guiNight]);
      if (c.cz.every((z) => gs.has(z))) return `三傳${c.cz.join('')}皆是貴人（貴多不貴轉無依）`;
      if (c.keShang.length < 4) return null;
      const n = [...c.keShang, ...c.cz].filter((z) => gs.has(z)).length;
      return n >= 5 ? `課傳${n}處聚晝夜貴人（遍地貴人，貴多不貴）` : null;
    },
  },
  {
    no: 45, certainty: 'exact',
    test(c) {
      if (!c.tianZhiAt || !c.guiDay) return null;
      if (c.tianZhiAt(c.guiNight) === c.guiDay) return `晝貴${c.guiDay}加夜貴${c.guiNight}之上（旦暮貴人相加）`;
      if (c.tianZhiAt(c.guiDay) === c.guiNight) return `夜貴${c.guiNight}加晝貴${c.guiDay}之上（旦暮貴人相加）`;
      return null;
    },
  },
  {
    no: 46, certainty: 'exact',
    test(c) {
      if (!c.gongs.length || !c.guiDay) return null;
      const pd = c.diOf(c.guiDay);
      const pn = c.diOf(c.guiNight);
      return pd && pn && !DAY_SIDE.has(pd) && DAY_SIDE.has(pn)
        ? `晝貴${c.guiDay}臨夜地${pd}、夜貴${c.guiNight}臨晝方${pn}（貴人差迭事參差）`
        : null;
    },
  },
  {
    no: 47, certainty: 'exact',
    test(c) {
      const g = c.gongs.find((x) => x.tianJiang === '贵人');
      if (!g || !['辰', '戌'].includes(g.diZhi)) return null;
      if (g.diZhi === c.jiGong) return `貴人臨地盤${g.diZhi}即干寄宮（貴人臨身，反宜干貴）`;
      if (['辰', '戌'].includes(c.riZhi)) return `貴人臨地盤${g.diZhi}而日支${c.riZhi}（貴人入宅，非坐獄論）`;
      return `貴人臨地盤${g.diZhi}（天乙入獄，宜私謀陰禱）`;
    },
  },
  {
    no: 48, certainty: 'exact',
    test(c) {
      if (c.ganShang && keRi(c, c.ganShang) && c.ganShangJiang === '贵人') {
        return `日鬼${c.ganShang}乘貴人臨干（乃神祗，勿作鬼祟看）`;
      }
      if (c.zhiShang && keRi(c, c.zhiShang) && c.zhiShangJiang === '贵人') {
        return `日鬼${c.zhiShang}乘貴人臨宅（家堂神像不肅之象）`;
      }
      return null;
    },
  },
  {
    no: 49, certainty: 'exact',
    test(c) {
      if (!c.gongs.length || !c.guiDay) return null;
      const pd = c.diOf(c.guiDay);
      const pn = c.diOf(c.guiNight);
      return pd && pn && zke(pd, c.guiDay) && zke(pn, c.guiNight)
        ? `晝貴${c.guiDay}坐${pd}、夜貴${c.guiNight}坐${pn}皆受克（兩貴受克難干貴）`
        : null;
    },
  },
  {
    no: 50, certainty: 'exact',
    test(c) {
      return c.guiDay && c.kong.has(c.guiDay) && c.kong.has(c.guiNight)
        ? `晝貴${c.guiDay}、夜貴${c.guiNight}皆落空亡（二貴皆空虛喜期）`
        : null;
    },
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
    no: 53, certainty: 'approx',
    test(c) {
      if (!c.gongs.length) return null;
      const SHORT: Record<string, string> = {
        贵人: '貴', 螣蛇: '蛇', 朱雀: '雀', 六合: '合', 勾陈: '勾', 青龙: '龍',
        天空: '空', 白虎: '虎', 太常: '常', 玄武: '玄', 太阴: '陰', 天后: '后',
      };
      const mu = MU_ZHI[GAN_WX[c.riGan]];
      const d = c.diOf(mu);
      const j = c.jiangOfTian(mu);
      return d && j && TJ_HOME[d] === j
        ? `干墓${mu}坐${d}乘${j}，與${d}位本將相夾（兩${SHORT[j] ?? j}夾墓凶難免）`
        : null;
    },
  },
  {
    no: 54, certainty: 'approx',
    test(c) {
      if (!/昴星|虎視|虎视/.test(c.keTiStr)) return null;
      const jiangs = [...c.cj, c.ganShangJiang, c.zhiShangJiang];
      return jiangs.includes('白虎')
        ? '虎視（昴星）課中復見白虎（前後皆虎力難施）'
        : null;
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
    no: 56, certainty: 'exact',
    test(c) {
      const mu = MU_ZHI[GAN_WX[c.riGan]];
      return c.benMing && c.ganShang === mu && c.benMing === mu
        ? `干墓${mu}覆日而本命亦${mu}（天網自裹，自招其禍）`
        : null;
    },
  },
  {
    no: 57, certainty: 'approx',
    test(c) {
      if (!c.ganShang || !sheng(ZHI_WX[c.ganShang], GAN_WX[c.riGan]) || !c.kong.has(c.ganShang)) return null;
      const shi = [...c.cz, c.zhiShang].find(
        (z) => z && !c.kong.has(z) && (sheng(GAN_WX[c.riGan], ZHI_WX[z]) || keRi(c, z)),
      );
      return shi
        ? `生我者${c.ganShang}空亡而脫氣／鬼賊${shi}坐實（費有餘得不足）`
        : null;
    },
  },
  {
    no: 58, certainty: 'approx',
    test(c) {
      if (c.liuQin[0] !== '妻财') return null;
      const kongZM = c.cz.slice(1).some((z) => c.kong.has(z));
      const guiZM = c.liuQin.slice(1).includes('官鬼');
      const zuoKe = c.gongs.length ? zke(c.diOf(c.cz[0]), c.cz[0]) : false;
      return kongZM && (guiZM || zuoKe)
        ? `初傳財${c.cz[0]}${zuoKe ? '坐克方' : ''}${guiZM ? '引入鬼鄉' : ''}而中末空陷（用破身心無所歸）`
        : null;
    },
  },
  {
    no: 59, certainty: 'exact',
    test(c) {
      const hg = HUA_GAI[c.riZhi];
      const mu = MU_ZHI[GAN_WX[c.riGan]];
      return hg && hg === mu && c.cz[0] === hg && c.ganShang === hg
        ? `支華蓋${hg}兼干墓臨干發用（華蓋覆日人昏晦）`
        : null;
    },
  },
  {
    no: 60, certainty: 'approx',
    test(c) {
      if (!c.yueJiang || c.zhiShang !== c.yueJiang) return null;
      const mu = MU_ZHI[ZHI_WX[c.riZhi]];
      return c.zhiShang === mu
        ? `支墓${mu}臨宅而作月將（太陽射宅屋光輝）`
        : `月將（太陽）${c.yueJiang}臨宅上（宅明而輝）`;
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
    no: 63, certainty: 'exact',
    test(c) {
      return c.ganShang && c.zhiShang && keRi(c, c.ganShang) && zke(c.zhiShang, c.riZhi)
        ? `干被上神${c.ganShang}克、支被上神${c.zhiShang}克（彼此全傷防兩損）`
        : null;
    },
  },
  {
    no: 64, certainty: 'exact',
    test(c) {
      if (!c.ganShang || !c.zhiShang) return null;
      const zsKeGan = ke(ZHI_WX[c.zhiShang], GAN_WX[c.riGan]);
      const gsKeZhi = zke(c.ganShang, c.riZhi);
      if (zsKeGan && gsKeZhi) return '支上克干、干上克支（蕪淫卦，夫婦各有私）';
      const ganKeZs = ke(GAN_WX[c.riGan], ZHI_WX[c.zhiShang]);
      const zhiKeGs = zke(c.riZhi, c.ganShang);
      if (ganKeZs && zhiKeGs) return '干克支上神、支克干上神（真解離卦）';
      return null;
    },
  },
  {
    no: 65, certainty: 'exact',
    test(c) {
      const mu = MU_ZHI[GAN_WX[c.riGan]];
      if (!c.guanShen || c.cz[0] !== mu || mu !== c.guanShen) return null;
      if (c.cz[0] === c.ganShang) return `干墓${mu}作季節關神臨干發用（主人衰）`;
      if (c.cz[0] === c.zhiShang) return `干墓${mu}作季節關神臨支發用（主宅廢）`;
      return `干墓${mu}作季節關神發用（干墓並關人宅廢）`;
    },
  },
  {
    no: 66, certainty: 'exact',
    test(c) {
      const mu = MU_ZHI[ZHI_WX[c.riZhi]];
      return c.cz[0] === mu && c.liuQin[0] === '妻财'
        ? `支墓${mu}作日財發用（支墳財並旅程稽，商販防折）`
        : null;
    },
  },
  {
    no: 67, certainty: 'approx',
    test(c) {
      const JING: Record<string, string> = { 金: '肝', 木: '脾', 水: '心', 火: '肺', 土: '腎' };
      let z = '';
      const i = c.cj.indexOf('白虎');
      if (i >= 0) z = c.cz[i];
      else if (c.ganShangJiang === '白虎') z = c.ganShang;
      else if (c.zhiShangJiang === '白虎') z = c.zhiShang;
      const wx = ZHI_WX[z];
      return z && wx ? `白虎乘${z}（${wx}神），占病主${JING[wx]}經受病` : null;
    },
  },
  {
    no: 68, certainty: 'exact',
    test(c) {
      const pool = [c.ganShang, c.zhiShang, ...c.cz].filter(Boolean);
      const gui = pool.find((z) => keRi(c, z));
      if (!gui) return null;
      const jiu = pool.find((z) => zke(z, gui));
      return jiu ? `課傳日鬼${gui}而${jiu}克制之（制鬼之位乃良醫／救神）` : null;
    },
  },
  {
    no: 69, certainty: 'exact',
    test(c) {
      const g = c.gongs.find((x) => x.tianJiang === '白虎');
      if (!g) return null;
      const dg = xunGanOf(c.riGan, c.riZhi, g.tianZhi);
      return dg && ke(GAN_WX[dg], GAN_WX[c.riGan])
        ? `白虎乘${dg}${g.tianZhi}，旬遁${dg}為日鬼（虎乘遁鬼殃非淺，空亡亦難救）`
        : null;
    },
  },
  {
    no: 70, certainty: 'exact',
    test(c) {
      const k3 = c.keShang[2];
      const k4 = c.keShang[3];
      if (!k3 || !k4 || !keRi(c, k3) || !keRi(c, k4)) return null;
      const kongAll = c.kong.has(k3) && c.kong.has(k4);
      return `日鬼${k3}${k4}全臨三四課（訟災隨${kongAll ? '，幸皆空亡可解' : '，宜修德作福'}）`;
    },
  },
  {
    no: 71, certainty: 'exact',
    test(c) {
      if (!c.nianZhi || !c.zhiShang) return null;
      const bf = nextZhi(c.nianZhi, -1);
      return c.zhiShang === bf && zke(bf, c.riZhi)
        ? `病符${bf}（舊太歲）臨支克支（全家患，防時疫）`
        : null;
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
  {
    no: 73, certainty: 'exact',
    test(c) {
      if (!c.tianZhiAt) return null;
      const chu = c.cz[0];
      const y = c.diOf(chu);
      const z2 = c.tianZhiAt(chu) ?? '';
      return y && z2 && zke(y, chu) && zke(z2, chu)
        ? `初傳${chu}坐克方${y}，歸本宮又被${z2}克（克處回歸，進退不能）`
        : null;
    },
  },
  {
    no: 74, certainty: 'exact',
    test(c) {
      if (c.cz.every((z) => c.kong.has(z))) return `三傳${c.cz.join('')}皆落空亡（空空如也事休追）`;
      const kongs = c.cz.filter((z) => c.kong.has(z));
      if (kongs.length === 2) {
        const i = c.cz.findIndex((z) => !c.kong.has(z));
        if (i >= 0 && c.cj[i] === '天空') return `兩傳空亡，餘傳${c.cz[i]}復乘天空（亦作空空如也）`;
      }
      return null;
    },
  },
  {
    no: 75, certainty: 'approx',
    test(c) {
      const ZI_XING = new Set(['辰', '午', '酉', '亥']);
      if (c.keShang.length >= 4 && c.keShang.every((z) => ZI_XING.has(z))) {
        return '四課上神全逢辰午酉亥（自刑，一字刑）';
      }
      if (!c.ganShang || !c.zhiShang) return null;
      const pair = new Set([c.ganShang, c.zhiShang]);
      if (pair.has('子') && pair.has('卯')) return '干支上全乘子卯（無禮之刑）';
      if (SAN_XING.has(c.ganShang + c.zhiShang)) return `干上${c.ganShang}與支上${c.zhiShang}相刑（賓主不投）`;
      return null;
    },
  },
  {
    no: 76, certainty: 'exact',
    test(c) {
      if (!c.ganShang || !c.zhiShang) return null;
      const h = (a: string, b: string) => LIU_HAI[a] === b;
      if (h(c.ganShang, c.jiGong) && h(c.zhiShang, c.riZhi)) return '干支上下皆各作六害（彼此猜忌）';
      if (h(c.ganShang, c.zhiShang)) return `干上${c.ganShang}與支上${c.zhiShang}六害（各相猜忌）`;
      if (h(c.ganShang, c.riZhi) && h(c.zhiShang, c.jiGong)) return '干支上下交互作六害（我動念害人，人早思害我）';
      return null;
    },
  },
  {
    no: 77, certainty: 'exact',
    test(c) {
      if (!c.ganShang || !c.zhiShang) return null;
      const gw = GAN_WX[c.riGan];
      const zw = ZHI_WX[c.riZhi];
      if (sheng(ZHI_WX[c.ganShang], gw) && sheng(ZHI_WX[c.zhiShang], zw)) return '干支上神俱生干支（俱生，凡事益）';
      if (sheng(ZHI_WX[c.ganShang], zw) && sheng(ZHI_WX[c.zhiShang], gw)) return '干上生支、支上生干（互生，凡事益）';
      return null;
    },
  },
  {
    no: 78, certainty: 'approx',
    test(c) {
      const wg = csZhi(GAN_WX[c.riGan], 4);
      const wz = csZhi(ZHI_WX[c.riZhi], 4);
      if (c.ganShang === wg && c.zhiShang === wz) return `干上${wg}、支上${wz}皆臨帝旺（皆旺，坐謀宜）`;
      if (c.ganShang === wz && c.zhiShang === wg) return '干支上神互乘彼旺（互旺，坐謀宜）';
      return null;
    },
  },
  {
    no: 79, certainty: 'exact',
    test(c) {
      const jg = JUE_79[GAN_WX[c.riGan]];
      const jz = JUE_79[ZHI_WX[c.riZhi]];
      return c.ganShang === jg && c.zhiShang === jz
        ? `干上${jg}、支上${jz}皆乘絕神（凡謀宜結絕）`
        : null;
    },
  },
  {
    no: 80, certainty: 'approx',
    test(c) {
      const sg = csZhi(GAN_WX[c.riGan], 7);
      const sz = csZhi(ZHI_WX[c.riZhi], 7);
      return c.ganShang === sg && c.zhiShang === sz
        ? `干上${sg}、支上${sz}皆臨死氣（人宅皆死各衰羸）`
        : null;
    },
  },
  {
    no: 81, certainty: 'approx',
    test(c) {
      const mu = MU_ZHI[ZHI_WX[c.cz[0]]];
      if (!mu || (c.cz[1] !== mu && c.cz[2] !== mu)) return null;
      if (c.cz[0] === mu) return null; // 初传本身为墓支时不成传墓
      const q = c.liuQin[0];
      const xi = q === '官鬼' || q === '子孙';
      return `初傳${c.cz[0]}（${q}）傳墓入墓${xi ? '，鬼盜入墓反吉' : '，財祿長生入墓則凶'}`;
    },
  },
  {
    no: 82, certainty: 'exact',
    test(c) {
      return c.kong.has(c.cz[1]) && c.kong.has(c.cz[2]) && !c.kong.has(c.cz[0])
        ? `中末皆空亡，以初傳${c.cz[0]}斷之（不行傳者考初時）`
        : null;
    },
  },
  {
    no: 83, certainty: 'exact',
    test(c) {
      const key = sanHeKey(c.cz);
      if (!key) return null;
      const he = JU_HE[key];
      const where = c.ganShang === he ? '干上' : c.zhiShang === he ? '支上' : '';
      return where ? `三傳${key}三合，${where}見${he}與局中字六合（三六相呼萬事忻）` : null;
    },
  },
  {
    no: 84, certainty: 'exact',
    test(c) {
      const key = sanHeKey(c.cz);
      if (!key) return null;
      for (const [type, z] of Object.entries(JU_SHA[key])) {
        const where = c.ganShang === z ? '干上' : c.zhiShang === z ? '支上' : '';
        if (where) return `三合${key}而${where}見${z}犯${type}（合中犯殺蜜中砒）`;
      }
      return null;
    },
  },
  {
    no: 85, certainty: 'exact',
    test(c) {
      if (!c.gongs.length) return null;
      const chu = c.cz[0];
      const y = c.diOf(chu);
      const jw = TJ_WX[c.cj[0]];
      return y && jw && zke(y, chu) && ke(jw, ZHI_WX[chu])
        ? `初傳${chu}坐克方${y}復被乘將${c.cj[0]}所傷（初遭夾克不由己）`
        : null;
    },
  },
  {
    no: 86, certainty: 'exact',
    test(c) {
      const jw = TJ_WX[c.cj[0]];
      return jw && ke(ZHI_WX[c.cz[0]], jw)
        ? `發用${c.cz[0]}克所乘${c.cj[0]}（將逢內戰所謀危）`
        : null;
    },
  },
  {
    no: 87, certainty: 'exact',
    test(c) {
      if (!c.gongs.length) return null;
      const mg = MU_ZHI[GAN_WX[c.riGan]];
      const mz = MU_ZHI[ZHI_WX[c.riZhi]];
      return c.diOf(c.jiGong) === mg && c.diOf(c.riZhi) === mz
        ? `干寄宮${c.jiGong}坐墓${mg}、支${c.riZhi}坐墓${mz}（人宅坐墓甘招晦）`
        : null;
    },
  },
  {
    no: 88, certainty: 'exact',
    test(c) {
      const mg = MU_ZHI[GAN_WX[c.riGan]];
      const mz = MU_ZHI[ZHI_WX[c.riZhi]];
      return c.ganShang === mg && c.zhiShang === mz
        ? `干上${mg}、支上${mz}皆見墓神（墓覆日辰，人宅昏迷）`
        : null;
    },
  },
  {
    no: 89, certainty: 'exact',
    test(c) {
      if (!c.fuYin) return null;
      const pool = [...c.cz, c.ganShang, c.zhiShang];
      if (c.xunDing && pool.includes(c.xunDing)) {
        return `伏吟而旬丁${c.xunDing}入課傳（任信丁馬須言動，靜中有動）`;
      }
      const ma = MA[c.riZhi];
      if (ma && pool.includes(ma)) return `伏吟而驛馬${ma}入課傳（靜中有動）`;
      return null;
    },
  },
  {
    no: 90, certainty: 'exact',
    test(c) {
      return c.fanYin && c.kong.has(c.cz[0]) && c.kong.has(c.cz[2])
        ? `返吟而初末${c.cz[0]}${c.cz[2]}空亡（來去俱空豈動宜）`
        : null;
    },
  },
  {
    no: 91, certainty: 'exact',
    test(c) {
      return c.ganShang && keRi(c, c.ganShang) && c.ganShangJiang === '白虎'
        ? `白虎乘日鬼${c.ganShang}臨干（凶速；若鬼空、坐制或虎之陰神制虎則緩）`
        : null;
    },
  },
  {
    no: 92, certainty: 'exact',
    test(c) {
      if (!c.shengQi) return null;
      const g = c.gongs.find((x) => x.tianJiang === '青龙');
      return g && sheng(ZHI_WX[g.tianZhi], GAN_WX[c.riGan]) && g.tianZhi === c.shengQi
        ? `青龍乘${g.tianZhi}生日兼月內生氣（龍加生氣吉遲遲）`
        : null;
    },
  },
  {
    no: 94, certainty: 'approx',
    test(c) {
      const mu = MU_ZHI[GAN_WX[c.riGan]];
      const kongs = c.cz.filter((z, i) => c.kong.has(z) && c.cz.indexOf(z) === i);
      if (!kongs.length) return null;
      const parts = kongs.map((z) => {
        const q = liuQinOf(c.riGan, z);
        const yi = q === '官鬼' || q === '子孙' || z === mu;
        return `${z}（${z === mu ? '墓神' : q}）空亡${yi ? '為喜' : '為忌'}`;
      });
      return `傳中${parts.join('、')}（喜懼空亡乃妙機）`;
    },
  },
  {
    no: 95, certainty: 'exact',
    test(c) {
      // 注文以局论财（辛未日卯亥未木局「皆作日之財」），兼容逐支皆财
      const ju = juWxOf(c.cz);
      const juCai = !!ju && ke(GAN_WX[c.riGan], ju);
      if (!juCai && !c.liuQin.every((q) => q === '妻财')) return null;
      const shang = [c.ganShang, c.zhiShang].filter(Boolean);
      const fuMu = shang.find((z) => liuQinOf(c.riGan, z) === '父母');
      if (fuMu) return `三傳皆財而${fuMu}父母爻在干支上（財現卦防長上災）`;
      const guan = shang.find((z) => liuQinOf(c.riGan, z) === '官鬼');
      if (guan) return `三傳皆財，干支上${guan}官鬼洩財生父（傳財化鬼，求財反禍）`;
      return null;
    },
  },
  {
    no: 96, certainty: 'approx',
    test(c) {
      const VERSE: Record<string, string> = {
        妻财: '財空軍儲乏', 官鬼: '鬼空敵人遁', 子孙: '救空謀策拙',
        兄弟: '比空贊佐慵', 父母: '生空防失惠',
      };
      const kongs = [...new Set(c.keShang.filter((z) => c.kong.has(z)))];
      if (!kongs.length) return null;
      const parts = kongs.map((z) => {
        const q = liuQinOf(c.riGan, z);
        return `${z}為${q}空（${VERSE[q] ?? ''}）`;
      });
      return `課上空亡逐類推：${parts.join('、')}`;
    },
  },
  {
    no: 99, certainty: 'approx',
    test(c) {
      const m = c.keTiStr.match(
        /龍德|龙德|鑄印|铸印|軒蓋|轩盖|高蓋|高盖|乘軒|乘轩|斫輪|斫轮|官爵|富貴|富贵|三光|三陽|三阳|三奇|時泰|时泰/,
      );
      return m ? `得${m[0]}貴課（利貴人；常人問常事不應，反防因訟達官）` : null;
    },
  },
  {
    no: 100, certainty: 'approx',
    test(c) {
      const m = c.keTiStr.match(/喪魂|丧魂|魄化|天禍|天祸|天寇|伏殃|天獄|天狱|天網|天网|二煩|二烦/);
      return m ? `得${m[0]}凶課（已見災而占反可解，未災占之防病訟並至）` : null;
    },
  },
];

/** 已实现检测的法号列表 */
export const DETECTOR_NOS: number[] = RULES.map((r) => r.no);

/** 无法机器判定的法号（93 起传校勘须本派重演；97/98 断法方法论） */
export const UNDETECTABLE_NOS: number[] = [93, 97, 98];

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
