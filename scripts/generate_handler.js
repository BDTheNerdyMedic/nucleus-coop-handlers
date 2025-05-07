#!/usr/bin/env node

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const inquirer = require('inquirer');
const trashModule = require('trash');

// Handle potential ES module export
const trash = trashModule.default || trashModule;

// Create the prompt function for inquirer@9.2.12 compatibility
const prompt = inquirer.createPromptModule();

// Normalize path: remove quotes and convert double backslashes to single
function normalizePath(input) {
    if (typeof input !== 'string' || input.trim() === '') return '';
    let normalized = input;
    if (normalized.startsWith('"') && normalized.endsWith('"')) {
        normalized = normalized.slice(1, -1); // Remove enclosing quotes
    }
    normalized = normalized.replace(/\\\\/g, '\\'); // Convert \\ to \
    return normalized;
}

// Transform path for JavaScript: double backslashes for string literals
function transformPathForScript(input) {
    if (typeof input !== 'string' || input.trim() === '') return '';
    return input.replace(/\\/g, '\\\\'); // Convert \ to \\
}

// Transform path for display: single backslashes
function transformPathForDisplay(input) {
    if (typeof input === 'string') {
        input = input.replace(/\\\\/g, '\\');
    }
    return input;
}

// Load or create configuration from scripts/generate-handler.config.json
async function loadOrCreateConfig() {
    const configPath = path.join(__dirname, 'generate-handler.config.json');
    try {
        const configData = await fsPromises.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Configuration file not found. Let’s create scripts/generate-handler.config.json...');
            return await createConfig(configPath);
        }
        console.error('Error reading generate-handler.config.json:', error.message);
        process.exit(1);
    }
}

// Interactively create configuration file
async function createConfig(configPath) {
    const answers = await prompt([
        {
            type: 'input',
            name: 'localHandlersDir',
            message: 'Path to local handlers directory (relative to repository):',
            default: './handlers',
            validate: async (input) => {
                try {
                    const resolvedPath = path.resolve(__dirname, '..', input);
                    await fsPromises.access(resolvedPath);
                    return true;
                } catch {
                    return 'Invalid path. Please provide a valid relative path to the handlers directory.';
                }
            }
        }
    ]);

    const config = {
        localHandlersDir: answers.localHandlersDir
    };

    try {
        await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2));
        console.log(`Configuration saved to ${configPath}`);
        return config;
    } catch (error) {
        console.error('Error saving configuration:', error.message);
        process.exit(1);
    }
}

// Load handler details from <HandlerName>.json if exists
async function loadHandlerDetails(handlerDir, handlerName) {
    const jsonPath = path.join(handlerDir, `${handlerName}.json`);
    try {
        const data = await fsPromises.readFile(jsonPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // File doesn't exist
        }
        console.error(`Error reading ${handlerName}.json:`, error.message);
        process.exit(1);
    }
}

// Save handler details to <HandlerName>.json
async function saveHandlerDetails(handlerDir, handlerName, details) {
    const jsonPath = path.join(handlerDir, `${handlerName}.json`);
    try {
        await fsPromises.writeFile(jsonPath, JSON.stringify(details, null, 2));
        console.log(`Saved handler details to ${transformPathForDisplay(jsonPath)}`);
    } catch (error) {
        console.error(`Error saving handler details to ${transformPathForDisplay(jsonPath)}:`, error.message);
        process.exit(1);
    }
}

