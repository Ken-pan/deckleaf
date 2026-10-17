# Decksprig 使用指南

[直接试用](https://decksprig.kens-toolbox.com/app?demo=1) · [观看演示](https://decksprig.kens-toolbox.com/demo.html) · [English](getting-started.md) · [AI 提问示例](prompt-examples.zh-CN.md)

做幻灯片、预览、导出，不需要账号或 API key。建议先用电脑浏览器，界面目前为英文。

## 五分钟完成第一份文稿

1. **打开示例。** 点击上方「直接试用」，会创建三页副本，不替换已有文稿。阅读并关闭 **Import report**（导入报告）。
2. **改标题。** 点击顶部文稿名，输入自己的名称，按 Enter。
3. **改内容。** 在幻灯片列表选一页，双击文字编辑；点击文字外部完成。选中图片或形状，在属性面板调整大小、位置和外观。
4. **看效果。** 点击 **Present**（演示），用方向键前进，按 Escape 返回。
5. **留备份。** 打开 **Document menu → Export document → Deck file**，下载可继续编辑的 `.deck.json`。

编辑会自动保存。关闭窗口前，等「Saving…」提示结束；出现「Not saved」时先保留窗口并导出备份。

## 常用操作在哪里

| 我想…… | 这样做 |
| --- | --- |
| 创建自己的文稿 | 首页选择 **Choose a template**（模板）或 **Start blank**（空白） |
| 打开已有文稿 | 点击左上角标志打开 **Document library**（文稿库） |
| 找不到某个功能 | 点击 **Search**，输入英文功能名，例如 `Import document` |
| 添加内容 | 使用画布工具栏；表格、图表等可通过 Search 查找 |
| 修改分组里的文字 | 先选中分组，再点击其中的对象；双击文字编辑 |
| 撤销 / 重做 | **Document menu → Undo / Redo**；电脑上用 ⌘/Ctrl+Z、⇧+⌘/Ctrl+Z |
| 隐藏一页 | 打开该页的菜单，选择 **Hide slide**；内容保留，演示时跳过 |
| 导入文件 | Search 搜索 **Import document**，选择文件；导入后会新建文稿 |
| 手机上调整对象 | 点击选中对象，打开编辑面板；完成后返回画布 |

模板里的文字、数字和图表是示例内容，分享前换成自己的资料。

## 导出选哪个

在 **Document menu → Export document** 中选择：

| 用途 | 格式 | 需要知道 |
| --- | --- | --- |
| 备份、换设备、以后继续编辑 | **Deck file** · `.deck.json` | 保留媒体、来源信息、备注和隐藏页；重新导入会新建副本 |
| 交给 PowerPoint 用户 | **PowerPoint** · `.pptx` | 支持可编辑对象；交付前在 PowerPoint 检查字体、图表和效果 |
| 发给别人用浏览器演示 | **Web page** · `.html` | 可直接打开；使用远程图片、字体或原型时仍可能需要联网 |
| 发静态阅读稿 | **PDF** | 在浏览器打印窗口选择「另存为 PDF」 |

Deck 与 PowerPoint 保留隐藏页，PDF 和网页演示使用可见页。分享前检查备注、来源链接和内嵌媒体。

## 用 AI 帮忙

1. 在 **Settings → More settings → AI models → Connect provider** 配置自己的提供商和模型；API key 只用于当前会话。
2. 在 AI 面板选定修改范围：选中对象、当前页或全部页面。
3. 说明「改什么、保留什么、做成什么样」。例如：「只把这一页的标题缩短到 15 字以内，保留数字和来源，其他对象不变。」
4. 查看修改提案；满意后选择 **Apply changes**。不满意可以继续调整或丢弃，应用后仍可撤销。

AI 需要自己的服务配置。相关内容会发送给你选择的提供商。不要在提示词中粘贴 API key。更多可复制的写法见 [AI 提问示例](prompt-examples.zh-CN.md)；外部 AI 接入见 [AI / MCP 指南](agent-guide.md)。

## 文稿保存在哪里

- **在线版：** 保存在当前浏览器、当前网站地址中，不会自动同步到另一台电脑、浏览器或域名。
- **本地版：** 文稿、历史和导入原件保存在安装目录的 `.data/`；浏览器另有恢复草稿。
- **换设备或清理浏览器：** 先导出 Deck 文件，再到新环境导入。本地迁移还需停止应用并备份 `.data/`。
- **从旧地址迁移：** 在[旧地址](https://deckleaf-kens-toolbox.netlify.app/app)导出 Deck，再到新地址导入。[迁移说明](name-change.md)

## 本地安装（可选）

安装 Node.js 22.14 或更新版本和 Git，然后运行：

```sh
git clone https://github.com/Ken-pan/decksprig.git
cd decksprig
npm ci
npm run dev
```

打开 `http://127.0.0.1:4310/`，保持终端运行。在线版与本地版的文稿库相互独立。

## 常见问题

| 情况 | 处理方式 |
| --- | --- |
| 换浏览器后找不到文稿 | 回到原浏览器、原地址导出 Deck，再导入新环境 |
| 保存失败 | 保留原窗口，先导出备份，再使用提示中的恢复操作；不要清理网站数据 |
| 导入后和原文件不同 | 查看 Import report，逐页核对；复杂字体、图表和效果可能变化 |
| PDF 不能像 PPT 一样编辑 | PDF 主要提供参考画面和提取文字，不是完整可编辑重建 |
| 在线打不开 Keynote | 先在 Keynote 导出 PPTX/PDF，或使用装有 Keynote 的本地 Mac |
| AI 无法连接 | 检查模型、凭证和提供商的浏览器访问支持；也可尝试本地版 |
| 4310 端口被占用 | 停止之前的 Decksprig 实例，保留数据，再启动一份 |
| PPTX / Keynote 包被拒绝 | 重新导出更小的文件；限制为输入 100 MB、15,000 项、单项展开 40 MB、总展开 256 MB，不支持不安全、加密和 ZIP64 包 |

[连接配置](connections.md) · [自托管](self-hosting.md) · [隐私](../../PRIVACY.md) · [反馈问题](https://github.com/Ken-pan/decksprig/issues)
