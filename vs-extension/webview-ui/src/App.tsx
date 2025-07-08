import { useState, useEffect, useRef } from 'react';
import './App.css';

// This is a special object that VS Code provides to the webview to communicate back to the extension.
// The '@ts-ignore' comment is used because this object is injected at runtime and TypeScript doesn't know about it.
// @ts-ignore
const vscode = acquireVsCodeApi();

interface Message {
    type: 'user' | 'agent' | 'thought' | 'tool';
    text: string;
}

function App() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    // Function to automatically scroll to the bottom of the chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Scroll to bottom whenever a new message is added
    useEffect(scrollToBottom, [messages]);

    // This effect runs once to set up a listener for messages from the VS Code extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data; // The data sent from ChatViewProvider.ts's postMessage
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

        // Cleanup function to remove the listener when the component is unmounted
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleSend = () => {
        // Only send a message if the input text is not empty
        if (inputText.trim()) {
            // This sends the message FROM the React UI TO the ChatViewProvider
            vscode.postMessage({
                type: 'sendMessage',
                value: inputText
            });
            // Clear the input box after sending
            setInputText('');
        }
    };

    return (
        <div className="chat-container">
            <div className="message-list">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.type}`}>
                        {/* A simple way to format the text to show newlines */}
                        {msg.text.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="input-area">
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                        // Send message on Enter, but allow Shift+Enter for new lines
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Ask the agent to do something..."
                    rows={3}
                />
                <button onClick={handleSend}>Send</button>
            </div>
        </div>
    );
}

export default App;