// Prompt for handler-specific details, excluding handlerName
async function promptHandlerDetails(previousDetails = {}) {
    const answers = await prompt([
        {
            type: 'input',
            name: 'gameName',
            message: 'Full game name:',
            default: previousDetails?.gameName || '',
            validate: (input) => input.trim() ? true : 'Game name cannot be empty.'
        },
        {
            type: 'input',
            name: 'executableName',
            message: 'Game executable name (e.g., MyGame-Win64-Shipping.exe):',
            default: previousDetails?.executableName || '',
            validate: (input) => input.trim() && input.endsWith('.exe') ? true : 'Please enter a valid .exe file name.'
        },
        {
            type: 'input',
            name: 'steamID',
            message: 'Steam App ID (leave blank if none):',
            default: previousDetails?.steamID || '',
            validate: (input) => {
                if (input && !/^\d+$/.test(input)) {
                    return 'Steam ID must be a number or empty.';
                }
                return true;
            }
        },
        {
            type: 'number',
            name: 'maxPlayers',
            message: 'Maximum number of players supported:',
            default: previousDetails?.maxPlayers || 4,
            validate: (input) => {
                if (!Number.isInteger(input) || input < 1) {
                    return 'Please enter a positive integer.';
                }
                return true;
            }
        },
        {
            type: 'input',
            name: 'binariesFolder',
            message: 'Path to game binaries folder (relative to game root, e.g., MyGame\\Binaries\\Win64):',
            default: previousDetails?.binariesFolder || '',
            validate: (input) => input.trim() ? true : 'Binaries folder path cannot be empty.'
        },
        {
            type: 'input',
            name: 'workingFolder',
            message: 'Working folder path (relative to game root, leave blank if same as executable folder):',
            default: previousDetails?.workingFolder || ''
        },
        {
            type: 'input',
            name: 'userProfileConfigPath',
            message: 'Path to user profile config (optional, e.g., AppData\\Local\\MyGame\\Config):',
            default: previousDetails?.userProfileConfigPath || ''
        },
        {
            type: 'input',
            name: 'userProfileSavePath',
            message: 'Path to user profile save (optional, e.g., AppData\\Local\\MyGame\\Saves):',
            default: previousDetails?.userProfileSavePath || ''
        },
        {
            type: 'confirm',
            name: 'supportsKeyboard',
            message: 'Does the game support keyboard input?',
            default: previousDetails?.supportsKeyboard || false
        },
        {
            type: 'confirm',
            name: 'useNucleusEnvironment',
            message: 'Use Nucleus environment for this handler?',
            default: previousDetails?.useNucleusEnvironment || true
        },
        {
            type: 'confirm',
            name: 'userProfileSavePathNoCopy',
            message: 'Prevent copying of save files (UserProfileSavePathNoCopy)?',
            default: previousDetails?.userProfileSavePathNoCopy || true
        },
        {
            type: 'confirm',
            name: 'symlinkGame',
            message: 'Symlink the game files to a temporary directory?',
            default: previousDetails?.symlinkGame || true
        },
        {
            type: 'confirm',
            name: 'symlinkExe',
            message: 'Symlink the game executable (if SymlinkGame is enabled)?',
            default: previousDetails?.symlinkExe || false
        }
    ]);

    // Normalize all path inputs
    answers.binariesFolder = normalizePath(answers.binariesFolder);
    answers.workingFolder = normalizePath(answers.workingFolder);
    answers.userProfileConfigPath = normalizePath(answers.userProfileConfigPath);
    answers.userProfileSavePath = normalizePath(answers.userProfileSavePath);

    return answers;
}

