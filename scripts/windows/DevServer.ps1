[CmdletBinding()]
param(
    [ValidateSet("start", "stop", "status")]
    [string]$Action = "status",

    [ValidateSet("all", "backend", "frontend")]
    [string]$Service = "all"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Quote-CmdArgument {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value -notmatch '[\s"&<>|^()]') {
        return $Value
    }

    return '"' + $Value.Replace('"', '""') + '"'
}

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-ServiceConfigs {
    $repoRoot = Get-RepoRoot

    return @{
        backend = [pscustomobject]@{
            Name = "backend"
            Port = 8002
            Url = "http://127.0.0.1:8002/health/"
            WorkDir = Join-Path $repoRoot "backend\apiSystem"
            LauncherType = "python"
            LauncherPath = Join-Path $repoRoot "backend\.venv\Scripts\python.exe"
            Arguments = @(
                "-m",
                "uvicorn",
                "apiSystem.asgi:application",
                "--host",
                "127.0.0.1",
                "--port",
                "8002"
            )
            LogPath = Join-Path $repoRoot "backend\logs\codex-backend-live.log"
            PidPath = Join-Path $repoRoot "backend\logs\codex-backend-live.pid"
        }
        frontend = [pscustomobject]@{
            Name = "frontend"
            Port = 5173
            Url = "http://127.0.0.1:5173/"
            WorkDir = Join-Path $repoRoot "frontend"
            LauncherType = "pnpm"
            LauncherPath = $null
            Arguments = @(
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                "5173",
                "--strictPort"
            )
            LogPath = Join-Path $repoRoot "frontend\logs\codex-frontend-live.log"
            PidPath = Join-Path $repoRoot "frontend\logs\codex-frontend-live.pid"
        }
    }
}

function Get-SelectedConfigs {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Configs,
        [Parameter(Mandatory = $true)][string]$SelectedService
    )

    if ($SelectedService -eq "all") {
        return @($Configs.backend, $Configs.frontend)
    }

    return @($Configs[$SelectedService])
}

function Resolve-ServiceLauncher {
    param([Parameter(Mandatory = $true)]$Config)

    switch ($Config.LauncherType) {
        "python" {
            if (-not (Test-Path $Config.LauncherPath)) {
                throw "Missing backend launcher: $($Config.LauncherPath)"
            }

            return $Config.LauncherPath
        }
        "pnpm" {
            return (Get-Command pnpm -ErrorAction Stop).Source
        }
        default {
            throw "Unsupported launcher type: $($Config.LauncherType)"
        }
    }
}

function Get-ListenerProcessId {
    param([Parameter(Mandatory = $true)][int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $connection) {
        return $null
    }

    return [int]$connection.OwningProcess
}

function Read-PidFile {
    param([Parameter(Mandatory = $true)][string]$PidPath)

    if (-not (Test-Path $PidPath)) {
        return $null
    }

    $raw = (Get-Content $PidPath -Raw -ErrorAction SilentlyContinue).Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }

    $parsedPid = 0
    if ([int]::TryParse($raw, [ref]$parsedPid)) {
        return $parsedPid
    }

    return $null
}

function Get-UrlStatus {
    param([Parameter(Mandatory = $true)][string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        return [pscustomobject]@{
            Ready = $true
            StatusCode = [int]$response.StatusCode
            Error = $null
        }
    }
    catch {
        return [pscustomobject]@{
            Ready = $false
            StatusCode = $null
            Error = $_.Exception.Message
        }
    }
}

function New-DedupedEnvironmentMap {
    $environmentMap = @{}
    $seenNames = @{}

    foreach ($item in Get-ChildItem Env:) {
        $lowerName = $item.Name.ToLowerInvariant()
        if (-not $seenNames.ContainsKey($lowerName)) {
            $environmentMap[$item.Name] = $item.Value
            $seenNames[$lowerName] = $true
        }
    }

    return $environmentMap
}

function Start-HiddenCommand {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$CommandText
    )

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = Join-Path $env:SystemRoot "System32\cmd.exe"
    $processInfo.Arguments = '/d /c "' + $CommandText + '"'
    $processInfo.WorkingDirectory = $WorkingDirectory
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true

    foreach ($entry in (New-DedupedEnvironmentMap).GetEnumerator()) {
        $processInfo.Environment[$entry.Key] = $entry.Value
    }

    return [System.Diagnostics.Process]::Start($processInfo)
}

function Wait-ForServiceReady {
    param(
        [Parameter(Mandatory = $true)]$Config,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        $listenerPid = Get-ListenerProcessId -Port $Config.Port
        if ($null -ne $listenerPid) {
            $urlStatus = Get-UrlStatus -Url $Config.Url
            if ($urlStatus.Ready) {
                return [pscustomobject]@{
                    Ready = $true
                    Pid = $listenerPid
                    StatusCode = $urlStatus.StatusCode
                    Error = $null
                }
            }
        }

        Start-Sleep -Milliseconds 500
    }

    $finalPid = Get-ListenerProcessId -Port $Config.Port
    $finalStatus = Get-UrlStatus -Url $Config.Url

    return [pscustomobject]@{
        Ready = $false
        Pid = $finalPid
        StatusCode = $finalStatus.StatusCode
        Error = if ($finalStatus.Ready) {
            "Timed out waiting for service verification."
        }
        else {
            $finalStatus.Error
        }
    }
}

