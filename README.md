# FPGA 面试默写

本地桌面程序：先默写答案，再对照参考答案，用「不会 / 模糊 / 掌握」安排下次复习。内置手册题库，也可从 PDF / TXT / MD 文档让模型出题后勾选加入。

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/` | 界面、间隔复习、存储与测试 |
| `electron/` | Electron 主进程、预加载、文档出题 |
| `bank/` | 题库 JSON 与从手册抽取的脚本 |
| `scripts/` | 打包更新脚本 |
| `release/` | 可直接运行的便携版 exe |

`package.json`、`vite.config.ts`、`index.html` 留在项目根目录，供 Vite / Electron 使用。双击根目录的 `更新软件.bat` 会调用 `scripts/update-app.ps1`。

学习进度和 API 密钥只存在这台电脑的用户目录（Windows 上一般是 `%APPDATA%\FPGA面试默写\` 或 `%APPDATA%\fpga-quiz\`），不会写入题库文件，也不提交到 Git。

## 使用

- 运行已打包程序：打开 `release/` 里的 exe。
- 开发：在本目录执行 `npm install`，再 `npm run desktop`。
- 跑测试：`npm test`。
- 更新 exe：先关掉默写窗口，再运行 `更新软件.bat`（或 `npm run update`）。脚本会结束残留进程，在本机临时目录打包，再只把便携版 exe 拷回 `release/`，避免占用 `release/win-unpacked`。

出题与答题分析需要在「API 设置」里选择厂商、该厂开放的模型版本，并填写密钥。