// Generate handler JavaScript file
async function generateHandlerFile(handlerDir, handlerName, gameName, executableName, steamID, maxPlayers, binariesFolder, workingFolder, userProfileConfigPath, userProfileSavePath, supportsKeyboard, useNucleusEnvironment, userProfileSavePathNoCopy, symlinkGame, symlinkExe) {
    // Transform paths for JavaScript string literals
    const jsBinariesFolder = transformPathForScript(binariesFolder);
    const jsWorkingFolder = transformPathForScript(workingFolder);
    const jsUserProfileConfigPath = transformPathForScript(userProfileConfigPath);
    const jsUserProfileSavePath = transformPathForScript(userProfileSavePath);

    const handlerTemplate = `Game.ExecutableName = "${executableName}";
Game.GUID = "${handlerName}";
Game.GameName = "${gameName}";
Game.MaxPlayers = ${maxPlayers};
Game.MaxPlayersOneMonitor = ${maxPlayers};
${steamID ? `Game.SteamID = "${steamID}";` : '// Game.SteamID = "Enter Steam App ID if applicable";'}
Game.BinariesFolder = "${jsBinariesFolder}";
Game.WorkingFolder = "${jsWorkingFolder}";
${jsUserProfileConfigPath ? `Game.UserProfileConfigPath = "${jsUserProfileConfigPath}";` : '// Game.UserProfileConfigPath = "Optional: Path to config files";'}
${jsUserProfileSavePath ? `Game.UserProfileSavePath = "${jsUserProfileSavePath}";` : '// Game.UserProfileSavePath = "Optional: Path to save files";'}
Game.UserProfileSavePathNoCopy = ${userProfileSavePathNoCopy};
Game.UseNucleusEnvironment = ${useNucleusEnvironment};
Game.HandlerInterval = 100;
Game.PauseBetweenStarts = 20;
Game.SymlinkGame = ${symlinkGame};
Game.SymlinkExe = ${symlinkExe};
Game.NeedsSteamEmulation = ${steamID ? 'true' : 'false'};
Game.UseGoldberg = ${steamID ? 'true' : 'false'};
Game.CreateSteamAppIdByExe = ${steamID ? 'true' : 'false'};
Game.SupportsKeyboard = ${supportsKeyboard};
Game.Hook.XInputEnabled = true;
Game.Hook.DInputEnabled = false;
Game.Hook.DInputForceDisable = true;
Game.Hook.CustomDllEnabled = true;
Game.Play = function () {
    Context.StartArguments = " -windowed -ResX=" + Context.Width + " -ResY=" + Context.Height;
};`;

    const handlerPath = path.join(handlerDir, `${handlerName}.js`);
    await fsPromises.writeFile(handlerPath, handlerTemplate);
    console.log(`Created handler file: ${transformPathForDisplay(handlerPath)}`);
}

// Generate README.md file
async function generateReadme(handlerDir, handlerName, gameName, executableName, steamID, maxPlayers, supportsKeyboard, useNucleusEnvironment, userProfileSavePathNoCopy, symlinkGame, symlinkExe) {
    const readmePath = path.join(handlerDir, 'README.md');
    const readmeTemplate = `# ${handlerName} Handler for Nucleus Co-op

## Game Information
- **Game Name**: ${gameName}
- **Executable Name**: ${executableName}
${steamID ? `- **Steam App ID**: ${steamID}` : ''}
- **Max Players**: ${maxPlayers}

## Description
This handler enables cooperative play for ${gameName} using Nucleus Co-op.

## Installation
1. Copy this handler folder (\`${handlerName}\`) to the Nucleus Co-op handlers directory (\`handlers\`) in your Nucleus Co-op installation.
2. Launch Nucleus Co-op, select this handler, and follow the on-screen instructions to set up and play.

## Notes
- Additional configuration may be required for optimal performance (e.g., adjust paths in \`${handlerName}.js\`).

## Development
- Edit \`${handlerName}.js\` to complete the handler logic (e.g., paths, input hooks, launch arguments).
- Test the handler using the Nucleus Co-op interface or the \`test-handler.js\` script.
`;

    try {
        await fsPromises.writeFile(readmePath, readmeTemplate);
        console.log(`Created README file: ${transformPathForDisplay(readmePath)}`);
    } catch (error) {
        console.error(`Error creating README file ${transformPathForDisplay(readmePath)}:`, error.message);
        process.exit(1);
    }
}

