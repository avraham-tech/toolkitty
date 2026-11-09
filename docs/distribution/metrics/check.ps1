# Toolkitty weekly metrics check. Appends one row to metrics/log.csv and prints referrers.
# Requires: gh (authenticated as the repo owner). Run from the repo root or anywhere.
param(
  [string]$Repo = "avraham-tech/toolkitty",
  [string]$Note = ""
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $here "log.csv"

$info = gh api "repos/$Repo" | ConvertFrom-Json
$clones = gh api "repos/$Repo/traffic/clones" | ConvertFrom-Json
$views = gh api "repos/$Repo/traffic/views" | ConvertFrom-Json
$refs = gh api "repos/$Repo/traffic/popular/referrers" | ConvertFrom-Json
$since = (Get-Date).AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$opened = (gh api "search/issues?q=repo:$Repo+is:issue+created:>$since" | ConvertFrom-Json).total_count
$closed = (gh api "search/issues?q=repo:$Repo+is:issue+closed:>$since" | ConvertFrom-Json).total_count
$rel = $null
try { $rel = gh api "repos/$Repo/releases/latest" | ConvertFrom-Json } catch {}
$relTag = if ($rel) { $rel.tag_name } else { "" }

$row = [pscustomobject]@{
  date = (Get-Date).ToString("yyyy-MM-dd")
  stars = $info.stargazers_count
  forks = $info.forks_count
  watchers = $info.subscribers_count
  open_issues = $info.open_issues_count
  clones_14d = $clones.count
  clones_uniques_14d = $clones.uniques
  views_14d = $views.count
  views_uniques_14d = $views.uniques
  issues_opened_7d = $opened
  issues_closed_7d = $closed
  release = $relTag
  kofi_supporters = ""
  wave_a_installs = ""
  note = $Note
}

if (-not (Test-Path $log)) {
  $row | Export-Csv -Path $log -NoTypeInformation -Encoding utf8
} else {
  $row | Export-Csv -Path $log -NoTypeInformation -Encoding utf8 -Append
}

$row | Format-List
Write-Host "Referrers (14 days):"
$refs | ForEach-Object { "{0,-30} {1,6} views {2,6} uniques" -f $_.referrer, $_.count, $_.uniques }
if ($rel -and $rel.assets) {
  Write-Host "Release asset downloads:"
  $rel.assets | ForEach-Object { "{0,-40} {1}" -f $_.name, $_.download_count }
}
Write-Host "Row appended to $log. Fill kofi_supporters and wave_a_installs by hand."
