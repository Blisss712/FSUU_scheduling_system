# Swap the corrected progress document into place on the Desktop.
#
# The Desktop copy could not be overwritten automatically because Word (or a
# preview handler) had it open. Close the document in Word, then run this:
#
#     powershell -ExecutionPolicy Bypass -File .\_apply_docx.ps1
#
# It keeps a one-time backup of the version it replaces.

$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'TWO_DAY_PROGRESS_DOCUMENTATION.docx'
$target = 'C:\Users\DJR\Desktop\TWO_DAY_PROGRESS_DOCUMENTATION.docx'
$backup = 'C:\Users\DJR\Desktop\TWO_DAY_PROGRESS_DOCUMENTATION.pre-progress-edit.docx'

if (-not (Test-Path $source)) {
    Write-Host "Source not found: $source" -ForegroundColor Red
    exit 1
}

# Fail early with a clear message while the file is still locked.
try {
    $stream = [System.IO.File]::Open($target, 'Open', 'ReadWrite', 'None')
    $stream.Close()
} catch {
    Write-Host "The document is still open in another program (Word)." -ForegroundColor Yellow
    Write-Host "Close '$target', then run this script again."
    exit 1
}

if (-not (Test-Path $backup)) {
    Copy-Item $target $backup
    Write-Host "Backed up the previous version to:" -ForegroundColor DarkGray
    Write-Host "  $backup"
}

Copy-Item $source $target -Force
Write-Host "Updated: $target" -ForegroundColor Green
Write-Host "The timeline-free document is now in place." -ForegroundColor Green
