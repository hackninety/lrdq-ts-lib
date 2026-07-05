/**
 * 干支/天将基础表与归一化
 *
 * 天将名兼容多写法：简体（贵人/螣蛇…）、繁体（貴人/勾陳…）、
 * 《占事略決》古写（天一/腾虵/勾陣/大裳/大陰）、《六壬大全》元武等。
 */

export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export const GAN_WX: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
export const ZHI_WX: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

/** 五行相生：键生值 */
export const WX_SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克：键克值 */
export const WX_KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 阳支（子寅辰午申戌） */
export const YANG_ZHI = new Set(['子', '寅', '辰', '午', '申', '戌']);

/** 日禄 */
export const LU: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
  己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};

/** 驿马（三合局） */
export const MA: Record<string, string> = {
  申: '寅', 子: '寅', 辰: '寅',
  寅: '申', 午: '申', 戌: '申',
  巳: '亥', 酉: '亥', 丑: '亥',
  亥: '巳', 卯: '巳', 未: '巳',
};

/** 日干寄宫（甲寄寅、乙辰、丙戊巳、丁己未、庚申、辛戌、壬亥、癸丑） */
export const JI_GONG: Record<string, string> = {
  甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳',
  己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑',
};

/** 五行墓库（木未、火戌、金丑、水土辰） */
export const MU_ZHI: Record<string, string> = { 木: '未', 火: '戌', 金: '丑', 水: '辰', 土: '辰' };

/** 地支六合 */
export const LIU_HE: Record<string, string> = {
  子: '丑', 丑: '子', 寅: '亥', 卯: '戌', 辰: '酉', 巳: '申',
  午: '未', 未: '午', 申: '巳', 酉: '辰', 戌: '卯', 亥: '寅',
};

export function zhiIdx(z: string): number {
  return ZHI.indexOf(z as (typeof ZHI)[number]);
}

/** 支顺行第 n 位 */
export function nextZhi(z: string, n = 1): string {
  const i = zhiIdx(z);
  return i < 0 ? '' : ZHI[(i + n + 120) % 12];
}

/** 天将名归一化（简体通行名） */
const TJ_ALIAS: Record<string, string> = {
  贵人: '贵人', 貴人: '贵人', 天一: '贵人', 天乙: '贵人',
  螣蛇: '螣蛇', 腾蛇: '螣蛇', 腾虵: '螣蛇', 騰蛇: '螣蛇',
  朱雀: '朱雀',
  六合: '六合',
  勾陈: '勾陈', 勾陳: '勾陈', 勾陣: '勾陈',
  青龙: '青龙', 青龍: '青龙',
  天空: '天空',
  白虎: '白虎',
  太常: '太常', 大裳: '太常',
  玄武: '玄武', 元武: '玄武',
  太阴: '太阴', 太陰: '太阴', 大陰: '太阴',
  天后: '天后', 天後: '天后',
};
export function normalizeTianJiang(name?: string): string {
  if (!name) return '';
  return TJ_ALIAS[name.trim()] ?? name.trim();
}

/** 支对日干六亲（同=兄弟，我生=子孙，生我=父母，我克=妻财，克我=官鬼） */
export function liuQinOf(riGan: string, zhi: string): string {
  const g = GAN_WX[riGan];
  const z = ZHI_WX[zhi];
  if (!g || !z) return '';
  if (g === z) return '兄弟';
  if (WX_SHENG[g] === z) return '子孙';
  if (WX_SHENG[z] === g) return '父母';
  if (WX_KE[g] === z) return '妻财';
  return '官鬼';
}

/** 十二天将五行（贵勾常空土、蛇雀火、合龙木、虎阴金、玄后水） */
export const TJ_WX: Record<string, string> = {
  贵人: '土', 螣蛇: '火', 朱雀: '火', 六合: '木', 勾陈: '土', 青龙: '木',
  天空: '土', 白虎: '金', 太常: '土', 玄武: '水', 太阴: '金', 天后: '水',
};

