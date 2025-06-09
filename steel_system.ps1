# Steel System Startup Script
# Author: AI Assistant
# Version: 1.0

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    Steel System Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we are in the project root directory
if (-not (Test-Path "package.json") -or -not (Test-Path "server") -or -not (Test-Path "client")) {
    Write-Host "Error: Please run this script in the project root directory" -ForegroundColor Red
    Write-Host "Current directory should contain: package.json, server/, client/" -ForegroundColor Yellow
    Read-Host "Press any key to exit"
    exit 1
}

# Check if Node.js is installed
Write-Host "Checking Node.js environment..." -ForegroundColor Yellow
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
}
catch {
    # Ignore error
}

if ($nodeVersion) {
    Write-Host "Node.js is installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press any key to exit"
    exit 1
}

# Check if npm is available
$npmVersion = $null
try {
    $npmVersion = npm --version 2>$null
}
catch {
    # Ignore error
}

if ($npmVersion) {
    Write-Host "npm is installed: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting system..." -ForegroundColor Cyan
Write-Host ""

# Function to check and install dependencies
function Install-Dependencies {
    param($directory, $name)
    
    Write-Host "Checking $name dependencies..." -ForegroundColor Yellow
    
    if (Test-Path "$directory/node_modules") {
        Write-Host "$name dependencies exist" -ForegroundColor Green
    } else {
        Write-Host "$name dependencies not found, installing..." -ForegroundColor Yellow
        Push-Location $directory
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$name dependencies installed successfully" -ForegroundColor Green
        } else {
            Write-Host "$name dependencies installation failed" -ForegroundColor Red
            Pop-Location
            Read-Host "Press any key to exit"
            exit 1
        }
        Pop-Location
    }
}

# Install root dependencies
Install-Dependencies "." "Root"

# Install client dependencies
Install-Dependencies "client" "Client"

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Cyan

# Create logs directory
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Start backend server
Write-Host "Starting backend server..." -ForegroundColor Blue
$serverProcess = Start-Process powershell -ArgumentList @(
    "-Command",
    "cd '$PWD'; node server/index.js"
) -PassThru -WindowStyle Normal

Write-Host "Backend server started (PID: $($serverProcess.Id))" -ForegroundColor Green
Write-Host "Server address: http://localhost:5001" -ForegroundColor Cyan

# Wait for server to start
Write-Host "Waiting for backend server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check if backend server started successfully
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001" -TimeoutSec 5 -UseBasicParsing 2>$null
    Write-Host "Backend server started successfully" -ForegroundColor Green
} catch {
    Write-Host "Backend server may still be starting..." -ForegroundColor Yellow
}

# Start frontend development server
Write-Host "Starting frontend development server..." -ForegroundColor Blue
$clientProcess = Start-Process powershell -ArgumentList @(
    "-Command",
    "cd '$PWD/client'; npm start"
) -PassThru -WindowStyle Normal

Write-Host "Frontend development server started (PID: $($clientProcess.Id))" -ForegroundColor Green
Write-Host "Frontend address: http://localhost:3000" -ForegroundColor Cyan

Write-Host ""
Write-Host "System startup completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Service Information:" -ForegroundColor White
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:5001" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "1. Wait for frontend server to fully start (about 30-60 seconds)" -ForegroundColor White
Write-Host "2. Browser will automatically open the system interface" -ForegroundColor White
Write-Host "3. If not automatically opened, manually visit: http://localhost:3000" -ForegroundColor White
Write-Host "4. To stop the system, close all related PowerShell windows" -ForegroundColor White
Write-Host ""

# Wait for frontend server to fully start
Write-Host "Waiting for frontend server to fully start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Try to open browser
try {
    Start-Process "http://localhost:3000"
    Write-Host "Browser opened system interface" -ForegroundColor Green
} catch {
    Write-Host "Unable to automatically open browser, please manually visit: http://localhost:3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "System is running..." -ForegroundColor Green
Write-Host "Process IDs - Backend: $($serverProcess.Id), Frontend: $($clientProcess.Id)" -ForegroundColor Cyan
Write-Host "To stop the system, close related PowerShell windows or press Ctrl+C" -ForegroundColor Yellow

# Keep script running, monitor processes
Write-Host ""
Write-Host "Press any key to stop all services and exit..." -ForegroundColor Yellow
Read-Host

# Stop services
Write-Host "Stopping services..." -ForegroundColor Red
try {
    if (!$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
        Write-Host "Backend server stopped" -ForegroundColor Green
    }
} catch {
    Write-Host "Problem stopping backend server" -ForegroundColor Yellow
}

try {
    if (!$clientProcess.HasExited) {
        Stop-Process -Id $clientProcess.Id -Force
        Write-Host "Frontend server stopped" -ForegroundColor Green
    }
} catch {
    Write-Host "Problem stopping frontend server" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "System closed, thank you for using!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Read-Host "Press any key to exit" 