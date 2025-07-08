"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
require("./App.css");
// This special object is the bridge to the VS Code extension
// @ts-ignore
const vscode = acquireVsCodeApi();
function App() {
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [inputText, setInputText] = (0, react_1.useState)('');
    const messagesEndRef = (0, react_1.useRef)(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    (0, react_1.useEffect)(scrollToBottom, [messages]);
    (0, react_1.useEffect)(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.type) {
                case 'userMessage':
                    setMessages(prev => [...prev, { type: 'user', text: message.value }]);
                    break;
                case 'agentMessage':
                case 'agentThought':
                case 'toolStart':
                case 'toolEnd':
                    setMessages(prev => [...prev, { type: 'agent', text: message.value }]);
                    break;
                case 'agentThinking':
                    setMessages(prev => [...prev, { type: 'agent', text: 'Thinking...' }]);
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    const handleSend = () => {
        if (inputText.trim()) {
            vscode.postMessage({ type: 'sendMessage', value: inputText });
            setInputText('');
        }
    };
    return (<div className="chat-container">
            <div className="message-list">
                {messages.map((msg, index) => (<div key={index} className={`message ${msg.type}`}>
                        {msg.text}
                    </div>))}
                <div ref={messagesEndRef}/>
            </div>
            <div className="input-area">
                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        }} placeholder="Ask the agent to do something..."/>
                <button onClick={handleSend}>Send</button>
            </div>
        </div>);
}
exports.default = App;
//# sourceMappingURL=App.js.map