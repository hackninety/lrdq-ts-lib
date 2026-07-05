# react-liuren 接入指南 —— 《畢法賦》命中插件 + 典籍并册

## 1. 安装

```bash
npm install github:hackninety/lrdq-ts-lib#v0.9.0
# 本地开发：npm install file:../lrdq-ts-lib
```

## 2. 毕法命中插件 `src/plugins/bifa.ts`

`detectBifa` 的输入与统一模型 `LiuRenChart` 结构兼容，直接传入即可：

```ts
import { detectBifa } from 'lrdq-ts-lib';
import type { LiuRenPlugin } from './types';

export const bifaPlugin: LiuRenPlugin = {
  id: 'bifa',
  title: '毕法赋',
  description: '《畢法賦》百法格局命中（六壬大全卷十一/十二）',
  compute(chart) {
    const hits = detectBifa(chart);
    return hits.length ? hits : undefined; // 挂 extras.bifa
  },
};
```

在 `plugins/index.ts` 注册后，UI（如 SanChuanPanel）读取 `chart.extras.bifa`
渲染命中列表（`{no,name,fu,certainty,why}[]`）。

## 3. 典籍库并册

**v0.6.0 多书升格**：manifest 携 `book/dynasty`（分组身份从前端下沉到数据），
`getDocMarkdown` 变**异步**（载荷按书分包，首次访问某书才拉取该书 chunk）。
宿主抽屉分组读 `manifest[].book`；zslj 等无 book 字段的库用 SOURCES 兜底标签：

```ts
import * as zslj from 'zslj-ts-lib';
import * as lrdq from 'lrdq-ts-lib/docs'; // 注意子入口

const SOURCES = [
  { lib: 'zslj', bookFallback: '占事略決', getManifest: zslj.getDocsManifest,
    getMd: async (p: string) => zslj.getDocMarkdown(p) }, // 同步库包一层
  { lib: 'lrdq', bookFallback: '六壬大全', getManifest: lrdq.getDocsManifest,
    getMd: lrdq.getDocMarkdown }, // 已是异步
];
// 分组：doc.book ?? source.bookFallback；key 用 `${lib}:${path}` 防路径冲突
```

## 3.5 课体課經原文深链（v0.4.0+）

三传面板的课体/课体细分名可深链《課經》原文。**动态导入**保持主包干净：

```ts
const names = [chart.sanChuan.keTi, chart.sanChuan.method, ...subTypes];
const { findKeJing } = await import('lrdq-ts-lib/keju'); // 独立 chunk
const entries = findKeJing(names); // 折叠匹配（剋/克、繁简、課后缀）
```

神煞映射同理走 `lrdq-ts-lib/shensha`（`shenShaValue('日祿','甲') → ['寅']`）。

## 4. MD 导出

`chartToMarkdown` 增加「毕法命中」段：`- 第N法 {fu}（确判/近似）— {why}`。

## 注意

- 检测覆盖为首批 23 法（见 `docs/algorithm/bifa-detect.md`），其余以语料收录，
  UI 建议标注「首批 23/100」以免误解为全量判定
- 毕法为明清通行体系断法汇编，与占事略決古法体系相互独立；对占事略決引擎的
  盘面命中仅供跨流派参考
