"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatViewProvider = void 0;
const vscode = require("vscode");
const getNonce_1 = require("./getNonce");
class ChatViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')],
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'sendMessage':
                    {
                        // When the user sends a message, call the main agent command
                        vscode.commands.executeCommand('agent-connector.runAgent', data.value);
                        break;
                    }
                case 'info':
                    {
                        vscode.window.showInformationMessage(data.value);
                        break;
                    }
            }
        });
    }
    postMessage(message) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.css'));
        const nonce = (0, getNonce_1.getNonce)();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<link rel="stylesheet" type="text/css" href="${styleUri}">
				<title>AI Agent</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}" type="module" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
exports.ChatViewProvider = ChatViewProvider;
ChatViewProvider.viewType = 'coding-agent.chatView';
//# sourceMappingURL=ChatViewProvider.js.map