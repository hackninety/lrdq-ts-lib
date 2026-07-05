/**
 * lrdq-ts-lib 领域模型
 *
 * 语料：《六壬大全》卷十一/十二《畢法賦》百法（四庫全書本，ctext 转录）
 * 检测：对宿主排盘结果（结构兼容 react-liuren 统一模型）做毕法格局命中
 */

/** 毕法单条 */
export interface BifaEntry {
  /** 序位编号 1–100（底本编号笔误已按序归正，见 rawNo/textualIssues） */
  no: number;
  /** 格名（取赋句前四字，传统称谓惯例） */
  name: string;
  /** 赋句（七字） */
  fu: string;
  /** 底本原标编号（与序位不符时记录） */
  rawNo?: number;
  /** 注文所在卷（11 或 12） */
  juan: number;
  /** 注文（郭氏辑注） */
  note: string;
  /** 附属格 */
  extras: { title: string; text: string }[];
}

/** 三传单传（与宿主 ChuanItem 结构兼容） */
export interface BifaChuan {
  zhi: string;
  tianJiang?: string;
  liuQin?: string;
  dunGan?: string;
}

/**
 * 检测输入 —— 与 react-liuren 统一模型 LiuRenChart 的相关字段结构兼容，
 * 宿主可将 chart 直接传入（结构化子集，多余字段忽略）。
 */
export interface BifaChartInput {
  dateInfo: {
    /** 四柱，空格分隔："甲辰 丙子 庚午 庚辰" */
    bazi: string;
    /** 旬空 */
    kongWang?: string[];
    yueJiang?: string;
    dayNight?: string;
  };
  /** 十二宫（0=子 … 11=亥），缺省时跳过依赖天地盘的格 */
  gong?: { diZhi: string; tianZhi: string; tianJiang?: string; dunGan?: string }[];
  /** 四课（一课干上 → 四课支阴） */
  siKe: { name?: string; shang: string; xia?: string; tianJiang?: string }[];
  sanChuan: {
    chu: BifaChuan;
    zhong: BifaChuan;
    mo: BifaChuan;
    keTi?: string;
    method?: string;
  };
}

/** 命中结果 */
export interface BifaHit {
  no: number;
  name: string;
  fu: string;
  /** exact=条件出自注文可直判；approx=判定口径有取舍（详见 algorithm 文档） */
  certainty: 'exact' | 'approx';
  /** 命中理由（具体到神煞/宫位） */
  why: string;
}

/** 典籍文档元信息（与 zslj-ts-lib 同形，便于宿主典籍库合并） */
export interface DocMeta {
  path: string;
  title: string;
  group: string;
}
