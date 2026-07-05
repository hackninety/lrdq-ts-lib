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
