@echo off
setlocal EnableDelayedExpansion

set ROOT=%~dp0

rem Version bump level: patch (default), minor, major, or none.
rem Use "none" to publish the current version as-is (e.g. the first 0.0.1 release).
set BUMP=%1
if "%BUMP%"=="" set BUMP=patch

if /i not "%BUMP%"=="patch" if /i not "%BUMP%"=="minor" if /i not "%BUMP%"=="major" if /i not "%BUMP%"=="none" (
    echo ERROR: bump level must be patch, minor, major, or none. Got "%BUMP%".
    exit /b 1
)

echo This will build and publish @angflow/mcp ONLY to npm with bump "%BUMP%".
echo The build regenerates the agent tool-schema snapshot from @angflow/angular.
echo npm 2FA will prompt for browser approval on publish.
set /p CONFIRM=Continue? (y/N):
if /i not "%CONFIRM%"=="y" (
    echo Aborted.
    exit /b 1
)

echo.
echo [1/3] Building @angflow/mcp...
pushd "%ROOT%packages\mcp"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: mcp build failed.
    popd
    exit /b 1
)

echo.
if /i "%BUMP%"=="none" (
    echo [2/3] Skipping version bump ^(publishing current version as-is^)...
) else (
    echo [2/3] Bumping @angflow/mcp ^(%BUMP%^)...
    call npm version %BUMP% --no-git-tag-version
    if errorlevel 1 (
        echo.
        echo ERROR: mcp version bump failed.
        popd
        exit /b 1
    )
)
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set MCP_VERSION=%%v
echo @angflow/mcp is now !MCP_VERSION!

echo.
echo [3/3] Publishing @angflow/mcp@!MCP_VERSION!...
call npm publish --access public
if errorlevel 1 (
    echo.
    echo ERROR: mcp publish failed.
    popd
    exit /b 1
)
popd

echo.
echo Done.
echo   @angflow/mcp -^> !MCP_VERSION!
echo Remember to commit the version bump in packages\mcp\package.json.
endlocal
