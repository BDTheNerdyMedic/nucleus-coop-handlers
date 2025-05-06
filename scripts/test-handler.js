#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const inquirer = require('inquirer');

const execPromise = util.promisify(exec);
const prompt = inquirer.createPromptModule();

// Load or create configuration from scripts/test-handler.config.json
async function loadOrCreateConfig() {
    const configPath = path.join(__dirname, 'test-handler.config.json');
    try {
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Configuration file not found. Let’s create scripts/test-handler.config.json...');
            return await createConfig(configPath);
        }
        console.error('Error reading test-handler.config.json:', error.message);
        process.exit(1);
    }
}

// Interactively create configuration file
async function createConfig(configPath) {
    const answers = await prompt([
        {
            type: 'input',
            name: 'nucleusExePath',
            message: 'Path to Nucleus Co-op executable (NucleusCoop.exe):',
            default: 'C:\\Program Files\\Nucleus Co-op\\NucleusCoop.exe',
            validate: async (input) => {
                try {
                    await fs.access(input);
                    return true;
                } catch {
                    return 'Invalid path. Please provide a valid path to NucleusCoop.exe.';
                }
            }
        },
        {
            type: 'input',
            name: 'nucleusHandlersDir',
            message: 'Path to Nucleus Co-op handlers directory:',
            default: (answers) => path.join(path.dirname(answers.nucleusExePath), 'handlers'),
            validate: async (input) => {
                try {
                    await fs.access(input);
                    return true;
                } catch {
                    return 'Invalid path. Please provide a valid handlers directory path.';
                }
            }
        },
        {
            type: 'input',
            name: 'localHandlersDir',
            message: 'Path to local handlers directory (relative to repository):',
            default: './handlers',
            validate: async (input) => {
                try {
                    const resolvedPath = path.resolve(__dirname, '..', input);
                    await fs.access(resolvedPath);
                    return true;
                } catch {
                    return 'Invalid path. Please provide a valid relative path to the handlers directory.';
                }
            }
        },
        {
            type: 'confirm',
            name: 'runAsAdmin',
            message: 'Run Nucleus Co-op as administrator?',
            default: false
        }
    ]);

    const config = {
        nucleusExePath: answers.nucleusExePath,
        nucleusHandlersDir: answers.nucleusHandlersDir,
        localHandlersDir: answers.localHandlersDir,
        runAsAdmin: answers.runAsAdmin
    };

    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        console.log(`Configuration saved to ${configPath}`);
        return config;
    } catch (error) {
        console.error('Error saving configuration:', error.message);
        process.exit(1);
    }
}

// Load the last selected handler from a JSON file
async function loadLastHandler() {
    const lastHandlerPath = path.join(__dirname, 'last-handler.json');
    try {
        const data = await fs.readFile(lastHandlerPath, 'utf8');
        const { lastHandler } = JSON.parse(data);
        // Verify the last handler still exists
        await fs.access(lastHandler);
        return lastHandler;
    } catch (error) {
        return null; // Return null if file doesn't exist or handler is invalid
    }
}

// Save the selected handler to a JSON file
async function saveLastHandler(handlerPath) {
    const lastHandlerPath = path.join(__dirname, 'last-handler.json');
    try {
        await fs.writeFile(lastHandlerPath, JSON.stringify({ lastHandler: handlerPath }, null, 2));
    } catch (error) {
        console.error('Error saving last handler:', error.message);
    }
}

// Recursively find all .js files in handlers directory and subdirectories
async function findHandlerFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const handlerFiles = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const subFiles = await findHandlerFiles(fullPath);
            handlerFiles.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            handlerFiles.push(fullPath);
        }
    }

    return handlerFiles;
}

