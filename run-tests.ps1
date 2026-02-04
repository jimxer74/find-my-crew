#!/usr/bin/env pwsh

Write-Host "===============================================" -ForegroundColor Green
Write-Host "OpenRouter API and AI Fixes Test Suite" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Check if OPENROUTER_API_KEY is set
if (-not $env:OPENROUTER_API_KEY) {
    Write-Host "❌ OPENROUTER_API_KEY environment variable is not set" -ForegroundColor Red
    Write-Host "Please run: $env:OPENROUTER_API_KEY='your_api_key_here'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Running quick verification only..."
    node test-quick.js
    exit
}

Write-Host "✅ OPENROUTER_API_KEY is set" -ForegroundColor Green
Write-Host ""

Write-Host "Running comprehensive test suite..." -ForegroundColor Yellow

Write-Host ""
Write-Host "1. Quick Verification..." -ForegroundColor Cyan
node test-quick.js

Write-Host ""
Write-Host "2. Comprehensive Testing..." -ForegroundColor Cyan
node test-comprehensive.js

Write-Host ""
Write-Host "3. Rate Limiting Tests..." -ForegroundColor Cyan
node test-rate-limiting.js

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Test suite completed." -ForegroundColor Green
Write-Host ""
Write-Host "If all tests show ✅, your AI assistant fixes are working correctly!" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to continue"