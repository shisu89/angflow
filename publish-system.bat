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

echo This will bump, build, and publish @angflow/system ONLY to npm with bump "%BUMP%".
echo @angflow/angular will NOT be rebuilt, bumped, or republished. Its dependency
echo stays "workspace:^" and needs no edit -- but the currently published
echo @angflow/angular keeps pointing at the OLD system version until you
echo republish it (use publish-angular.bat, or publish.bat for both at once).
echo npm 2FA will prompt for browser approval on publish.
set /p CONFIRM=Continue? (y/N):
if /i not "%CONFIRM%"=="y" (
    echo Aborted.
    exit /b 1
)

echo.
echo [1/4] Building @angflow/system...
pushd "%ROOT%packages\system"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: system build failed.
    popd
    exit /b 1
)

echo.
echo [2/4] Bumping @angflow/system (%BUMP%)...
call npm version %BUMP% --no-git-tag-version
if errorlevel 1 (
    echo.
    echo ERROR: system version bump failed.
    popd
    exit /b 1
)
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set SYSTEM_VERSION=%%v
echo @angflow/system is now !SYSTEM_VERSION!

echo.
echo [3/4] Publishing @angflow/system@!SYSTEM_VERSION!...
rem npm is correct here: @angflow/system has no "workspace:" dependencies, so
rem there is nothing for pnpm to substitute. Only @angflow/angular needs pnpm.
call npm publish --access public
if errorlevel 1 (
    echo.
    echo ERROR: system publish failed.
    popd
    exit /b 1
)
popd

echo.
echo [4/4] Refreshing pnpm-lock.yaml to match the bumped specifier...
pushd "%ROOT%"
call pnpm install --lockfile-only
if errorlevel 1 (
    echo.
    echo ERROR: pnpm lockfile refresh failed. Run 'pnpm install --lockfile-only' manually before committing.
    popd
    exit /b 1
)
popd

echo.
echo Done.
echo   @angflow/system  -^> !SYSTEM_VERSION!
echo Remember to commit the version bump in packages\system\package.json and pnpm-lock.yaml.
endlocal
