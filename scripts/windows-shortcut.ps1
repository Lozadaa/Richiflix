$ErrorActionPreference = 'Stop'
$richiflixRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$richiflixElectron = Join-Path $richiflixRoot 'node_modules\electron\dist\electron.exe'
$richiflixIcon = Join-Path $richiflixRoot 'public\brand\richiflix.ico'
if (!(Test-Path -LiteralPath $richiflixElectron) -or !(Test-Path -LiteralPath $richiflixIcon)) { throw 'Falta Electron o el icono de Richiflix.' }
$richiflixShell = New-Object -ComObject WScript.Shell
$richiflixShortcut = $richiflixShell.CreateShortcut((Join-Path $richiflixRoot 'Richiflix.lnk'))
$richiflixShortcut.TargetPath = $richiflixElectron
$richiflixShortcut.Arguments = '"' + $richiflixRoot + '"'
$richiflixShortcut.WorkingDirectory = $richiflixRoot
$richiflixShortcut.IconLocation = $richiflixIcon + ',0'
$richiflixShortcut.Description = 'Richiflix'
$richiflixShortcut.Save()
Write-Output (Join-Path $richiflixRoot 'Richiflix.lnk')
