@echo off
setlocal EnableDelayedExpansion

set ROOT=%~dp0

rem Version bump level: patch (default), minor, or major.
set BUMP=%1
if "%BUMP%"=="" set BUMP=patch

if /i not "%BUMP%"=="patch" if /i not "%BUMP%"=="minor" if /i not "%BUMP%"=="major" (
    echo ERROR: bump level must be patch, minor, or major. Got "%BUMP%".
    exit /b 1
)

echo This will bump, build, and publish BOTH packages to npm with bump "%BUMP%".
echo npm 2FA will prompt for browser approval on each publish.
set /p CONFIRM=Continue? (y/N):
if /i not "%CONFIRM%"=="y" (
    echo Aborted.
    exit /b 1
)

echo.
echo [1/6] Building @angflow/system...
pushd "%ROOT%packages\system"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: system build failed.
    popd
    exit /b 1
)

echo.
echo [2/6] Bumping @angflow/system (%BUMP%)...
call npm version %BUMP% --no-git-tag-version
if errorlevel 1 (
    echo.
    echo ERROR: system version bump failed.
    popd
    exit /b 1
)
rem Read the new system version for the angular dep update.
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set SYSTEM_VERSION=%%v
echo @angflow/system is now !SYSTEM_VERSION!

echo.
echo [3/6] Publishing @angflow/system@!SYSTEM_VERSION!...
call npm publish --access public
if errorlevel 1 (
    echo.
    echo ERROR: system publish failed.
    popd
    exit /b 1
)
popd

echo.

echo   @angflow/system  -^> !SYSTEM_VERSION!
echo Remember to commit the version bumps in packages\system\package.json, packages\angular\package.json, and pnpm-lock.yaml.
endlocal
