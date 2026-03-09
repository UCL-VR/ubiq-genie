import { EventEmitter } from 'node:events';
import { spawn, spawnSync, execSync, ChildProcess, SpawnOptions } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { NetworkScene } from 'ubiq-server/ubiq';
import { Logger } from './logger';
import { RoomClient } from 'ubiq-server/components/roomclient';
import nconf from 'nconf';

/**
 * Defines the lifecycle mode for child processes managed by a service.
 * - 'per-peer': One child process per connected peer. Spawned on peer join, killed on peer leave.
 * - 'singleton': A single child process spawned immediately on service creation.
 * - 'lazy-singleton': A single child process spawned when the first peer joins, killed when all peers leave.
 */
type ProcessMode = 'per-peer' | 'singleton' | 'lazy-singleton';

/**
 * Standardized service lifecycle states.
 *
 * Child processes signal state transitions via stdout markers:
 *   >READY  — the backend has finished loading and is ready to accept input
 *   >BUSY   — the backend is processing a request
 *   >IDLE   — the backend has finished processing and is ready for the next request
 *
 * These markers are intentionally plain text so that any language (Python, Node, C++, etc.)
 * can trivially emit them to stdout.
 */
type ServiceState = 'starting' | 'ready' | 'busy' | 'idle' | 'error' | 'stopped';

/**
 * Configuration for the Python environment used by a service.
 * Resolved per-service from the `services.<serviceName>.python` section of config.json.
 */
interface PythonConfig {
    /**
     * Python command to use. Can be:
     * - An absolute path to a venv executable (e.g., "/home/user/.venv/bin/python")
     * - A conda-run invocation (e.g., "conda run -n myenv python")
     * - A bare system command (e.g., "python3")
     */
    command?: string;
}

/**
 * Configuration for an external repository dependency used by a provider.
 * Resolved per-service from the `services.<serviceName>.externalRepo` section of config.json.
 */
interface ExternalRepoConfig {
    /** Absolute path to the cloned repository on disk. */
    path?: string;
    /** Git clone URL of the repository. */
    url?: string;
    /** Known-good commit hash that this app was tested against. */
    commit?: string;
}

/**
 * Per-service configuration block from config.json under `services.<serviceName>`.
 */
interface ServiceConfig {
    /** Provider name to auto-resolve (e.g., 'llama-cpp', 'azure', 'kokoro'). */
    provider?: string;
    /** Model name or path. Can be a HuggingFace ID, an absolute file path, or a relative checkpoint name. */
    model?: string;
    /** Python environment configuration for this service. */
    python?: PythonConfig;
    /** External repository this service depends on. */
    externalRepo?: ExternalRepoConfig;
    /** Provider-specific options (passed through to the provider factory). */
    options?: Record<string, unknown>;
}

/**
 * Lightweight configuration object that defines how a service backend is run.
 * Providers specify what command to run, with what arguments, and what lifecycle
 * pattern to use. They do not contain business logic — that stays in ServiceController.
 */
interface ServiceProvider {
    /** Display name for the provider (e.g., 'azure', 'whisper', 'openai') */
    name: string;
    /** The command to execute (e.g., 'python', '/usr/local/bin/whisper-cpp') */
    command: string;
    /**
     * Arguments for the command. Can be a static array or a function that receives
     * the process identifier (peer UUID for per-peer mode, 'default' for singleton
     * modes) and returns args.
     */
    args: string[] | ((identifier: string) => string[]);
    /** Lifecycle mode for child process management */
    processMode: ProcessMode;
    /** Optional extra environment variables for the child process */
    env?: Record<string, string>;
    /** Optional path to a requirements.txt file for Python dependency checking */
    requirements?: string;
    /** Optional Python command override specific to this provider */
    pythonCommand?: string;
}

/**
 * A mapping from provider name to a factory function that creates a ServiceProvider.
 * Used by `resolveProvider()` to allow config-only provider selection.
 */
type ProviderRegistry = Record<string, (config: ServiceConfig) => ServiceProvider>;

class ServiceController extends EventEmitter {
    name: string;
    roomClient: RoomClient;
    childProcesses: { [identifier: string]: ChildProcess };
    provider?: ServiceProvider;

    /** The config key used to look up this service's settings under `services.<key>`. */
    serviceConfigKey?: string;

