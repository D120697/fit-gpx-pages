# FIT → GPX 转换器

一个可直接部署到 GitHub Pages 的静态网站：

- 浏览器本地解析 `.fit`
- 导出标准 `.gpx`
- 支持将 `GCJ-02` / `BD-09` 转成 `WGS84`
- 不需要后端，适合个人项目或公开仓库快速上线
- 用于解决迈金fit导入strava后路线偏移问题
- 
## 本地开发

1. 安装依赖：`npm install`
2. 启动开发：`npm run dev`
3. 构建发布包：`npm run build`

## 站点功能

- FIT 文件上传 / 拖拽
- FIT 轨迹点解析
- 中国坐标转国际坐标（WGS84）
- GPX 下载
- 点数、距离、开始 / 结束时间摘要展示

## 部署到 GitHub Pages

### 方式一：推荐（已内置 GitHub Actions）

仓库里已经包含 `.github/workflows/deploy.yml`。

你只需要：

1. 把本项目推到 GitHub 仓库默认分支 `main`
2. 进入 GitHub 仓库设置 `Settings > Pages`
3. 在 `Build and deployment` 中选择 `GitHub Actions`
4. 推送一次代码或手动运行工作流

部署成功后，GitHub 会自动生成 Pages 网址。

### 方式二：手动部署

也可以在本地执行构建，然后把 `dist/` 发布到任意静态托管平台。

## 技术栈

- Vite
- TypeScript
- fit-file-parser
- gcoord

## 注意事项

- Garmin / Apple Watch 等原始 FIT 通常本来就是 `WGS84`
- 若轨迹点来自高德 / 腾讯地图，请选择 `GCJ-02`
- 若轨迹点来自百度地图，请选择 `BD-09`
- 若 FIT 文件没有 GPS 点（例如跑步机训练），无法导出有效 GPX 轨迹
