$backendProject = Join-Path $PSScriptRoot "..\..\backend\TalentValley.Api\TalentValley.Api.csproj"
$frontendDirectory = Split-Path $PSScriptRoot -Parent
$backendProcess = Start-Process dotnet -ArgumentList "run", "--project", $backendProject, "--launch-profile", "http" -PassThru
$previousApiBaseUrl = $env:NEXT_PUBLIC_API_BASE_URL
$env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:5087"
$frontendProcess = Start-Process node -WorkingDirectory $frontendDirectory -ArgumentList ".\\node_modules\\next\\dist\\bin\\next", "dev" -PassThru

if ($null -eq $previousApiBaseUrl) {
    Remove-Item Env:NEXT_PUBLIC_API_BASE_URL
} else {
    $env:NEXT_PUBLIC_API_BASE_URL = $previousApiBaseUrl
}

Write-Host "Backend: http://localhost:5087"
Write-Host "Frontend: http://localhost:3000"

try {
    Wait-Process -Id $frontendProcess.Id
}
finally {
    Stop-Process -Id $backendProcess.Id, $frontendProcess.Id -ErrorAction SilentlyContinue
}