// Close Nucleus Co-op if running
async function closeNucleus(nucleusExe) {
    console.log('Checking if Nucleus Co-op is running...');
    try {
        await execPromise(`taskkill /IM NucleusCoop.exe /F`);
        console.log('Nucleus Co-op closed successfully.');
    } catch (error) {
        if (error.code !== 128) { // 128 means process not found
            console.error('Error closing Nucleus Co-op:', error.message);
            process.exit(1);
        }
        console.log('Nucleus Co-op was not running.');
    }
}

// Copy handler to Nucleus Co-op handlers directory
async function copyHandler(handlerPath, nucleusHandlersDir) {
    const handlerFileName = path.basename(handlerPath);
    const destPath = path.join(nucleusHandlersDir, handlerFileName);
    try {
        await fs.copyFile(handlerPath, destPath);
        console.log(`Copied ${handlerFileName} to ${nucleusHandlersDir}`);
    } catch (error) {
        console.error(`Error copying handler to ${nucleusHandlersDir}:`, error.message);
        process.exit(1);
    }
}

// Launch Nucleus Co-op
async function launchNucleus(nucleusExe, runAsAdmin) {
    console.log('Launching Nucleus Co-op...');
    try {
        // Escape backticks and backslashes in the path for PowerShell
        const escapedExe = nucleusExe.replace(/`/g, '``').replace(/\\/g, '\\\\');
        // Set working directory to the Nucleus Co-op executable's directory
        const workingDir = path.dirname(nucleusExe);
        const escapedWorkingDir = workingDir.replace(/`/g, '``').replace(/\\/g, '\\\\');
        const command = runAsAdmin
            ? `powershell -Command "Start-Process \\"${escapedExe}\\" -WorkingDirectory \\"${escapedWorkingDir}\\" -Verb RunAs"`
            : `start "" "${nucleusExe}"`;
        await execPromise(command, { cwd: runAsAdmin ? undefined : workingDir });
        console.log('Nucleus Co-op launched successfully.');
    } catch (error) {
        console.error('Error launching Nucleus Co-op:', error.message);
        process.exit(1);
    }
}

// Main function
async function main() {
    console.log('Nucleus Co-op Handler Test Script\n');

    // Load or create configuration
    const config = await loadOrCreateConfig();
    const {
        nucleusExePath,
        nucleusHandlersDir,
        localHandlersDir = path.join(__dirname, '..', 'handlers'),
        runAsAdmin = false // Default to false if not specified
    } = config;

    // Resolve handlers directory path early
    const resolvedHandlersDir = path.resolve(__dirname, '..', localHandlersDir);

    // Validate configuration paths
    try {
        await fs.access(nucleusExePath);
        await fs.access(nucleusHandlersDir);
        await fs.access(resolvedHandlersDir);
    } catch (error) {
        console.error('Error: Invalid path in configuration');
        console.error('Ensure nucleusExePath, nucleusHandlersDir, and localHandlersDir are correct in scripts/test-handler.config.json');
        process.exit(1);
    }

    // Find all .js handler files recursively
    const handlerFiles = await findHandlerFiles(resolvedHandlersDir);
    if (handlerFiles.length === 0) {
        console.error('Error: No .js handler files found in', localHandlersDir);
        process.exit(1);
    }

    // Load the last selected handler
    const lastHandler = await loadLastHandler();

    // Prompt user to select a handler
    const { selectedHandler } = await prompt([
        {
            type: 'list',
            name: 'selectedHandler',
            message: 'Select a handler to test:',
            choices: handlerFiles.map(file => ({
                name: path.relative(resolvedHandlersDir, file),
                value: file
            })),
            default: handlerFiles.includes(lastHandler) ? lastHandler : handlerFiles[0]
        }
    ]);

    await saveLastHandler(selectedHandler);

    await closeNucleus(nucleusExePath);

    await copyHandler(selectedHandler, nucleusHandlersDir);

    await launchNucleus(nucleusExePath, runAsAdmin);
}

main().catch(error => {
    console.error('Unexpected error:', error.message);
    process.exit(1);
});