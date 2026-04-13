# 发布说明

项目目录：`e:\VScode\ai\fit-gpx-pages`

## 已完成内容

- 站点代码已完成
- `npm run build` 已验证通过
- GitHub Pages workflow 已配置：`.github/workflows/deploy.yml`
- 本地 git 仓库已初始化并完成首个提交

## 还差什么

由于当前环境未登录 GitHub，无法直接替你创建远端仓库并推送代码。

## 最快发布方式

### 1. 在 GitHub 创建一个空仓库

例如仓库名：`fit-gpx-pages`

### 2. 运行推送脚本

在 PowerShell 中进入项目目录后执行：

`./scripts/publish-github.ps1 -RepositoryUrl https://github.com/<你的用户名>/<你的仓库名>.git`

### 3. 打开 GitHub Pages

进入仓库：

- `Settings`
- `Pages`
- `Build and deployment`
- 选择 `GitHub Actions`

### 4. 等待部署完成

首次推送后，GitHub Actions 会执行：

- 安装依赖
- 构建站点
- 发布 `dist/` 到 Pages

## 本地开发

- 启动开发：`npm run dev`
- 生产构建：`npm run build`

## 访问效果

站点支持：

- 上传 FIT 文件
- GCJ-02 / BD-09 转 WGS84
- 导出 GPX
- 结果摘要展示
