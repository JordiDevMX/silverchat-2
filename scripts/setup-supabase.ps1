# SilverChat - Supabase CLI health check. Idempotent; never prompts.
# Verifies CLI version and authentication, and links the project if needed.
# See docs/SUPABASE_CLI.md.
#
# Windows PowerShell 5.1 notes (both bugs found the hard way):
# - Splatting '@args' to a native command silently DROPS the arguments, so
#   every call site below passes literal tokens inside each switch branch.
# - $ErrorActionPreference='Stop' turns npx stderr warnings (npm warn ...)
#   into terminating NativeCommandErrors, so it is deliberately not set.
Set-Location (Split-Path $PSScriptRoot -Parent)

$shimPath = Join-Path (Get-Location) 'node_modules\.bin\supabase.CMD'
$cliMode = if (Get-Command supabase -ErrorAction SilentlyContinue) {
  'global'
} elseif (Test-Path $shimPath) {
  'shim'
} else {
  'npx'
}
$env:SUPABASE_SKIP_UPDATE_CHECK = '1'

function Invoke-SbVersion {
  switch ($cliMode) {
    'global' { & supabase --version 2>&1 }
    'shim' { & $shimPath --version 2>&1 }
    'npx' { & npx supabase --version 2>&1 }
  }
}

function Invoke-SbProjectsList {
  switch ($cliMode) {
    'global' { & supabase projects list 2>&1 }
    'shim' { & $shimPath projects list 2>&1 }
    'npx' { & npx supabase projects list 2>&1 }
  }
}

function Invoke-SbLink([string]$ref) {
  switch ($cliMode) {
    'global' { & supabase link --project-ref $ref 2>&1 }
    'shim' { & $shimPath link --project-ref $ref 2>&1 }
    'npx' { & npx supabase link --project-ref $ref 2>&1 }
  }
}

Write-Host "== Supabase CLI health check =="

# 1. Version must be 2.x or newer.
$verRaw = (Invoke-SbVersion) -join ' '
if ($verRaw -match '(\d+\.\d+\.\d+)') {
  $ver = [version]$Matches[1]
} else {
  Write-Host "ERROR: Supabase CLI not found. Run 'pnpm install' in this repo, or install it globally (npm i -g supabase)." -ForegroundColor Red
  exit 1
}
if ($ver.Major -lt 2) {
  Write-Host "ERROR: Supabase CLI 2.x+ required, found $ver. Upgrade with: npm i -g supabase" -ForegroundColor Red
  exit 1
}
Write-Host "CLI version: $ver"

# 2. Auth must already be configured. We never run 'supabase login' ourselves.
Invoke-SbProjectsList | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Supabase CLI is not authenticated. Run 'npx supabase login' (opens a browser), then re-run this script." -ForegroundColor Red
  exit 2
}
Write-Host "Auth: OK"

# 3. Link only if missing. Reads SUPABASE_PROJECT_ID from the environment,
#    falling back to a READ-ONLY .env.local lookup. Never hardcodes a ref.
if (Test-Path supabase/.temp/project-ref) {
  Write-Host "Link: OK ($(Get-Content supabase/.temp/project-ref))"
} else {
  $ref = $env:SUPABASE_PROJECT_ID
  if (-not $ref -and (Test-Path .env.local)) {
    $line = (Get-Content .env.local | Select-String '^SUPABASE_PROJECT_ID=' | Select-Object -First 1)
    if ($line) { $ref = (($line.Line -split '=', 2)[1].Trim().Trim('"')) }
  }
  if (-not $ref) {
    Write-Host "ERROR: Not linked and SUPABASE_PROJECT_ID is not set." -ForegroundColor Red
    Write-Host "Add 'SUPABASE_PROJECT_ID=<your-project-ref>' to .env.local (see docs/SUPABASE_CLI.md), then re-run."
    exit 3
  }
  Write-Host "Not linked; linking with SUPABASE_PROJECT_ID..."
  Invoke-SbLink $ref | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 'supabase link' failed. See docs/SUPABASE_CLI.md." -ForegroundColor Red
    exit 4
  }
  Write-Host "Link: OK ($ref)"
}

Write-Host "Supabase CLI is ready."