    /** Per-process state tracking. Key is the process identifier. */
    private processStates: { [identifier: string]: ServiceState } = {};

    /** Pending stdout data per process for line-based marker detection. */
    private stdoutBuffers: { [identifier: string]: string } = {};

    /** Resolvers for waitForReady() promises. */
    private readyResolvers: { [identifier: string]: Array<() => void> } = {};

    constructor(scene: NetworkScene, name: string, provider?: ServiceProvider, serviceConfigKey?: string) {
        super();
        this.name = name;
        this.roomClient = scene.getComponent('RoomClient') as RoomClient;
        this.childProcesses = {};
        this.provider = provider;
        this.serviceConfigKey = serviceConfigKey;

        // Listen for process exit events and ensure child processes are killed
        process.on('exit', () => this.killAllChildProcesses());
        process.on('SIGINT', () => {
            this.killAllChildProcesses();
            process.exit();
        });
        process.on('SIGTERM', () => {
            this.killAllChildProcesses();
            process.exit();
        });

        // Check external repo commit hash if configured
        if (this.serviceConfigKey) {
            this.verifyExternalRepoCommit();
        }

        // If a provider is given, automatically set up child process lifecycle
        if (provider) {
            this.initializeProvider(provider);
        }
    }

    // --- Service state management ---

    /**
     * Returns the current state for a process identifier.
     * For singleton/lazy-singleton modes, use 'default' as the identifier.
     */
    getState(identifier: string = 'default'): ServiceState {
        return this.processStates[identifier] ?? 'stopped';
    }

    /**
     * Convenience getter for the default process state (singleton modes).
     */
    get state(): ServiceState {
        return this.getState('default');
    }

