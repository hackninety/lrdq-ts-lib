import { describe, expect, it } from 'vitest';
import { findSimilarCases, getZhanLi, getZhanLiIssues, zhanLiLabel } from '../cases';

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
function xunKong(day: string): string {
  const g = GAN.indexOf(day[0]);
  const z = ZHI.indexOf(day[1]);
  const shou = (z - g + 12) % 12;
  return [ZHI[(shou + 10) % 12], ZHI[(shou + 11) % 12]].join('');
}

describe('占例库（《六壬指南注解》卷三）', () => {
  const all = getZhanLi();

  it('规模与字段覆盖', () => {
    expect(all.length).toBeGreaterThanOrEqual(125);
    expect(all.length).toBeLessThanOrEqual(145);
    const withDay = all.filter((e) => e.day).length;
    expect(withDay).toBeGreaterThanOrEqual(125);
    // 今案（占例/增補）全部带标志；原案（陳公獻占驗）占绝对多数
    const aug = all.filter((e) => e.augmented);
    expect(aug.length).toBeGreaterThanOrEqual(8);
    expect(all.length - aug.length).toBeGreaterThanOrEqual(115);
    // 每案有章、有文，文含头部原行
    for (const e of all) {
      expect(e.chapter, zhanLiLabel(e)).toMatch(/第[一二三四五六七八九十]+$/);
      expect(e.text.length, zhanLiLabel(e)).toBeGreaterThan(20);
    }
  });

  it('样例字段金标：天時章第二·占驗一', () => {
    const e = all.find((x) => x.chapter === '天時章第二' && x.kind === '占驗' && x.no === '一');
    expect(e).toBeTruthy();
    expect(e!.year).toBe('戊寅');
    expect(e!.month).toBe('三月');
    expect(e!.day).toBe('己巳');
    expect(e!.hourZhi).toBe('丑');
    expect(e!.keti).toContain('遙克');
    expect(e!.keti).toContain('玄胎');
    expect(e!.kong).toEqual(['戌', '亥']);
    expect(e!.luoKong).toEqual(['未', '申']);
    expect(e!.text).toContain('祈雨');
  });

  it('旬空金标回归：底本所记旬空与日干支互证（偏差须在校记中）', () => {
    const issues = getZhanLiIssues();
    let checked = 0;
    for (const e of all) {
      if (!e.day || e.kong.length !== 2) continue;
      checked++;
      const exp = xunKong(e.day);
      if (exp !== e.kong.join('')) {
        const flagged = issues.some((s) => s.includes(e.chapter) && s.includes(e.day!));
        expect(flagged, `${zhanLiLabel(e)} 旬空 ${e.kong.join('')} ≠ 推算 ${exp} 且未记校记`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(110);
  });

  it('相似检索：章 + 课体 + 日干支加权', () => {
    const hits = findSimilarCases({ keti: ['蒿矢'], chapters: ['疾病章第九'], limit: 3 });
    expect(hits.length).toBe(3);
    // 同章且课体同者居首
    expect(hits[0].entry.chapter).toBe('疾病章第九');
    expect(hits[0].entry.keti).toContain('蒿矢');
    expect(hits[0].why.join('')).toContain('同章');
    expect(hits[0].why.join('')).toContain('蒿矢');
    // 简体查询折叠匹配（遥克 → 遙克）
    const byKeti = findSimilarCases({ keti: ['遥克', '玄胎'] });
    expect(byKeti.length).toBeGreaterThan(0);
    expect(byKeti[0].entry.keti.join('')).toMatch(/遙克|玄胎/);
    // 日干支细分计分
    const byDay = findSimilarCases({ day: '己巳', limit: 5 });
    expect(byDay.some((h) => h.entry.day === '己巳')).toBe(true);
    // 无匹配返回空
    expect(findSimilarCases({})).toEqual([]);
  });
});
