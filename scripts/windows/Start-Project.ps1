[CmdletBinding()]
param(
    [ValidateSet("all", "backend", "frontend")]
    [string]$Service = "all"
)

& (Join-Path $PSScriptRoot "DevServer.ps1") -Action start -Service $Service
