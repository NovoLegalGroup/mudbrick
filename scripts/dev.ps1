# Mudbrick v2 -- Development Script
# Launches both the Python backend and the Vite + Tauri frontend.
#
# Usage: powershell scripts/dev.ps1
#
# For faster backend iteration, you can also run:
#   Terminal 1: cd apps/api && uvicorn app.main:app --reload --port 8000
#   Terminal 2: pnpm tauri dev

Write-Host "Starting Mudbrick v2 development environment..." -ForegroundColor Cyan

# Start the Python backend in the background
$backend = Start-Process -PassThru -NoNewWindow -FilePath "python" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" `
    -WorkingDirectory "apps/api"

Write-Host "Backend PID: $($backend.Id)" -ForegroundColor Green

# Wait a moment for the backend to start
Start-Sleep -Seconds 2

# Start the Tauri development server (Vite + native window)
Write-Host "Starting Tauri dev server..." -ForegroundColor Cyan
pnpm tauri dev

# Clean up backend when Tauri exits
if ($backend -and !$backend.HasExited) {
    Write-Host "Stopping backend..." -ForegroundColor Yellow
    Stop-Process -Id $backend.Id -Force
}
