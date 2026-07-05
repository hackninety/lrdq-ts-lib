import { describe, expect, it } from 'vitest';
import { bifa, detectBifa, getBifaEntry, normalizeTianJiang, DETECTOR_NOS, UNDETECTABLE_NOS } from '../index';
import type { BifaChartInput } from '../types';

/**
 * 构造最小检测输入（默认甲子日、丙午年、甲午月，天地盘为伏吟式恒等盘）。
 * gongMap 可改天盘支、gongJiang 可设宫上天将、noPan 去掉天地盘。
 */
function mk(o: {
  gan?: string;
  zhi?: string;
  nian?: string;
  yue?: string;
  kong?: string[];
  ke?: [string, string?][];
  chuan: [string, string?, string?][];
  gongMap?: Record<string, string>;
  gongJiang?: Record<string, string>;
  noPan?: boolean;
  keTi?: string;
  yueJiang?: string;
  dayNight?: string;
  benMing?: string;
}): BifaChartInput {
  const gan = o.gan ?? '甲';
  const zhi = o.zhi ?? '子';
  const nian = o.nian ?? '午';
  const yue = o.yue ?? '午';
  const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ke = (o.ke ?? [['丑'], ['丑'], ['丑'], ['丑']]).map(([shang, tianJiang], i) => ({
    name: `${i + 1}課`, shang, tianJiang,
  }));
  const [c, z, m] = o.chuan.map(([zz, tianJiang, dunGan]) => ({ zhi: zz, tianJiang, dunGan }));
  return {
    dateInfo: {
      bazi: `丙${nian} 甲${yue} ${gan}${zhi} 甲子`,
      kongWang: o.kong ?? [],
      yueJiang: o.yueJiang,
      dayNight: o.dayNight,
    },
    nianMing: o.benMing ? { benMing: o.benMing } : undefined,
    gong: o.noPan
      ? []
      : ZHI12.map((d) => ({ diZhi: d, tianZhi: o.gongMap?.[d] ?? d, tianJiang: o.gongJiang?.[d] ?? '' })),
    siKe: ke,
    sanChuan: { chu: c, zhong: z, mo: m, keTi: o.keTi },
  };
}

const nos = (hits: ReturnType<typeof detectBifa>) => hits.map((h) => h.no);
const det = (o: Parameters<typeof mk>[0]) => nos(detectBifa(mk(o)));

