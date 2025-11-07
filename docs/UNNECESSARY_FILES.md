# Files and Folders You Don't Need in Project

## Dependencies (Can be regenerated)
- `node_modules/` (root)
- `SoundCloudJukeboxMobile/node_modules/`
- `package-lock.json` (root)
- `SoundCloudJukeboxMobile/package-lock.json`

## IDE/Editor Configuration (Personal preferences)
- `.vscode/` - VS Code settings
- `.kilocode/` - Kilo Code editor configuration
- `.git/` - Git repository (if you want to remove version control)

## Development/Testing Scripts (May not be needed in production)
- `expose.bat`
- `expose.ps1`
- `expose-cloudflared-skip-verify.bat`
- `expose-cloudflared-skip-verify.ps1`
- `expose-no-password.bat`
- `expose-no-password.ps1`
- `expose-no-password-proxy.bat`
- `expose-no-password-proxy.ps1`
- `get-tunnel-password.bat`
- `get-tunnel-password.ps1`
- `setup-ngrok.ps1`
- `start.bat`
- `start.ps1`

## Utility Scripts (Temporary/Development tools)
- `tree.ps1` - Tree visualization script (just created)

## Log Files (If any exist)
- `*.log`
- `npm-debug.log*`
- `yarn-debug.log*`
- `yarn-error.log*`

## Environment Files (Should be in .gitignore, but check if committed)
- `.env`
- `.env.local`

## Build Artifacts (If any)
- `dist/`
- `build/`
- `.next/`
- `out/`

## Cache Files
- `.cache/`
- `.parcel-cache/`
- `.turbo/`

## OS Files
- `.DS_Store` (macOS)
- `Thumbs.db` (Windows)
- `desktop.ini` (Windows)

## Notes:
- `node_modules` can always be regenerated with `npm install`
- `package-lock.json` can be regenerated but is useful for consistent installs
- IDE configs (`.vscode`, `.kilocode`) are personal preferences
- Development scripts (`.bat`, `.ps1`) may be needed for local development
- Consider what's needed for deployment vs. what's only for local development

