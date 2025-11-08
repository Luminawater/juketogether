# Using Railway MCP Tools

This project has Railway MCP (Model Context Protocol) integration, which allows AI assistants to interact with Railway directly through tools.

## Prerequisites

1. **Railway CLI Installed**: ✅ Already installed via `npm install -g @railway/cli`
2. **Logged In**: You need to run `railway login` manually (opens browser)

## Available MCP Tools

Once logged in, you can use these Railway MCP tools:

### Project Management
- **`list-projects`** - List all your Railway projects
- **`create-project-and-link`** - Create a new project and link it to this workspace
- **`link-service`** - Link a service to the current project

### Deployment
- **`deploy`** - Deploy your code to Railway
- **`list-deployments`** - List recent deployments with status
- **`get-logs`** - View build or deployment logs

### Domain Management
- **`generate-domain`** - Generate a Railway domain for your service
  - This is the key tool for setting up your GoDaddy domain!

### Environment & Variables
- **`list-variables`** - Show all environment variables for a service
- **`set-variables`** - Set environment variables
- **`list-services`** - List all services in a project
- **`create-environment`** - Create a new environment (production, staging, etc.)
- **`link-environment`** - Link to a specific environment

### Monitoring
- **`get-logs`** - View real-time logs from your service
- **`list-deployments`** - Check deployment status and history

## Quick Start

### 1. Login to Railway

Run this in your terminal (it will open a browser):

```bash
railway login
```

### 2. Link Your Project (if it exists)

If you already have a Railway project:

```bash
railway link
```

Or create a new one:

```bash
railway init
```

### 3. Use MCP Tools

Once logged in, you can ask the AI assistant to:

- **"List my Railway projects"** → Uses `list-projects`
- **"Generate a domain for my service"** → Uses `generate-domain`
- **"Show my environment variables"** → Uses `list-variables`
- **"Deploy to Railway"** → Uses `deploy`
- **"Show me the logs"** → Uses `get-logs`

## Example: Setting Up Domain with MCP

Once you're logged in, you can ask:

> "Generate a domain for my Railway service"

The AI will:
1. Use `generate-domain` MCP tool
2. Get the CNAME value from Railway
3. Tell you exactly what to add in GoDaddy DNS

## Example: Setting Environment Variables

Ask:

> "Set my Stripe secret key in Railway"

The AI will:
1. Use `set-variables` MCP tool
2. Add the variable to your Railway service
3. Confirm it's set

## Example: Deploying

Ask:

> "Deploy my code to Railway"

The AI will:
1. Use `deploy` MCP tool
2. Upload and deploy your code
3. Show you the deployment status

## MCP vs CLI

**MCP Tools** (via AI):
- ✅ Can be used in conversation
- ✅ AI can automate workflows
- ✅ Good for one-off tasks
- ✅ Can combine multiple operations

**CLI Commands** (manual):
- ✅ Full control
- ✅ Good for scripts
- ✅ Better for debugging
- ✅ Interactive commands

## Troubleshooting

### "Not logged in" Error

Run:
```bash
railway login
```

### "CLI not found" Error

Install CLI:
```bash
npm install -g @railway/cli
```

### MCP Tools Not Working

1. Ensure Railway CLI is installed: `railway --version`
2. Ensure you're logged in: `railway login`
3. Check MCP server is running (should be automatic in Cursor)

## Next Steps

1. **Login**: Run `railway login` in terminal
2. **Link Project**: Run `railway link` or `railway init`
3. **Use MCP**: Ask AI to help with Railway tasks!

Example prompts:
- "What Railway projects do I have?"
- "Generate a domain for my service"
- "Show me my Railway environment variables"
- "Deploy this code to Railway"
- "What's the status of my latest deployment?"

