import { describe, expect, it } from 'vitest';
import { findKeJing, foldKeName, getKeJing, getKeJingEntry } from '../keju';
import { findTianJiang, findYueJiang, getLeiShen } from '../leishen';
import {
  findMonthlyShenSha, findShenSha, getMonthlyShenSha, getShenShaIssues,
  getShenShaSections, monthlyAt, shenShaValue,
} from '../shensha';
import { nextZhi, ZHI } from '../normalize';

describe('课体节库（大全課經 + 心鏡）', () => {
  const all = getKeJing();
  const dq = all.filter((e) => e.book === '六壬大全');
  const xj = all.filter((e) => e.book === '六壬心鏡');

  it('課經七十节 + 心鏡卷一~三课体节，节序连续', () => {
    expect(dq).toHaveLength(70);
    expect(xj.length).toBeGreaterThanOrEqual(60);
    expect(all.map((e) => e.order)).toEqual(Array.from({ length: all.length }, (_, i) => i + 1));
    expect(all[0].name).toBe('元首');
    expect(all[69].name).toBe('物類');
    // 秋卯將三課（卷九）底本仅列三日课式，正文天然短，阈值放宽
    expect(all.every((e) => e.text.length > 10)).toBe(true);
  });

  it('重出与跨书互证：大全三交×2＋心鏡三交×1；元首两书各一', () => {
    expect(all.filter((e) => e.name === '三交')).toHaveLength(3);
    const ys = all.filter((e) => e.name === '元首');
    expect(ys.map((e) => e.book)).toEqual(['六壬大全', '六壬心鏡']);
  });

  it('元首課正文锚点（首个命中为課經）', () => {
    const e = getKeJingEntry('元首')!;
    expect(e.book).toBe('六壬大全');
    expect(e.juan).toBe(7);
    expect(e.text).toContain('凡一上克下，餘課無克');
  });

  it('课名折叠匹配：繁简/剋克/課卦后缀/倒序别名', () => {
    expect(foldKeName('遙剋課')).toBe('遥克');
    expect(foldKeName('克賊')).toBe('贼克');
    expect(foldKeName('天羅地網卦')).toBe('天罗地网');
    expect(getKeJingEntry('遥克')?.name).toBe('遙克');
    expect(getKeJingEntry('重审课')?.name).toBe('重審');
    expect(getKeJingEntry('龙德')?.name).toBe('龍德');
    // 贼克（通行取法名）→ 心鏡「克賊第一」
    const zk = getKeJingEntry('贼克')!;
    expect(zk.book).toBe('六壬心鏡');
    expect(zk.juan).toBe(1);
    // 涉害在心鏡九法有其节（課經无）
    expect(getKeJingEntry('涉害')?.book).toBe('六壬心鏡');
  });

  it('findKeJing 含重出节与跨书节', () => {
    const r = findKeJing(['三交', '元首', '不存在']);
    expect(r).toHaveLength(5);
    expect(r[0].name).toBe('元首');
  });

  it('心鏡「十雜卦」组题不入库，其下甲己等卦入库', () => {
    expect(all.some((e) => e.name === '十雜')).toBe(false);
    expect(xj.some((e) => e.name === '甲己')).toBe(true);
    expect(xj.some((e) => e.name === '曲直')).toBe(true);
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

describe('逐月神煞立成（卷一）', () => {
  const YUE12 = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const monthly = getMonthlyShenSha();

  it('十二月 × 十二宫齐全且支序一致', () => {
    expect(monthly.map((m) => m.month)).toEqual(YUE12);
    for (const m of monthly) {
      expect(m.gong.map((g) => g.zhi)).toEqual([...ZHI]);
    }
  });

  it('正月子宫：上栏生氣、下栏災煞', () => {
    const g = monthlyAt('正月', '子')!;
    expect(g.ji).toContain('生氣');
    expect(g.xiong).toContain('災煞');
  });

  it('生氣逐月落宫与「月支后二辰」公式互证（八月底本落午为已档偏差）', () => {
    const JIAN = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
    const byMonth = Object.fromEntries(
      findMonthlyShenSha('生氣').filter((s) => s.side === 'ji').map((s) => [s.month, s.zhi]),
    );
    YUE12.forEach((m, i) => {
      if (m === '八月') return;
      expect(byMonth[m], m).toBe(nextZhi(JIAN[i], -2));
    });
    // 底本八月「生氣」落午（依序当在未），照录且校记有档
    expect(byMonth['八月']).toBe('午');
    expect(getShenShaIssues().some((s) => s.includes('八月') && s.includes('生氣'))).toBe(true);
  });

  it('天喜四季落宫与杂列「春戌夏丑秋辰冬未」互证', () => {
    const byMonth = Object.fromEntries(findMonthlyShenSha('天喜').map((s) => [s.month, s.zhi]));
    expect(byMonth['正月']).toBe('戌');
    expect(byMonth['四月']).toBe('丑');
    expect(byMonth['七月']).toBe('辰');
    expect(byMonth['十月']).toBe('未');
  });

  it('驛馬正月在申宫上栏（寅月三合马）', () => {
    expect(monthlyAt('正月', '申')?.ji).toContain('驛馬');
  });

  it('连书未分名照录并记校记', () => {
    expect(getShenShaIssues().some((s) => s.includes('连书'))).toBe(true);
  });
});

describe('类神库（卷二神將釋）', () => {
  it('十二月将 + 十二天将齐全', () => {
    const all = getLeiShen();
    expect(all.filter((e) => e.kind === '月将')).toHaveLength(12);
    expect(all.filter((e) => e.kind === '天将')).toHaveLength(12);
  });

  it('月将 brief 为「所主/類為」原行；按支可查', () => {
    const dm = findYueJiang('亥')!;
    expect(dm.name).toBe('登明');
    expect(dm.brief).toContain('所主禎祥');
    expect(dm.brief).toContain('類為天雨師');
    expect(findYueJiang('未')?.name).toBe('小吉');
  });

  it('天将简繁/古写均可查，brief 为定性段', () => {
    expect(findTianJiang('贵人')?.name).toBe('貴人');
    expect(findTianJiang('天一')?.name).toBe('貴人');
    expect(findTianJiang('勾陈')?.name).toBe('勾陳');
    const lh = findTianJiang('六合')!;
    expect(lh.brief).toContain('和合');
    expect(lh.blocks.map((b) => b.label)).toEqual(['論', '賦', '詩']);
  });

  it('六合主事段在論块（婚姻類神）', () => {
    const lh = findTianJiang('六合')!;
    expect(lh.blocks[0].text).toContain('六合主婚姻、喜慶');
  });
});

describe('毕法課名与課經互链（同步守卫）', () => {
  it('第99法吉课名/第100法凶课名在課經皆有其节', () => {
    const ji99 = ['龍德', '鑄印', '軒蓋', '斫輪', '官爵', '富貴', '三光', '三陽', '三奇', '時泰'];
    const xiong100 = ['天禍', '天獄', '天寇', '天網', '魄化', '二煩'];
    for (const n of [...ji99, ...xiong100]) {
      expect(getKeJingEntry(n), n).toBeDefined();
    }
  });
});
