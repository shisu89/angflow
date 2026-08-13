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
echo The "@angflow/system" dependency stays "workspace:^" in the repo; pnpm
echo substitutes it with a real semver range inside the published tarball.
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
rem MUST be pnpm, not npm: "@angflow/system" is declared "workspace:^" and only
rem pnpm rewrites that to a real semver range when packing. A raw `npm publish`
rem ships the literal string and breaks every clean install -- that is how
rem 0.3.18 shipped broken. scripts/check-publish-tool.js runs as `prepack` and
rem refuses any non-pnpm pack, so npm cannot get past this line anyway.
rem
rem --no-git-checks: step [2/4] just bumped package.json, so the tree is dirty by
rem design and pnpm would otherwise abort. This only waives pnpm's tidiness
rem check; the prepack guard above still runs and is what actually protects the
rem published manifest.
call pnpm publish --access public --no-git-checks
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
