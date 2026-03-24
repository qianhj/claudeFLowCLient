# 检查 electron 目录大小
$baseDir = "D:\fufan-cc-flow-src\electron"
Get-ChildItem $baseDir -Force -Directory | ForEach-Object {
    $size = 0
    try {
        $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    } catch {}
    if ($size -gt 0) {
        Write-Host ("{0,-30} {1:N2} MB" -f $_.Name, ($size/1MB))
    }
}