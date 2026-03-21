#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { input, select } from '@inquirer/prompts';

const args = process.argv.slice(2);
const appName = args[0];

let appDirectory = '';
let configFilePath = '';
let appEntryFilePath = '';
let envExampleFilePath = '';
let envFilePath = '';
let config: any = {};

if (!appName) {
    console.error('Usage: npm start <app-name> [version] [configure], where <app-name> is a directory in Node/apps.');
    process.exit(1);
}

const appRootDirectory = join(process.cwd(), 'apps', appName);
const extraArgs = args.slice(1);
const configMode = extraArgs.includes('configure');
const positionalArgs = extraArgs.filter(arg => arg !== 'configure');
const requestedVersion = positionalArgs[0];

if (positionalArgs.length > 1) {
    console.error('Too many positional arguments.');
    console.error('Usage: npm start <app-name> [version] [configure]');
    process.exit(1);
}

if (!existsSync(appRootDirectory)) {
    console.error(`Application not found: ${appName}`);
    process.exit(1);
}

function discoverVersions(rootDirectory: string): string[] {
    return readdirSync(rootDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((folderName) => existsSync(join(rootDirectory, folderName, 'config.json')))
        .sort();
}

async function resolveAppDirectory(): Promise<{ appDirectory: string; selectedVersion?: string }> {
    const availableVersions = discoverVersions(appRootDirectory);
    const hasRootConfig = existsSync(join(appRootDirectory, 'config.json'));

    if (requestedVersion) {
        if (!availableVersions.includes(requestedVersion)) {
            if (availableVersions.length === 0) {
                console.error(
                    `App "${appName}" does not have versions. Start it with "npm start ${appName}"${configMode ? ' or "npm start ' + appName + ' configure".' : '.'}`,
                );
            } else {
                console.error(
                    `Unknown version "${requestedVersion}" for app "${appName}". Available versions: ${availableVersions.join(', ')}`,
                );
            }
            process.exit(1);
        }

        return {
            appDirectory: join(appRootDirectory, requestedVersion),
            selectedVersion: requestedVersion,
        };
    }

    if (availableVersions.length > 1) {
        const selectedVersion = await select({
            message: `Select a version for "${appName}":`,
            choices: availableVersions.map((version) => ({
                name: version,
                value: version,
            })),
        });

        return {
            appDirectory: join(appRootDirectory, selectedVersion),
            selectedVersion,
        };
    }

    if (availableVersions.length === 1 && !hasRootConfig) {
        const onlyVersion = availableVersions[0];
        return {
            appDirectory: join(appRootDirectory, onlyVersion),
            selectedVersion: onlyVersion,
        };
    }

    return { appDirectory: appRootDirectory };
}

async function runConfigJsonConfiguration() {
    const serverType = await select({
        message: 'Would you like your app to create its own Ubiq server, or would you like the app to join an existing one?',
        choices: [
            { name: 'Join an existing server', value: 'existing' },
            { name: 'Create a new Ubiq server', value: 'new' },
        ]
    });

    let existingServerType;
    if (serverType === 'existing') {
        existingServerType = await select({
            message: 'Would you like to use Nexus (the Ubiq server hosted by UCL), or would you like to run your own?',
            choices: [
                { name: 'Run my own server', value: 'own' },
                { name: 'Use Nexus (UCL hosted server)', value: 'ucl' },
            ]
        });
    }

    if (serverType === 'existing' && existingServerType === 'own') {
        config.roomserver.joinExisting = true;
        config.roomserver.uri = await input({ message: 'Enter the URI of your server:', default: 'localhost' });
        config.roomserver.tcp.port = parseInt(await input({ message: 'Enter the TCP port of your server:', default: '8009' }), 10);
        console.log('For more information on server setup, visit: https://ucl-vr.github.io/ubiq/serversetup');
    } else if (serverType === 'existing' && existingServerType === 'ucl') {
        config.roomserver.joinExisting = true;
        config.roomserver.uri = 'nexus.cs.ucl.ac.uk';
        config.roomserver.tcp.port = 8009;
    } else {
        config.roomserver.joinExisting = false;
        config.roomserver.uri = 'localhost';
        config.roomserver.tcp.port = parseInt(await input({ message: 'Enter the TCP port you wish to run the server on:', default: '8009' }), 10);
    }

    config.configurationComplete = true;
    writeFileSync(configFilePath, JSON.stringify(config, null, 2));
}

/**
 * Prompts the user to configure per-service settings (Python paths, external repos, etc.)
 * based on the `services` section in config.json.
 */
async function runServiceConfiguration() {
    if (!config.services) return;

    for (const [serviceKey, serviceConf] of Object.entries(config.services) as [string, any][]) {
        const displayName = serviceKey
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .toLowerCase();

        // Configure external repo path
        if (serviceConf.externalRepo) {
            const repoUrl = serviceConf.externalRepo.url ?? '';
            const currentPath = serviceConf.externalRepo.path ?? '';
            const repoPath = await input({
                message: `Enter the absolute path to the ${displayName} repository${repoUrl ? ` (${repoUrl})` : ''}:`,
                default: currentPath || undefined,
            });
            if (repoPath.trim()) {
                serviceConf.externalRepo.path = repoPath.trim();
            }
        }

        // Configure Python command for the service
        if (serviceConf.python) {
            const currentCommand = serviceConf.python.command ?? '';
            const pythonCommand = await input({
                message: `Enter the Python command for ${displayName} (venv path, conda env, or system command):`,
                default: currentCommand || undefined,
            });
            if (pythonCommand.trim()) {
                serviceConf.python.command = pythonCommand.trim();
            }
        }
    }

    writeFileSync(configFilePath, JSON.stringify(config, null, 2));
}

async function runEnvConfiguration() {
    if (!existsSync(envExampleFilePath)) {
        return;
    }
    
    const envExampleContent = readFileSync(envExampleFilePath, 'utf-8');
    const envLines = envExampleContent.split('\n').filter(line => line.trim() !== '');
    const envConfig: { [key: string]: string } = {};

    for (const line of envLines) {
        const [key, ...rest] = line.split('=');
        const commentMatch = rest.join('=').match(/#\s*(.*)/);
        const comment = commentMatch ? commentMatch[1] : key.trim();
        envConfig[key.trim()] = await input({ message: `Please enter your ${comment}:` });
    }

    const newEnvContent = Object.entries(envConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    writeFileSync(envFilePath, newEnvContent);
    console.log(`A new .env file has been created at ${envFilePath}.`);
}

(async () => {
    const resolved = await resolveAppDirectory();
    appDirectory = resolved.appDirectory;
    configFilePath = join(appDirectory, 'config.json');
    appEntryFilePath = join(appDirectory, 'app.ts');
    envExampleFilePath = join(appDirectory, '.env.example');
    envFilePath = join(appDirectory, '.env');

    if (!existsSync(configFilePath)) {
        console.error(`Configuration file not found for app: ${appName}${resolved.selectedVersion ? ` (version: ${resolved.selectedVersion})` : ''}`);
        process.exit(1);
    }

    if (!existsSync(appEntryFilePath)) {
        console.error(`Entry file not found: ${appEntryFilePath}`);
        process.exit(1);
    }

    config = JSON.parse(readFileSync(configFilePath, 'utf-8'));

    if (resolved.selectedVersion) {
        console.log(`Selected app version: ${appName}/${resolved.selectedVersion}`);
    }

    if (configMode || !config.configurationComplete) {
        await runConfigJsonConfiguration();
        await runServiceConfiguration();
        console.log('\x1b[32mConfiguration complete. Please ensure to apply the same configuration to the Unity client.\x1b[0m');
    }

    if (!existsSync(envFilePath)) {
        await runEnvConfiguration();
    }

    console.log('Executing: ', `node --loader ts-node/esm ./app.ts in directory ${appDirectory}`);

    try {
        execSync(
            `node --import "data:text/javascript,import { register } from 'node:module'; import { pathToFileURL } from 'node:url'; register('ts-node/esm', pathToFileURL('./'));" ./app.ts`,
            { stdio: 'inherit', cwd: appDirectory }
        );
    } catch (error) {
        process.exit(1);
    }
})();
