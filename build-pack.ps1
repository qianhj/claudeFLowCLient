$ErrorActionPreference = "Stop"

Write-Host "[1/6] npm install server..." -ForegroundColor Cyan
Set-Location "d:\fufan-cc-flow-src\server"
npm install
if ($LASTEXITCODE -ne 0) { throw "server npm install failed" }

Write-Host "[2/6] npm install client..." -ForegroundColor Cyan
Set-Location "d:\fufan-cc-flow-src\client"
npm install
if ($LASTEXITCODE -ne 0) { throw "client npm install failed" }

Write-Host "[3/6] build server..." -ForegroundColor Cyan
Set-Location "d:\fufan-cc-flow-src\server"
npx --yes tsc
if ($LASTEXITCODE -ne 0) { throw "server build failed" }

Write-Host "[4/6] build client..." -ForegroundColor Cyan
Set-Location "d:\fufan-cc-flow-src\client"
npx --yes vite build
if ($LASTEXITCODE -ne 0) { throw "client build failed" }

Write-Host "[5/6] compile electron..." -ForegroundColor Cyan
Set-Location "d:\fufan-cc-flow-src\electron"
# .bin links may be missing; call typescript and electron-builder directly via node
node ".\node_modules\typescript\bin\tsc"
if ($LASTEXITCODE -ne 0) { throw "electron tsc failed" }

Write-Host "[5.5/6] copy app-builder-bin from pnpm store..." -ForegroundColor Cyan
$pnpmStore = "d:\fufan-cc-flow-src\node_modules\.pnpm"
$appBuilderDir = Get-ChildItem $pnpmStore -Filter "app-builder-bin*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($appBuilderDir) {
    $src = Join-Path $appBuilderDir.FullName "node_modules\app-builder-bin"
    $dst = "d:\fufan-cc-flow-src\electron\node_modules\app-builder-bin"
    Write-Host "Source: $src"
    Write-Host "Dest:   $dst"
    if (Test-Path $src) {
        # Use robocopy for reliable Windows file copying (handles hardlinks properly)
        robocopy $src $dst /E /NFL /NDL /NJH /NJS /NC /NS 2>&1 | Out-Null
        Write-Host "robocopy done, checking: $(Test-Path (Join-Path $dst 'package.json'))"
    } else {
        Write-Host "ERROR: Source path not found: $src"
        exit 1
    }
} else {
    Write-Host "ERROR: app-builder-bin not in pnpm store"
    exit 1
}

Write-Host "[6/6] electron-builder pack..." -ForegroundColor Cyan
node ".\node_modules\electron-builder\cli.js" --config electron-builder.yml
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }

Write-Host "SUCCESS! Output: C:\FufanBuild\release" -ForegroundColor Green