    /**
     * Returns a promise that resolves when the specified process emits >READY.
     * Resolves immediately if the process is already in 'ready' or 'idle' state.
     */
    waitForReady(identifier: string = 'default'): Promise<void> {
        const currentState = this.getState(identifier);
        if (currentState === 'ready' || currentState === 'idle') {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            if (!this.readyResolvers[identifier]) {
                this.readyResolvers[identifier] = [];
            }
            this.readyResolvers[identifier].push(resolve);
        });
    }

    private setState(identifier: string, state: ServiceState) {
        const previous = this.processStates[identifier];
        if (previous === state) return;
        this.processStates[identifier] = state;
        this.emit('stateChange', state, identifier, previous);

        // Resolve pending waitForReady promises
        if ((state === 'ready' || state === 'idle') && this.readyResolvers[identifier]) {
            for (const resolve of this.readyResolvers[identifier]) {
                resolve();
            }
            delete this.readyResolvers[identifier];
        }
    }

    // --- External repo commit hash verification ---

    private verifyExternalRepoCommit() {
        const serviceConf = this.getServiceConfig();
        if (!serviceConf?.externalRepo) return;

        const { path: repoPath, commit: expectedCommit, url } = serviceConf.externalRepo;
        if (!repoPath || !expectedCommit) return;

        if (!existsSync(repoPath)) {
            this.log(
                `External repo not found at '${repoPath}'.` +
                    (url ? ` Clone it with: git clone ${url} "${repoPath}"` : ''),
                'warning'
            );
            return;
        }

        try {
            const actualCommit = execSync('git rev-parse HEAD', {
                cwd: repoPath,
                encoding: 'utf-8',
                timeout: 5000,
            }).trim();

            if (actualCommit !== expectedCommit) {
                this.log(
                    `External repo at '${repoPath}' is at commit ${actualCommit.slice(0, 12)} ` +
                        `but config expects ${expectedCommit.slice(0, 12)}. ` +
                        `If the application works correctly, update the commit hash in config.json ` +
                        `under services.${this.serviceConfigKey}.externalRepo.commit`,
                    'warning'
                );
            }
        } catch {
            // Not a git repo or git not available — skip silently
        }
    }

    // --- Config helpers ---

    /**
     * Returns the per-service config block from `services.<serviceConfigKey>` in config.json.
     * Returns undefined if no serviceConfigKey is set or the config section doesn't exist.
     */
    getServiceConfig(): ServiceConfig | undefined {
        if (!this.serviceConfigKey) return undefined;
        return nconf.get(`services:${this.serviceConfigKey}`) as ServiceConfig | undefined;
    }

    /**
     * Resolves a provider from the config-based registry.
     *
     * Reads `services.<serviceConfigKey>.provider` from config.json, looks it up
     * in the provided registry, and calls the factory with the service config.
     * Falls back to `defaultProvider` if no config is set or the provider name
     * is not found in the registry.
     */
    static resolveProvider(
        serviceConfigKey: string,
        registry: ProviderRegistry,
        defaultProvider: ServiceProvider
    ): ServiceProvider {
        const serviceConf = nconf.get(`services:${serviceConfigKey}`) as ServiceConfig | undefined;
        if (!serviceConf?.provider) return defaultProvider;

        const factory = registry[serviceConf.provider];
        if (!factory) {
            Logger.log(
                'ServiceController',
                `Unknown provider '${serviceConf.provider}' for service '${serviceConfigKey}'. ` +
                    `Available: ${Object.keys(registry).join(', ')}. Using default.`,
                'warning'
            );
            return defaultProvider;
        }
        return factory(serviceConf);
    }

    // --- Provider lifecycle ---

    /**
     * Sets up child process lifecycle management based on the provider's processMode.
     * - 'singleton': spawns a single process immediately.
     * - 'per-peer': spawns a process per peer on join, kills on leave.
     * - 'lazy-singleton': spawns on first peer join, kills when all peers leave.
     */
    private initializeProvider(provider: ServiceProvider) {
        // Check Python dependencies if a requirements file is specified
        if (provider.requirements) {
            this.checkRequirements(provider.requirements);
        }

        switch (provider.processMode) {
            case 'singleton':
                this.spawnProviderProcess('default');
                break;
            case 'per-peer':
                this.registerProviderPeerLifecycle(true);
                break;
            case 'lazy-singleton':
                this.registerProviderPeerLifecycle(false);
                break;
        }
    }

    /**
     * Checks whether the Python packages listed in a requirements.txt file are
     * installed. Logs a warning with install instructions if any are missing.
     */
    private checkRequirements(requirementsPath: string) {
        if (!existsSync(requirementsPath)) {
            this.log(`Requirements file not found: ${requirementsPath}`, 'warning');
            return;
        }

        const content = readFileSync(requirementsPath, 'utf-8');
        const packages = content
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'))
            .map((line) => line.split(/[=<>!~]/)[0].trim())
            .filter(Boolean);

        if (packages.length === 0) return;

        const resolvedPython = this.resolveCommand('python');
        const { command: pythonCommand, prefixArgs: pythonPrefixArgs } = this.splitCommand(resolvedPython);

        // Use pip to check installed packages in one call
        const result = spawnSync(pythonCommand, [...pythonPrefixArgs, '-m', 'pip', 'show', ...packages], {
            encoding: 'utf-8',
            timeout: 15000,
        });

        if (result.status !== 0) {
            // Determine which specific packages are missing
            const missing: string[] = [];
            for (const pkg of packages) {
                const check = spawnSync(pythonCommand, [...pythonPrefixArgs, '-m', 'pip', 'show', pkg], {
                    encoding: 'utf-8',
                    timeout: 10000,
                });
                if (check.status !== 0) {
                    missing.push(pkg);
                }
            }
            if (missing.length > 0) {
                this.log(
                    `Missing Python packages for provider '${this.provider?.name}': ${missing.join(', ')}. ` +
                        `Install with: pip install -r ${requirementsPath}`,
                    'warning'
                );
            }
        }
    }

    /**
     * Spawns a child process using the provider's command, args, and optional env.
     */
    private spawnProviderProcess(identifier: string) {
        const provider = this.provider!;
        const providerArgs =
            typeof provider.args === 'function' ? provider.args(identifier) : provider.args;
        const resolved = this.resolveCommand(provider.command);
        const { command, prefixArgs } = this.splitCommand(resolved);
        const args = [...prefixArgs, ...providerArgs];

        const spawnOptions: SpawnOptions | undefined = provider.env
            ? { env: { ...process.env, ...provider.env } }
            : undefined;

        this.setState(identifier, 'starting');
        this.registerChildProcess(identifier, command, args, spawnOptions);
    }

    /**
     * Resolves the command to execute. For Python commands, checks (in order):
     *   1. provider.pythonCommand (provider-level override)
     *   2. services.<serviceConfigKey>.python.command (per-service config)
     *   3. python.command (global config)
     *   4. 'python3' (system default)
     */
    private resolveCommand(command: string): string {
        if (command !== 'python') {
            return command;
        }

        // 1. Provider-level override
        if (this.provider?.pythonCommand) {
            return this.validatePythonCommand(this.provider.pythonCommand);
        }

        // 2. Per-service config: services.<key>.python.command
        if (this.serviceConfigKey) {
            const serviceConf = this.getServiceConfig();
            const perService = serviceConf?.python?.command;
            if (typeof perService === 'string' && perService.trim().length > 0) {
                return this.validatePythonCommand(perService.trim());
            }
        }

        // 3. Global config: python.command
        const globalPython = nconf.get('python:command');
        if (typeof globalPython === 'string' && globalPython.trim().length > 0) {
            return this.validatePythonCommand(globalPython.trim());
        }

        return 'python3';
    }

    /**
     * Validates that a Python command string is non-empty.
     * Accepts absolute paths, conda-run invocations, or bare system commands.
     */
    private validatePythonCommand(pythonCommand: string): string {
        if (pythonCommand.length === 0) {
            throw new Error('Python command must not be empty.');
        }
        return pythonCommand;
    }

    /**
     * Splits a command string that may contain spaces (e.g., "conda run -n myenv python")
     * into the executable and prefix arguments. These prefix args are prepended to the
     * actual process args when spawning.
     */
    private splitCommand(commandStr: string): { command: string; prefixArgs: string[] } {
        const parts = commandStr.split(/\s+/);
        return { command: parts[0], prefixArgs: parts.slice(1) };
    }

    /**
     * Registers peer join/leave handlers for provider-based process lifecycle.
     * @param perPeer - If true, one process per peer (identifier = peer UUID).
     *                  If false, a single shared process (identifier = 'default').
     */
    private registerProviderPeerLifecycle(perPeer: boolean) {
        if (!this.roomClient) {
            throw new Error(`RoomClient must be added to the scene before ${this.name}`);
        }

        this.roomClient.addListener('OnPeerAdded', (peer: { uuid: string }) => {
            const identifier = perPeer ? peer.uuid : 'default';
            if (!(identifier in this.childProcesses)) {
                this.log(`Starting process for peer ${peer.uuid}`);
                this.spawnProviderProcess(identifier);
            }
        });

        this.roomClient.addListener('OnPeerRemoved', (peer: { uuid: string }) => {
            if (perPeer) {
                const identifier = peer.uuid;
                if (identifier in this.childProcesses) {
                    this.log(`Stopping process for peer ${peer.uuid}`);
                    this.killChildProcess(identifier);
                }
            } else {
                // lazy-singleton: kill when no peers remain
                if (this.roomClient.peers.size === 0 && 'default' in this.childProcesses) {
                    this.log('No peers remaining, stopping process');
                    this.killChildProcess('default');
                }
            }
        });
    }

    // --- stdout marker detection ---

    /**
     * Scans stdout data for state markers (>READY, >BUSY, >IDLE) and updates
     * the process state accordingly. Markers are stripped from the data before
     * being emitted to consumers.
     *
     * Returns the data with marker lines removed.
     */
    private processStdoutMarkers(data: Buffer, identifier: string): Buffer {
        const text = data.toString();
        this.stdoutBuffers[identifier] = (this.stdoutBuffers[identifier] ?? '') + text;

        const lines = this.stdoutBuffers[identifier].split('\n');
        // Keep the last incomplete line in the buffer
        this.stdoutBuffers[identifier] = lines.pop() ?? '';

        const outputLines: string[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '>READY') {
                this.setState(identifier, 'ready');
            } else if (trimmed === '>BUSY') {
                this.setState(identifier, 'busy');
            } else if (trimmed === '>IDLE') {
                this.setState(identifier, 'idle');
            } else {
                outputLines.push(line);
            }
        }

        // Reconstruct the buffer without marker lines
        const filtered = outputLines.join('\n');
        // Add newline back if there was content (to match original stream behavior)
        if (filtered.length > 0) {
            return Buffer.from(filtered + '\n');
        }
        return Buffer.alloc(0);
    }

    /**
     * Registers a child process and sets up stdout/stderr event handlers.
     * State markers (>READY, >BUSY, >IDLE) in stdout are automatically detected
     * and update the service state. They are stripped before being emitted as 'data' events.
     */
    registerChildProcess(
        identifier: string,
        command: string,
        args: Array<string>,
        spawnOptions?: SpawnOptions
    ): ChildProcess {
        if (identifier === undefined) {
            throw new Error(`Identifier must be defined for child process of service: ${this.name}`);
        }
        if (this.childProcesses[identifier] !== undefined) {
            throw new Error(`Identifier: ${identifier} already in use for child process of service: ${this.name}`);
        }

        try {
            this.childProcesses[identifier] = spawnOptions
                ? spawn(command, args, spawnOptions)
                : spawn(command, args);
        } catch (e) {
            this.setState(identifier, 'error');
            throw new Error(`Failed to spawn child process for service: ${this.name}. Error: ${e}`);
        }

        // Register events for the child process.
        const childProcess = this.childProcesses[identifier];
        if (childProcess && childProcess.stdout && childProcess.stderr) {
            childProcess.stdout.on('data', (data: Buffer) => {
                const filtered = this.processStdoutMarkers(data, identifier);
                if (filtered.length > 0) {
                    this.emit('data', filtered, identifier);
                }
            });
            childProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    this.log(`Child process ${identifier}: ${message}`, 'warning');
                }
            });
            childProcess.on('close', (code, signal) => {
                this.setState(identifier, 'stopped');
                delete this.childProcesses[identifier];
                delete this.processStates[identifier];
                delete this.stdoutBuffers[identifier];
                this.emit('close', code, signal, identifier);
            });
            childProcess.on('error', (err) => {
                this.setState(identifier, 'error');
                delete this.childProcesses[identifier];
                this.log(`Failed to start child process ${identifier}: ${err.message}`, 'error');
                this.emit('close', -1, 'ERROR', identifier);
            });
            // Prevent unhandled EPIPE errors when writing to a process that has exited
            if (childProcess.stdin) {
                childProcess.stdin.on('error', (err) => {
                    if ((err as NodeJS.ErrnoException).code === 'EPIPE') {
                        this.log(`Child process ${identifier} stdin closed (EPIPE)`, 'warning');
                    } else {
                        this.log(`Child process ${identifier} stdin error: ${err.message}`, 'error');
                    }
                });
            }
        }

        this.log(`Registered child process with identifier: ${identifier}`);

        // Check if the child process has already been closed.
        if (this.childProcesses[identifier].killed) {
            this.setState(identifier, 'stopped');
            delete this.childProcesses[identifier];
            this.emit('close', 0, 'SIGTERM', identifier);
        }

        // Return reference to the child process.
        return this.childProcesses[identifier];
    }

    /**
     * Logs a message to the console with the service name.
     */
    log(message: string, level: 'info' | 'warning' | 'error' = 'info', end: string = '\n'): void {
        Logger.log(this.name, message, level, end, '\x1b[35m');
    }

    /**
     * Sends data to a child process with the specified identifier.
     *
     * @returns `true` if the data was flushed, `false` if it was buffered internally
     *   (backpressure), or `undefined` if the write could not be performed.
     */
    sendToChildProcess(identifier: string, data: string | Buffer): boolean | undefined {
        const child = this.childProcesses[identifier];
        if (child === undefined) {
            this.log(`Child process with identifier ${identifier} not found for service: ${this.name}`, 'error');
            return undefined;
        }

        if (child.killed || !child.stdin || child.stdin.destroyed) {
            this.log(`Child process ${identifier} is no longer writable`, 'warning');
            return undefined;
        }

        return child.stdin.write(data);
    }

    /**
     * Kills a specific child process.
     */
    killChildProcess(identifier: string) {
        if (this.childProcesses[identifier] === undefined) {
            throw new Error(`Child process with identifier: ${identifier} not found for service: ${this.name}`);
        }

        this.childProcesses[identifier].kill();
        this.setState(identifier, 'stopped');
        delete this.childProcesses[identifier];
    }

    /**
     * Kills all child processes.
     */
    killAllChildProcesses() {
        this.log('Killing all child processes');
        for (const [identifier, childProcess] of Object.entries(this.childProcesses)) {
            childProcess.kill();
            this.setState(identifier, 'stopped');
        }
    }
}

export { ServiceController };
export type { ServiceProvider, ProcessMode, ServiceState, ServiceConfig, ExternalRepoConfig, PythonConfig, ProviderRegistry };
