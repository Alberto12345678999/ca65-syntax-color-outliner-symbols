"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateDocumentSymbolProvider = activateDocumentSymbolProvider;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const DocumentSymbolProvider_1 = require("./DocumentSymbolProvider");
function activateDocumentSymbolProvider(context) {
    const provider = new DocumentSymbolProvider_1.asm6502DocumentSymbolProvider();
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: 'ca65' }, provider));
}
// This is the main entry point for the CA65 extension in Visual Studio Code.
function activate(context) {
    console.log('Congratulations, your extension "ca65" is now active!');
    activateDocumentSymbolProvider(context);
    // Example of a command registration
    let disposable = vscode.commands.registerCommand('ca65.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from CA65!');
    });
    context.subscriptions.push(disposable);
}
function deactivate() {
    console.log('Extension "ca65" has been deactivated.');
}
