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

echo This will bump, build, and publish @angflow/angular ONLY to npm with bump "%BUMP%".
echo @angflow/system will NOT be rebuilt, bumped, or republished.
echo The existing "@angflow/system" dependency in packages\angular\package.json will be left as-is.
echo npm 2FA will prompt for browser approval on publish.
set /p CONFIRM=Continue? (y/N):
if /i not "%CONFIRM%"=="y" (
    echo Aborted.
    exit /b 1
)

echo.
echo [1/4] Building @angflow/angular...
pushd "%ROOT%packages\angular"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: angular build failed.
    popd
    exit /b 1
)

echo.
echo [2/4] Bumping @angflow/angular (%BUMP%)...
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
echo [3/4] Publishing @angflow/angular@!ANGULAR_VERSION!...
call npm publish --access public
if errorlevel 1 (
    echo.
    echo ERROR: angular publish failed.
    popd
    exit /b 1
)
popd

echo.
echo [4/4] Refreshing pnpm-lock.yaml to match bumped specifier...
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
echo   @angflow/angular -^> !ANGULAR_VERSION!
echo Remember to commit the version bump in packages\angular\package.json and pnpm-lock.yaml.
endlocal
