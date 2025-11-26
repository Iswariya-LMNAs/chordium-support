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


// import * as vscode from "vscode";
// import * as cp from "child_process";
// import * as path from "path";
// import which from "which";

// export function activate(context: vscode.ExtensionContext) {

//   // -------------------------------------------------------------------
//   // 1️⃣ Detect Node 20 inside the extension
//   // -------------------------------------------------------------------

//   const platform = process.platform;

//   let NODE20 = "";
//   if (platform === "win32") {
//     NODE20 = context.asAbsolutePath("node-runtime/node.exe");
//   } else if (platform === "darwin") {
//     NODE20 = context.asAbsolutePath("node-runtime/node-macos");
//   } else {
//     NODE20 = context.asAbsolutePath("node-runtime/node");
//   }

//   // Ensure binary exists
//   vscode.workspace.fs.stat(vscode.Uri.file(NODE20)).then(
//     () => {},
//     () => vscode.window.showErrorMessage(`Node 20 binary missing: ${NODE20}`)
//   );


//   // -------------------------------------------------------------------
//   // 2️⃣ Auto-detect lenscloud CLI
//   // -------------------------------------------------------------------

//   const FALLBACK_PATH =
//     "/home/tyro23007/.nvm/versions/node/v20.19.5/bin/lenscloud";

//   function detectLensCloud(): string | null {
//     try {
//       const resolved = which.sync("lenscloud");
//       console.log("Detected lenscloud at:", resolved);
//       return resolved;
//     } catch (err) {
//       // fallback check
//       try {
//         vscode.workspace.fs.stat(vscode.Uri.file(FALLBACK_PATH));
//         vscode.window.showWarningMessage(
//           `⚠️ lenscloud CLI not found in PATH. Using fallback binary: ${FALLBACK_PATH}`
//         );
//         return FALLBACK_PATH;
//       } catch {
//         vscode.window.showErrorMessage(
//           "❌ lenscloud CLI not found. Install with `npm i -g lenscloud` OR ensure fallback path exists."
//         );
//         return null;
//       }
//     }
//   }

//   const LENS_CLOUD = detectLensCloud();
//   if (!LENS_CLOUD) return;


//   // -------------------------------------------------------------------
//   // Output channel
//   // -------------------------------------------------------------------

//   const output = vscode.window.createOutputChannel("Chordium Support");


//   // -------------------------------------------------------------------
//   // 3️⃣ Function to run lenscloud using our Node 20 runtime
//   // -------------------------------------------------------------------

//   function execLensCloud(args: string) {
//     const fullCmd = `"${NODE20}" "${LENS_CLOUD}" ${args}`;

//     output.appendLine(`\n⚙️ Running: ${fullCmd}\n`);

//     cp.exec(fullCmd, (err, stdout, stderr) => {
//       if (err) {
//         vscode.window.showErrorMessage(`❌ LensCloud failed: ${err.message}`);
//         output.appendLine(err.message);
//         return;
//       }
//       if (stdout.trim()) output.appendLine(stdout);
//       if (stderr.trim()) output.appendLine(stderr);
//     });
//   }


//   // -------------------------------------------------------------------
//   // 4️⃣ Read user configuration
//   // -------------------------------------------------------------------

//   const config = vscode.workspace.getConfiguration("chordiumSupport");
//   const settings = config.get<any[]>("commands") || [];


//   // -------------------------------------------------------------------
//   // 5️⃣ Branch selection popup
//   // -------------------------------------------------------------------

//   async function handleReferenceFlow(branches: string[], baseCmd: string) {
//     const defaultBranch = branches[0] ?? "main";

//     const action = await vscode.window.showInformationMessage(
//       `Do you want reference from ${defaultBranch}?`,
//       defaultBranch,
//       "Yes",
//       "No"
//     );

//     if (!action || action === "No") {
//       vscode.window.showWarningMessage("Skipped.");
//       return;
//     }

//     let selectedBranch = defaultBranch;

//     if (action === defaultBranch) {
//       selectedBranch =
//         (await vscode.window.showQuickPick(branches, {
//           placeHolder: "Select branch",
//         })) ?? defaultBranch;
//     }

//     const finalConfirm = await vscode.window.showInformationMessage(
//       `Attach reference from ${selectedBranch}?`,
//       "Confirm",
//       "Cancel"
//     );

//     if (finalConfirm !== "Confirm") return;

//     execLensCloud(`${baseCmd} -b ${selectedBranch}`);
//     vscode.window.showInformationMessage(
//       `Reference attached from ${selectedBranch}`
//     );
//   }


//   // -------------------------------------------------------------------
//   // 6️⃣ Register triggers based on settings
//   // -------------------------------------------------------------------

//   function isInScope(doc: vscode.TextDocument, folders: string[]) {
//     if (!folders || folders.length === 0) return true;
//     return folders.some((f) => doc.uri.fsPath.includes(f));
//   }

//   settings.forEach((setting) => {
//     const { command, trigger, folders = [], branches = [] } = setting;

//     if (trigger === "onSave") {
//       vscode.workspace.onDidSaveTextDocument((doc) => {
//         if (!isInScope(doc, folders)) return;
//         handleReferenceFlow(branches, command);
//       });
//     }

//     if (trigger === "onChange") {
//       vscode.workspace.onDidChangeTextDocument((event) => {
//         if (!isInScope(event.document, folders)) return;
//         handleReferenceFlow(branches, command);
//       });
//     }
//   });
// }

// export function deactivate() {}


