import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { asm6502DocumentSymbolProvider } from '../DocumentSymbolProvider';

let taskProvider: vscode.Disposable | undefined;
let ld65ConfigWatcher: vscode.FileSystemWatcher | undefined;
let cl65ConfigWatcher: vscode.FileSystemWatcher | undefined;

export function activateDocumentSymbolProvider(context: vscode.ExtensionContext) {
    const provider = new asm6502DocumentSymbolProvider();
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: 'ca65' }, provider));
}

// This is the main entry point for the CA65 extension in Visual Studio Code.
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "ca65" is now active!');

    activateDocumentSymbolProvider(context);

    let workspaceRoot = vscode.workspace.rootPath;
    if (workspaceRoot) {
        let ca65Promise: Thenable<vscode.Task[]> | undefined = undefined;

        vscode.window.onDidChangeActiveTextEditor(() => ca65Promise = undefined);

        ld65ConfigWatcher = vscode.workspace.createFileSystemWatcher("**/*.cfg");
        ld65ConfigWatcher.onDidChange(() => ca65Promise = undefined);
        ld65ConfigWatcher.onDidCreate(() => ca65Promise = undefined);
        ld65ConfigWatcher.onDidDelete(() => ca65Promise = undefined);

        cl65ConfigWatcher = vscode.workspace.createFileSystemWatcher(path.join(workspaceRoot, "cl65config.json"));
        cl65ConfigWatcher.onDidChange(() => ca65Promise = undefined);
        cl65ConfigWatcher.onDidCreate(() => ca65Promise = undefined);
        cl65ConfigWatcher.onDidDelete(() => ca65Promise = undefined);

        taskProvider = vscode.tasks.registerTaskProvider('ca65', {
            provideTasks: async (_token?: vscode.CancellationToken) => {
                return await getAssemblerTasks();
            },
            resolveTask(_task: vscode.Task, _token?: vscode.CancellationToken): vscode.Task | undefined {
                return undefined;
            }
        } as vscode.TaskProvider<vscode.Task>);
    }

    // Example of a command registration
    let disposable = vscode.commands.registerCommand('ca65.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from CA65!');
    });
    context.subscriptions.push(disposable);
}

export function deactivate() {
    if (cl65ConfigWatcher) {
        cl65ConfigWatcher.dispose();
    }
    if (ld65ConfigWatcher) {
        ld65ConfigWatcher.dispose();
    }
    if (taskProvider) {
        taskProvider.dispose();
    }
    console.log('Extension "ca65" has been deactivated.');
}

interface AssemblerTaskDefinition extends vscode.TaskDefinition {
    config: string | undefined;
}

interface AssemblerCL65ConfigurationDefinition {
    executable: string | undefined;
    input: string | undefined;
    params: string | undefined;
}

function getAssemblerCommandLine(fileName: string, ld65Config: string | undefined, cl65Config: AssemblerCL65ConfigurationDefinition | undefined): string {
    let cli = "";
    if (cl65Config && cl65Config.executable) {
        cli = cl65Config.executable;
    }
    else {
        cli = `cl65`;
    }

    if (ld65Config) {
        cli += ` -C "${ld65Config}" `;
    }
    if (cl65Config && cl65Config.params) {
        cli += ` ${cl65Config.params} `;
    }

    cli += ` "${fileName}" `;
    return cli;
}

async function getAssemblerTasks(): Promise<vscode.Task[]> {
    let tasks: vscode.Task[] = [];
    let cl65Config: AssemblerCL65ConfigurationDefinition | undefined = undefined;

    let editor = vscode.window.activeTextEditor;
    if (editor && editor.document && editor.document.fileName && editor.document.languageId === "ca65") {
        let input: string = editor.document.fileName;

        if (vscode.workspace.rootPath) {
            try {
                const readFile = util.promisify(fs.readFile);
                const readFileData = await readFile(path.join(vscode.workspace.rootPath || "", "cl65config.json"), "utf-8");
                cl65Config = JSON.parse(readFileData);
            } catch (err) { }

            if (cl65Config && cl65Config.input) {
                input = path.resolve(vscode.workspace.rootPath, cl65Config.input);
            }

            let cfgs = await vscode.workspace.findFiles("**/*.cfg");
            for (let cfg of cfgs) {
                let buildLinkerConfigFileRel = path.relative(vscode.workspace.rootPath, cfg.fsPath);
                let buildLinkerConfigFileAbs = path.resolve(cfg.fsPath);
                let buildTaskDef: AssemblerTaskDefinition = { type: "ca65", config: buildLinkerConfigFileRel };
                let buildTask = new vscode.Task(buildTaskDef, vscode.TaskScope.Workspace, `Build with ${buildLinkerConfigFileRel}`, "ca65",
                    new vscode.ShellExecution(getAssemblerCommandLine(input, buildLinkerConfigFileAbs, cl65Config)), ["$ca65", "$ld65"]);
                buildTask.group = vscode.TaskGroup.Build;
                tasks.push(buildTask);
            }
        }

        let buildTaskDef: AssemblerTaskDefinition = { type: "ca65", config: undefined };
        let buildTask = new vscode.Task(buildTaskDef, vscode.TaskScope.Workspace, "Build without config", "ca65",
            new vscode.ShellExecution(getAssemblerCommandLine(input, undefined, cl65Config)), ["$ca65", "$ld65"]);
        buildTask.group = vscode.TaskGroup.Build;
        tasks.push(buildTask);
    }
    return tasks;
}