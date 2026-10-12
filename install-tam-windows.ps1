[CmdletBinding()]
param(
    [string]$AppAsarPath,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginPath = Join-Path $scriptDirectory 'tam-drawio.js'

if (-not $AppAsarPath) {
    $candidates = @(
        (Join-Path $env:ProgramFiles 'draw.io\resources\app.asar'),
        (Join-Path $env:LOCALAPPDATA 'Programs\draw.io\resources\app.asar')
    )

    if (${env:ProgramFiles(x86)}) {
        $candidates += Join-Path ${env:ProgramFiles(x86)} 'draw.io\resources\app.asar'
    }

    $matches = @($candidates | Where-Object { Test-Path -LiteralPath $_ })
    if ($matches.Count -ne 1) {
        throw 'Could not identify one draw.io installation. Pass -AppAsarPath with the full path to resources\app.asar.'
    }

    $AppAsarPath = $matches[0]
}

$AppAsarPath = (Resolve-Path -LiteralPath $AppAsarPath).Path
if ([IO.Path]::GetFileName($AppAsarPath) -ne 'app.asar') {
    throw 'AppAsarPath must point to draw.io resources\app.asar.'
}

if ($AppAsarPath.StartsWith((Join-Path $env:ProgramFiles 'WindowsApps'), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Microsoft Store installations are not supported. Install draw.io from the website or use its portable build.'
}

$installDirectory = Split-Path (Split-Path $AppAsarPath -Parent) -Parent
$targetExecutable = Join-Path $installDirectory 'draw.io.exe'
$runningTarget = Get-Process -Name 'draw.io' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and [string]::Equals($_.Path, $targetExecutable, [StringComparison]::OrdinalIgnoreCase) }
if ($runningTarget) {
    throw 'Close draw.io before installing or uninstalling the plugin, then run this script again.'
}

if (-not $Uninstall -and -not (Test-Path -LiteralPath $pluginPath)) {
    throw "Plugin file not found: $pluginPath"
}

$npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $npx) {
    throw 'Node.js and npm are required. Install Node.js, then run this script again.'
}

$extractDirectory = Join-Path $env:TEMP ('tam-drawio-' + [guid]::NewGuid().ToString('N'))
$archiveTemporaryPath = "$AppAsarPath.tam-drawio.tmp"
$preloadRelativePath = 'src\main\electron-preload.js'
$pluginRelativePath = 'drawio\src\main\webapp\plugins\tam-drawio.js'

try {
    New-Item -ItemType Directory -Path $extractDirectory | Out-Null
    & $npx.Source --yes @electron/asar extract $AppAsarPath $extractDirectory
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not extract draw.io app.asar.'
    }

    $preloadPath = Join-Path $extractDirectory $preloadRelativePath
    $bundledPluginPath = Join-Path $extractDirectory $pluginRelativePath
    if (-not (Test-Path -LiteralPath $preloadPath) -or -not (Test-Path -LiteralPath (Split-Path -Parent $bundledPluginPath))) {
        throw 'This draw.io app.asar does not have the expected preload and built-in plugins paths.'
    }

    $preloadText = [IO.File]::ReadAllText($preloadPath)
    $registrationPattern = '(?s)// tam-drawio: begin\r?\n.*?// tam-drawio: end\r?\n?'

    if ($Uninstall) {
        if ($preloadText -notmatch [regex]::Escape('// tam-drawio: begin')) {
            Write-Output 'The TAM plugin registration is not present; no changes made.'
            return
        }

        $preloadText = [regex]::Replace($preloadText, $registrationPattern, '')
        Remove-Item -LiteralPath $bundledPluginPath -Force -ErrorAction SilentlyContinue
        [IO.File]::WriteAllText($preloadPath, $preloadText, [Text.UTF8Encoding]::new($false))
    }
    else {
        if ($preloadText -notmatch [regex]::Escape('// tam-drawio: begin')) {
            $registration = @'
// tam-drawio: begin
try {
    const raw = window.localStorage.getItem('.drawio-config');
    const cfg = raw ? JSON.parse(raw) : {};
    if (!Array.isArray(cfg.plugins)) cfg.plugins = [];
    const entry = './plugins/tam-drawio.js';
    if (!cfg.plugins.includes(entry)) {
        cfg.plugins.push(entry);
        window.localStorage.setItem('.drawio-config', JSON.stringify(cfg));
    }
} catch (e) {
    console.error('tam-drawio: failed to register plugin', e);
}
// tam-drawio: end
'@
            $preloadText = $registration + "`n" + $preloadText
        }

        Copy-Item -LiteralPath $pluginPath -Destination $bundledPluginPath -Force
        [IO.File]::WriteAllText($preloadPath, $preloadText, [Text.UTF8Encoding]::new($false))
    }

    & $npx.Source --yes @electron/asar pack $extractDirectory $archiveTemporaryPath
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not rebuild draw.io app.asar.'
    }

    Move-Item -LiteralPath $archiveTemporaryPath -Destination $AppAsarPath -Force
    if ($Uninstall) {
        Write-Output 'TAM plugin removed from draw.io.'
    }
    else {
        Write-Output 'TAM plugin installed. Restart draw.io to load it.'
    }
}
catch {
    if ($_.Exception -is [UnauthorizedAccessException] -or $_.Exception -is [IO.IOException]) {
        throw "Could not update '$AppAsarPath'. For an installation under Program Files, run PowerShell as Administrator. Details: $($_.Exception.Message)"
    }
    throw
}
finally {
    Remove-Item -LiteralPath $extractDirectory -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $archiveTemporaryPath -Force -ErrorAction SilentlyContinue
}