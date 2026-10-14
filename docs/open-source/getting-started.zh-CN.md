# 中文使用指南

[打开可编辑示例](https://decksprig-kens-toolbox.netlify.app/app?demo=1) · [视频与演示](https://decksprig-kens-toolbox.netlify.app/demo.html) · [English guide](getting-started.md)

## 第一份文稿

建议使用桌面浏览器。示例链接会新建三页文稿，不替换已有文稿。阅读并关闭导入报告后即可编辑；刷新会重新打开同一份副本。

回到编辑器首页，**Choose a template** 选择模板，**Start blank** 创建空白，**Try sample** 打开示例。**Create with AI** 需要自行连接提供商，普通编辑可以直接使用。模板中的文字和数据为虚构示例，需要替换成自己的内容。

## 编辑与演示

1. 在顶部文稿名输入框重命名。
2. 在幻灯片列表选择一页；选中文字并点击 Edit text，或双击文字编辑，点击外部结束。分组对象可能需要再点击一次才能选中内部对象。
3. 选中对象后使用右侧属性调整排版、尺寸和外观；插入工具支持文字、图片、形状、表格和图表。
4. **Document menu → Undo** 撤销。桌面快捷键为 Command/Control+Z 撤销，Shift+Command/Control+Z 重做。点击文字外部或 Command/Control+Enter 完成文字编辑，Escape 取消当前文字编辑。
5. **Present** 进入演示，箭头前进，Escape 返回。隐藏页仍可编辑，演示时跳过。

关闭窗口前，等待保存提示结束。**Open document library** 查看当前浏览器或本地安装的已保存文稿。出现保存错误时保留原窗口，并使用恢复或导出操作。

## 备份与分享

打开 **Document menu → Export document**：

- **Deck file**（`.deck.json`）：完整可编辑备份，包含媒体、来源、备注和隐藏页；重新导入会创建新文稿。
- **PowerPoint**（`.pptx`）：受支持的可编辑对象，在 PowerPoint 中复核字体、图表和效果。
- **Web page**（`.html`）：可在浏览器打开的独立演示，包含动效；远程图片或原型可能仍需联网。
- **PDF**：使用浏览器打印功能，选择另存为 PDF；不同浏览器的选项可能不同。

分享前检查备注、隐藏页、来源链接和内嵌媒体。Deck 与 PowerPoint 包含隐藏页，PDF 与网页演示只使用可见页。浏览器间及在线/本地版不会自动同步；清理网站数据前导出 Deck。本地迁移时先停止应用，再备份 `.data/`。

## 导入与常见问题

**Import document** 选择文件，或将支持的文件拖到画布。导入会创建新文稿，完成后阅读导入报告并复核页面。

| 问题 | 处理方式 |
| --- | --- |
| `node` 不存在 | 安装 Node.js 22.14 或更新版本，重新打开终端 |
| 4310 被占用 | 停止之前的 Decksprig 服务，保留 `.data/`，只运行一份实例 |
| 文稿在另一台设备消失 | 数据保存在原浏览器/安装中，导入之前导出的 Deck 文件 |
| PPTX 字体或效果不同 | 在目标软件安装有许可的字体并查看转换警告 |
| PDF 不是完全可编辑 | PDF 以参考画面和文字提取为主，这是当前限制 |
| 在线无法导入 Keynote | 在 Keynote 导出 PPTX/PDF，或使用装有 Keynote 的本地 Mac 版 |
| 压缩文件被拒绝 | 从原软件重新导出更小的 PPTX/PDF；上限为输入 100 MB、15,000 项、单项展开 40 MB、总展开 256 MB，不接受不安全、加密和 ZIP64 包 |
| AI/云服务连接失败 | 检查凭证和浏览器访问限制，或用本地版；手动编辑无需连接 |
| 保存失败 | 保持窗口、导出备份并使用恢复；报告问题时使用虚构复现 |

进阶阅读：[连接配置](connections.md)、[自托管](self-hosting.md)、[隐私](../../PRIVACY.md)、[素材许可](../../ASSET_LICENSES.md)、[问题反馈](https://github.com/Ken-pan/decksprig/issues)。
