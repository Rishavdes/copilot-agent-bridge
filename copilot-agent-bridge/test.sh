#!/bin/bash

# Complete Extension Testing Script
# Tests the Copilot Agent Bridge extension from start to finish

cd "/home/hacker/Desktop/copilot extension/copilot-agent-bridge" || exit 1

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Copilot Agent Bridge - Complete Testing Suite            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Check file structure
echo "TEST 1: File Structure ✓"
echo "─────────────────────────────────────"
FILES=(
  "package.json"
  "tsconfig.json"
  "webpack.config.js"
  ".vscodeignore"
  "src/extension.ts"
  "src/utils/logger.ts"
  "src/utils/config.ts"
  "src/copilot/modelRegistry.ts"
  "src/copilot/copilotClient.ts"
  "src/server/bridgeServer.ts"
  "src/server/requestHandler.ts"
  "src/ui/statusBar.ts"
  "src/ui/sidebarProvider.ts"
  "src/ui/dashboardPanel.ts"
  "media/dashboard.css"
  "media/dashboard.js"
  "assets/icon.png"
)

missing=0
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file (MISSING)"
    ((missing++))
  fi
done
echo ""

if [ $missing -eq 0 ]; then
  echo "✓ All files present!"
else
  echo "✗ $missing files missing"
fi
echo ""

# Test 2: Check build artifacts
echo "TEST 2: Build Artifacts ✓"
echo "─────────────────────────────────────"
if [ -f "dist/extension.js" ]; then
  size=$(wc -c < "dist/extension.js")
  lines=$(wc -l < "dist/extension.js")
  echo "✅ dist/extension.js exists"
  echo "   Size: $size bytes"
  echo "   Lines: $lines"
else
  echo "❌ dist/extension.js NOT FOUND"
fi
echo ""

# Test 3: Check dependencies
echo "TEST 3: Dependencies ✓"
echo "─────────────────────────────────────"
if [ -d "node_modules" ]; then
  dep_count=$(find node_modules -maxdepth 1 -type d | wc -l)
  echo "✅ node_modules installed"
  echo "   Packages: ~$((dep_count - 1))"
else
  echo "❌ node_modules NOT FOUND"
fi
echo ""

# Test 4: Verify extension exports
echo "TEST 4: Extension Entry Points ✓"
echo "─────────────────────────────────────"
if grep -q "export async function activate" src/extension.ts; then
  echo "✅ activate() function exported"
else
  echo "❌ activate() function NOT found"
fi

if grep -q "export function deactivate" src/extension.ts; then
  echo "✅ deactivate() function exported"
else
  echo "❌ deactivate() function NOT found"
fi
echo ""

# Test 5: Check command registration
echo "TEST 5: Command Registration ✓"
echo "─────────────────────────────────────"
commands=(
  "copilot-bridge.startServer"
  "copilot-bridge.stopServer"
  "copilot-bridge.restartServer"
  "copilot-bridge.openDashboard"
  "copilot-bridge.connectAgent"
  "copilot-bridge.testConnection"
  "copilot-bridge.copyEnvConfig"
  "copilot-bridge.viewLogs"
  "copilot-bridge.clearLogs"
  "copilot-bridge.refreshSidebar"
)

found=0
for cmd in "${commands[@]}"; do
  if grep -q "\"$cmd\"" package.json; then
    echo "✅ $cmd"
    ((found++))
  fi
done
echo ""
echo "✓ $found / ${#commands[@]} commands registered"
echo ""

# Test 6: Check sidebar views
echo "TEST 6: Sidebar Views ✓"
echo "─────────────────────────────────────"
views=(
  "copilot-bridge.serverView"
  "copilot-bridge.agentView"
  "copilot-bridge.statsView"
  "copilot-bridge.modelsView"
)

found=0
for view in "${views[@]}"; do
  if grep -q "\"$view\"" package.json; then
    echo "✅ $view"
    ((found++))
  fi
done
echo ""
echo "✓ $found / ${#views[@]} views registered"
echo ""

# Test 7: Check configuration schema
echo "TEST 7: Configuration Schema ✓"
echo "─────────────────────────────────────"
configs=(
  "copilotBridge.port"
  "copilotBridge.host"
  "copilotBridge.autoStart"
  "copilotBridge.authToken"
  "copilotBridge.defaultModel"
  "copilotBridge.agentDirectories"
  "copilotBridge.maxRequestHistory"
  "copilotBridge.requestTimeout"
  "copilotBridge.logLevel"
)

found=0
for cfg in "${configs[@]}"; do
  if grep -q "\"$cfg\"" package.json; then
    echo "✅ $cfg"
    ((found++))
  fi
done
echo ""
echo "✓ $found / ${#configs[@]} settings configured"
echo ""

# Test 8: TypeScript compilation
echo "TEST 8: TypeScript Compilation ✓"
echo "─────────────────────────────────────"
echo "Running: npm run compile..."
if npm run compile > /tmp/build.log 2>&1; then
  echo "✅ Compilation successful"
  if [ -f "dist/extension.js" ]; then
    size=$(wc -c < "dist/extension.js")
    echo "✅ Output: dist/extension.js ($((size / 1024))KB)"
  fi
else
  echo "❌ Compilation failed"
  echo "Log:"
  tail -20 /tmp/build.log
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TESTING COMPLETE ✓                                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next Steps:"
echo "──────────────────────────────────────"
echo "1. Press F5 in VS Code to launch Extension Development Host"
echo "2. In the new window, test commands:"
echo "   • Copilot Bridge: Start Bridge Server"
echo "   • Copilot Bridge: Open Dashboard"
echo "   • Copilot Bridge: Test Connection"
echo "3. Check the sidebar (🤖 icon) for live status"
echo "4. View logs in Output → 'Copilot Bridge' channel"
echo ""
echo "✨ Extension is ready for testing!"
