import { describe, expect, it } from 'vitest';
import { bifa, detectBifa, getBifaEntry, normalizeTianJiang } from '../index';
import type { BifaChartInput } from '../types';

/** 构造最小检测输入（默认甲子日、丙午年、四课上神与三传可覆盖） */
function mk(o: {
  gan?: string;
  zhi?: string;
  nian?: string;
  kong?: string[];
  ke?: [string, string?][];
  chuan: [string, string?, string?][];
  gongMap?: Record<string, string>;
}): BifaChartInput {
  const gan = o.gan ?? '甲';
  const zhi = o.zhi ?? '子';
  const nian = o.nian ?? '午';
  const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ke = (o.ke ?? [['丑'], ['丑'], ['丑'], ['丑']]).map(([shang, tianJiang], i) => ({
    name: `${i + 1}課`, shang, tianJiang,
  }));
  const [c, z, m] = o.chuan.map(([zz, tianJiang, dunGan]) => ({ zhi: zz, tianJiang, dunGan }));
  return {
    dateInfo: { bazi: `丙${nian} 甲午 ${gan}${zhi} 甲子`, kongWang: o.kong ?? [] },
    gong: ZHI12.map((d) => ({ diZhi: d, tianZhi: o.gongMap?.[d] ?? d, tianJiang: '' })),
    siKe: ke,
    sanChuan: { chu: c, zhong: z, mo: m },
  };
}

const nos = (hits: ReturnType<typeof detectBifa>) => hits.map((h) => h.no);

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

describe('毕法命中检测', () => {
  it('第7法 旺祿臨身：甲日禄寅临干上（甲子日兼中第41法禄马同乡）', () => {
    const hits = detectBifa(mk({ ke: [['寅'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] }));
    expect(nos(hits)).toContain(7);
    // 甲子日：日禄寅、驿马（申子辰）亦寅，禄马同现干支之上
    expect(nos(hits)).toContain(41);
  });

  it('第8法 權攝不正：禄临支上而不临干上', () => {
    const hits = detectBifa(mk({ ke: [['丑'], ['丑'], ['寅'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] }));
    expect(nos(hits)).toContain(8);
    expect(nos(hits)).not.toContain(7);
  });

  it('第5/6法 純陽／純陰', () => {
    const yang = detectBifa(mk({ ke: [['子'], ['寅'], ['辰'], ['午']], chuan: [['申'], ['戌'], ['子']] }));
    expect(nos(yang)).toContain(5);
    const yin = detectBifa(mk({ gan: '乙', zhi: '丑', ke: [['丑'], ['卯'], ['巳'], ['未']], chuan: [['酉'], ['亥'], ['丑']] }));
    expect(nos(yin)).toContain(6);
    expect(nos(yin)).not.toContain(5);
  });

  it('第25法 金日逢丁：庚日三传遁得丁神', () => {
    const hits = detectBifa(mk({ gan: '庚', zhi: '午', chuan: [['卯', '', '丁'], ['辰'], ['巳']] }));
    expect(nos(hits)).toContain(25);
    expect(nos(hits)).not.toContain(26);
  });

  it('第16法 空上乘空：传支落旬空复乘天空', () => {
    const hits = detectBifa(mk({ kong: ['戌', '亥'], chuan: [['戌', '天空'], ['卯'], ['申']] }));
    expect(nos(hits)).toContain(16);
  });

  it('第17法 進茹空亡：三传进连茹带旬空', () => {
    const hits = detectBifa(mk({ kong: ['戌', '亥'], chuan: [['戌'], ['亥'], ['子']] }));
    expect(nos(hits)).toContain(17);
    expect(nos(hits)).not.toContain(18);
  });

  it('第31/32法 遞生／遞克', () => {
    // 寅(木)生午(火)生戌(土)
    expect(nos(detectBifa(mk({ chuan: [['寅'], ['午'], ['戌']] })))).toContain(31);
    // 寅(木)克辰(土)、辰(土)克子(水)
    expect(nos(detectBifa(mk({ chuan: [['寅'], ['辰'], ['子']] })))).toContain(32);
  });

  it('第14法 傳財太旺：甲日三传皆土（财）', () => {
    const hits = detectBifa(mk({ chuan: [['辰'], ['戌'], ['丑']] }));
    expect(nos(hits)).toContain(14);
  });

  it('第51/52法 魁度天門／罡塞鬼戶（依天地盘）', () => {
    const kui = detectBifa(mk({ gongMap: { 亥: '戌' }, chuan: [['戌'], ['酉'], ['申']] }));
    expect(nos(kui)).toContain(51);
    const gang = detectBifa(mk({ gongMap: { 寅: '辰' }, chuan: [['卯'], ['辰'], ['巳']] }));
    expect(nos(gang)).toContain(52);
  });

  it('第61法 干乘墓虎：甲日（木墓未）干上未乘白虎', () => {
    const hits = detectBifa(mk({ ke: [['未', '白虎'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] }));
    expect(nos(hits)).toContain(61);
  });

  it('第72法 喪吊全逢：年支午→丧门申、吊客辰俱入课传', () => {
    const hits = detectBifa(mk({ nian: '午', ke: [['申'], ['丑'], ['卯'], ['丑']], chuan: [['辰'], ['巳'], ['午']] }));
    expect(nos(hits)).toContain(72);
  });

  it('命中项带赋句与判定级别', () => {
    const hits = detectBifa(mk({ ke: [['寅'], ['丑'], ['卯'], ['丑']], chuan: [['卯'], ['辰'], ['巳']] }));
    const h7 = hits.find((h) => h.no === 7)!;
    expect(h7.fu).toBe('旺祿臨身徒妄作');
    expect(h7.certainty).toBe('exact');
    expect(h7.why).toContain('寅');
  });
});
