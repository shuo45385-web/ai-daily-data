# ai-daily-data

每日开源 AI 精选的数据仓库。GitHub Actions 每天北京时间 08:10 自动从 GitHub 的活跃开源 AI 项目中筛选 10 个项目，写入 `data/yyyy-MM-dd.json`，个人系统从这里同步。

每个文件保留既有的 `date`、`title`、`projects` 和 `sources` 字段；项目包含排序、分类、简介、部署方式、许可证和链接，并额外补充 GitHub 星标、语言、主题及更新时间等元数据。

可在仓库的 **Actions → Generate daily AI projects → Run workflow** 手动补跑；同日期文件默认不会被覆盖，勾选 `force` 才会重新生成。
