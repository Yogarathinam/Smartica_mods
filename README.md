# 🚀 AgentBridge: SmartAgent Helper Extension

![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Chrome%20Extension-green.svg)
![Backend](https://img.shields.io/badge/Backend-Python%20%7C%20Gemini-yellow.svg)
![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)

**AgentBridge** is a powerful, fully-automated assessment solver toolkit. It consists of a beautiful, Shadow DOM-protected Chrome Extension (the frontend) and a desktop worker app (the backend). By leveraging a cloud WebSocket bridge and Google's Gemini AI, it seamlessly reads coding and MCQ questions, formulates answers, injects code, runs test cases, and automatically navigates to the next question.

---

## ✨ Key Features
- **🤖 Autonomous Solving Loop:** Set a target limit (e.g., 50 questions) and let the agent extract, solve, submit, and proceed automatically.
- **🛡️ Bulletproof UI:** Uses a completely isolated Shadow DOM to ensure the floating control panel and "Gen-Z" live-stream HUD work flawlessly on *any* website without CSS conflicts.
- **🔌 Cloud WebSocket Bridge:** The extension communicates instantly with your local machine via the `agentbridge-cloud.vercel.app` relay.
- **🧠 Auto-Fix Capabilities:** If a submitted code fails the test cases, the agent reads the compiler errors and automatically rewrites the code to fix it.
- **🌍 Dynamic Language Support:** Automatically detects the programming language selected in the web IDE and forces the AI to output the correct syntax.

---

## 🛠️ Installation Guide

To use AgentBridge, you need to set up two things: the **Desktop Client** (which talks to the AI) and the **Chrome Extension** (which talks to the webpage).

### Phase 1: Install the AgentBridge Desktop Client
The desktop client acts as the brain, securely logging you in and handling the AI processing.

1. Head over to the [Releases page](https://agentbridge-cloud.vercel.app/t) on GitHub.
2. Download the latest **`AgentBridge-Installer.exe`**.
3. Run the installer and open the **AgentBridge App**.
4. Click the **Authenticate** button. This will open a browser window—log in securely using your Google Account.
5. Once authenticated, click **Start Server**. The client is now actively listening to the cloud bridge!

### Phase 2: Install the Chrome Extension
1. Go to the [Releases page](https://github.com/Yogarathinam/Smartica_mods/releases/latest) again.
2. Download the **`SmartAgent-Extension.zip`** source code file.
3. Extract the `.zip` file into a folder on your computer.
4. Open Google Chrome and type `chrome://extensions/` into the URL bar.
5. In the top right corner, toggle **Developer mode** to ON.
6. Click the **Load unpacked** button in the top left.
7. Select the extracted folder. The extension is now installed!

---

## 🕹️ How to Use (User Flow)

Once both the Server and Extension are running, using the agent is incredibly simple:

1. **Open the Portal:** Navigate to your assessment or coding test webpage. 
2. **Open the HUD:** In the bottom-left corner of the screen, you will see a floating pill labeled **SmartAgent**. Hover over it and click to expand the full control panel.
3. **Connect to Bridge:** Click the **CONNECT** button. You will see the ping dot turn from Red to Cyan, and the text will change to `CONNECTED`.
4. **Set Your Target:** Enter the number of questions you want the bot to solve in the `TARGET` input box.
5. **Start the Engine:**
   - Click the **Play (▶)** button to initiate the **Auto-Run** loop.
   - *Alternatively*, click the **Step (⏭)** button if you only want the bot to solve the *current* question and pause.
6. **Watch the Magic:** Sit back and watch the Live Terminal output in the panel (or the floating stream toasts) as the bot reads the DOM, asks the AI, injects the code, submits, and clicks Next.

---

## ⚙️ Architecture (How it Works)

AgentBridge uses a 3-tier architecture to securely and reliably automate browser actions:

1. **Chrome Extension (Content Scripts):** Extracts DOM text (MCQ text, code constraints) and handles physical injections/clicks using `document.execCommand` and Ace Editor API targeting.
2. **Vercel Cloud Bridge (`agentbridge-cloud.vercel.app`):** Acts as the middleman relay. The Chrome extension cannot host a local server securely on restricted networks, so it sends payloads to the Vercel bridge via WebSocket.
3. **Desktop Worker App:** Listens to the Vercel bridge. When it receives an `ASK_AGENT` payload, it processes the prompt through Google's Gemini models using your authenticated session, and returns the strictly formatted JSON or Code block back through the bridge to the extension.

---

## ⚠️ Disclaimer

**Educational Purposes Only.** This toolkit is a proof-of-concept demonstrating DOM manipulation, WebSocket bridging, and LLM orchestration. Usage of this tool to bypass, cheat, or automate live academic or professional assessments violates the Terms of Service of most testing platforms. The developer assumes no responsibility for account bans, academic penalties, or misuse of this software.