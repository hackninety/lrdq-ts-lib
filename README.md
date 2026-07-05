# lrdq-ts-lib

《六壬大全》（明·欽定四庫全書本）典籍库 与 宋·凌福之《畢法賦》百法命中检测引擎。

- **语料**：卷十一/十二《畢法賦》全量结构化 —— 百法（编号/格名/赋句/注文/204 附属格），
  底本笔误按序归正并记录 `textualIssues`
- **检测**：`detectBifa(chart)` 对排盘结果做毕法格局命中（首批 23 法，exact/approx 分级，
  详见 `docs/algorithm/bifa-detect.md`）
- **典籍**：全书十三篇（序 + 卷一~卷十二）随包内置，`lrdq-ts-lib/docs` 子入口输出
  可渲染 markdown（与 zslj-ts-lib 同形，宿主典籍库可直接并册）；与检测主入口分包，
  宿主主包不背整部书卷
- 纯 TS、零运行时依赖、ESM（dist 可被纯 Node / Vite / vitest 直接消费）

## 安装与使用

```bash
npm install github:hackninety/lrdq-ts-lib#v0.2.0
```

```ts
import { detectBifa, bifa, getBifaEntry } from 'lrdq-ts-lib';

const hits = detectBifa(chart); // chart 结构兼容 react-liuren 统一模型
// → [{ no: 7, name: '旺祿臨身', fu: '旺祿臨身徒妄作', certainty: 'exact', why: '日祿寅臨干上' }]

getBifaEntry(52); // 单条语料（含注文与附属格）
```

```ts
// 典籍库（惰性场景再导入，避免全书文本进主包）
import { getDocsManifest, getDocMarkdown } from 'lrdq-ts-lib/docs';

getDocsManifest(); // 14 篇：序 + 卷一~卷十二 + 检测口径说明
getDocMarkdown('book/juan07.md'); // 課經集一（元首課…）
```

## 典籍篇目

| 篇 | 内容 | 处理 |
|---|---|---|
| 序 | 四庫全書總目提要 | 整卷典籍化 |
| 卷一 | 起例（入手法/九宗门口诀/神煞表） | 整卷典籍化 |
| 卷二 | 神將釋（十二月将 + 十二天将各論） | 整卷典籍化（26 节） |
| 卷三/卷四 | 歌賦（括囊賦、雲霄賦等；卷四底本缺卷题行，已回退补题） | 整卷典籍化 |
| 卷五 | 兵占五十章（底本缺第三十六/四十一/四十三节题，如实保留） | 整卷典籍化（47 节） |
| 卷六 | 宿度分野 | 整卷典籍化 |
| 卷七~卷十 | 課經集一~四（元首課…物類課，70 课体） | 整卷典籍化（各课成节） |
| 卷十一/十二 | 《畢法賦》上下 | 深度结构化（bifa.json + 分法详解渲染） |

整卷典籍化只做高置信排版（卷题→H1、「…第X/…課/…論」等独行→小节标题、页衬行清理），
底本版面不臆断重构。

## 数据源

ctext.org wiki（res=260435）四庫全書本《六壬大全》转录，全书 13 页原件存档于
`docs/book/raw`（HTML）与 `docs/book/text`（提取稿）。古籍原文为公有领域。

## 后续计划

- 分批扩充检测覆盖（77 法待实现）
- 課經七百二十课、神煞表等深度结构化（当前为整卷典籍化）
