#!/usr/bin/env pwsh
# Electron 打包优化脚本 (Windows)
# 功能：
# 1. 删除 .ignored 目录
# 2. 使用 pnpm deploy 创建精简版 server（仅生产依赖）
# 3. 更新 electron-builder.yml 使用精简版 server
# 4. 对比优化前后大小

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "=== Electron 打包优化脚本 ===" -ForegroundColor Cyan
Write-Host "项目根目录: $root" -ForegroundColor Gray
Write-Host ""

# 步骤 1: 删除 .ignored 目录
Write-Host "[1/5] 检查并删除 .ignored 目录..." -ForegroundColor Yellow
$ignoredPath = "electron/node_modules/.ignored"
if (Test-Path $ignoredPath) {
    $sizeBefore = (Get-ChildItem $ignoredPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Remove-Item -Path $ignoredPath -Recurse -Force
    Write-Host "      ✓ 已删除 .ignored (释放 $($sizeBefore.ToString('N0')) MB)" -ForegroundColor Green
} else {
    Write-Host "      ✓ .ignored 目录不存在或已删除" -ForegroundColor Green
}

# 步骤 2: 确保 server 已构建
Write-Host ""
Write-Host "[2/5] 检查 server/dist..." -ForegroundColor Yellow
if (-not (Test-Path "server/dist")) {
    if ($SkipBuild) {
        Write-Host "      ✗ server/dist 不存在，请先运行 pnpm build" -ForegroundColor Red
        exit 1
    }
    Write-Host "      ! server/dist 不存在，开始构建..." -ForegroundColor Yellow
    pnpm build
}
Write-Host "      ✓ server/dist 存在" -ForegroundColor Green

# 步骤 3: 创建精简版 server (仅生产依赖)
Write-Host ""
Write-Host "[3/5] 创建精简版 server (仅生产依赖)..." -ForegroundColor Yellow
$prodServerPath = "electron/server-prod"

# 清理旧的
if (Test-Path $prodServerPath) {
    Write-Host "      清理旧的 server-prod..." -ForegroundColor Gray
    Remove-Item -Path $prodServerPath -Recurse -Force
}

# 创建临时目录进行打包
$tempPackDir = "electron/.temp-pack"
if (Test-Path $tempPackDir) {
    Remove-Item -Path $tempPackDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempPackDir -Force | Out-Null

# 使用 pnpm pack 打包，然后解压（这样得到的是实际文件而非软链接）
try {
    Set-Location server
    pnpm pack --pack-destination "../electron/.temp-pack" | Out-Null
    Set-Location ..

    # 找到生成的 tarball
    $tarball = Get-ChildItem "electron/.temp-pack/*.tgz" | Select-Object -First 1
    if (-not $tarball) {
        throw "打包失败：未找到 tarball"
    }

    # 解压到目标目录
    New-Item -ItemType Directory -Path $prodServerPath -Force | Out-Null
    tar -xzf $tarball.FullName -C $prodServerPath --strip-components=1

    # 安装生产依赖（使用 npm 安装实际文件）
    Set-Location $prodServerPath
    npm install --omit=dev --no-audit --no-fund --silent 2>$null
    Set-Location ../..

    # 清理临时文件
    Remove-Item -Path $tempPackDir -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "      ✓ 已创建 $prodServerPath" -ForegroundColor Green
} catch {
    Write-Host "      ✗ 创建失败: $_" -ForegroundColor Red
    Set-Location $root
    exit 1
}

# 步骤 4: 复制 dist 到精简版 server
Write-Host ""
Write-Host "[4/5] 复制 server/dist 到精简版目录..." -ForegroundColor Yellow
if (Test-Path "server/dist") {
    Copy-Item -Path "server/dist" -Destination "$prodServerPath/dist" -Recurse -Force
    Write-Host "      ✓ 已复制 dist" -ForegroundColor Green
} else {
    Write-Host "      ✗ server/dist 不存在" -ForegroundColor Red
    exit 1
}

# 步骤 5: 对比大小
Write-Host ""
Write-Host "[5/5] 优化效果对比..." -ForegroundColor Yellow

$originalSize = 0
$prodSize = 0

if (Test-Path "server/node_modules") {
    $originalSize = (Get-ChildItem "server/node_modules" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
}
if (Test-Path "$prodServerPath/node_modules") {
    $prodSize = (Get-ChildItem "$prodServerPath/node_modules" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
}

Write-Host ""
Write-Host "=== 优化效果 ===" -ForegroundColor Cyan
Write-Host "原始 server/node_modules:     $($originalSize.ToString('N0')) MB"
Write-Host "精简 server-prod/node_modules: $($prodSize.ToString('N0')) MB"
Write-Host "节省空间:                     $([math]::Round($originalSize - $prodSize, 1)) MB ($([math]::Round(($originalSize - $prodSize) / $originalSize * 100, 1))%)"
Write-Host ""

# 更新 electron-builder.yml
Write-Host "=== 更新 electron-builder.yml ===" -ForegroundColor Cyan
$builderConfig = @"
appId: com.hz.cc-flow
productName: "HZ CC Flow"
copyright: "Copyright © 2024 HZ"

files:
  - dist/**/*
  - "!dist/**/*.map"

# 使用精简版 server-prod 替代完整 server
extraResources:
  - from: "server-prod"
    to: "server"
    filter:
      - "**/*"
      - "!**/.cache/**"
      - "!**/.pnpm/**"

directories:
  output: "dist/release"
  buildResources: "assets"

win:
  target:
    - target: nsis
      arch:
        - x64
  signtoolOptions:
    signingHashAlgorithms: []

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: "HZ CC Flow"

mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
    - target: zip
      arch:
        - x64
        - arm64
  identity: null
  gatekeeperAssess: false
  hardenedRuntime: false

linux:
  target:
    - target: AppImage
      arch:
        - x64
    - target: deb
      arch:
        - x64
  category: Development
  maintainer: "HZ"

# 重建原生模块（node-pty）
afterPack: "scripts/rebuild-native.js"

asar: true
asarUnpack:
  - "**/*.node"
"@

$builderConfig | Out-File -FilePath "electron/electron-builder.yml" -Encoding utf8
Write-Host "      ✓ 已更新 electron/electron-builder.yml" -ForegroundColor Green
Write-Host ""

Write-Host "=== 优化完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "现在可以运行打包命令:" -ForegroundColor Cyan
Write-Host "  cd electron" -ForegroundColor Yellow
Write-Host "  pnpm pack" -ForegroundColor Yellow
Write-Host ""
Write-Host "或完整命令:" -ForegroundColor Cyan
Write-Host "  pnpm --filter electron pack" -ForegroundColor Yellow
