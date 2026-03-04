# Testing Guide

This guide shows you how to test your tool server locally before deploying.

## Prerequisites

Install dependencies:
```bash
pnpm install
# or
npm install
```

Note: The `dev` command automatically builds on first run, so you can skip the manual build step unless you specifically need production builds.

## Testing Methods

The template uses **Node.js HTTP server** for both development and production - ensuring you test the exact same code that runs in production (Cloud Run, Railway, etc.).

### Development Mode (with auto-rebuild)

This mode watches for file changes and automatically rebuilds and restarts the server:

```bash
pnpm dev
# or
npm run dev
```

**What happens:**
- Terminal 1: Rollup watch mode rebuilds TypeScript on file changes
- Terminal 2: Node.js --watch restarts server when lib/ changes
- Both run via `concurrently` in a single command

**Server runs on:** http://localhost:3000 (default)

**Test the API:**
```bash
# List all tools/skills/interactions
curl http://localhost:3000/api

# Execute calculator tool
curl -X POST http://localhost:3000/api \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "calculator",
    "tool_input": {"expression": "10 * 5 + 2^3"},
    "context": {"serverUrl": "http://localhost:3000"}
  }'
```

**Browse the UI:**
- Main page: http://localhost:3000/
- Calculator tool: http://localhost:3000/tools/calculator
- Code review skill: http://localhost:3000/skills/code-review
- Summarize interaction: http://localhost:3000/interactions/summarize

**Custom port:**
```bash
PORT=8080 pnpm dev
```

### Production Mode

This is identical to how it runs in Cloud Run, Railway, etc.

**Step 1: Build**
```bash
pnpm build
# or
npm run build
```

**Step 2: Start the server**
```bash
pnpm start
# or
npm start
```

Server will start on **http://localhost:3000** (default)

### Manual Control (Advanced)

If you want separate control of build and server processes:

```bash
# Terminal 1: Rollup watch mode
pnpm run build:watch

# Terminal 2: Node with auto-restart
pnpm run start:watch
```

## Testing Individual Resources

### 1. Testing the Calculator Tool

Replace `{{VERTESIA_JWT}}` with a valid Vertesia JWT token in all examples below.

**Basic calculation:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/tools/calculator" \
  -d '{
    "tool_use": {
      "id": "run1",
      "tool_name": "calculator",
      "tool_input": {"expression": "2 + 2"}
    }
  }'
```

Expected response:
```json
{
  "is_error": false,
  "content": "Result: 2 + 2 = 4"
}
```

**Complex expression:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/tools/calculator" \
  -d '{
    "tool_use": {
      "id": "run2",
      "tool_name": "calculator",
      "tool_input": {"expression": "(10 + 5) * 2 - 3^2"}
    }
  }'
```

**Error handling:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/tools/calculator" \
  -d '{
    "tool_use": {
      "id": "run3",
      "tool_name": "calculator",
      "tool_input": {"expression": "invalid"}
    }
  }'
```

Expected response:
```json
{
  "is_error": true,
  "content": "Calculation error: Failed to evaluate expression: ..."
}
```

### 2. Testing Skills

Skills are prompt templates, so you can't "execute" them via the API. Instead, retrieve their details:

**Get skill details:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  "http://localhost:3000/api/skills/code-review/skill_code-review"
```

**List all skills:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  "http://localhost:3000/api" | jq '.skills'
```

**View skill in browser:**
- http://localhost:3000/skills/code-review

### 3. Testing Interactions

Interactions define workflows with templated prompts.

**Get interaction details:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  "http://localhost:3000/api/interactions/summarize/text_summarizer"
```

**List all interactions:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  "http://localhost:3000/api" | jq '.interactions'
```

**Browse interaction page:**
- http://localhost:3000/interactions/summarize

## Testing Vercel Deployment Locally

If you want to test the Vercel deployment setup locally:

```bash
# Install Vercel CLI
npm i -g vercel

# Run Vercel dev server
pnpm start:vercel
# or
vercel dev
```

This simulates the Vercel serverless function environment.

## Common Test Scenarios

### Test 1: Server Health Check
```bash
# Should return 200 with list of tools/skills/interactions
curl -i http://localhost:3000/api
```

### Test 2: Invalid Tool Name
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/tools/nonexistent" \
  -d '{
    "tool_use": {
      "id": "test1",
      "tool_name": "nonexistent",
      "tool_input": {}
    }
  }'
```

Should return an error response.

### Test 3: Missing Required Parameters
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/tools/calculator" \
  -d '{
    "tool_use": {
      "id": "test2",
      "tool_name": "calculator",
      "tool_input": {}
    }
  }'
```

Should return validation error about missing `expression`.

### Test 4: HTML Pages Generated
```bash
# Check main index page exists
curl -s http://localhost:3000/ | grep -q "Tool Server Template"
echo $?  # Should output 0 (success)

