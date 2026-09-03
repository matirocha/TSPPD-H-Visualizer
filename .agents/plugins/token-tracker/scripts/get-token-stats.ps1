# Script de análisis de tokens para PowerShell
param (
    [string]$TranscriptPath
)

if (-not $TranscriptPath -or -not (Test-Path $TranscriptPath)) {
    Write-Host "Por favor proporciona una ruta válida a transcript.jsonl"
    exit 1
}

$lines = Get-Content $TranscriptPath
$totalSteps = $lines.Count
$totalBytes = (Get-Item $TranscriptPath).Length
$approxTokens = [math]::Round($totalBytes / 4)

Write-Host "=========================================="
Write-Host "       REPORTE DE CONSUMO DE TOKENS       "
Write-Host "=========================================="
Write-Host "Total de pasos en la sesión: $totalSteps"
Write-Host "Tamaño del registro: $([math]::Round($totalBytes / 1KB, 2)) KB"
Write-Host "Tokens acumulados estimados: ~$approxTokens tokens"
Write-Host "=========================================="
