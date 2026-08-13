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
echo [1/7] Building @angflow/system...
pushd "%ROOT%packages\system"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: system build failed.
    popd
    exit /b 1
)

echo.
echo [2/7] Bumping @angflow/system (%BUMP%)...
call npm version %BUMP% --no-git-tag-version
if errorlevel 1 (
    echo.
    echo ERROR: system version bump failed.
    popd
    exit /b 1
)
rem Read the new system version for the closing summary. It is NOT written into
rem angular's package.json -- pnpm resolves "workspace:^" against it at pack time.
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set SYSTEM_VERSION=%%v
echo @angflow/system is now !SYSTEM_VERSION!

echo.
echo [3/7] Publishing @angflow/system@!SYSTEM_VERSION!...
call npm publish --access public
if errorlevel 1 (
    echo.
    echo ERROR: system publish failed.
    popd
    exit /b 1
)
popd

echo.
echo [4/7] Building @angflow/angular...
pushd "%ROOT%packages\angular"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: angular build failed.
    popd
    exit /b 1
)

echo.
echo [5/7] Bumping @angflow/angular (%BUMP%)...
rem The "@angflow/system" dep is deliberately NOT rewritten here. It stays
rem "workspace:^" in the repo, and pnpm substitutes it against the workspace's
rem current system version (just bumped to !SYSTEM_VERSION! above) when packing.
rem An earlier version of this script did `npm pkg set` to a ">=" range so that
rem `npm publish` would work -- which meant publishing angular through
rem publish-angular.bat, which has no such step, shipped "workspace:^" verbatim.
rem That was the 0.3.18 break. One strategy now: workspace:^ everywhere, pnpm publishes.
call npm version %BUMP% --no-git-tag-version
if errorlevel 1 (
    echo.
    echo ERROR: angular version bump failed.
    popd
    exit /b 1
)
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set ANGULAR_VERSION=%%v
echo @angflow/angular is now !ANGULAR_VERSION!

echo.
echo [6/7] Publishing @angflow/angular@!ANGULAR_VERSION!...
rem MUST be pnpm -- see the note in step [5/7] and scripts/check-publish-tool.js.
rem --no-git-checks: the bumps above dirty the tree by design.
call pnpm publish --access public --no-git-checks
if errorlevel 1 (
    echo.
    echo ERROR: angular publish failed.
    popd
    exit /b 1
)
popd

echo.
echo [7/7] Refreshing pnpm-lock.yaml to match bumped specifiers...
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
echo   @angflow/angular -^> !ANGULAR_VERSION!
echo Remember to commit the version bumps in packages\system\package.json, packages\angular\package.json, and pnpm-lock.yaml.
endlocal
