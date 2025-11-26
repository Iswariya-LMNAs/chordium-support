import 'mocha';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import assert from 'assert';

// Import your classes
import {
    NodeRuntime,
    LensCloudResolver,
    OutputManager,
    LensCloudExecutor,
    CommandRunner
} from '../extension'; // adjust path if needed

suite('Extension Test Suite', () => {

    test('OutputManager cleans ANSI codes', () => {
        const sandbox = sinon.createSandbox();
        try {
            const manager = new OutputManager();
            const channel = (manager as any).channel;
            const appendLine = sandbox.stub(channel, 'appendLine');
            const append = sandbox.stub(channel, 'append');

            manager.write('\u001b[31mHello\u001b[0m');
            manager.writeln('\u001b[32mWorld\u001b[0m');

            assert(append.calledOnce);
            assert(appendLine.calledOnce);
            assert.strictEqual(append.firstCall.args[0], 'Hello');
            assert.strictEqual(appendLine.firstCall.args[0], 'World');
        } finally {
            sandbox.restore();
        }
    });

    test('CommandRunner skips disabled settings', async () => {
        const sandbox = sinon.createSandbox();
        try {
            const output = new OutputManager();
            const executor = new LensCloudExecutor('/fake/lenscloud', output);
            const runner = new CommandRunner(executor, output);

            const setting = { enabled: false, command: 'ls' };
            await runner.runSetting(setting); // should not throw
        } finally {
            sandbox.restore();
        }
    });

    test('CommandRunner executes command if enabled', async () => {
        const sandbox = sinon.createSandbox();
        try {
            const output = new OutputManager();
            const executor = new LensCloudExecutor('/fake/lenscloud', output);
            const runner = new CommandRunner(executor, output);

            const runStub = sandbox.stub(executor, 'run');

            const setting = { enabled: true, command: 'ls', needBaseBranch: false };
            await runner.runSetting(setting);
            assert(runStub.calledOnceWith(['ls']));
        } finally {
            sandbox.restore();
        }
    });

    test('CommandRunner handles branch selection', async () => {
        const sandbox = sinon.createSandbox();
        try {
            const output = new OutputManager();
            const executor = new LensCloudExecutor('/fake/lenscloud', output);
            const runner = new CommandRunner(executor, output);

            // Stub VS Code prompts
            sandbox.stub(vscode.window, 'showInformationMessage')
                .onFirstCall().resolves({ value: 'sel' } as any)
                .onSecondCall().resolves('Confirm' as any);

            sandbox.stub(vscode.window, 'showQuickPick').resolves('dev' as any);

            const runStub = sandbox.stub(executor, 'run');

            const setting = {
                enabled: true,
                command: 'ls',
                needBaseBranch: true,
                branches: ['main', 'dev']
            };

            await runner.runSetting(setting);

            assert(runStub.calledOnce);
            assert.deepStrictEqual(runStub.firstCall.args[0], ['ls', '-b', 'dev']);
        } finally {
            sandbox.restore();
        }
    });

});
