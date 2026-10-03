# setup.ps1

Write-Host "Verifying environment prerequisites..."

# Check Node.js version
try {
    $nodeVersion = node -v
    if ($LASTEXITCODE -ne 0 -and $null -eq $nodeVersion) {
        Write-Error "Node.js is not installed or not in PATH."
        exit 1
    }

    $nodeVersionNum = [version]($nodeVersion -replace 'v', '')
    if ($nodeVersionNum.Major -lt 20) {
        Write-Error "Node.js version is $nodeVersion. Please upgrade to v20 or higher."
        exit 1
    }
    Write-Host "Node.js version $nodeVersion verified."
} catch {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js v20 or higher."
    exit 1
}

# Check Docker
try {
    docker --version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker Desktop is not installed or not in PATH."
        exit 1
    }
    Write-Host "Docker verified."
} catch {
    Write-Error "Docker Desktop is not installed or not in PATH."
    exit 1
}

Write-Host "Creating directory structure..."
$directories = @(
    "apps/web",
    "apps/api",
    "packages/shared",
    "tools/botlab",
    "reports"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "Created directory: $dir"
}

Write-Host "Creating .gitignore..."
$gitignoreContent = @"
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Dependency directories
node_modules/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# dotenv environment variables file
.env
.env.test
.env.production
.env.local
.env.development.local
.env.test.local
.env.production.local

# parcel-bundler cache
.cache
.parcel-cache

# Next.js build output
.next
out

# macOS specific
.DS_Store

# IDEs
.vscode/
.idea/
"@

Set-Content -Path ".gitignore" -Value $gitignoreContent
Write-Host "Created .gitignore"

Write-Host "Creating .env.example..."
$envExampleContent = @"
# Application Port
PORT=3000

# Database Connection String
DATABASE_URL=
"@

Set-Content -Path ".env.example" -Value $envExampleContent
Write-Host "Created .env.example"

Write-Host "Monorepo setup complete!"
