@echo off
echo Testing OpenRouter API and JSON Parsing
echo ======================================

REM Check if OPENROUTER_API_KEY is set
if "%OPENROUTER_API_KEY%"=="" (
    echo ❌ OPENROUTER_API_KEY environment variable is not set
    echo Please set it with: set OPENROUTER_API_KEY=your_api_key_here
    echo.
    echo Running JSON parsing tests only...
    node test-comprehensive.js
    goto end
)

echo ✅ OPENROUTER_API_KEY is set
echo Running comprehensive tests...
node test-comprehensive.js

:end
echo.
echo Tests completed.
pause