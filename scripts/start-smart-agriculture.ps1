$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $PSScriptRoot
$PythonExe = Join-Path $ProjectDir ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

function Test-HttpHealth {
    param([int]$Port)

    try {
        $response = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri "http://127.0.0.1:$Port/api/v1/health/" `
            -TimeoutSec 1
        return ($response.StatusCode -lt 500 -and $response.Content -like "*django-api*")
    }
    catch {
        return $false
    }
}

function Test-PortAvailable {
    param([int]$Port)

    if (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue) {
        return $false
    }

    $listener = $null
    try {
        $address = [System.Net.IPAddress]::Parse("127.0.0.1")
        $listener = [System.Net.Sockets.TcpListener]::new($address, $Port)
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $listener) {
            $listener.Stop()
        }
    }
}

$CandidatePorts = 8000..8010
$Port = $null
$AlreadyRunning = $false

foreach ($CandidatePort in $CandidatePorts) {
    if (Test-HttpHealth -Port $CandidatePort) {
        $Port = $CandidatePort
        $AlreadyRunning = $true
        break
    }
}

if ($null -eq $Port) {
    foreach ($CandidatePort in $CandidatePorts) {
        if (Test-PortAvailable -Port $CandidatePort) {
            $Port = $CandidatePort
            break
        }
    }
}

if ($null -eq $Port) {
    Write-Host "No available port found in 8000-8010."
    Start-Sleep -Seconds 5
    exit 1
}

$AppUrl = "http://127.0.0.1:$Port/"

if (-not $AlreadyRunning) {
    $command = 'set "WEATHER_INTEGRATION_ENABLED=true" && cd /d "{0}" && npm run build && "{1}" backend\manage.py migrate --noinput && "{1}" backend\manage.py seed_dev && "{1}" backend\manage.py runserver 127.0.0.1:{2} --noreload' -f $ProjectDir, $PythonExe, $Port
    Start-Process `
        -FilePath "cmd.exe" `
        -ArgumentList @("/k", $command) `
        -WorkingDirectory $ProjectDir `
        -WindowStyle Normal | Out-Null
}

for ($i = 0; $i -lt 120; $i++) {
    if (Test-HttpHealth -Port $Port) {
        Start-Process $AppUrl
        exit 0
    }
    Start-Sleep -Milliseconds 500
}

Start-Process $AppUrl
