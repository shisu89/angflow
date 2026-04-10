@echo off
setlocal

set ROOT=%~dp0

echo [1/3] Building @angflow/system...
pushd "%ROOT%packages\system"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: system build failed.
    popd
    exit /b 1
)
popd

echo.
echo [2/3] Building @angflow/angular...
pushd "%ROOT%packages\angular"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: angular build failed.
    popd
    exit /b 1
)
popd

echo.
echo [3/3] Clearing examples\angular\.angular\cache...
if exist "%ROOT%examples\angular\.angular\cache" (
    rmdir /s /q "%ROOT%examples\angular\.angular\cache"
    if errorlevel 1 (
        echo.
        echo ERROR: failed to clear Angular cache.
        exit /b 1
    )
    echo Cache cleared.
) else (
    echo No cache directory found, skipping.
)

echo.
echo Done. Both packages rebuilt and example cache cleared.
echo Note: restart ng serve in examples\angular to pick up the changes.
endlocal
