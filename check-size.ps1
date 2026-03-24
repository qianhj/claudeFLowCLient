# 检查项目目录大小
$baseDir = "D:\fufan-cc-flow-src"
$dirs = Get-ChildItem $baseDir -Force
foreach ($dir in $dirs) {
    $size = 0
    try {
        $size = (Get-ChildItem $dir.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    } catch {}
    if ($size -gt 0) {
        Write-Host ("{0,-30} {1:N2} MB" -f $dir.Name, ($size/1MB))
    }
}