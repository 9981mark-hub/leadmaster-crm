@echo off
echo ========================================================
echo LeadMaster CRM - Supabase Edge Function Deploy
echo ========================================================
echo.
echo Deploying telegram-webhook to Supabase...
echo.

npx supabase functions deploy telegram-webhook --project-ref cenksfblktflfurxjmtv --no-verify-jwt

echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Edge Function deployed successfully.
) else (
    echo [ERROR] Deployment failed.
)
echo.
pause
