param(
  [Parameter(Mandatory = $true)]
  [string]$RepositoryUrl
)

$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot\..

if (-not (Test-Path .git)) {
  throw '当前目录还不是 git 仓库，请先初始化仓库。'
}

$existingRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $existingRemote) {
  git remote set-url origin $RepositoryUrl
} else {
  git remote add origin $RepositoryUrl
}

git branch -M main
git push -u origin main

Write-Host ''
Write-Host '代码已推送到 GitHub。' -ForegroundColor Green
Write-Host '接下来请到仓库 Settings > Pages，确认 Source 为 GitHub Actions。' -ForegroundColor Cyan
Write-Host '如果 workflow 首次未自动触发，可在 Actions 页面手动运行 Deploy to GitHub Pages。' -ForegroundColor Cyan
