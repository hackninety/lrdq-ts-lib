import { describe, expect, it } from 'vitest';
import { getDocMarkdown, getDocsManifest } from '../docs';

/** 典籍库全书（序 + 卷一~卷十二）金标：目录序、可取性、关键文本锚点 */
describe('典籍库 · 全书十三篇', () => {
  const manifest = getDocsManifest();
  const books = manifest.filter((d) => d.group === 'book');

  it('book 组齐全且按卷有序', () => {
    expect(books.map((d) => d.title)).toEqual([
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

  it('每篇均可取且非空', () => {
    for (const d of manifest) {
      const md = getDocMarkdown(d.path);
      expect(md, d.path).toBeTruthy();
      expect(md!.length, d.path).toBeGreaterThan(500);
    }
  });

  it('提要：四库馆臣署名在文', () => {
    expect(getDocMarkdown('book/xu.md')).toContain('紀昀');
  });

  it('卷一起例：十干寄宫歌在文', () => {
    expect(getDocMarkdown('book/juan01.md')).toContain('甲課寅兮乙課辰');
  });

  it('課經卷：卷题与课名小节成立', () => {
    const md = getDocMarkdown('book/juan07.md')!;
    expect(md).toContain('# 六壬大全卷七　課經集一');
    expect(md).toContain('## 元首課');
  });

  it('卷四：底本缺卷题行，用回退卷题', () => {
    expect(getDocMarkdown('book/juan04.md')).toContain('# 六壬大全卷四　歌賦');
  });

  it('页衬行（欽定四庫全書/卷终）已清理', () => {
    for (const d of books) {
      const md = getDocMarkdown(d.path)!;
      expect(/^欽定四庫全書$/m.test(md), d.path).toBe(false);
      expect(/^六壬大全[卷巻].{1,4}終$/m.test(md), d.path).toBe(false);
    }
  });

  it('畢法賦上：保留结构化渲染（總目 + 分法详解）', () => {
    const md = getDocMarkdown('book/juan11.md')!;
    expect(md).toContain('《六壬畢法》正文');
    expect(md).toContain('### 第1法');
  });
});
