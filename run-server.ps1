$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot
$python = 'C:\ProgramData\miniconda3\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw "Python runtime not found: $python" }
& $python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
