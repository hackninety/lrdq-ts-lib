# lrdq-ts-lib

《六壬大全》（明·欽定四庫全書本）典籍库 与 宋·凌福之《畢法賦》百法命中检测引擎。

- **语料**：卷十一/十二《畢法賦》全量结构化 —— 百法（编号/格名/赋句/注文/204 附属格），
  底本笔误按序归正并记录 `textualIssues`
- **检测**：`detectBifa(chart)` 对排盘结果做毕法格局命中（首批 23 法，exact/approx 分级，
  详见 `docs/algorithm/bifa-detect.md`）
- **典籍**：`getDocsManifest()/getDocMarkdown()` 输出可渲染 markdown（与 zslj-ts-lib 同形，
  宿主典籍库可直接并册）
- 纯 TS、零运行时依赖、ESM（dist 可被纯 Node / Vite / vitest 直接消费）

## 安装与使用

```bash
npm install github:hackninety/lrdq-ts-lib#v0.1.0
```

```ts
import { detectBifa, bifa, getBifaEntry, getDocsManifest, getDocMarkdown } from 'lrdq-ts-lib';

const hits = detectBifa(chart); // chart 结构兼容 react-liuren 统一模型
// → [{ no: 7, name: '旺祿臨身', fu: '旺祿臨身徒妄作', certainty: 'exact', why: '日祿寅臨干上' }]

getBifaEntry(52); // 单条语料（含注文与附属格）
```

## 数据源

ctext.org wiki（res=260435）四庫全書本《六壬大全》转录，全书 13 页已存档于
`docs/book/raw`，本版处理卷十一/十二（畢法賦上下），其余卷待后续扩展。
古籍原文为公有领域。

## 后续计划

- 分批扩充检测覆盖（77 法待实现）
- 卷一~卷十（神将释/占法诸门）语料化
