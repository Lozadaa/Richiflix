param(
 [Parameter(Mandatory=$true)][System.Net.IPAddress]$TvIP,
 [Parameter(Mandatory=$true)][string]$CertificateProfile,
 [string]$SdkPath='',
 [string]$ProfilesPath='',
 [switch]$SkipBuild,
 [switch]$SkipLaunch
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
if(!$SdkPath){
 $vscodeConfig=Join-Path $env:USERPROFILE '.tizen.path.config'
 if(Test-Path -LiteralPath 'C:\tizen-studio\tools\sdb.exe'){$SdkPath='C:\tizen-studio'}
 elseif(Test-Path -LiteralPath $vscodeConfig){$extensionRoot=(Get-Content -LiteralPath $vscodeConfig -Raw | ConvertFrom-Json).url;$SdkPath=Join-Path $extensionRoot 'server\sdktools\data'}
 else{throw 'No se encontro el SDK. Indica -SdkPath o instala el SDK de Tizen para Visual Studio Code.'}
}
$sdbCommand=Join-Path $SdkPath 'tools\sdb.exe'
$tizenCommand=Join-Path $SdkPath 'tools\ide\bin\tizen.bat'
$coreCommand=Join-Path $SdkPath 'tools\tizen-core\tz.exe'
$modernSdk=Test-Path -LiteralPath $coreCommand
if(!(Test-Path -LiteralPath $sdbCommand) -or (!$modernSdk -and !(Test-Path -LiteralPath $tizenCommand))){
 throw 'No se encontraron sdb y la CLI de Tizen en -SdkPath.'
}
if($modernSdk -and !$ProfilesPath){$ProfilesPath=Join-Path (Split-Path -Parent $SdkPath) 'sdk-data\profile\profiles.xml'}
if($modernSdk -and !(Test-Path -LiteralPath $ProfilesPath)){
 throw 'No se encontro profiles.xml. Crea el certificado Samsung o indica -ProfilesPath.'
}
if($TvIP.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork){throw 'Usa la direccion IPv4 del Samsung TV.'}
$serial="${TvIP}:26101"
Push-Location -LiteralPath $projectRoot
try{
 if(!$SkipBuild){
  & npm.cmd run build:tizen
  if($LASTEXITCODE -ne 0){throw 'Fallo la compilacion de Tizen.'}
 }
 & $sdbCommand connect $serial
 if($LASTEXITCODE -ne 0){throw 'No se pudo conectar. Comprueba Developer Mode, IP del PC y red local.'}
 $buildDirectory=Join-Path $projectRoot 'dist-tizen'
 if($modernSdk){
  $unsignedPackage=Join-Path $projectRoot 'artifacts\Richiflix-Tizen-unsigned.wgt'
  $signedPackage=Join-Path $projectRoot 'artifacts\Richiflix-Tizen.wgt'
  & $coreCommand pack -t wgt -b $unsignedPackage -s $CertificateProfile -p $ProfilesPath -o $signedPackage
 }else{
  & $tizenCommand package -t wgt -s $CertificateProfile -- $buildDirectory
  $signedPackage=Join-Path $buildDirectory 'Richiflix.wgt'
 }
 if($LASTEXITCODE -ne 0){throw 'No se pudo firmar. Comprueba el perfil Samsung y el DUID del TV.'}
 if(!(Test-Path -LiteralPath $signedPackage)){throw "No se encontro el paquete firmado: $signedPackage"}
 # tz install forcibly uninstalls the existing widget. Use Samsung's update
 # command instead, and inspect its result (daemon failures can return code 0).
 if($modernSdk){
  $capabilities=& $sdbCommand -s $serial capability
  $toolPathLine=$capabilities | Where-Object {$_ -match '^sdk_toolpath:/[a-zA-Z0-9_/-]+$'} | Select-Object -First 1
  if(!$toolPathLine){throw 'El TV no informo una ruta valida para instalar el widget.'}
  $remotePackage=$toolPathLine.Substring('sdk_toolpath:'.Length).TrimEnd('/')+'/Richiflix.wgt'
  & $sdbCommand -s $serial push $signedPackage $remotePackage
  if($LASTEXITCODE -ne 0){throw 'No se pudo enviar el paquete al TV.'}
  $installOutput=& $sdbCommand -s $serial shell 0 vd_appinstall 'Richiflix1.Richiflix' $remotePackage 2>&1
  $installOutput | Write-Output
  if($LASTEXITCODE -ne 0 -or ($installOutput -join "`n") -notmatch 'install completed'){throw 'Samsung no confirmo la instalacion del paquete.'}
 }
 else{& $tizenCommand install -s $serial -n 'Richiflix.wgt' -- $buildDirectory}
 if($LASTEXITCODE -ne 0){throw 'No se pudo instalar. Comprueba certificados y Permit to install applications en Device Manager.'}
 if($SkipLaunch){return}
 if($modernSdk){& $coreCommand run -e $serial -p 'Richiflix1'}
 else{& $tizenCommand run -s $serial -p 'Richiflix1.Richiflix'}
 if($LASTEXITCODE -ne 0){throw 'Instalada, pero no se pudo iniciar. Abrela desde Apps en el TV.'}
}finally{Pop-Location}
