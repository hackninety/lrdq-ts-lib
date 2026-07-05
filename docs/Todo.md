# lrdq-ts-lib · 语料库扩建 Todo

> **定位变更**：本库自 v0.2.0 的《六壬大全》单书库，升格为 **大六壬典籍语料库**。
> `detectBifa` 毕法引擎保留（《畢法賦》本即大全语料），`lrdq-ts-lib/docs` 子入口
> 聚合多部公有领域大六壬典籍；宿主 react-liuren 典籍抽屉多书并册。
>
> 调研结论：GitHub 无专门六壬语料库 repo（高星项目全是排盘引擎/app），原文须自采于
> 通用古籍数字化源。故"逐书手工典籍化"是当前唯一可行路径，本库即承此角色。

---

## 0. 基线（已完成，勿重复造）

- **语料**：《六壬大全》四庫全書本 13 篇（序 + 卷一~卷十二），《畢法賦》百法深度结构化
  （`bifa.json`，含 204 附属格，底本笔误按序归正记 `textualIssues`）
- **引擎**：`detectBifa` 首批 23/100 法（exact/approx 分级）
- **管线**：`docs/book/text/*.txt`（ctext res=260435 转录）→ `scripts/gen-data.mjs`
  → `src/data/{bifa,docs}.json` → `scripts/build.mjs`（tsc + `fixEsmImports`）→ `lrdq-ts-lib/docs` 子入口
- **manifest 项**：`DocMeta = {path, title, group}`，`group ∈ {book, algorithm}`
- **原件存档**：`docs/book/{raw,text}`

---

## 1. 升格重构（🚧 阻塞项 —— 第二部书进来前必须先做）

现管线全部硬编码大全：`BOOK_PAGES` 数组、`TITLE_RE = /^六壬大全[卷巻]/`、`PROVENANCE`、
`SECTION_RES` 均为大全专用；"是哪部书"的身份现在来自**前端 `TypikonDrawer.SOURCES` 的
`book:` 标签**（一库一书），而非 manifest。多书前需：

| # | 改动 | 位置 | 说明 |
|---|---|---|---|
| 1 | 目录分书 | `docs/book/*` → `docs/corpus/<slug>/{raw,text}` | 大全迁 `corpus/lrdq/`；每书独立底本存档 |
| 2 | **manifest 加 `book`** | `src/types.ts` `DocMeta` | 增 `book`（典籍名）+ 可选 `dynasty/author`。**"是哪部书"必须从前端 SOURCES 下沉到 manifest**，否则新书全被标成"六壬大全" |
| 3 | gen-data 书注册表 | `scripts/gen-data.mjs` | 抽出 `CORPUS = [{slug, book, titleRe, sectionRes, provenance, level}]` 循环产出；毕法深度结构化保留为大全专属分支 |
| 4 | 前端按书分组 | react-liuren `src/components/TypikonDrawer.tsx` | 抽屉分组改读 `manifest[].book`；`getDocMarkdown` 仍按 lib 路由，`key = ${lib}:${path}` 不变 |
| 5 | **按书分包** | `package.json` exports / docs 子入口 | 单书 docs.json 已 ~1MB，多书须 code-split（`lrdq-ts-lib/docs/<slug>` 子路径，或 manifest-only 入口 + 按篇懒取），避免开抽屉即拉全部语料 |
| 6 | 元信息 | `package.json` / `README.md` / `INTEGRATION.md` | description/keywords 改语料库口径；`lrdq` 包名沿用（仅作 id，不改） |

**开放决策 —— 毕法引擎去留**：建议**留在本库**（毕法赋即大全语料，`detectBifa` 与
`getBifaEntry` 共用 `bifa.json`，且 react-liuren `src/plugins/bifa.ts` 已依赖）。若坚持"纯语料库"，
可另拆 `lrdq-bifa` 引擎包——但当前无必要。

---

## 2. 收录清单（优先级 × 与现有功能协同度）

标注：✅ 已有　📝 你已点名　➕ 建议新增

### 🔴 T1 · 核心底座 / 高协同（先收）

