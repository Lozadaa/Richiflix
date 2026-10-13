$ErrorActionPreference = 'Stop'
# Instala Kingdom en este PC: accesos directos en el Escritorio y en el menú Inicio que abren la app de escritorio
# (Electron con la build de `npm run build` de esta carpeta). Uso: npm run build && npm run windows:shortcut
$kingdomRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$kingdomElectron = Join-Path $kingdomRoot 'node_modules\electron\dist\electron.exe'
$kingdomIcon = Join-Path $kingdomRoot 'public\brand\kingdom.ico'
if (!(Test-Path -LiteralPath $kingdomElectron)) { throw 'Falta Electron: ejecuta npm install.' }
if (!(Test-Path -LiteralPath $kingdomIcon)) { throw 'Falta el icono public\brand\kingdom.ico.' }
if (!(Test-Path -LiteralPath (Join-Path $kingdomRoot 'dist\index.html'))) { throw 'Falta la build: ejecuta npm run build.' }
$shell = New-Object -ComObject WScript.Shell
$targets = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Kingdom.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Kingdom.lnk')
)
foreach ($path in $targets) {
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $kingdomElectron
  $shortcut.Arguments = '"' + $kingdomRoot + '"'
  $shortcut.WorkingDirectory = $kingdomRoot
  $shortcut.IconLocation = $kingdomIcon + ',0'
  $shortcut.Description = 'Kingdom Player'
  $shortcut.Save()
  Write-Output $path
}
# El acceso directo antiguo (Richiflix.lnk en la carpeta del proyecto) ya no se crea; se retira si quedó de antes.
$legacy = Join-Path $kingdomRoot 'Richiflix.lnk'
if (Test-Path -LiteralPath $legacy) { Remove-Item -LiteralPath $legacy -Force }