/** 十二天将地支本位（第53法「两将夹墓」例表反推：贵丑蛇巳雀午合卯勾辰龙寅空戌虎申常未玄子阴酉后亥） */
export const TJ_HOME: Record<string, string> = {
  丑: '贵人', 巳: '螣蛇', 午: '朱雀', 卯: '六合', 辰: '勾陈', 寅: '青龙',
  戌: '天空', 申: '白虎', 未: '太常', 子: '玄武', 酉: '太阴', 亥: '天后',
};

/** 地支六害（子未 丑午 寅巳 卯辰 申亥 酉戌） */
export const LIU_HAI: Record<string, string> = {
  子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅',
  卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉',
};

/** 昼贵人（甲戊庚丑、乙己子、丙丁亥、辛午、壬卯、癸巳） */
export const GUI_DAY: Record<string, string> = {
  甲: '丑', 戊: '丑', 庚: '丑', 乙: '子', 己: '子',
  丙: '亥', 丁: '亥', 辛: '午', 壬: '卯', 癸: '巳',
};
/** 夜贵人（甲戊庚未、乙己申、丙丁酉、辛寅、壬巳、癸卯） */
export const GUI_NIGHT: Record<string, string> = {
  甲: '未', 戊: '未', 庚: '未', 乙: '申', 己: '申',
  丙: '酉', 丁: '酉', 辛: '寅', 壬: '巳', 癸: '卯',
};

/** 三合局（键为按支序排序后的串：子辰申=申子辰局 等） */
const SANHE_JU: Record<string, string> = {
  子辰申: '水', 寅午戌: '火', 丑巳酉: '金', 卯未亥: '木',
};
const sortZhi = (zs: string[]) => [...zs].sort((a, b) => zhiIdx(a) - zhiIdx(b)).join('');
/** 三支成三合局 → 局五行（否则 ''）；键序不限 */
export function sanHeOf(zs: string[]): string {
  if (zs.length !== 3 || new Set(zs).size !== 3) return '';
  return SANHE_JU[sortZhi(zs)] ?? '';
}
/** 三合局名（寅午戌 等原序键，供查刑害冲表） */
export function sanHeKey(zs: string[]): string {
  if (!sanHeOf(zs)) return '';
  const k = sortZhi(zs);
  return { 子辰申: '申子辰', 寅午戌: '寅午戌', 丑巳酉: '巳酉丑', 卯未亥: '亥卯未' }[k] ?? '';
}
/** 三支成三会方局 → 方五行（亥子丑水 寅卯辰木 巳午未火 申酉戌金） */
export function sanHuiOf(zs: string[]): string {
  if (zs.length !== 3 || new Set(zs).size !== 3) return '';
  return { 子丑亥: '水', 寅卯辰: '木', 巳午未: '火', 申酉戌: '金' }[sortZhi(zs)] ?? '';
}

/**
 * 五行长生支（水土同长生申口径，第34法注「申為戊土之長生」）。
 * 个别法注文取火土同宫（第19/20法胎神、第79法土绝亥），由该法检测器就地取表。
 */
export const CS_SHENG: Record<string, string> = { 木: '亥', 火: '寅', 金: '巳', 水: '申', 土: '申' };
/** 长生十二宫序位取支：0长生 1沐浴(败) 4帝旺 7死 8墓 9绝 10胎 */
export function csZhi(wx: string, pos: number): string {
  const s = CS_SHENG[wx];
  return s ? nextZhi(s, pos) : '';
}

/** 旬首支（由日干支反推：甲子旬→子） */
export function xunShouZhi(riGan: string, riZhi: string): string {
  const g = GAN.indexOf(riGan as (typeof GAN)[number]);
  const z = zhiIdx(riZhi);
  if (g < 0 || z < 0) return '';
  return ZHI[(z - g + 12) % 12];
}
/** 某支在本旬的旬遁干（旬空二支返回 ''） */
export function xunGanOf(riGan: string, riZhi: string, zhi: string): string {
  const shou = xunShouZhi(riGan, riZhi);
  if (!shou) return '';
  const off = (zhiIdx(zhi) - zhiIdx(shou) + 12) % 12;
  return off < 10 ? GAN[off] : '';
}
