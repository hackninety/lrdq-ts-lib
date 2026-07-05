# lrdq-ts-lib

**大六壬典籍语料库**（首册《六壬大全》，明·欽定四庫全書本）与 宋·凌福之《畢法賦》百法命中检测引擎。
多书架构：manifest 携 `book/dynasty`、路径带书 slug 前缀、载荷按书分包懒加载；
收录路线图见 `docs/Todo.md`（心镜/毕法案录/壬归等待收）。

- **语料**：卷十一/十二《畢法賦》全量结构化 —— 百法（编号/格名/赋句/注文/204 附属格），
  底本笔误按序归正并记录 `textualIssues`
- **检测**：`detectBifa(chart)` 对排盘结果做毕法格局命中（**97/100 法**，exact/approx 分级；
  第 93/97/98 法为起传校勘与断法方法论，不设检测器，见 `UNDETECTABLE_NOS` 与
  `docs/algorithm/bifa-detect.md`）；可选 `nianMing` 输入启用年命类法（第 56 法等）
- **典籍**：多书语料库架构（`lrdq-ts-lib/docs` 子入口）——manifest 轻入口同步、
  各书 markdown 载荷按书分包懒加载；宿主典籍库并册按 `manifest[].book` 分组。
  首册《六壬大全》全书十三篇随包内置
- 纯 TS、零运行时依赖、ESM（dist 可被纯 Node / Vite / vitest 直接消费）

## 安装与使用

```bash
npm install github:hackninety/lrdq-ts-lib#v0.6.0
```

```ts
import { detectBifa, bifa, getBifaEntry } from 'lrdq-ts-lib';

const hits = detectBifa(chart); // chart 结构兼容 react-liuren 统一模型
// → [{ no: 7, name: '旺祿臨身', fu: '旺祿臨身徒妄作', certainty: 'exact', why: '日祿寅臨干上' }]

getBifaEntry(52); // 单条语料（含注文与附属格）
```

```ts
// 典籍库（v0.6.0 多书入口：manifest 轻量同步，载荷按书分包异步）
import { getDocsManifest, getDocMarkdown } from 'lrdq-ts-lib/docs';

getDocsManifest(); // 全库篇目（path 带书 slug 前缀，携 book/dynasty）
await getDocMarkdown('lrdq/book/juan07.md'); // 首次访问某书才拉取该书载荷 chunk
```

```ts
// 課經深度结构化（卷七~卷十，70 节；宿主课体深链用，惰性导入）
import { getKeJingEntry, findKeJing } from 'lrdq-ts-lib/keju';

getKeJingEntry('遥克'); // 折叠匹配（剋/克、繁简、「課」后缀）→ 遙克課全文
findKeJing(['元首', '三交']); // 含卷九三交課重出两节

// 神煞表结构化（卷一：歲/十天干/十二地支三表映射 + 月令杂列保守解析 + 逐月立成）
import { getShenShaSections, shenShaValue, monthlyAt, findMonthlyShenSha } from 'lrdq-ts-lib/shensha';

shenShaValue('日祿', '甲'); // ['寅']；规则条整行列存（rule 含原文）
monthlyAt('正月', '子'); // { zhi:'子', ji:['生氣','天醫',…], xiong:['災煞','吊客','天獄'] }
findMonthlyShenSha('天喜'); // 逐月落宫反查（正月戌、四月丑…与杂列「春戌夏丑」互证）
```

## 典籍篇目

| 篇 | 内容 | 处理 |
|---|---|---|
| 序 | 四庫全書總目提要 | 整卷典籍化 |
| 卷一 | 起例（入手法/九宗门口诀/神煞表） | 整卷典籍化 + 神煞**深度结构化**（`shensha.json`：三表映射 + 月令杂列保守解析 + **逐月立成 12月×12宫 1602 处落位**；總鈐盘图按红线列存不重构） |
| 卷二 | 神將釋（十二月将 + 十二天将各論） | 整卷典籍化（26 节） |
| 卷三/卷四 | 歌賦（括囊賦、雲霄賦等；卷四底本缺卷题行，已回退补题） | 整卷典籍化 |
| 卷五 | 兵占五十章（底本缺第三十六/四十一/四十三节题，如实保留） | 整卷典籍化（47 节） |
| 卷六 | 宿度分野 | 整卷典籍化 |
| 卷七~卷十 | 課經集一~四（元首課…物類課，70 课体） | 整卷典籍化 + **深度结构化**（`keju.json`，70 节含卷九三交課重出） |
| 卷十一/十二 | 《畢法賦》上下 | 深度结构化（bifa.json + 分法详解渲染） |

整卷典籍化只做高置信排版（卷题→H1、「…第X/…課/…論」等独行→小节标题、页衬行清理），
底本版面不臆断重构。

## 数据源

每书底本原件按书存档于 `docs/corpus/<slug>/{raw,text}`。首册《六壬大全》：
ctext.org wiki（res=260435）四庫全書本转录，13 页原件在 `docs/corpus/lrdq/`。
古籍原文为公有领域。

## 后续计划

见 `docs/Todo.md`（多书语料库升格路线、收录清单、逐月神煞结构化等）。
