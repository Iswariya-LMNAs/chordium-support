import * as vscode from "vscode";
import { spawnSync, spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export function activate(context: vscode.ExtensionContext) {
  // -------------------------------------------------------------------
  // 1️⃣ Detect Node 20 Runtime bundled with extension
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

  if (!fs.existsSync(NODE20)) {
    vscode.window.showErrorMessage(`❌ Node20 binary missing: ${NODE20}`);
    return;
  }

  // -------------------------------------------------------------------
  // 2️⃣ Detect lenscloud CLI (cross-platform + dynamic Node20 fallback)
  // -------------------------------------------------------------------
  function getLenscloudFallback(): string | null {
    const home = os.homedir();
    let nvmDir = "";

    if (platform === "win32") {
      nvmDir = path.join(home, "AppData", "Roaming", "nvm");
    } else {
      nvmDir = path.join(home, ".nvm/versions/node");
    }

    if (!fs.existsSync(nvmDir)) return null;

    // Find first folder matching v20.*
    const versions = fs.readdirSync(nvmDir).filter((v) => /^v20\./.test(v));

    for (const v of versions) {
      const lenscloudPath =
        platform === "win32"
          ? path.join(nvmDir, v, "lenscloud.exe")
          : path.join(nvmDir, v, "bin", "lenscloud");

      if (fs.existsSync(lenscloudPath)) return lenscloudPath;
    }

    return null; // no Node 20 found with lenscloud
  }

  function detectLensCloud(): string | null {
    try {
      const result = spawnSync(
        NODE20,
        ["-e", "console.log(require('which').sync('lenscloud'))"],
        {
          encoding: "utf-8",
          env: { ...process.env },
        }
      );

      if (result.status === 0 && result.stdout.trim()) {
        const resolved = result.stdout.trim();
        console.log("Detected lenscloud at:", resolved);
        return resolved;
      } else {
        throw new Error(result.stderr || "Not found");
      }
    } catch {
      const fallback = getLenscloudFallback();
      if (fallback) {
        vscode.window.showWarningMessage(`lenscloud not found in PATH. Using fallback: ${fallback}`);
        return fallback;
      } else {
        vscode.window.showErrorMessage("lenscloud CLI not found. Install it globally.");
        return null;
      }
    }
  }

  const LENS_CLOUD = detectLensCloud();
  if (!LENS_CLOUD) return;

  // -------------------------------------------------------------------
  // 3️⃣ Output channel
  // -------------------------------------------------------------------
  const output = vscode.window.createOutputChannel("Chordium Support");
  output.show(true);

  function cleanAnsi(input: string) {
    return input.replace(/\u001b\[.*?[@-~]/g, "");
  }

  // -------------------------------------------------------------------
  // 4️⃣ Execute lenscloud
  // -------------------------------------------------------------------
  function execLensCloud(args: string) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage("❌ No workspace folder.");
      return;
    }

    const proc = spawn(LENS_CLOUD!, args.split(" "), {
      cwd: workspacePath,
      env: {
        ...process.env,
        PATH: `${path.dirname(LENS_CLOUD!)}:${process.env.PATH}`,
      },
      shell: false,
    });

    proc.stdout.on("data", async (data) => {
      const text = cleanAnsi(data.toString());
      output.append(text);

      if (text.includes("Do you want to update the Task Reference Table?")) {
        const answer = await vscode.window.showInformationMessage(
          "Update the Task Reference Table?",
          "Yes",
          "No"
        );
        proc.stdin.write(answer === "Yes" ? "Y\n" : "n\n");
      }
    });

    proc.stderr.on("data", (data) => {
      output.append(`🟥 ${cleanAnsi(data.toString())}`);
    });

    proc.on("close", (code) => {
      output.appendLine(`\n✔ Finished with exit code ${code}`);
    });

    proc.on("error", (err) => {
      vscode.window.showErrorMessage(`❌ Error running lenscloud: ${err.message}`);
    });
  }

  // -------------------------------------------------------------------
  // 5️⃣ Branch selection & triggers
  // -------------------------------------------------------------------
  const config = vscode.workspace.getConfiguration("chordiumSupport");
  const settings = config.get<any[]>("commands") || [];

  function isInScope(doc: vscode.TextDocument, folders: string[]) {
    if (!folders.length) return true;
    return folders.some((f) => doc.uri.fsPath.includes(f));
  }

  async function handleReferenceFlow(branches: string[], baseCmd: string) {
    const defaultBranch = branches[0] ?? "main";
    const selection = await vscode.window.showInformationMessage(
      `Attach reference from ${defaultBranch}?`,
      {
        modal: false,
        detail: `Choose how you want to pick the branch`,
      },
      { title: `Use ${defaultBranch}`, value: "default" },
      { title: "Select another branch", value: "select" }
    );

    if (!selection) return;

    let selectedBranch = defaultBranch;

    if (selection.value === "select") {
      selectedBranch =
        (await vscode.window.showQuickPick(branches, {
          placeHolder: "Select branch",
        })) ?? defaultBranch;
    }

    const confirm = await vscode.window.showInformationMessage(
      `Attach reference from ${selectedBranch}?`,
      "Confirm",
      "Cancel"
    );
    if (confirm !== "Confirm") return;

    execLensCloud(`${baseCmd} -b ${selectedBranch}`);
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