describe('语料完整性', () => {
  it('百法俱全且编号有序', () => {
    expect(bifa.entries).toHaveLength(100);
    expect(bifa.entries.map((e) => e.no)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(bifa.entries.every((e) => e.fu.length >= 6)).toBe(true);
  });
  it('第52法保留底本编号笔误记录（底本作第五十三法）', () => {
    expect(getBifaEntry(52)?.rawNo).toBe(53);
    expect(bifa.textualIssues.length).toBeGreaterThanOrEqual(5);
  });
  it('注文覆盖：每法皆有注', () => {
    expect(bifa.entries.filter((e) => !e.note).map((e) => e.no)).toEqual([]);
  });
  it('检测覆盖 97/100：与不可判 3 法互补成百', () => {
    expect(DETECTOR_NOS).toHaveLength(97);
    expect(new Set(DETECTOR_NOS).size).toBe(97);
    expect([...DETECTOR_NOS].sort((a, b) => a - b)).toEqual(DETECTOR_NOS);
    expect(UNDETECTABLE_NOS).toEqual([93, 97, 98]);
    const all = [...DETECTOR_NOS, ...UNDETECTABLE_NOS].sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });
});

describe('天将名归一化', () => {
  it('古写/繁体归一', () => {
    expect(normalizeTianJiang('天一')).toBe('贵人');
    expect(normalizeTianJiang('腾虵')).toBe('螣蛇');
    expect(normalizeTianJiang('大裳')).toBe('太常');
    expect(normalizeTianJiang('勾陣')).toBe('勾陈');
    expect(normalizeTianJiang('元武')).toBe('玄武');
  });
});

describe('毕法命中检测 · 首批 23 法回归', () => {
  it('第7法 旺祿臨身：甲日禄寅临干上（甲子日兼中第41法禄马同乡）', () => {
    const r = det({ ke: [['寅'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] });
    expect(r).toContain(7);
    expect(r).toContain(41);
  });

  it('第8法 權攝不正：禄临支上而不临干上', () => {
    const r = det({ ke: [['丑'], ['丑'], ['寅'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] });
    expect(r).toContain(8);
    expect(r).not.toContain(7);
  });

  it('第5/6法 純陽／純陰', () => {
    expect(det({ ke: [['子'], ['寅'], ['辰'], ['午']], chuan: [['申'], ['戌'], ['子']] })).toContain(5);
    const yin = det({ gan: '乙', zhi: '丑', ke: [['丑'], ['卯'], ['巳'], ['未']], chuan: [['酉'], ['亥'], ['丑']] });
    expect(yin).toContain(6);
    expect(yin).not.toContain(5);
  });

  it('第25法 金日逢丁：庚日三传遁得丁神', () => {
    const r = det({ gan: '庚', zhi: '午', chuan: [['卯', '', '丁'], ['辰'], ['巳']] });
    expect(r).toContain(25);
    expect(r).not.toContain(26);
  });

  it('第16法 空上乘空：传支落旬空复乘天空', () => {
    expect(det({ kong: ['戌', '亥'], chuan: [['戌', '天空'], ['卯'], ['申']] })).toContain(16);
  });

  it('第17法 進茹空亡：三传进连茹带旬空', () => {
    const r = det({ kong: ['戌', '亥'], chuan: [['戌'], ['亥'], ['子']] });
    expect(r).toContain(17);
    expect(r).not.toContain(18);
  });

  it('第31/32法 遞生／遞克', () => {
    expect(det({ chuan: [['寅'], ['午'], ['戌']] })).toContain(31);
    expect(det({ chuan: [['寅'], ['辰'], ['子']] })).toContain(32);
  });

  it('第14法 傳財太旺：甲日三传皆土（财）', () => {
    expect(det({ chuan: [['辰'], ['戌'], ['丑']] })).toContain(14);
  });

  it('第51/52法 魁度天門／罡塞鬼戶（依天地盘）', () => {
    expect(det({ gongMap: { 亥: '戌' }, chuan: [['戌'], ['酉'], ['申']] })).toContain(51);
    expect(det({ gongMap: { 寅: '辰' }, chuan: [['卯'], ['辰'], ['巳']] })).toContain(52);
  });

  it('第61法 干乘墓虎：甲日（木墓未）干上未乘白虎', () => {
    expect(det({ ke: [['未', '白虎'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(61);
  });

  it('第72法 喪吊全逢：年支午→丧门申、吊客辰俱入课传', () => {
    expect(det({ nian: '午', ke: [['申'], ['丑'], ['卯'], ['丑']], chuan: [['辰'], ['巳'], ['午']] })).toContain(72);
  });

  it('命中项带赋句与判定级别', () => {
    const hits = detectBifa(mk({ ke: [['寅'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] }));
    const h7 = hits.find((h) => h.no === 7)!;
    expect(h7.fu).toBe('旺祿臨身徒妄作');
    expect(h7.certainty).toBe('exact');
    expect(h7.why).toContain('寅');
  });
});

describe('毕法命中检测 · 新增 74 法', () => {
  it('第1法 前後引從：甲寄寅，初卯末丑', () => {
    expect(det({ chuan: [['卯'], ['辰'], ['丑']] })).toContain(1);
  });

  it('第2法 首尾相見：甲子日干上旬尾酉、支上旬首子', () => {
    expect(det({ ke: [['酉'], ['丑'], ['子'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(2);
  });

  it('第3法 簾幕貴人：昼占夜贵未临干上', () => {
    expect(det({ dayNight: '昼', ke: [['未'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(3);
  });

  it('第4/91法 催官使者 & 虎臨乾鬼：甲日申鬼乘白虎临干', () => {
    const r = det({ ke: [['申', '白虎'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] });
    expect(r).toContain(4);
    expect(r).toContain(91);
  });

  it('第9法 避難逃生：三传皆鬼而干上无制', () => {
    const r = det({ ke: [['丑'], ['丑'], ['丑'], ['丑']], chuan: [['申'], ['酉'], ['申']] });
    expect(r).toContain(9);
    expect(r).not.toContain(11);
  });

  it('第11法 眾鬼不畏：壬辰日三传戌丑辰土鬼，干上寅木制之', () => {
    const r = det({ gan: '壬', zhi: '辰', ke: [['寅'], ['丑'], ['丑'], ['丑']], chuan: [['戌'], ['丑'], ['辰']] });
    expect(r).toContain(11);
    expect(r).not.toContain(9);
  });

  it('第10法 朽木難雕：庚戌日斫轮卯落空坐申', () => {
    expect(det({
      gan: '庚', zhi: '戌', kong: ['卯'],
      gongMap: { 申: '卯', 卯: '戌' }, chuan: [['卯'], ['辰'], ['巳']],
    })).toContain(10);
  });

  it('第12法 狐假虎威：干上辰非鬼而乘白虎（金）克甲日', () => {
    expect(det({ ke: [['辰', '白虎'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['巳'], ['未']] })).toContain(12);
  });

  it('第13法 鬼賊當時無畏忌：戊日春占三传皆木鬼当令', () => {
    expect(det({ gan: '戊', yue: '卯', chuan: [['寅'], ['卯'], ['寅']] })).toContain(13);
  });

  it('第15法 脫上逢脫：庚日干上子乘青龙', () => {
    expect(det({ gan: '庚', zhi: '午', ke: [['子', '青龙'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(15);
  });

  it('第19/20法 胎財生氣／死氣：壬日干上午', () => {
    expect(det({ gan: '壬', zhi: '寅', yue: '申', ke: [['午'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(19);
    expect(det({ gan: '壬', zhi: '寅', yue: '寅', ke: [['午'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(20);
  });

  it('第23/24法 支傳乾／乾傳支', () => {
    expect(det({ ke: [['酉'], ['丑'], ['巳'], ['丑']], chuan: [['巳'], ['丑'], ['酉']] })).toContain(23);
    expect(det({ ke: [['酉'], ['丑'], ['巳'], ['丑']], chuan: [['酉'], ['丑'], ['巳']] })).toContain(24);
  });

  it('第28法 傳鬼化財：丙申日水局两传空独存申财', () => {
    expect(det({ gan: '丙', zhi: '申', kong: ['子', '辰'], chuan: [['申'], ['子'], ['辰']] })).toContain(28);
  });

  it('第29/30法 人宅盛衰：三传局生日脱支／盗日生支', () => {
    expect(det({ gan: '甲', zhi: '申', ke: [['午'], ['丑'], ['卯'], ['丑']], chuan: [['辰'], ['申'], ['子']] })).toContain(29);
    expect(det({ gan: '甲', zhi: '辰', chuan: [['寅'], ['午'], ['戌']] })).toContain(30);
  });

  it('第33法 有始無終：乙未日初亥（长生）末未（墓）', () => {
    expect(det({ gan: '乙', zhi: '未', chuan: [['亥'], ['卯'], ['未']] })).toContain(33);
  });

  it('第34法 苦去甘來：戊午日寅亥申，末申制初寅', () => {
    expect(det({ gan: '戊', zhi: '午', chuan: [['寅'], ['亥'], ['申']] })).toContain(34);
  });

  it('第35法 人宅受脫：甲子日干上巳支上卯皆脱气', () => {
    expect(det({ ke: [['巳'], ['丑'], ['卯'], ['丑']], chuan: [['午'], ['戌'], ['寅']] })).toContain(35);
  });

  it('第36法 干支皆敗：甲申日干上子支上午', () => {
    expect(det({ gan: '甲', zhi: '申', ke: [['子'], ['丑'], ['午'], ['丑']], chuan: [['寅'], ['辰'], ['午']] })).toContain(36);
  });

  it('第37法 末助初訟：庚午日午辰寅，末寅生初午克庚', () => {
    expect(det({ gan: '庚', zhi: '午', chuan: [['午'], ['辰'], ['寅']] })).toContain(37);
  });

  it('第38法 閉口卦：玄武临地盘旬首子', () => {
    expect(det({ gongJiang: { 子: '玄武' }, chuan: [['卯'], ['辰'], ['巳']] })).toContain(38);
  });

  it('第39法 太陽照武：玄武乘月将寅', () => {
    expect(det({ yueJiang: '寅', gongJiang: { 寅: '玄武' }, chuan: [['卯'], ['辰'], ['巳']] })).toContain(39);
  });

  it('第40法 後合占婚：干支上分乘天后六合', () => {
    expect(det({ ke: [['寅', '天后'], ['丑'], ['戌', '六合'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(40);
  });

  it('第43法 害貴：贵人乘未与传中子六害', () => {
    expect(det({ gongJiang: { 未: '贵人' }, chuan: [['子'], ['辰'], ['申']] })).toContain(43);
  });

  it('第44法 課傳俱貴：甲日三传丑未丑皆贵人', () => {
    expect(det({ chuan: [['丑'], ['未'], ['丑']] })).toContain(44);
  });

  it('第45法 晝夜貴加：甲日昼贵丑加夜贵未上', () => {
    expect(det({ gongMap: { 未: '丑', 丑: '午' }, chuan: [['卯'], ['辰'], ['巳']] })).toContain(45);
  });

  it('第46法 貴人差迭：伏吟盘甲日昼贵丑落夜地、夜贵未落昼方', () => {
    expect(det({ chuan: [['卯'], ['辰'], ['巳']] })).toContain(46);
  });

  it('第47法 貴雖在獄：贵人临地盘辰', () => {
    expect(det({ gongJiang: { 辰: '贵人' }, chuan: [['卯'], ['辰'], ['巳']] })).toContain(47);
  });

  it('第48法 鬼乘天乙：辛日干上午鬼乘贵人', () => {
    expect(det({ gan: '辛', zhi: '卯', ke: [['午', '贵人'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(48);
  });

  it('第49法 兩貴受克：乙日申坐午、子坐戌', () => {
    expect(det({
      gan: '乙', zhi: '丑',
      gongMap: { 午: '申', 戌: '子', 申: '丑', 子: '卯' },
      chuan: [['卯'], ['辰'], ['巳']],
    })).toContain(49);
  });

  it('第50法 二貴皆空：丁日亥酉俱空亡', () => {
    expect(det({ gan: '丁', zhi: '丑', kong: ['亥', '酉'], chuan: [['卯'], ['辰'], ['巳']] })).toContain(50);
  });

  it('第53法 兩蛇夾墓：丙戌日干墓戌坐巳乘螣蛇', () => {
    expect(det({
      gan: '丙', zhi: '戌',
      gongMap: { 巳: '戌', 戌: '卯' }, gongJiang: { 巳: '螣蛇' },
      chuan: [['卯'], ['辰'], ['巳']],
    })).toContain(53);
  });

  it('第54法 虎視逢虎：昴星课中复见白虎', () => {
    expect(det({ gan: '丁', zhi: '亥', keTi: '昴星', chuan: [['戌', '白虎'], ['辰'], ['巳']] })).toContain(54);
  });

  it('第55法 羅網兜裹（回归）', () => {
    expect(det({ ke: [['卯'], ['丑'], ['丑'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(55);
  });

  it('第56法 天網自裹：甲日干墓未覆日而本命未', () => {
    expect(det({ benMing: '未', ke: [['未'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(56);
  });

  it('第57法 費有餘得不足：庚日生我丑空而鬼午坐实', () => {
    expect(det({ gan: '庚', zhi: '午', kong: ['丑'], ke: [['丑'], ['丑'], ['卯'], ['丑']], chuan: [['午'], ['戌'], ['寅']] })).toContain(57);
  });

  it('第58法 用破身心：戊申日初财子而中鬼末空', () => {
    expect(det({ gan: '戊', zhi: '申', kong: ['辰'], chuan: [['子'], ['寅'], ['辰']] })).toContain(58);
  });

  it('第59法 華蓋覆日：壬申日辰临干发用', () => {
    expect(det({ gan: '壬', zhi: '申', ke: [['辰'], ['丑'], ['卯'], ['丑']], chuan: [['辰'], ['申'], ['子']] })).toContain(59);
  });

  it('第60法 太陽射宅：丙午日支墓戌作月将临宅', () => {
    expect(det({ gan: '丙', zhi: '午', yueJiang: '戌', ke: [['丑'], ['丑'], ['戌'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(60);
  });

  it('第63法 彼此全傷：丁亥日干上子支上辰', () => {
    expect(det({ gan: '丁', zhi: '亥', ke: [['子'], ['丑'], ['辰'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(63);
  });

  it('第64法 蕪淫卦：甲子日支上申克干、干上戌克支', () => {
    expect(det({ ke: [['戌'], ['丑'], ['申'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(64);
  });

  it('第65法 干墓並關：乙日秋占未作关神临干发用', () => {
    expect(det({ gan: '乙', zhi: '丑', yue: '酉', ke: [['未'], ['丑'], ['卯'], ['丑']], chuan: [['未'], ['卯'], ['亥']] })).toContain(65);
  });

  it('第66法 支墳財並：甲子日支墓辰作日财发用', () => {
    expect(det({ chuan: [['辰'], ['申'], ['子']] })).toContain(66);
  });

  it('第67法 受虎克神為病症：传中白虎乘申金主肝经', () => {
    const hits = detectBifa(mk({ chuan: [['申', '白虎'], ['子'], ['辰']] }));
    const h = hits.find((x) => x.no === 67)!;
    expect(h.why).toContain('肝');
  });

  it('第68法 制鬼良醫：乙丑日干上酉鬼，支上午制之', () => {
    expect(det({ gan: '乙', zhi: '丑', ke: [['酉'], ['丑'], ['午'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(68);
  });

  it('第69法 虎乘遁鬼：甲子日白虎乘庚午', () => {
    expect(det({ gongJiang: { 午: '白虎' }, chuan: [['卯'], ['辰'], ['巳']] })).toContain(69);
  });

  it('第70法 鬼臨三四：乙未日三四课申酉全鬼', () => {
    expect(det({ gan: '乙', zhi: '未', ke: [['丑'], ['丑'], ['申'], ['酉']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(70);
  });

  it('第71法 病符克宅：子年病符亥临支克巳', () => {
    expect(det({ gan: '丙', zhi: '巳', nian: '子', ke: [['丑'], ['丑'], ['亥'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(71);
  });

  it('第73法 前後逼迫：初午坐亥归本宫又被亥克', () => {
    expect(det({ gan: '癸', zhi: '巳', gongMap: { 亥: '午', 午: '亥' }, chuan: [['午'], ['戌'], ['寅']] })).toContain(73);
  });

  it('第74法 空空如也：三传皆空亡', () => {
    expect(det({ kong: ['戌', '亥'], chuan: [['戌'], ['亥'], ['戌']] })).toContain(74);
  });

  it('第75法 賓主不投：四课上全逢辰午酉亥', () => {
    expect(det({ gan: '甲', zhi: '辰', ke: [['酉'], ['辰'], ['亥'], ['午']], chuan: [['酉'], ['辰'], ['亥']] })).toContain(75);
  });

  it('第76法 彼此猜忌：甲申日干上巳害寄宫、支上亥害支', () => {
    expect(det({ gan: '甲', zhi: '申', ke: [['巳'], ['丑'], ['亥'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(76);
  });

  it('第77法 互生俱生：干上亥生甲、支上申生子', () => {
    expect(det({ ke: [['亥'], ['丑'], ['申'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(77);
  });

  it('第78法 互旺皆旺：甲子日干上卯支上子', () => {
    expect(det({ ke: [['卯'], ['丑'], ['子'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(78);
  });

  it('第79法 干支值絕：甲申日干上申支上寅', () => {
    expect(det({ gan: '甲', zhi: '申', ke: [['申'], ['丑'], ['寅'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(79);
  });

  it('第80法 人宅皆死：甲子日干上午支上卯', () => {
    expect(det({ ke: [['午'], ['丑'], ['卯'], ['丑']], chuan: [['寅'], ['辰'], ['午']] })).toContain(80);
  });

  it('第81法 傳墓入墓：辛未日巳戌卯，中戌墓初巳', () => {
    const hits = detectBifa(mk({ gan: '辛', zhi: '未', chuan: [['巳'], ['戌'], ['卯']] }));
    const h = hits.find((x) => x.no === 81)!;
    expect(h.why).toContain('官鬼');
  });

  it('第82法 不行傳者考初時：中末空亡', () => {
    expect(det({ kong: ['戌', '亥'], chuan: [['申'], ['戌'], ['亥']] })).toContain(82);
  });

  it('第83法 三六相呼：乙酉日申子辰而支上丑', () => {
    expect(det({ gan: '乙', zhi: '酉', ke: [['午'], ['丑'], ['丑'], ['丑']], chuan: [['申'], ['子'], ['辰']] })).toContain(83);
  });

  it('第84法 合中犯殺：寅午戌而干上子犯冲', () => {
    expect(det({ ke: [['子'], ['丑'], ['卯'], ['丑']], chuan: [['寅'], ['午'], ['戌']] })).toContain(84);
  });

  it('第85法 初遭夾克：戌加寅乘六合', () => {
    expect(det({ gongMap: { 寅: '戌', 戌: '卯' }, chuan: [['戌', '六合'], ['辰'], ['巳']] })).toContain(85);
  });

  it('第86法 將逢內戰：癸巳日申乘六合发用', () => {
    expect(det({ gan: '癸', zhi: '巳', chuan: [['申', '六合'], ['子'], ['辰']] })).toContain(86);
  });

  it('第87法 人宅坐墓：壬寅日亥坐辰、寅坐未', () => {
    expect(det({
      gan: '壬', zhi: '寅',
      gongMap: { 辰: '亥', 未: '寅', 亥: '辰', 寅: '未' },
      chuan: [['卯'], ['辰'], ['巳']],
    })).toContain(87);
  });

  it('第88法 干支乘墓：壬申日干上辰支上丑', () => {
    expect(det({ gan: '壬', zhi: '申', ke: [['辰'], ['丑'], ['丑'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).toContain(88);
  });

  it('第89法 任信丁馬：伏吟而旬丁卯入传', () => {
    expect(det({ chuan: [['卯'], ['辰'], ['巳']] })).toContain(89);
  });

  it('第90法 來去俱空：己酉日返吟卯酉卯初末空', () => {
    expect(det({ gan: '己', zhi: '酉', kong: ['寅', '卯'], noPan: true, keTi: '返吟', chuan: [['卯'], ['酉'], ['卯']] })).toContain(90);
  });

  it('第92法 龍加生氣：丙日三月青龙乘寅生日', () => {
    expect(det({ gan: '丙', zhi: '申', yue: '辰', gongJiang: { 寅: '青龙' }, chuan: [['卯'], ['辰'], ['巳']] })).toContain(92);
  });

  it('第94法 喜懼空亡：传中申鬼空为喜', () => {
    const hits = detectBifa(mk({ kong: ['申'], chuan: [['申'], ['子'], ['辰']] }));
    const h = hits.find((x) => x.no === 94)!;
    expect(h.why).toContain('為喜');
  });

  it('第95法 六爻現卦：辛未日卯亥未局财而干上午官鬼', () => {
    const hits = detectBifa(mk({ gan: '辛', zhi: '未', ke: [['午'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['亥'], ['未']] }));
    const h = hits.find((x) => x.no === 95)!;
    expect(h.why).toContain('傳財化鬼');
  });

  it('第96法 旬內空亡逐類推：课上戌财空、亥父空', () => {
    const hits = detectBifa(mk({ kong: ['戌', '亥'], ke: [['戌'], ['丑'], ['亥'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] }));
    const h = hits.find((x) => x.no === 96)!;
    expect(h.why).toContain('財空軍儲乏');
  });

  it('第99/100法 課名吉凶語境', () => {
    expect(det({ keTi: '三光', chuan: [['卯'], ['辰'], ['巳']] })).toContain(99);
    expect(det({ keTi: '天網四張', chuan: [['卯'], ['辰'], ['巳']] })).toContain(100);
  });

  it('年命缺省时第56法静默跳过', () => {
    expect(det({ ke: [['未'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] })).not.toContain(56);
  });
});
