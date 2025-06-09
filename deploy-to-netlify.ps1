# Netlify Deployment Script for Steel System
# Author: AI Assistant

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    Steel System - Netlify Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Netlify CLI is installed
Write-Host "Checking Netlify CLI..." -ForegroundColor Yellow
try {
    $netlifyVersion = netlify --version 2>$null
    if ($netlifyVersion) {
        Write-Host "Netlify CLI is installed: $netlifyVersion" -ForegroundColor Green
    } else {
        Write-Host "Installing Netlify CLI..." -ForegroundColor Yellow
        npm install -g netlify-cli
    }
} catch {
    Write-Host "Installing Netlify CLI..." -ForegroundColor Yellow
    npm install -g netlify-cli
}

Write-Host ""
Write-Host "Building project for production..." -ForegroundColor Cyan

# Build the project
npm run build:netlify

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit 1
}

Write-Host ""
Write-Host "Deployment options:" -ForegroundColor Yellow
Write-Host "1. Deploy to existing site" -ForegroundColor White
Write-Host "2. Create new site" -ForegroundColor White
Write-Host "3. Deploy preview" -ForegroundColor White

$choice = Read-Host "Select option (1-3)"

switch ($choice) {
    "1" {
        Write-Host "Deploying to production..." -ForegroundColor Cyan
        netlify deploy --prod --dir=client/build --functions=netlify/functions
    }
    "2" {
        Write-Host "Creating new site..." -ForegroundColor Cyan
        netlify deploy --dir=client/build --functions=netlify/functions
    }
    "3" {
        Write-Host "Creating preview deployment..." -ForegroundColor Cyan
        netlify deploy --dir=client/build --functions=netlify/functions
    }
    default {
        Write-Host "Invalid option selected" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "Check your Netlify dashboard for the site URL" -ForegroundColor Cyan

Read-Host "Press any key to exit" 