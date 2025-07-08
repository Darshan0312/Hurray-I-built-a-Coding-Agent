"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const node_fetch_1 = require("node-fetch"); // Import AbortError for timeout handling
const ChatViewProvider_1 = require("./ChatViewProvider");
const AGENT_DECISION_URL = "http://127.0.0.1:8001/agent/decide";
const SYSTEM_PROMPT = `
You are an expert AI coding agent. Your goal is to help users with their coding tasks.
You operate in a loop of Thought and Action. Based on the user's request, you will reason about the task and then choose an action to take. The actions will be executed by the editor.

**AVAILABLE TOOLS:**
- \`write_file(filepath: string, content: string)\`: Writes content to a file in the user's current project workspace.
- \`run_shell_command(command: string)\`: Executes a shell command in a terminal within the user's editor.
- \`finish(response: string)\`: Use this action when the task is complete to respond to the user.

**RESPONSE FORMAT:**
You MUST respond in the following JSON format. Do not write any other text.

{"thought": "Your reasoning and plan for the next step.", "action": {"tool_name": "tool_to_use", "parameters": {"param1": "value1"}}}

**EXAMPLE:**
User Request: "Create a python script that prints 'hello world'."

{"thought": "I need to create a Python file. I'll name it \`main.py\` and write the print statement into it.", "action": {"tool_name": "write_file", "parameters": {"filepath": "main.py", "content": "print('hello world')"}}}
`;
// --- TOOL IMPLEMENTATIONS (in TypeScript, using the VS Code API) ---
async function writeFile(args) {
    if (!vscode.workspace.workspaceFolders) {
        return "Error: No workspace is open. Please open a project folder first.";
    }
    try {
        const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
        const fileUri = vscode.Uri.joinPath(workspaceUri, args.filepath);
        const contentAsBuffer = Buffer.from(args.content, 'utf8');
        await vscode.workspace.fs.writeFile(fileUri, contentAsBuffer);
        return `Successfully wrote to ${args.filepath}`;
    }
    catch (error) {
        return `Error writing file: ${error.message}`;
    }
}
async function runShellCommand(args) {
    try {
        const terminal = vscode.window.createTerminal("AI Agent Shell");
        terminal.sendText(args.command);
        terminal.show();
        return `Successfully executed command: ${args.command}`;
    }
    catch (error) {
        return `Error running shell command: ${error.message}`;
    }
}
const AVAILABLE_TOOLS = {
    "write_file": writeFile,
    "run_shell_command": runShellCommand,
};
// --- MAIN EXTENSION LOGIC ---
function activate(context) {
    const chatProvider = new ChatViewProvider_1.ChatViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ChatViewProvider_1.ChatViewProvider.viewType, chatProvider));
    let disposable = vscode.commands.registerCommand('agent-connector.runAgent', async (userPrompt) => {
        if (!userPrompt) {
            const fromInput = await vscode.window.showInputBox({ prompt: "What task should the agent perform?" });
            if (!fromInput)
                return;
            userPrompt = fromInput;
        }
        chatProvider.postMessage({ type: 'userMessage', value: userPrompt });
        let history = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
        ];
        const MAX_TURNS = 10;
        for (let i = 0; i < MAX_TURNS; i++) {
            chatProvider.postMessage({ type: 'agentThinking' });
            // =================================================================
            // === START OF THE UPDATED, ROBUST FETCH LOGIC ===
            // =================================================================
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout
            let response;
            try {
                response = await (0, node_fetch_1.default)(AGENT_DECISION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ history: history }),
                    signal: controller.signal
                });
            }
            catch (error) {
                if (error instanceof node_fetch_1.AbortError) {
                    chatProvider.postMessage({ type: 'agentMessage', value: 'Error: Connection to backend timed out. Please ensure the server is running and responsive.' });
                }
                else {
                    chatProvider.postMessage({ type: 'agentMessage', value: `Error: Could not connect to backend. ${error.message}` });
                }
                return; // Exit the loop on connection error
            }
            finally {
                clearTimeout(timeoutId); // Always clear the timeout
            }
            if (!response.ok) {
                chatProvider.postMessage({ type: 'agentMessage', value: `Error: Backend server responded with status ${response.status}.` });
                return;
            }
            // =================================================================
            // === END OF THE UPDATED, ROBUST FETCH LOGIC ===
            // =================================================================
            const decision = await response.json();
            history.push({ role: "assistant", content: JSON.stringify(decision) });
            const thought = decision.thought || "Thinking...";
            chatProvider.postMessage({ type: 'agentThought', value: thought });
            const action = decision.action;
            if (!action || !action.tool_name) {
                chatProvider.postMessage({ type: 'agentMessage', value: 'Error: Agent returned an invalid action.' });
                return;
            }
            if (action.tool_name === "finish") {
                chatProvider.postMessage({ type: 'agentMessage', value: action.parameters.response });
                return;
            }
            if (action.tool_name in AVAILABLE_TOOLS) {
                chatProvider.postMessage({ type: 'toolStart', value: `Using tool: ${action.tool_name}` });
                const observation = await AVAILABLE_TOOLS[action.tool_name](action.parameters);
                chatProvider.postMessage({ type: 'toolEnd', value: `Tool result: ${observation}` });
                history.push({ role: "tool", content: observation });
            }
            else {
                const observation = `Error: Agent tried to use an unknown tool: ${action.tool_name}`;
                chatProvider.postMessage({ type: 'agentMessage', value: observation });
                history.push({ role: "tool", content: observation });
            }
        }
        chatProvider.postMessage({ type: 'agentMessage', value: "Agent reached max turns." });
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map