# Check calculator tool page
curl -s http://localhost:3000/tools/calculator | grep -q "Calculator Tools"
echo $?  # Should output 0
```

### Test 5: Browser Bundles Created
```bash
# Check that browser bundle exists
ls -lh dist/libs/tool-server-calculator.js

# Should show the bundled file with size
```

## Debugging Tips

### Enable Detailed Logging

Add to your `.env` file:
```bash
DEBUG=*
NODE_ENV=development
```

### Check Build Output

After building, verify structure:
```bash
tree lib/ -L 3
```

Expected structure:
```
lib/
├── server.js
├── server-node.js
├── build-site.js
├── index.html
├── tools/
│   └── calculator/
│       ├── index.html
│       ├── index.js
│       └── ...
├── skills/
│   └── code-review/
│       ├── index.html
│       └── SKILL.md
├── interactions/
│   └── summarize/
│       └── ...
└── libs/
    └── tool-server-calculator.js
```

### Check TypeScript Compilation

Verify no TypeScript errors:
```bash
pnpm exec tsc --noEmit
```

### Watch Rollup Build Process

See what Rollup is doing:
```bash
pnpm run build:watch
# Watch the console for build errors
```

### Test with Different Ports

```bash
# Test port binding
PORT=8080 pnpm start
PORT=9000 pnpm start
```

### Debug Raw Imports

If `?raw` imports aren't working, check:
```bash
# Verify the rawPlugin is in rollup.config.js
grep -A 10 "rawPlugin" rollup.config.js

# Check the imported file exists
ls -la src/tool-server/interactions/*/prompts/*.jst
```

## Performance Testing

### Simple Load Test with Apache Bench

```bash
# Install apache bench (usually pre-installed on Mac/Linux)
# On Mac: already available
# On Ubuntu: apt-get install apache2-utils

# Test GET /api endpoint
ab -n 1000 -c 10 http://localhost:3000/api

# Test POST /api endpoint (save request to file first)
cat > post_data.json <<EOF
{
  "tool_name": "calculator",
  "tool_input": {"expression": "2 + 2"},
  "context": {"serverUrl": "http://localhost:3000"}
}
EOF

ab -n 1000 -c 10 -p post_data.json -T application/json http://localhost:3000/api
```

## Environment Variables

Create a `.env` file for local testing:

```bash
# Copy example
cp .env.example .env

# Edit with your values
PORT=3000
NODE_ENV=development
```

## Next Steps

Once local testing passes:

1. **Deploy to Vercel:**
   ```bash
   vercel
   ```

2. **Deploy to Cloud Run:**
   ```bash
   # Build Docker image (you'll need to create a Dockerfile)
   gcloud run deploy tool-server \
     --source . \
     --platform managed \
     --region us-central1
   ```

3. **Deploy to Railway/Fly.io/Render:**
   - They can auto-detect the Node.js server from `package.json`
   - Use `npm start` as the start command

## Troubleshooting

### Problem: `@vertesia/tools-sdk` not found

**Solution:** Make sure you're in a pnpm workspace with the SDK, or update `package.json` to point to the correct SDK location.

### Problem: HTML pages not showing

**Solution:** Run `pnpm build` first. HTML pages are generated during the build process.

### Problem: Port already in use

**Solution:** Use a different port:
```bash
PORT=8080 pnpm start
```

### Problem: Tool execution returns 404

**Solution:** Check that the tool is properly registered in `src/tool-server/tools/index.ts` and rebuild:
```bash
pnpm build
```

### Problem: Changes not reflected in dev mode

**Solution:**
- Make sure `pnpm dev` is running (it should auto-rebuild)
- Check the console for Rollup build errors
- If it's still not working, restart `pnpm dev`

### Problem: "Cannot find module" errors

**Solution:** Make sure you're using `.js` extensions in imports:
```typescript
// ✅ Correct
import { MyTool } from './my-tool.js';

// ❌ Wrong
import { MyTool } from './my-tool';
```

## Summary

**Quick Start for Testing:**

```bash
# 1. Install dependencies
pnpm install

# 2. Start development server (builds automatically + auto-rebuild + restart)
pnpm dev

# 3. In another terminal, test the API
curl http://localhost:3000/api

# 4. Test calculator tool
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/tools/calculator" \
  -d '{"tool_use":{"id":"test","tool_name":"calculator","tool_input":{"expression":"2+2"}}}'

# 5. Open browser
open http://localhost:3000
```

**Understanding the Build Process:**

The template uses **Rollup** for everything:
- **TypeScript compilation** (src → dist) with `@rollup/plugin-typescript`
- **Raw imports** (`?raw`) via custom rawPlugin
- **Browser bundles** (lib/tools → dist/libs) with minification

All in one `rollup.config.js` file!

You're all set! 🚀
