// This file tells TypeScript about the special `acquireVsCodeApi` function
// that exists in the VS Code webview environment.
declare global {
  const vscode: {
    postMessage: (message: any) => void;
  };
}
export {};