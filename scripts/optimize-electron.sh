#!/bin/bash
# 清理脚本 - 用于优化 Electron 打包

set -e

echo "=== Electron 打包优化脚本 ==="
echo ""

# 1. 删除 .ignored 目录
if [ -d "electron/node_modules/.ignored" ]; then
    echo "[1/4] 删除 electron/node_modules/.ignored ..."
    rm -rf electron/node_modules/.ignored
    echo "      ✓ 已删除 (释放 ~294 MB)"
else
    echo "[1/4] .ignored 目录不存在，跳过"
fi

# 2. 使用 pnpm deploy 创建精简版 server
echo ""
echo "[2/4] 创建精简版 server (仅生产依赖)..."
if [ -d "electron/server-prod" ]; then
    rm -rf electron/server-prod
fi
pnpm --filter server deploy electron/server-prod --prod
echo "      ✓ 已创建 electron/server-prod"

# 3. 显示大小对比
echo ""
echo "[3/4] 对比大小..."
echo "      原始 server/node_modules: $(du -sh server/node_modules 2>/dev/null | cut -f1)"
echo "      精简 server-prod/node_modules: $(du -sh electron/server-prod/node_modules 2>/dev/null | cut -f1)"

# 4. 复制必要文件
echo ""
echo "[4/4] 复制 server/dist ..."
if [ -d "server/dist" ]; then
    cp -r server/dist electron/server-prod/
    echo "      ✓ 已复制 server/dist"
else
    echo "      ⚠ server/dist 不存在，请先运行 pnpm build"
    exit 1
fi

echo ""
echo "=== 优化完成 ==="
echo "现在可以运行: pnpm --filter electron pack"
