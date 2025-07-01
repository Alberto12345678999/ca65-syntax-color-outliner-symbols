import * as vscode from 'vscode';
import { asm6502DocumentSymbolProvider } from './DocumentSymbolProvider';

export function activateDocumentSymbolProvider(context: vscode.ExtensionContext) {
    const provider = new asm6502DocumentSymbolProvider();
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: 'ca65' }, provider));
}

// This is the main entry point for the CA65 extension in Visual Studio Code.
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "ca65" is now active!');

    activateDocumentSymbolProvider(context);

    // Example of a command registration
    let disposable = vscode.commands.registerCommand('ca65.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from CA65!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    console.log('Extension "ca65" has been deactivated.');
}