function Get-RecentLogTail {
    param([Parameter(Mandatory = $true)][string]$LogPath)

    if (-not (Test-Path $LogPath)) {
        return "Log file not found."
    }

    return ((Get-Content $LogPath -Tail 20) -join [Environment]::NewLine)
}

function Start-ServiceRuntime {
    param([Parameter(Mandatory = $true)]$Config)

    $listenerPid = Get-ListenerProcessId -Port $Config.Port
    if ($null -ne $listenerPid) {
        Set-Content -Path $Config.PidPath -Value $listenerPid
        Write-Output ("[{0}] already running on port {1} (PID {2})." -f $Config.Name, $Config.Port, $listenerPid)
        return
    }

    $launcher = Resolve-ServiceLauncher -Config $Config
    $logDirectory = Split-Path $Config.LogPath -Parent
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

    Add-Content -Path $Config.LogPath -Value ("=== {0} start request ===" -f (Get-Date -Format "o"))

    $commandParts = @((Quote-CmdArgument $launcher)) + @($Config.Arguments | ForEach-Object { Quote-CmdArgument $_ })
    $commandText = ($commandParts -join " ") + " >> " + (Quote-CmdArgument $Config.LogPath) + " 2>&1"

    $wrapperProcess = Start-HiddenCommand -WorkingDirectory $Config.WorkDir -CommandText $commandText
    $readyState = Wait-ForServiceReady -Config $Config

    if (-not $readyState.Ready) {
        $logTail = Get-RecentLogTail -LogPath $Config.LogPath
        throw ("[{0}] failed to start. Wrapper PID: {1}. Last log lines:{2}{3}" -f $Config.Name, $wrapperProcess.Id, [Environment]::NewLine, $logTail)
    }

    Set-Content -Path $Config.PidPath -Value $readyState.Pid
    Write-Output ("[{0}] started. PID {1}. URL: {2}" -f $Config.Name, $readyState.Pid, $Config.Url)
}

function Stop-ServiceRuntime {
    param([Parameter(Mandatory = $true)]$Config)

    $candidateIds = New-Object System.Collections.Generic.List[int]

    $listenerPid = Get-ListenerProcessId -Port $Config.Port
    if ($null -ne $listenerPid) {
        $candidateIds.Add($listenerPid)
    }

    $pidFilePid = Read-PidFile -PidPath $Config.PidPath
    if (($null -ne $pidFilePid) -and (-not $candidateIds.Contains($pidFilePid))) {
        $candidateIds.Add($pidFilePid)
    }

    if ($candidateIds.Count -eq 0) {
        Remove-Item -Path $Config.PidPath -Force -ErrorAction SilentlyContinue
        Write-Output ("[{0}] not running." -f $Config.Name)
        return
    }

    foreach ($candidateId in $candidateIds) {
        $process = Get-Process -Id $candidateId -ErrorAction SilentlyContinue
        if ($null -ne $process) {
            Stop-Process -Id $candidateId -Force -ErrorAction Stop
            Write-Output ("[{0}] stopped PID {1}." -f $Config.Name, $candidateId)
        }
    }

    Start-Sleep -Seconds 1
    $remainingListenerPid = Get-ListenerProcessId -Port $Config.Port
    if ($null -ne $remainingListenerPid) {
        throw ("[{0}] port {1} is still occupied by PID {2}." -f $Config.Name, $Config.Port, $remainingListenerPid)
    }

    Remove-Item -Path $Config.PidPath -Force -ErrorAction SilentlyContinue
}

function Show-ServiceRuntime {
    param([Parameter(Mandatory = $true)]$Config)

    $listenerPid = Get-ListenerProcessId -Port $Config.Port
    $pidFilePid = Read-PidFile -PidPath $Config.PidPath
    $urlStatus = Get-UrlStatus -Url $Config.Url

    if ($null -ne $listenerPid) {
        if ($pidFilePid -ne $listenerPid) {
            Set-Content -Path $Config.PidPath -Value $listenerPid
            $pidFilePid = $listenerPid
        }

        $httpPart = if ($urlStatus.Ready) {
            "http=$($urlStatus.StatusCode)"
        }
        else {
            "http=unreachable"
        }

        Write-Output ("[{0}] running pid={1} port={2} {3}" -f $Config.Name, $listenerPid, $Config.Port, $httpPart)
    }
    else {
        Write-Output ("[{0}] stopped port={1}" -f $Config.Name, $Config.Port)
    }

    Write-Output ("[{0}] url={1}" -f $Config.Name, $Config.Url)
    Write-Output ("[{0}] pid-file={1}" -f $Config.Name, $(if ($null -ne $pidFilePid) { $pidFilePid } else { "none" }))
    Write-Output ("[{0}] log={1}" -f $Config.Name, $Config.LogPath)
}

$serviceConfigs = Get-ServiceConfigs
$selectedConfigs = Get-SelectedConfigs -Configs $serviceConfigs -SelectedService $Service

foreach ($config in $selectedConfigs) {
    switch ($Action) {
        "start" {
            Start-ServiceRuntime -Config $config
        }
        "stop" {
            Stop-ServiceRuntime -Config $config
        }
        "status" {
            Show-ServiceRuntime -Config $config
        }
    }
}

if ($Action -eq "start") {
    Write-Output ""
    Write-Output "Frontend: http://127.0.0.1:5173/"
    Write-Output "Backend health: http://127.0.0.1:8002/health/"
}
