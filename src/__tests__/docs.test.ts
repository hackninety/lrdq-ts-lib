import { describe, expect, it } from 'vitest';
import { getDocMarkdown, getDocsManifest } from '../docs';

/** 典籍库多书升格金标：manifest 轻入口（book/dynasty/slug 路径）+ 载荷异步路由 */
describe('典籍库 · 多书 manifest', () => {
  const manifest = getDocsManifest();
  const books = manifest.filter((d) => d.group === 'book');

  it('book 组齐全且按卷有序（首册《六壬大全》）', () => {
    expect(books.filter((d) => d.book === '六壬大全').map((d) => d.title)).toEqual([
      '提要（四庫總目）',
      '卷一 起例',
      '卷二 神將釋',
      '卷三 歌賦',
      '卷四 歌賦（續）',
      '卷五 兵占',
      '卷六 宿度分野',
      '卷七 課經集一',
      '卷八 課經集二',
      '卷九 課經集三',
      '卷十 課經集四',
      '卷十一 畢法賦上',
      '卷十二 畢法賦下',
    ]);
  });

  it('manifest 携书目身份：path 带 slug 前缀、book/dynasty 落到条目', () => {
    for (const d of manifest) {
      const slug = d.path.split('/')[0];
      expect(['lrdq', 'lrxj'], d.path).toContain(slug);
      expect(d.book, d.path).toBe(slug === 'lrdq' ? '六壬大全' : '六壬心鏡');
      expect(d.dynasty, d.path).toBe(slug === 'lrdq' ? '明' : '唐');
    }
  });

  it('第二部书《六壬心鏡》九篇齐整（升格多书首验）', async () => {
    const xj = manifest.filter((d) => d.book === '六壬心鏡');
    expect(xj).toHaveLength(9);
    expect(xj[0].title).toBe('序·總目');
    expect(xj[0].author).toBe('徐道符');
    expect(xj[8].title).toBe('卷八 兵占');
    const j1 = (await getDocMarkdown('lrxj/book/juan01.md'))!;
    expect(j1).toContain('# 大六壬心鏡卷一');
    expect(j1).toContain('## 克賊第一');
    expect(j1).toContain('## 蒿矢卦彈射卦附');
    const xu = (await getDocMarkdown('lrxj/book/xu.md'))!;
    expect(xu).toContain('程樹勛');
    expect(/^## /m.test(xu)).toBe(false); // 序·總目整页免提级
  });

  it('每篇均可异步取且非空', async () => {
    for (const d of manifest) {
      const md = await getDocMarkdown(d.path);
      expect(md, d.path).toBeTruthy();
      expect(md!.length, d.path).toBeGreaterThan(500);
    }
  });

  it('未注册书 slug 返回 undefined', async () => {
    expect(await getDocMarkdown('nobook/book/x.md')).toBeUndefined();
  });

  it('提要：四库馆臣署名在文', async () => {
    expect(await getDocMarkdown('lrdq/book/xu.md')).toContain('紀昀');
  });

  it('卷一起例：十干寄宫歌在文', async () => {
    expect(await getDocMarkdown('lrdq/book/juan01.md')).toContain('甲課寅兮乙課辰');
  });

  it('課經卷：卷题与课名小节成立', async () => {
    const md = (await getDocMarkdown('lrdq/book/juan07.md'))!;
    expect(md).toContain('# 六壬大全卷七　課經集一');
    expect(md).toContain('## 元首課');
  });

  it('卷四：底本缺卷题行，用回退卷题', async () => {
    expect(await getDocMarkdown('lrdq/book/juan04.md')).toContain('# 六壬大全卷四　歌賦');
  });

  it('页衬行（欽定四庫全書/卷终）已清理', async () => {
    for (const d of books) {
      const md = (await getDocMarkdown(d.path))!;
      expect(/^欽定四庫全書$/m.test(md), d.path).toBe(false);
      expect(/^六壬大全[卷巻].{1,4}終$/m.test(md), d.path).toBe(false);
    }
  });

  it('畢法賦上：保留结构化渲染（總目 + 分法详解）', async () => {
    const md = (await getDocMarkdown('lrdq/book/juan11.md'))!;
    expect(md).toContain('《六壬畢法》正文');
    expect(md).toContain('### 第1法');
  });
});
