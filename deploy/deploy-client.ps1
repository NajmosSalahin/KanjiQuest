# Per-phase Vercel deploy of the built React client (owner-directed early
# hosting — DECISIONS.md). Builds client, injects the Render API URL into the
# rewrites (keeps /api/* same-origin so §14 SameSite=Strict cookies work),
# and deploys the static dist. Run from anywhere in the repo:
#
#   .\deploy\deploy-client.ps1 -ApiUrl https://kanjiquest-api-xxxx.onrender.com
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiUrl,
  [string]$ProjectName = 'kanjiquest'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host 'Building client...'
npm run build -w client
if ($LASTEXITCODE -ne 0) { throw 'client build failed' }

$dist = Join-Path $root 'client\dist'
$tpl = Get-Content (Join-Path $PSScriptRoot 'vercel.json.tpl') -Raw
[System.IO.File]::WriteAllText(
  (Join-Path $dist 'vercel.json'),
  $tpl.Replace('__API_URL__', $ApiUrl.TrimEnd('/'))
)

Write-Host "Deploying to Vercel (project: $ProjectName)..."
vercel deploy --cwd $dist --prod --yes --name $ProjectName
if ($LASTEXITCODE -ne 0) { throw 'vercel deploy failed' }
Write-Host 'Done.'
