# Copilot Agent Bridge — Complete Setup

done
This `SETUP.md` walks you through getting the Copilot Agent Bridge extension built, run, and tested end-to-end on your machine. It includes a step-by-step guide for development, running the extension in the Extension Development Host, testing the local HTTP bridge endpoints, and validating real Copilot connectivity using the included Python test agent.

If you already followed a shorter guide, this file consolidates everything into one authoritative reference.

---

## Quick checklist (what you'll do)
- Install prerequisites
- Build the extension bundle
- Launch the Extension Development Host (F5)
- Open the Dashboard and start the Bridge server
- Verify HTTP endpoints (/health, /status, /models, /chat)
- Run the Python test agent and optional retry loop
- Troubleshoot and collect logs if something fails

---

## 0. Where things live (paths)
- Extension root: `<workspace-root>/copilot-agent-bridge`  (open this folder in VS Code)
- Webview UI: `media/dashboard.js`, `media/dashboard.css`
- Extension source: `src/` (TypeScript files)
- Test agent: `<workspace-root>/test-agent`
- This guide: `<workspace-root>/SETUP.md`

Replace `<workspace-root>` with the top-level directory where you checked out this project.

---

## 1. Prerequisites
- VS Code (latest stable)
- Node.js (16+ recommended) and npm
- Python 3.8+ (for the test agent)
- Git (recommended)
- The GitHub Copilot extension installed in your main VS Code and signed in

Make sure the main VS Code (not the Dev Host) is signed into GitHub Copilot.

---

## 2. Install JS dependencies and build the extension
Open a terminal and run the following commands in the extension folder (relative to your workspace root):

```bash
cd "<workspace-root>/copilot-agent-bridge"
# Install dependencies (run once)
npm install

# Build the extension bundle (run after edits)
npm run compile
```

Successful output ends with `webpack ... compiled successfully` and `dist/extension.js` is produced.

---

## 3. Launch the Extension Dev Host (for development)
1. Open the extension folder in VS Code: `code "<workspace-root>/copilot-agent-bridge"`.
2. Press `F5` to start the Extension Development Host. A new VS Code window (Dev Host) opens.
3. In the Dev Host, open Command Palette and run: `Copilot Bridge: Open Dashboard`.

Open DevTools for the webview (focus dashboard then press `F12`) to view console logs and verify messages.

---

## 4. Start the local Bridge server from the Dashboard
- In the dashboard webview, click the green **▶ Start** button (or run the `Copilot Bridge: Start Server` command).
- Dashboard status should change to `RUNNING` and show the endpoint:

```
http://127.0.0.1:8765/
```

If the UI is unresponsive, open the DevTools console (F12) and look for logs beginning with `[Dashboard]`.

---

## 5. Quick HTTP endpoint tests (browser / curl)
Open the welcome page in a browser: `http://127.0.0.1:8765/` (the extension provides a small welcome HTML). Use `curl` for JSON endpoints:

```bash
# Health
curl -s http://127.0.0.1:8765/health | jq

# Status
curl -s http://127.0.0.1:8765/status | jq

# Models (should return an array of models)
curl -s http://127.0.0.1:8765/models | jq

# Chat (example)
curl -s -X POST http://127.0.0.1:8765/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Hello from curl!"}' | jq
```

If `/models` returns a non-empty array, the extension is successfully reading Copilot models.

---

## 6. Python test agent (end-to-end validation)
A simple test agent lives in `test-agent/` under your workspace root. It contains `test_bridge.py`, `requirements.txt`, and a helper script.

Create and activate a virtual environment, install requirements, and run the test script:

```bash
cd "<workspace-root>/test-agent"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Run the tests once
./run_test.sh
```

`run_test.sh` runs the health, status, models and chat tests and prints a summary. If Chat is tested, the bridge will call Copilot via the extension's Copilot client.

Optional: run the tests in a loop until all pass:

```bash
# Retry loop - runs until all pass
while true; do
  source venv/bin/activate
  python test_bridge.py && echo "ALL PASSED" && break
  echo "One or more checks failed — retrying in 5s..."
  sleep 5

```

---

## 7. How model selection works
- Use the **Available Copilot Models** panel and click **Select** on any model. A toast confirms the change.
- The dashboard also provides an **Active Model** dropdown that is populated with all discovered models. Selecting a model sends the change to the extension which updates the `copilotBridge.defaultModel` setting.
- After changing models, restart the bridge from the dashboard to ensure the new default model is used by the Copilot client.

You can change the default model manually in `settings.json`:

```json
"copilotBridge.defaultModel": "gpt-4o"
```

---

## 8. Common troubleshooting
- UI doesn't update / buttons don't work
  - Open webview DevTools (F12) and look for `[Dashboard]` logs and any errors.
  - Confirm `media/dashboard.js` loaded (no 404s in Network tab).
  - Reload Dev Host (Ctrl+Shift+P → "Developer: Reload Window").

- `/models` returns empty or `Loading`:
  - Ensure GitHub Copilot is installed and signed in in the main VS Code instance (not Dev Host).
  - Check Output → "Copilot Bridge" channel for errors.
  - In the extension logs (Dev Host) look for `Found X Copilot models` messages.

- Bridge unreachable at `127.0.0.1:8765`:
  - Ensure you've started the bridge from the dashboard (Start button).
  - Confirm the welcome page: `curl http://127.0.0.1:8765/health` should return JSON.

- Python package install errors
  - Use a virtualenv. If your environment blocks installs, create a venv as shown above.

---

## 9. Collecting logs for debugging
- Webview console (F12 in dashboard): shows `[Dashboard]` logs and errors
- Extension Output: View `Output` panel → select `Copilot Bridge` channel
- Dev Host CLI: If you started the extension from VS Code, the debug console shows extension runtime logs

When reporting issues, copy:
- The webview console output (F12)
- `Output` → `Copilot Bridge` channel contents
- Results from `curl /health` and `curl /models`

---

## 10. Advanced: testing Copilot connectivity manually
Sometimes you'll want to run a test chat without the Python agent. Use curl to POST to `/chat`:

```bash
curl -s -X POST http://127.0.0.1:8765/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Reply with exactly: BRIDGE_OK", "model":"gpt-4o"}' | jq
```

Expect a JSON response with model and content fields when successful.

---

## 11. If you want me to keep testing automatically
If you want an automated loop where I (the assistant) keep running checks — I can provide a script you run locally that will:
- Build the extension (if changed)
- Launch extension Dev Host (manual step: F5)
- Start the bridge via the webview command (must be clicked or invoked via the command palette)
- Run the Python test agent repeatedly until all tests pass

I cannot press buttons in your UI remotely; I can only modify the code and provide scripts you run locally. Tell me if you'd like that script and I'll add it.

---

## 12. Next steps I recommend
1. Build and open the Dev Host (`F5`).
2. Open Dashboard and start the bridge.
3. In a terminal run the Python test agent (`test-agent/run_test.sh`).
4. If something fails, save the webview console output and the `Copilot Bridge` output channel and paste them here.

---

If you want, I will now:
- add a retry script that runs `npm run compile` then runs the Python test loop, or
- add additional debug endpoints or stricter logging.

Tell me which, or run the steps above and report results — I will iterate until everything works.
