import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { spawn, spawnSync } from "child_process";

// ======================================================
// 1️⃣ Node Runtime Manager
// ======================================================
export class NodeRuntime {
  constructor(private context: vscode.ExtensionContext) {}

  getNodeBinary(version: string): string | null {
    const platform = process.platform;

    const file =
      platform === "win32"
        ? "node.exe"
        : platform === "darwin"
        ? "node-macos"
        : "node";

    const localPath = this.context.asAbsolutePath(`node-runtime/${file}`);

    if (fs.existsSync(localPath)) return localPath;

    vscode.window.showErrorMessage(`Node runtime not found: ${localPath}`);
    return null;
  }
}

// ======================================================
// 2️⃣ LensCloud Resolver
// ======================================================
export class LensCloudResolver {
  constructor(private nodeBinary: string) {}

  detect(): string | null {
    try {
      const result = spawnSync(
        this.nodeBinary,
        ["-e", "console.log(require('which').sync('lenscloud'))"],
        { encoding: "utf-8", env: { ...process.env } }
      );

      const out = result.stdout?.trim();
      if (result.status === 0 && out) return out;

      throw new Error("Not found");
    } catch {
      const fallback = this.getFallback();
      if (fallback) {
        vscode.window.showWarningMessage(`Using fallback lenscloud: ${fallback}`);
        return fallback;
      }
      vscode.window.showErrorMessage("lenscloud CLI not found.");
      return null;
    }
  }

  // --------------------------------------------
  // FIXED: nodeVersion is now read from settings
  // --------------------------------------------
  private getFallback(): string | null {
    const config = vscode.workspace.getConfiguration("chordiumSupport");
    const nodeVersion = config.get<string>("nodeVersion") || "v20";

    const home = os.homedir();
    const platform = process.platform;
    const nvmDir =
      platform === "win32"
        ? path.join(home, "AppData", "Roaming", "nvm")
        : path.join(home, ".nvm/versions/node");

    if (!fs.existsSync(nvmDir)) return null;

    const versions = fs
      .readdirSync(nvmDir)
      .filter((folder) => folder.startsWith(nodeVersion));

    for (const v of versions) {
      const cli =
        platform === "win32"
          ? path.join(nvmDir, v, "lenscloud.exe")
          : path.join(nvmDir, v, "bin", "lenscloud");

      if (fs.existsSync(cli)) return cli;
    }

    return null;
  }
}

// ======================================================
// 3️⃣ Output Manager
// ======================================================
export class OutputManager {
  private channel = vscode.window.createOutputChannel("Chordium Support");

  constructor() {
    this.channel.show(true);
  }

  write(text: string) {
    this.channel.append(this.cleanAnsi(text));
  }

  writeln(text: string) {
    this.channel.appendLine(this.cleanAnsi(text));
  }

  private cleanAnsi(input: string) {
    return input.replace(/\u001b\[.*?[@-~]/g, "");
  }
}

// ======================================================
// 4️⃣ LensCloud Executor (Reusable)
// ======================================================
export class LensCloudExecutor {
  constructor(private lenscloud: string, private output: OutputManager) {}

  run(args: string[]): void {
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspace) {
      vscode.window.showErrorMessage("No workspace folder.");
      return;
    }

    const proc = spawn(this.lenscloud, args, {
      cwd: workspace,
      env: {
        ...process.env,
        PATH: `${path.dirname(this.lenscloud)}:${process.env.PATH}`,
      },
      shell: false,
    });

    proc.stdout.on("data", async (data) => {
      const text = data.toString();
      this.output.write(text);

      // Auto prompt handler for attach reference
      if (text.includes("Do you want to update the Task Reference Table?")) {
        const choice = await vscode.window.showInformationMessage(
          "Update Task Reference Table?",
          "Yes",
          "No"
        );
        proc.stdin.write(choice === "Yes" ? "Y\n" : "n\n");
      }
    });

    proc.stderr.on("data", (data) => {
      this.output.writeln("🟥 " + data.toString());
    });

    proc.on("close", (code) => {
      this.output.writeln(`✔ lenscloud finished with exit code ${code}`);
    });
  }
}

// ======================================================
// 5️⃣ Command Runner (Handles Settings)
// ======================================================
export class CommandRunner {
  constructor(
    private executor: LensCloudExecutor,
    private output: OutputManager
  ) {}

  async runSetting(setting: any, doc?: vscode.TextDocument) {
    if (!setting.enabled) return;

    if (setting.folders?.length && doc) {
      const isMatch = setting.folders.some((f: string) =>
        doc.uri.fsPath.includes(f)
      );
      if (!isMatch) return;
    }

    if (setting.needBaseBranch) {
      await this.runWithBranch(setting);
    } else {
      this.executor.run(setting.command.split(" "));
    }
  }

  private async runWithBranch(setting: any) {
    const branches = setting.branches || [];
    const defaultBranch = branches[0] ?? "main";

    const action = await vscode.window.showInformationMessage(
      `Run "${setting.command}" with branch ${defaultBranch}?`,
      { title: `Use ${defaultBranch}`, value: "def" },
      { title: "Select branch", value: "sel" }
    );

    if (!action) return;

    let branch = defaultBranch;

    if (action.value === "sel") {
      branch =
        (await vscode.window.showQuickPick(branches, {
          placeHolder: "Select base branch",
        })) || defaultBranch;
    }

    const confirm = await vscode.window.showInformationMessage(
      `Execute "${setting.command}" on ${branch}?`,
      "Confirm",
      "Cancel"
    );

    if (confirm !== "Confirm") return;

    const args = [...setting.command.split(" "), "-b", branch];
    this.executor.run(args);
  }
}

// ======================================================
// 6️⃣ Main Activate Function
// ======================================================
export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("chordiumSupport");
  const nodeVersion = config.get<string>("nodeVersion") || "v20";
  const settings = config.get<any[]>("commands") || [];

  // Load Node binary
  const nodeRuntime = new NodeRuntime(context);
  const node20 = nodeRuntime.getNodeBinary(nodeVersion);
  if (!node20) return;

  // Detect lenscloud
  const resolver = new LensCloudResolver(node20);
  const lenscloud = resolver.detect();
  if (!lenscloud) return;

  const output = new OutputManager();
  const executor = new LensCloudExecutor(lenscloud, output);
  const runner = new CommandRunner(executor, output);

  // Register event triggers
  for (const setting of settings) {
    if (!setting.enabled) continue;

    // --- onSave ---
    if (setting.trigger === "onSave") {
      vscode.workspace.onDidSaveTextDocument((doc) =>
        runner.runSetting(setting, doc)
      );
    }

    // --- onChange ---
    if (setting.trigger === "onChange") {
      vscode.workspace.onDidChangeTextDocument((ev) =>
        runner.runSetting(setting, ev.document)
      );
    }

    // --- cron (future enhancement) ---
  }
}

// ======================================================
export function deactivate() {}