// Main function
async function main() {
    console.log('Nucleus Co-op Handler Generator Script\n');

    // Load or create configuration
    const config = await loadOrCreateConfig();
    const { localHandlersDir = path.join(__dirname, '..', 'handlers') } = config;

    // Resolve handlers directory
    const resolvedHandlersDir = path.resolve(__dirname, '..', localHandlersDir);

    // Validate handlers directory
    try {
        await fsPromises.access(resolvedHandlersDir);
    } catch (error) {
        console.error('Error: Invalid handlers directory path:', transformPathForDisplay(resolvedHandlersDir));
        console.error('Ensure localHandlersDir is correct in scripts/generate-handler.config.json');
        process.exit(1);
    }

    // Prompt for handler name ONCE
    const { handlerName } = await prompt([
        {
            type: 'input',
            name: 'handlerName',
            message: 'Handler name (Used as directory name and `Handler name.js`):',
            validate: async (input) => {
                if (!input.trim()) {
                    return 'Handler name cannot be empty.';
                }
                if (/[<>:"\/\\|?*]/.test(input)) {
                    return 'Handler name contains invalid characters for a directory.';
                }
                return true;
            }
        }
    ]);

    const handlerDir = path.join(resolvedHandlersDir, handlerName);

    // Check if handler directory exists and load details if available
    let previousDetails = (await loadHandlerDetails(handlerDir, handlerName)) || {};
    if (previousDetails && Object.keys(previousDetails).length > 0) {
        console.log(`Previous handler details found for '${handlerName}'. Pre-filling prompts...`);
    } else {
        console.log(`Handler directory '${transformPathForDisplay(handlerDir)}' exists but no details found. Proceeding with new details.`);
    }

    // Prompt for handler details, excluding handlerName
    const handlerDetails = await promptHandlerDetails(previousDetails);
    handlerDetails.handlerName = handlerName; // Use the initial input

    // Check if handler directory already exists and prompt for overwrite
    if (fs.existsSync(handlerDir)) {
        const { confirmOverwrite } = await prompt([
            {
                type: 'confirm',
                name: 'confirmOverwrite',
                message: `Handler directory '${transformPathForDisplay(handlerDir)}' already exists. Overwriting will move existing files to the recycle bin. Proceed? (This action is destructive)`,
                default: false
            }
        ]);

        if (!confirmOverwrite) {
            console.log('Operation canceled by user.');
            process.exit(0);
        }

        // Move existing directory to recycle bin
        try {
            await trash(handlerDir);
            console.log(`Moved existing directory '${transformPathForDisplay(handlerDir)}' to recycle bin.`);
        } catch (error) {
            console.error(`Error moving directory to recycle bin:`, error.message);
            process.exit(1);
        }
    }

    // Create handler directory
    try {
        await fsPromises.mkdir(handlerDir, { recursive: true });
        console.log(`Created handler directory: ${transformPathForDisplay(handlerDir)}`);
    } catch (error) {
        console.error(`Error creating handler directory ${transformPathForDisplay(handlerDir)}:`, error.message);
        process.exit(1);
    }

    // Generate handler and README files
    await generateHandlerFile(
        handlerDir,
        handlerDetails.handlerName,
        handlerDetails.gameName,
        handlerDetails.executableName,
        handlerDetails.steamID,
        handlerDetails.maxPlayers,
        handlerDetails.binariesFolder,
        handlerDetails.workingFolder,
        handlerDetails.userProfileConfigPath,
        handlerDetails.userProfileSavePath,
        handlerDetails.supportsKeyboard,
        handlerDetails.useNucleusEnvironment,
        handlerDetails.userProfileSavePathNoCopy,
        handlerDetails.symlinkGame,
        handlerDetails.symlinkExe
    );
    await generateReadme(
        handlerDir,
        handlerDetails.handlerName,
        handlerDetails.gameName,
        handlerDetails.executableName,
        handlerDetails.steamID,
        handlerDetails.maxPlayers,
        handlerDetails.supportsKeyboard,
        handlerDetails.useNucleusEnvironment,
        handlerDetails.userProfileSavePathNoCopy,
        handlerDetails.symlinkGame,
        handlerDetails.symlinkExe
    );

    // Save handler details to <HandlerName>.json
    await saveHandlerDetails(handlerDir, handlerDetails.handlerName, handlerDetails);

    console.log('\nHandler generation complete!');
    console.log(`Handler created at: ${transformPathForDisplay(handlerDir)}`);
}

main().catch(error => {
    console.error('Unexpected error:', error.message);
    process.exit(1);
});