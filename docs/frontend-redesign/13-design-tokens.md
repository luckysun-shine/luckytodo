# 13 设计 Token

方向：日间品牌与 logo 外框一致，使用青绿 `#4EB7AC`。中性色沿用现有日间灰，完成与成长用已有的绿色，不另做积分色。圆角保持现在的大圆角，阴影轻，动效短。

夜间 `[data-theme="night"]` 与纸色 `[data-theme="paper"]` 选择器保留，色值维持现状（强调色 `#2dd8fe`）。默认是 `data-theme="day"`。设置入口仍不在本轮。下表只锁定日间。

## 1. 色彩

日间写在 `#app` 上，名字尽量沿用现有变量，减少选择器改名。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#F5F6F8` | 页面底 |
| `--bg-elev` | `#FFFFFF` | 抬高的条、toast |
| `--surface` | `#FFFFFF` | 卡片 |
| `--task` | `#FFFFFF` | 待办行 |
| `--field` | `#F0F2F5` | 输入底 |
| `--chip` | `#EEF1F4` | 筛选未选中 |
| `--nav` | `#FFFFFF` | 底栏 |
| `--text` | `#1C1C1E` | 主文字 |
| `--text-soft` | `#1C1C1E` | 次文字 |
| `--muted` | `#8E8E93` | 说明、占位 |
| `--line` | `#E8EAED` | 分割与描边 |
| `--accent` | `#4EB7AC` | 主按钮、选中 Tab、链接，与 logo 外框同系 |
| `--accent-strong` | `#3A9E94` | 按下、强调文字 |
| `--on-accent` | `#FFFFFF` | 主按钮文字 |
| `--done` | `#3DBD7F` | 完成、打卡 |
| `--warn` | `#F5A524` | 待同步、提醒 |
| `--miss` | `#F34E4E` | 错误、高优先级 |
| `--shadow` | `0 8px 24px rgba(28, 28, 30, 0.06)` | 卡片 |
| `--overlay` | `rgba(0, 0, 0, 0.54)` | 抽屉遮罩 |

Logo 爪印的橙色只出现在标志里，不替换 `--accent`。启动闪屏底色 `#E5F5F2`，浏览器 `theme-color` 与 manifest 使用 `#4EB7AC`。

优先级沿用语义，不另做荧光色：高 `--miss`，中 `--accent`，低 `--done`。

计划卡四档仍叫 `amber`、`mint`、`coral`、`sky`，沿用现有低饱和色。热力继续表达打卡密度，不引入名次色。

主文字 `#1C1C1E` 在白色与 `#F5F6F8` 上对比足够。白色在 `#4EB7AC` 上大约 2.4:1，低于正文 4.5:1。主按钮保持白字配青绿，字号和字重沿用现在的大按钮，不把品牌色改深来凑对比度。`--muted` 只用于辅助说明，不单独承载错误信息。

状态栏前景用深色图标（现有 `StatusBar` style `DARK` 表示深色内容）。Capacitor Splash 背景与启动页同为 `#E5F5F2`。

## 2. 字体与字号

继续 `Plus Jakarta Sans` 与 `Noto Sans SC`，中文回退 `PingFang SC`。第一批可以仍用 `index.html` 的 Google Fonts 链接。自托管字体不在本规格的实现批次里。

| Token | 值 |
| --- | --- |
| `--font-display` | `"Plus Jakarta Sans", "Noto Sans SC", sans-serif` |
| `--font-body` | `"Plus Jakarta Sans", "Noto Sans SC", "PingFang SC", sans-serif` |
| `--text-xs` | `0.75rem` |
| `--text-sm` | `0.875rem` |
| `--text-md` | `1rem` |
| `--text-lg` | `1.15rem` |
| `--text-xl` | `1.5rem` |

正文 16px，行高 1.45。标题用 display 字重 700–800，字距略紧。大字号 `[data-font="large"]` 保持 17.5px，仍无设置项。

## 3. 间距、圆角、尺寸

| Token | 值 | 说明 |
| --- | --- | --- |
| `--space-1` … `--space-6` | `4 / 8 / 12 / 16 / 24 / 32px` | 已存在，保持 |
| `--radius-sm` | `12px` | 输入、小按钮 |
| `--radius-md` | `20px` | 卡片、按钮 |
| `--radius-lg` | `24px` | 大卡片 |
| `--radius-xl` | `28px` | 底栏、抽屉顶 |
| `--radius-pill` | `999px` | 筛选、头像 |
| `--tap` | `48px` | 主按钮最小高度 |
| `--tap-icon` | `44px` | 图标按钮 |

页面水平内边距手机 `--space-4`，宽屏内容区 `--space-5`。区块间距 `--space-5`。

## 4. 动效

`--ease: cubic-bezier(0.16, 1, 0.3, 1)` 保留。页面进入 280–350ms，只做透明度与 8px 位移。抽屉 320ms。勾选用颜色和描边变化，不超过 180ms。

`prefers-reduced-motion: reduce` 已把动画压到极短，保持。完成时只在原生调用 `lightTap`，不播庆祝动画。

## 5. 主题切换

默认日间青绿。`night` 与 `paper` 的选择器保留，已写入 `lt_theme` 的浏览器仍能套上对应变量。设置页不在本轮出现。

## 6. 落地对照

| 项 | 内容 |
| --- | --- |
| 对应模块 | `styles.js` 的 `:root` 与 `#app` 日间变量；`applyChrome` 的 `theme-color`；启动闪屏内联样式 |
| 改动文件 | `apps/web/src/styles.js`、`apps/web/index.html`、`apps/web/public/manifest.webmanifest`。原生闪屏色可选 `capacitor.config.json` |
| 数据层 | 不影响 |
| 验证 | 日间主按钮与顶栏添加按钮为 `#4EB7AC`，页面底为 `#F5F6F8`；`data-theme="night"` 与 `data-theme="paper"` 仍覆盖强调色；焦点环使用 `--accent` |

实现时先改变量值，再替换散落的十六进制。不要在同一批重写选择器结构。
