@echo off
echo ===============================================
echo OpenRouter API and AI Fixes Test Suite
echo ===============================================

REM Check if OPENROUTER_API_KEY is set
if "%OPENROUTER_API_KEY%"=="" (
    echo ❌ OPENROUTER_API_KEY environment variable is not set
    echo Please run: set OPENROUTER_API_KEY=your_api_key_here
    echo.
    echo Running quick verification only...
    node test-quick.js
    goto end
)

echo ✅ OPENROUTER_API_KEY is set
echo.
echo Running comprehensive test suite...

echo.
echo 1. Quick Verification...
node test-quick.js

echo.
echo 2. Comprehensive Testing...
node test-comprehensive.js

echo.
echo 3. Rate Limiting Tests...
node test-rate-limiting.js

:end
echo.
echo ===============================================
echo Test suite completed.
echo.
echo If all tests show ✅, your AI assistant fixes are working correctly!
echo.
pause