// // The module 'vscode' contains the VS Code extensibility API
// // Import the module and reference it with the alias vscode in your code below
// import * as vscode from 'vscode';

// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed
// export function activate(context: vscode.ExtensionContext) {

// 	// Use the console to output diagnostic information (console.log) and errors (console.error)
// 	// This line of code will only be executed once when your extension is activated
// 	console.log('Congratulations, your extension "chordium-support" is now active!');

// 	// The command has been defined in the package.json file
// 	// Now provide the implementation of the command with registerCommand
// 	// The commandId parameter must match the command field in package.json
// 	const disposable = vscode.commands.registerCommand('chordium-support.helloWorld', () => {
// 		// The code you place here will be executed every time your command is executed
// 		// Display a message box to the user
// 		vscode.window.showInformationMessage('Hello World from chordium-support!');
// 	});

// 	context.subscriptions.push(disposable);
// }

// // This method is called when your extension is deactivated
// export function deactivate() {}

// import * as vscode from "vscode";
// import { exec, ChildProcess } from "child_process";

// export function activate(context: vscode.ExtensionContext) {

//     const output = vscode.window.createOutputChannel("LensCloud Automation");
//     output.appendLine("LensCloud Automation Started");

//     const config = vscode.workspace.getConfiguration();
//     const rules = config.get<any[]>("chordium-auto.rules") || [];

//     vscode.workspace.onDidSaveTextDocument((document) => {
//         const filePath = document.uri.fsPath;

//         rules.forEach(rule => {
//             if (!rule.enabled) return;

//             if (!rule.events.includes("onSave")) return;

//             // Folder matching
//             const folderMatch = rule.watchFolders.some((folder: string) =>
//                 filePath.includes(folder)
//             );
//             if (!folderMatch) return;

//             // START EXECUTION
//             output.appendLine(`Trigger matched for: ${filePath}`);
//             output.appendLine(`Executing Command: ${rule.command}`);

//             // Ask user confirmation
//             vscode.window.showInformationMessage(
//                 `Run: ${rule.command}?`, 
//                 "Yes", 
//                 "No"
//             ).then(async (selection) => {

//                 if (selection !== "Yes") {
//                     output.appendLine(`Execution skipped by user`);
//                     vscode.window.showInformationMessage(`Skipped`);
//                     return;
//                 }

//                 let child: ChildProcess;

//                 try {
//                     child = exec(rule.command, (err, stdout, stderr) => {

//                         if (err) {
//                             output.appendLine(`❌ ERROR`);
//                             output.appendLine(err.message);
//                             vscode.window.showErrorMessage("Failed");
//                             return;
//                         }

//                         if (stderr) {
//                             output.appendLine(`⚠ STDERR`);
//                             output.appendLine(stderr);
//                         }

//                         // Detect story references
//                         const storyRefs = extractStoryReferences(stdout);

//                         if (storyRefs.length > 0) {
//                             vscode.window.showInformationMessage(
//                                 `Found story references: ${storyRefs.join(", ")}`,
//                                 "Attach",
//                                 "Skip"
//                             ).then(selection => {

//                                 if (selection === "Attach") {
//                                     output.appendLine("Attaching story references...");
//                                     vscode.window.showInformationMessage("Success");
//                                 } else {
//                                     output.appendLine("Attachment skipped.");
//                                     vscode.window.showInformationMessage("Skipped");
//                                 }

//                             });
//                         }

//                         output.appendLine(`✔ SUCCESS`);
//                         output.appendLine(stdout);
//                     });

//                 } catch (err: any) {
//                     output.appendLine(`❌ FAILED`);
//                     output.appendLine(err.message);
//                 }

//             });
//         });
//     });
// }

// // Helper function “detect story refs”
// function extractStoryReferences(text: string): string[] {
//     const regex = /(STORY-\d+|TASK-\d+)/gi;
//     return text.match(regex) || [];
// }

// export function deactivate() {}


import * as vscode from "vscode";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";

const BRANCHES = ["main", "develop", "release", "hot-fix", "pre-prod"];

// <<<< NEW: we will NOT call lenscloud as a system-installed binary
// we will execute it using Node v20 + local CLI script
const LENS_CLOUD_ENTRY = "lenscloud-cli/index.js";

const ANALYSE_ARGS = ["analyse", "change-object", "-b"]; 
const ATTACH_ARGS = ["attach", "reference", "-b"];

// debounce map
const debounceTimers = new Map<string, NodeJS.Timeout>();
const LENS_CLOUD_PATH = "/home/tyro23004/.nvm/versions/node/v20.13.1/bin/lenscloud";
const NODE20_PATH = "/home/tyro23004/.nvm/versions/node/v20.13.1/bin/node";


