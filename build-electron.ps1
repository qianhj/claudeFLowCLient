$ErrorActionPreference = "Stop"

Write-Host "[1/3] npm install electron..." -ForegroundColor Cyan
Set-Location "d:\hz-cc-flow-src\electron"
npm install
if ($LASTEXITCODE -ne 0) { throw "electron npm install failed" }

Write-Host "[2/3] tsc electron..." -ForegroundColor Cyan
& ".\node_modules\.bin\tsc.CMD"
if ($LASTEXITCODE -ne 0) { throw "electron tsc failed" }

Write-Host "[3/3] electron-builder pack..." -ForegroundColor Cyan
& ".\node_modules\.bin\electron-builder.CMD" --config electron-builder.yml
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }

Write-Host "SUCCESS! Output: C:\HzBuild\release" -ForegroundColor Green
