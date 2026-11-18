<#
发布 QuantCore Labs 网站：拉取 -> 生成页面 -> 测试 -> 暂存 -> 确认 -> 提交 -> 刷新站点地图 -> 推送。
任何一步出错就停下，不会提交半成品。

用法（在 D:\quantcore-labs 下运行）：
  powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -Message "提交说明"
  ... -DryRun             只生成、测试并列出将要提交的文件，不提交、不推送
  ... -NoTest             生成时跳过代码片段的 Python 测试（快，只改了模板或文字时用）
  ... -Add path1,path2    额外加入新文件或新文件夹（例如新的研究页面）
  ... -Yes                不再询问确认

不会提交的东西：
  - .publish-hold 文件里列出的路径（一行一个，# 开头是注释），用来放还没做完的工作；
  - 从没提交过的新文件，除非用 -Add 指定。脚本会把它们列出来提醒你。
#>
[CmdletBinding()]
param(
    [string]$Message,
    [string[]]$Add = @(),
    [switch]$NoTest,
    [switch]$DryRun,
    [switch]$Yes
)

# 用 Continue：Windows PowerShell 5.1 在 Stop 模式下会把外部命令写到 stderr 的普通提示当成错误。
# 每个外部命令的退出码都在下面单独检查。
$ErrorActionPreference = 'Continue'
# 用 -File 运行时，"-Add a,b,c" 会作为一个字符串传进来，这里按逗号拆开
$Add = @($Add | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Step($text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host ""; Write-Host "停止：$text" -ForegroundColor Red; exit 1 }

# 运行外部命令；退出码不是 0 就停下（Windows PowerShell 5.1 不会自动因外部命令失败而停止）
function Run([string]$exe, [string[]]$argv, [string]$what) {
    & $exe @argv
    if ($LASTEXITCODE -ne 0) { Fail "$what 失败（退出码 $LASTEXITCODE）。" }
}
function GitOut([string[]]$argv) {
    $out = @(& git @argv 2>&1 | ForEach-Object { "$_" })
    if ($LASTEXITCODE -ne 0) { Fail ("git " + ($argv -join ' ') + " 失败：" + ($out -join ' ')) }
    return $out
}

# ------------------------------------------------------------------ 0. 检查环境
Step "检查环境"
if (-not $DryRun -and -not $Message) { Fail "请用 -Message 写提交说明，例如 -Message `"Add site icon`"；只想预览就加 -DryRun。" }

$Python = @((Join-Path $Repo '.venv\Scripts\python.exe'), (Join-Path $Repo '.venv/bin/python')) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Python) { Fail "找不到 .venv 里的 Python。先运行：D:\xysz\.venv\Scripts\python.exe -m venv .venv，再 .\.venv\Scripts\python.exe -m pip install -r scripts\requirements.txt" }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "找不到 git。" }

$gitDir = (GitOut @('rev-parse', '--git-dir')) | Select-Object -First 1
foreach ($m in 'rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD') {
    if (Test-Path (Join-Path $gitDir $m)) { Fail "上一次的 git 合并或变基还没结束（$m）。先处理完再运行。" }
}
$branch = (GitOut @('rev-parse', '--abbrev-ref', 'HEAD')) | Select-Object -First 1
if ($branch -ne 'main') { Fail "当前分支是 $branch，不是 main。" }
if (-not $DryRun) {
    $name = & git config user.name; $mail = & git config user.email
    if (-not $name -or -not $mail) { Fail "这个仓库还没设置提交者。运行：git config user.name `"你的名字`"；git config user.email `"你的邮箱`"" }
    if ($name -match '上面显示|你的名字|Your Name' -or $mail -match '上面显示|你的邮箱|example\.com') { Fail "提交者看起来还是占位文字：$name <$mail>。" }
    Say "提交者：$name <$mail>"
}