| 典籍 | 时代 · 作者 | 收录理由 / 协同点 | 状态 | 底本来源 |
|---|---|---|---|---|
| **六壬心镜** | 唐 · 徐道符 | 现存最早成体系专著，古法总纲；与 zslj《占事略決》成"古法双璧" | 📝 | 维基文库 / 大全课经已引 |
| **大六壬探原** | 民国 · 袁树珊 | 结构最清晰的入门体系书，最易典籍化，可作全库"导读总纲" | ➕ | 民国铅印本（公有领域） |
| **毕法案录** | 清 · 纪大奎 | **每条毕法配占例**——直接给本库 `detectBifa`/`getBifaEntry` 做"经典案例"深链，协同最高 | ➕ | 续修四库 / 书格扫描 |
| **大六壬指南（壬归）** | 清 · 陈公献 | 占验派最重要，分类占例极多 | 📝 | 维基文库 / ctext |

### 🟠 T2 · 占例 / 占验集（丰富断辞素材）

| 典籍 | 时代 · 作者 | 说明 | 状态 |
|---|---|---|---|
| **六壬断案** | 题宋 · 邵彦和 | 断例鼻祖，医案式占例 | 📝 |
| **六壬集应钤** | 明（题佚名） | 大型分类占例钤，断辞素材库（体量大，按类分节） | ➕ |
| **大六壬类阐** | 清 · 张官德 | 义理 + 占例并重 | ➕ |
| **六壬视斯（眎斯）** | 清 · 叶悔亭 | 占验 | ➕ |
| **大六壬占验** | 清抄本 | 占例集 | 📝 |
| **壬占汇选** | 清辑 | 分类占例 | 📝 |

### 🟢 T3 · 歌赋 / 义理 / 注疏

| 典籍 | 时代 · 作者 | 状态 |
|---|---|---|
| **六壬粹言** | 清 · 刘赤江辑 | 📝 |
| **六壬直指** | 清（一说陈公献别本） | 📝 |
| **六壬说约** | 清 | 📝 |
| **六壬神定经** | 宋（景祐本 · 题邵彦和） | 📝 |
| 六壬辨疑 / 六壬统宗 / 六壬明镜 | 明清 | ➕（备选） |

### ⚪ 自成体系（单列，勿并入大六壬册）

| 典籍 | 说明 |
|---|---|
| **六壬神课金口诀** | 明流行（题孙膑）。react-liuren 已有独立金口诀引擎（`src/engines/jinkoujue`）；若收原文须**单列一"书"并标注"非月将加时体系"**，避免与大六壬盘读者混淆 |
| **占事略決** | ✅ 已在 `zslj-ts-lib`（带唐/敦煌古法引擎，**保持独立库**，与本库同形并册） |

---

## 3. 每部书落库模板（照此逐书执行）

1. **定底本**：优先维基文库（已校）→ ctext → 书格/国学大师扫描（需 OCR + 校对）；
   记录 res/url 与版本到该书 `raw/` 出处说明
2. **转录**：整书原件存 `docs/corpus/<slug>/raw`（HTML/图），提取稿存 `text/*.txt`（按卷/章分文件，命名 `NN-<节>.txt`）
3. **配置**：在 `gen-data.mjs` 的 `CORPUS` 注册该书 `{slug, book, titleRe, sectionRes, provenance, level:'整卷'|'深结构'}`
4. **生成**：`npm run gen`，核对 manifest 篇数 / 小节数；转录笔误按序位归正并记 `textualIssues`，**不臆改原字**
5. **校对**：繁体保留、繁简不混；底本版面（盘式图、神煞表行）保持原行原序，不重构；通读一遍
6. **验证**：`npm test`；前端抽屉核对 `book` 分组与站内 `.md` 链接跳转
7. **发版**：bump version，更新 `README.md` 篇目表 + `INTEGRATION.md`，打 tag；react-liuren 依赖切新 tag

---

## 4. 数据源与版权

- **公有领域截止**：清及以前无虞；民国印本须作者殁逾 50 年（袁树珊 1881–1968，已过，可收）
- **首选源**：维基文库 `zh.wikisource.org`（校对最好）、`ctext.org`（结构化）；
  扫描源 书格 `shuge.org` / 国学大师 `guoxuedashi.net`（需 OCR 校对）；殆知阁语料做粗校打底
- **🚫 勿收**：近现代仍在版权期著作（徐伟刚《大六壬预测学》等）
- 每书 `raw/` 保留出处 url/res，便于复核与再校

---

## 5. 质量红线（承 gen-data 现口径）

- 底本不臆断重构：盘式图、神煞表行保持原行原序
- 转录笔误按序位归正 + 记 `textualIssues`，**不静默改字**
- 繁体原文，繁简统一不混用
- 结构化分级：占例集 / 歌赋只做**整卷典籍化**（高置信排版：卷题→H1、独行小节题→H2、页衬行清理）；
  仅《畢法賦》一类强结构文本做**深度结构化**