import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import which from "which";

export function activate(context: vscode.ExtensionContext) {

  // -------------------------------------------------------------------
  // 1️⃣ Detect Node 20 inside the extension
  // -------------------------------------------------------------------

  const platform = process.platform;

  let NODE20 = "";
  if (platform === "win32") {
    NODE20 = context.asAbsolutePath("node-runtime/node.exe");
  } else if (platform === "darwin") {
    NODE20 = context.asAbsolutePath("node-runtime/node-macos");
  } else {
    NODE20 = context.asAbsolutePath("node-runtime/node");
  }

  // Check if Node runtime exists
  vscode.workspace.fs.stat(vscode.Uri.file(NODE20)).then(
    () => {},
    () => vscode.window.showErrorMessage(`Node 20 binary missing: ${NODE20}`)
  );


  // -------------------------------------------------------------------
  // 2️⃣ Auto-detect lenscloud CLI with fallback
  // -------------------------------------------------------------------

  const FALLBACK_PATH =
    "/home/tyro23007/.nvm/versions/node/v20.19.5/bin/lenscloud";

  function detectLensCloud(): string | null {
    try {
      const resolved = which.sync("lenscloud");
      console.log("Detected lenscloud at:", resolved);
      return resolved;
    } catch (err) {
      // ========= Try fallback =========
      try {
        vscode.workspace.fs.stat(vscode.Uri.file(FALLBACK_PATH));
        vscode.window.showWarningMessage(
          `⚠️ lenscloud not found in PATH. Using fallback: ${FALLBACK_PATH}`
        );
        return FALLBACK_PATH;
      } catch {
        vscode.window.showErrorMessage(
          "❌ lenscloud CLI not found. Install `npm i -g lenscloud` OR ensure fallback path exists."
        );
        return null;
      }
    }
  }

  const LENS_CLOUD = detectLensCloud();
  if (!LENS_CLOUD) return;


  // -------------------------------------------------------------------
  // 3️⃣ Output Channel
  // -------------------------------------------------------------------

  const output = vscode.window.createOutputChannel("Chordium Support");
  output.show(true);


  // -------------------------------------------------------------------
  // 4️⃣ Run lenscloud using Node 20 with LIVE LOGS
  // -------------------------------------------------------------------

  function execLensCloud(args: string) {
    // Split args properly
    const splitArgs = args.split(" "); // e.g., "attach reference -b release" => ["attach","reference","-b","release"]
  
    // Use Node 20 to run the lenscloud JS file directly
    const proc = cp.spawn(NODE20, [LENS_CLOUD!, ...splitArgs], {
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      shell: false, // keep false for direct execution
    });
  
    output.appendLine(`\n⚙️ Running (LIVE): ${NODE20} ${LENS_CLOUD} ${splitArgs.join(" ")}\n`);
  
    proc.stdout.on("data", (data) => {
      output.appendLine(data.toString());
    });
  
    proc.stderr.on("data", (data) => {
      output.appendLine(`🟥 ${data.toString()}`);
    });
  
    proc.on("close", (code) => {
      output.appendLine(`\n✔️ Finished (exit code: ${code})\n`);
      if (code !== 0) {
        vscode.window.showErrorMessage(`LensCloud failed (exit code ${code})`);
      }
    });
  
    proc.on("error", (err) => {
      output.appendLine(`❌ Spawn error: ${err.message}`);
      vscode.window.showErrorMessage(`Spawn Error: ${err.message}`);
    });
  }
  

  // -------------------------------------------------------------------
  // 5️⃣ Load User Configuration
  // -------------------------------------------------------------------

  const config = vscode.workspace.getConfiguration("chordiumSupport");
  const settings = config.get<any[]>("commands") || [];


  // -------------------------------------------------------------------
  // 6️⃣ Branch Selection Popup
  // -------------------------------------------------------------------

  async function handleReferenceFlow(branches: string[], baseCmd: string) {
    const defaultBranch = branches[0] ?? "main";

    const action = await vscode.window.showInformationMessage(
      `Do you want reference from ${defaultBranch}?`,
      defaultBranch,
      "Yes",
      "No"
    );

    if (!action || action === "No") {
      vscode.window.showWarningMessage("Skipped.");
      return;
    }

    let selectedBranch = defaultBranch;

    if (action === defaultBranch) {
      selectedBranch =
        (await vscode.window.showQuickPick(branches, {
          placeHolder: "Select branch",
        })) ?? defaultBranch;
    }

    const finalConfirm = await vscode.window.showInformationMessage(
      `Attach reference from ${selectedBranch}?`,
      "Confirm",
      "Cancel"
    );

    if (finalConfirm !== "Confirm") return;

    execLensCloud(`${baseCmd} -b ${selectedBranch}`);
  }


  // -------------------------------------------------------------------
  // 7️⃣ Register Triggers From Settings
  // -------------------------------------------------------------------

  function isInScope(doc: vscode.TextDocument, folders: string[]) {
    if (!folders || folders.length === 0) return true;
    return folders.some((f) => doc.uri.fsPath.includes(f));
  }

  settings.forEach((setting) => {
    const { command, trigger, folders = [], branches = [] } = setting;

    if (trigger === "onSave") {
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (!isInScope(doc, folders)) return;
        handleReferenceFlow(branches, command);
      });
    }

    if (trigger === "onChange") {
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (!isInScope(event.document, folders)) return;
        handleReferenceFlow(branches, command);
      });
    }
  });
}

export function deactivate() {}
