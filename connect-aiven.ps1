<#
Connect Los Blancos FC to Aiven from PowerShell.
This script asks for secrets interactively and writes them only to the local .env file.
#>

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

function Get-PlainText([Security.SecureString]$SecureValue) {
    $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr) }
}

$NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
if ($NpmCommand) {
    $Npm = $NpmCommand.Source
} else {
    $NodeVersion = (& node --version).Trim()
    $ToolsRoot = Join-Path $ProjectRoot 'work\node-runtime'
    $PortableNode = Join-Path $ToolsRoot "node-$NodeVersion-win-x64"
    $Npm = Join-Path $PortableNode 'npm.cmd'
    if (-not (Test-Path -LiteralPath $Npm)) {
        $NodeArchive = Join-Path $ProjectRoot 'work\node-runtime.zip'
        New-Item -ItemType Directory -Path $ToolsRoot -Force | Out-Null
        Write-Host "Downloading the portable Node.js package tool ($NodeVersion)..."
        $NodePackageUrl = "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip"
        & node -e "const https=require('https'),fs=require('fs');const [url,out]=process.argv.slice(1);https.get(url,response=>{if(response.statusCode!==200){console.error('Download failed with status '+response.statusCode);process.exit(1)}const file=fs.createWriteStream(out);response.pipe(file);file.on('finish',()=>file.close())}).on('error',error=>{console.error(error.message);process.exit(1)})" $NodePackageUrl $NodeArchive
        if ($LASTEXITCODE -ne 0) { throw 'Could not download the portable Node.js package tool.' }
        Expand-Archive -LiteralPath $NodeArchive -DestinationPath $ToolsRoot -Force
        Remove-Item -LiteralPath $NodeArchive -Force
    }
    if (-not (Test-Path -LiteralPath $Npm)) {
        throw 'The portable Node.js package tool could not be prepared.'
    }
}

$DbPassword = Get-PlainText (Read-Host 'Aiven database password' -AsSecureString)
$OwnerEmail = Read-Host 'Owner email address'
$OwnerName = Read-Host 'Owner display name'
$OwnerPassword = Get-PlainText (Read-Host 'Owner portal password' -AsSecureString)
$SessionSecret = Get-PlainText (Read-Host 'Session secret (press Enter to generate one)' -AsSecureString)
if ([string]::IsNullOrWhiteSpace($SessionSecret)) {
    $SessionSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}

$EnvFile = Join-Path $ProjectRoot '.env'
@(
    'PORT=3000'
    'NODE_ENV=development'
    "SESSION_SECRET=$SessionSecret"
    'DB_HOST=losblancos-mysql-omonditimon.j.aivencloud.com'
    'DB_PORT=24444'
    'DB_USER=avnadmin'
    "DB_PASSWORD=$DbPassword"
    'DB_NAME=defaultdb'
    'DB_SSL=true'
    "OWNER_EMAIL=$OwnerEmail"
    "OWNER_PASSWORD=$OwnerPassword"
    "OWNER_NAME=$OwnerName"
    'MEDIA_STORAGE=local'
) | Set-Content -LiteralPath $EnvFile -Encoding utf8

Write-Host 'Installing project packages...'
& $Npm install
Write-Host 'Creating and updating the Aiven database schema...'
& $Npm run setup
Write-Host ''
Write-Host 'The club portal is ready at http://localhost:3000'
Write-Host 'Press Ctrl+C to stop the local server.'
& $Npm start