export function activate(context: vscode.ExtensionContext) {

  // <<<< NEW — dedicated Output Channel
  const output = vscode.window.createOutputChannel("LensCloud Automation");
  output.show(true);  
  output.appendLine("LensCloud Automation Started");

  // <<<< NEW — get Node v20 inside the extension
  const node20Path = vscode.Uri.joinPath(
    context.extensionUri,
    "node-runtime",
    "bin",
    "node"
  ).fsPath;

  const cliEntryPath = vscode.Uri.joinPath(
    context.extensionUri,
    LENS_CLOUD_ENTRY
  ).fsPath;

  const config = vscode.workspace.getConfiguration();
  const rules = config.get<any[]>("chordium-auto.rules") || [];

  if (!vscode.workspace.workspaceFolders?.length) {
    output.appendLine("No workspace folder open.");
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

  const onSaveHandler = vscode.workspace.onDidSaveTextDocument(async (document) => {
    const filePath = document.uri.fsPath;

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (!Array.isArray(rule.events) || !rule.events.includes("onSave")) continue;

      const watchFolders: string[] = Array.isArray(rule.watchFolders)
        ? rule.watchFolders
        : [];

      if (!isInsideWatchedFolder(filePath, workspaceRoot, watchFolders)) continue;

      const key = `${rule.command}::${watchFolders.join(",")}`;
      if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key)!);

      debounceTimers.set(
        key,
        setTimeout(() => {
          debounceTimers.delete(key);
          runRuleFlow(rule, workspaceRoot, node20Path, cliEntryPath, output);
        }, 250)
      );
    }
  });

  context.subscriptions.push(onSaveHandler);
  context.subscriptions.push(output);
}

/**
 * FULL RULE FLOW
 */
async function runRuleFlow(
  rule: any,
  workspaceRoot: string,
  node20: string,
  cliEntry: string,
  output: vscode.OutputChannel
) {
  const defaultBranch = "main";

  const first = await vscode.window.showInformationMessage(
    `Do you want Reference from ${defaultBranch}?`,
    "Yes",
    "No"
  );

  if (!first) {
    output.appendLine("User dismissed main-branch popup.");
    return;
  }

  let selectedBranch = defaultBranch;

  if (first === "No") {
    const pick = await vscode.window.showQuickPick(BRANCHES, {
      placeHolder: "Select base branch for analysis",
    });
    if (!pick) {
      output.appendLine("User cancelled branch selection.");
      return;
    }
    selectedBranch = pick;
  }

  vscode.window.showInformationMessage(
    `Running analysis for branch: ${selectedBranch}`
  );

  output.appendLine(`Running analyser with branch ${selectedBranch}`);

  const analyseArgs = [...ANALYSE_ARGS, selectedBranch];

  // <<<< NEW — spawn Node v20 + local CLI index.js
  const analyser = spawn(LENS_CLOUD_PATH, analyseArgs, { shell: false });

  let analyserStdout = "";
  let analyserStderr = "";

  analyser.stdout?.on("data", (chunk) => {
    const s = chunk.toString();
    analyserStdout += s;
    output.appendLine(s.trimEnd());
  });

  analyser.stderr?.on("data", (chunk) => {
    const s = chunk.toString();
    analyserStderr += s;
    output.appendLine(`STDERR: ${s.trimEnd()}`);
  });

  const analyserExit = await new Promise<number>((resolve) => {
    analyser.on("close", (code) => resolve(code ?? -1));
    analyser.on("error", () => resolve(-1));
  });

  if (analyserExit !== 0) {
    vscode.window.showErrorMessage("LensCloud analyse failed.");
    output.appendLine(`Analyser failed with code ${analyserExit}`);
    return;
  }

  const storyRefs = extractStoryReferences(analyserStdout);
  if (!storyRefs.length) {
    vscode.window.showInformationMessage("No story references found.");
    output.appendLine("Found 0 story references.");
    return;
  }

  const attachChoice = await vscode.window.showInformationMessage(
    `Found ${storyRefs.length}: ${storyRefs.join(", ")}. Attach?`,
    "Attach",
    "Skip"
  );

  if (attachChoice !== "Attach") {
    output.appendLine("User skipped attachment.");
    return;
  }

  const attachArgs = [...ATTACH_ARGS, selectedBranch];

  output.appendLine(`Running attach for branch ${selectedBranch}`);

const attachChild: ChildProcess = spawn(LENS_CLOUD_PATH, attachArgs, { shell: false });


  let attachStdout = "";
  let attachStderr = "";

  const PROMPT_REGEX = /\? Do you want to update the Task Reference Table\? \(Y\/n\)/i;
  let promptSeen = false;

  attachChild.stdout?.on("data", (chunk) => {
    const s = chunk.toString();
    attachStdout += s;
    output.appendLine(s.trimEnd());

    if (!promptSeen && PROMPT_REGEX.test(s)) {
      promptSeen = true;
      attachChild.stdin?.write("Y\n");
      output.appendLine("[Auto] Sent Y to CLI");
    }
  });

  attachChild.stderr?.on("data", (chunk) => {
    const s = chunk.toString();
    attachStderr += s;
    output.appendLine(`STDERR: ${s.trimEnd()}`);
  });

  const attachExit = await new Promise<number>((resolve) => {
    attachChild.on("close", (code) => resolve(code ?? -1));
    attachChild.on("error", () => resolve(-1));
  });

  if (attachExit === 0) {
    vscode.window.showInformationMessage("Story reference attached successfully.");
    output.appendLine("✔ Attach completed successfully.");
  } else {
    vscode.window.showErrorMessage("Failed to attach story references.");
    output.appendLine(`❌ Attach exited with code ${attachExit}`);
  }
}

/** Check folder match */
function isInsideWatchedFolder(
  filePath: string,
  workspaceRoot: string,
  watchFolders: string[]
): boolean {
  if (!watchFolders?.length) return false;

  const absFile = path.resolve(filePath);

  return watchFolders.some((folder) => {
    const absFolder = path.resolve(workspaceRoot, folder);
    return (
      absFile === absFolder ||
      absFile.startsWith(absFolder + path.sep)
    );
  });
}

/** Extract story refs like US-2025-0675 */
function extractStoryReferences(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/US-\d{4}-\d{4}/gi);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}

export function deactivate() {}

