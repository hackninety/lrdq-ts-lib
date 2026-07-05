import { describe, expect, it } from 'vitest';
import { findKeJing, foldKeName, getKeJing, getKeJingEntry } from '../keju';
import { findShenSha, getShenShaIssues, getShenShaSections, shenShaValue } from '../shensha';

describe('課經深度结构化（卷七~卷十）', () => {
  const all = getKeJing();

  it('七十节齐全且节序连续', () => {
    expect(all).toHaveLength(70);
    expect(all.map((e) => e.order)).toEqual(Array.from({ length: 70 }, (_, i) => i + 1));
    expect(all[0].name).toBe('元首');
    expect(all[69].name).toBe('物類');
    // 秋卯將三課（卷九）底本仅列三日课式，正文天然短，阈值放宽
    expect(all.every((e) => e.text.length > 10)).toBe(true);
  });

  it('卷九「三交課」底本重出两节照收', () => {
    expect(all.filter((e) => e.name === '三交')).toHaveLength(2);
  });

  it('元首課正文锚点', () => {
    const e = getKeJingEntry('元首')!;
    expect(e.juan).toBe(7);
    expect(e.text).toContain('凡一上克下，餘課無克');
  });

  it('课名折叠匹配：繁简/剋克/課后缀', () => {
    expect(foldKeName('遙剋課')).toBe('遥克');
    expect(getKeJingEntry('遥克')?.name).toBe('遙克');
    expect(getKeJingEntry('重审课')?.name).toBe('重審');
    expect(getKeJingEntry('龙德')?.name).toBe('龍德');
    expect(getKeJingEntry('涉害')).toBeUndefined(); // 課經无涉害課
  });

  it('findKeJing 含重出节且按节序', () => {
    const r = findKeJing(['三交', '元首', '不存在']);
    expect(r).toHaveLength(3);
    expect(r[0].name).toBe('元首');
    expect(r.filter((e) => e.name === '三交')).toHaveLength(2);
  });
});

describe('神煞表结构化（卷一）', () => {
  const sections = getShenShaSections();

  it('四节齐全', () => {
    expect(sections.map((s) => s.id)).toEqual(['sui', 'gan', 'zhi', 'yue']);
    for (const s of sections) expect(s.entries.length).toBeGreaterThan(10);
  });

  it('十天干表：日祿全表与禄位一致，表头巳归正为己', () => {
    const gan = sections.find((s) => s.id === 'gan')!;
    expect(gan.keys).toContain('己');
    expect(gan.keys).not.toContain('巳');
    const lu = gan.entries.find((e) => e.name === '日祿')!;
    expect(lu.map).toEqual({
      甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
      己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
    });
  });

  it('歲神煞：將軍带尾注；十二地支：支馬合三合马', () => {
    const jj = findShenSha('將軍').find((x) => x.section.id === 'sui')!.entry;
    expect(jj.map?.['子']).toBe('酉');
    expect(jj.note).toBe('占行人用');
    const zm = findShenSha('支馬').find((x) => x.section.id === 'zhi')!.entry;
    expect(zm.map?.['子']).toBe('寅');
    expect(zm.map?.['丑']).toBe('亥');
  });

  it('月令杂列：严格模式提映射，其余整行列存', () => {
    const yue = sections.find((s) => s.id === 'yue')!;
    const he = yue.entries.find((e) => e.name === '皇恩')!;
    expect(he.map?.['正月']).toBe('戌');
    const tx = yue.entries.find((e) => e.name === '天喜')!;
    expect(tx.rule).toContain('春戌夏丑');
    const fx = yue.entries.find((e) => e.name === '福星')!;
    expect(fx.rule).toContain('壬癸在巳'); // 断行已拼接
  });

  it('同名跨节查值（金神见于歲/支两节）', () => {
    expect(shenShaValue('金神', '子')).toEqual(['酉', '酉']);
  });

  it('文字校记', () => {
    const issues = getShenShaIssues();
    expect(issues.some((s) => s.includes('戊巳庚'))).toBe(true);
    expect(issues.some((s) => s.includes('聖心'))).toBe(true);
  });
});