# .publish-hold：本机文件，不进仓库
$holdFile = Join-Path $Repo '.publish-hold'
$hold = @()
if (Test-Path $holdFile) {
    $hold = @(Get-Content $holdFile -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') })
}
$exclude = Join-Path (Join-Path $gitDir 'info') 'exclude'
if (Test-Path $exclude) {
    $ex = @(Get-Content $exclude -Encoding UTF8)
    foreach ($line in '.publish-hold', '.venv/', '__pycache__/') {
        if ($ex -notcontains $line) {
            $raw = [IO.File]::ReadAllText($exclude)
            $pre = if ($raw.Length -and -not $raw.EndsWith("`n")) { "`n" } else { "" }
            [IO.File]::AppendAllText($exclude, $pre + $line + "`n")      # UTF-8 without BOM, as git expects
            $ex += $line
        }
    }
}
if ($hold.Count) { Say ("暂不发布：" + ($hold -join ', ')) 'Yellow' }

# ------------------------------------------------------------------ 1. 拉取
Step "拉取远程更新"
Run git @('pull', '--rebase', '--autostash') "git pull"

# ------------------------------------------------------------------ 2. 生成页面
Step ("生成页面" + $(if ($NoTest) { "（跳过代码片段测试）" } else { "（含代码片段测试）" }))
$genArgs = @((Join-Path 'scripts' 'generate_glossary.py'))
if ($NoTest) { $genArgs += '--no-test' }
Run $Python $genArgs "生成页面"

# ------------------------------------------------------------------ 3. 网页工具测试
Step "网页工具测试"
$node = Get-Command node -ErrorAction SilentlyContinue
$tests = @(Get-ChildItem -Path (Join-Path $Repo 'tests') -Filter '*.test.mjs' -ErrorAction SilentlyContinue)
$tracked = @(GitOut @('ls-files', 'tests'))
$tests = @($tests | Where-Object { $tracked -contains ('tests/' + $_.Name) -or $Add -match [regex]::Escape($_.Name) })
if (-not $node) {
    Say "没装 Node.js，跳过 JavaScript 测试（装了以后会自动运行）。" 'Yellow'
} elseif (-not $tests.Count) {
    Say "没有要运行的测试。"
} else {
    foreach ($t in $tests) {
        $out = @(& node --test $t.FullName 2>&1 | ForEach-Object { "$_" })
        if ($LASTEXITCODE -ne 0) { $out | Select-Object -Last 30 | ForEach-Object { Say $_ }; Fail "测试没通过：$($t.Name)" }
        # Node 的输出格式随版本不同：“# pass 10”或“ℹ pass 10”；找不到数字时只说通过
        $pass = $null
        foreach ($line in $out) { if ($line -match '^\S*\s*pass (\d+)\s*$') { $pass = $Matches[1] } }
        if ($pass) { Say ("通过 {0,4} 项  {1}" -f $pass, $t.Name) 'Green' } else { Say ("通过        {0}" -f $t.Name) 'Green' }
    }
}

# ------------------------------------------------------------------ 4. 暂存
Step "整理要提交的文件"
Run git @('add', '-u', '--', '.') "git add -u"
foreach ($p in $Add) {
    if (-not (Test-Path $p)) { Fail "-Add 里的路径不存在：$p" }
    Run git @('add', '--', $p) "git add $p"
}
foreach ($p in $hold) { & git reset -q -- $p 2>$null | Out-Null }
& git reset -q -- sitemap.xml 2>$null | Out-Null       # 站点地图在提交之后单独刷新

$staged = @(GitOut @('diff', '--cached', '--name-only'))
$untracked = @(GitOut @('ls-files', '--others', '--exclude-standard'))
foreach ($p in $hold) { $untracked = @($untracked | Where-Object { -not $_.StartsWith($p.TrimEnd('/', '\').Replace('\', '/')) }) }
$heldChanged = @()
foreach ($p in $hold) { $heldChanged += @(GitOut @('diff', '--name-only', '--', $p)) }

if ($staged.Count) {
    $groups = $staged | Group-Object { ($_ -split '/')[0] } | Sort-Object Name
    Say ("将提交 {0} 个文件：" -f $staged.Count) 'Green'
    foreach ($g in $groups) {
        if ($g.Count -le 4) { $g.Group | ForEach-Object { Say "  $_" } }
        else { Say ("  {0}/  （{1} 个文件）" -f $g.Name, $g.Count) }
    }
} else {
    Say "没有需要提交的改动。" 'Yellow'
}
if ($untracked.Count) {
    Say ("没提交过的新文件（不会提交；需要的话用 -Add 加入）：") 'Yellow'
    $untracked | Select-Object -First 20 | ForEach-Object { Say "  $_" 'Yellow' }
    if ($untracked.Count -gt 20) { Say ("  …… 共 {0} 个" -f $untracked.Count) 'Yellow' }
}
if ($heldChanged.Count) { Say ("按 .publish-hold 暂不发布的改动：{0} 个文件" -f $heldChanged.Count) 'Yellow' }

if ($DryRun) {
    & git reset -q | Out-Null
    Step "预览结束（-DryRun）：没有提交，也没有推送。生成的页面留在本地。"
    exit 0
}
if (-not $staged.Count) { Step "完成：没有新内容需要发布。"; exit 0 }

if (-not $Yes) {
    $ans = Read-Host "确认提交并推送？输入 y 继续"
    if ($ans -ne 'y') { & git reset -q | Out-Null; Say "已取消，没有提交。暂存区已清空，本地文件保持不变。" 'Yellow'; exit 1 }
}

# ------------------------------------------------------------------ 5. 提交、刷新站点地图、推送
Step "提交"
Run git @('commit', '-q', '-m', $Message) "git commit"

Run $Python @((Join-Path 'scripts' 'build_sitemap.py')) "刷新站点地图"
$sm = @(GitOut @('status', '--porcelain', '--', 'sitemap.xml'))
if ($sm.Count) {
    Run git @('add', '--', 'sitemap.xml') "git add sitemap.xml"
    Run git @('commit', '-q', '-m', 'Refresh sitemap lastmod') "提交站点地图"
}

Step "推送"
& git push
if ($LASTEXITCODE -ne 0) {
    Say "远程有新提交，先合并再推送一次……" 'Yellow'
    Run git @('pull', '--rebase', '--autostash') "git pull"
    Run git @('push') "git push"
}

Step "完成"
GitOut @('log', '-3', '--format=%h  %an  %s') | ForEach-Object { Say "  $_" }
Say "Cloudflare 一两分钟后部署完毕：https://quantcore-labs.com/" 'Green'
if ($heldChanged.Count -or $untracked.Count) { Say "提醒：还有没发布的本地改动或新文件（见上面的黄色提示）。" 'Yellow' }
