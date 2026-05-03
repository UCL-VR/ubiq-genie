# AGENTS.md

Instructions for AI coding agents working in this repository.

## Scope

- This file applies to the whole repository.
- If a more specific `AGENTS.md` is added under `Node/`, `Unity/`, or another subdirectory, follow the closest file first and use this file for repo-wide context.
- Keep this file focused on instructions agents need before editing. Human-facing setup and sample walkthroughs belong in `README.md` files unless an agent-specific warning is needed here.

## Project Overview

Ubiq-Genie is a server-assisted collaborative mixed-reality framework built on Ubiq. The repo has two coupled parts:

- `Node/`: TypeScript ESM server package, CLI, reusable components, apps, services, and provider-backed AI/ML integrations.
- `Unity/`: Unity 6 project containing the embedded Unity package at `Unity/Assets/Ubiq-Genie/`, runtime C# components, editor setup scripts, and sample scenes.

The central model is:

- Unity scenes provide VR/XR user interaction and communicate over Ubiq networking.
- Node apps extend `ApplicationController`, register components/services, define an event pipeline, and join or start a Ubiq room.
- Node services extend `ServiceController`. Services may run backend providers as child processes, often Python scripts, selected through app `config.json`.
- Providers describe process lifecycle and command configuration. Keep provider objects lightweight; business logic should stay in services, components, or backend scripts.

## Repository Map

- `README.md`: project setup, Unity install paths, sample list, support links.
- `Node/README.md`: architecture, config-driven providers, process modes, service/app creation guide.
- `Node/package.json`: server package metadata and scripts.
- `Node/bin/cli.ts`: `npm start <app-name> [version] [configure]` entrypoint and configuration wizard.
- `Node/components/`: shared server components such as `ApplicationController`, `ServiceController`, `VoipReceiver`, `MediaReceiver`, `AudioSender`, `FileServer`, and `MessageReader`.
- `Node/services/`: reusable services and their `providers/` folders. Provider folders own backend scripts and `requirements.txt`.
- `Node/apps/`: runnable sample applications. Some apps have version folders containing their own `app.ts` and `config.json`.
- `Node/config.schema.json`: schema for app config files. Keep this in sync when adding config fields.
- `Unity/Assets/Ubiq-Genie/Runtime/`: package runtime assemblies.
- `Unity/Assets/Ubiq-Genie/Runtime/Compatibility/XRI/`: optional XR Interaction Toolkit integration.
- `Unity/Assets/Ubiq-Genie/Editor/`: package editor automation for dependencies and samples.
- `Unity/Assets/Ubiq-Genie/Apps/`: sample scenes, sample scripts, materials, assets, and `ServerConfig.asset` files.
- `Unity/Assets/Ubiq-Genie/package.json`: UPM package metadata and sample declarations.
- `.github/workflows/build-upm.yml`: extracts `Unity/Assets/Ubiq-Genie` to the `upm` branch and renames `Apps` to `Samples~`.

## Environment

- Node.js: v20 or later.
- Python: v3.10 or later for provider backends.
- Unity: 6000.0.67f1, Unity 6.0 LTS. `Unity/ProjectSettings/ProjectVersion.txt` is the source of truth.
- Ubiq Unity package: `com.ucl.ubiq` from `https://github.com/UCL-VR/ubiq.git#upm-unity-v1.0.0-pre.16` in the included Unity project.
- Unity WebRTC fork: `com.unity.webrtc-ubiq-fork` from `https://github.com/UCL-VR/unity-webrtc-ubiq-fork.git#v3.0.1-pre.7`.

Do not vendor local model checkpoints, external ML repositories, virtual environments, generated recordings, Unity `Library/`, or `node_modules/` into this repo.

## Setup Commands

Run commands from the indicated directory.

```bash
# Node server dependencies
cd Node
npm install

# Build the distributable Node package
cd Node
npm run build

# Lint TypeScript
cd Node
npm run lint

# Start a sample app
cd Node
npm start <app-name>
npm start <app-name> <version>
npm start <app-name> configure
npm start <app-name> <version> configure
```

Important command notes:

- Run `npm install` in `Node/` before build validation. If `npm run build` cannot resolve `@ucl-vr/ubiq`, `@ucl-vr/ubiq-server`, or expected `@types/*` packages, treat that as an incomplete dependency install rather than a source compile failure.
- `npm test` is currently a placeholder that exits with failure. Do not report it as a meaningful project test unless you also add real tests.
- `npm start ...` can launch interactive configuration, start a Ubiq room server, spawn Python/model processes, and open network ports. Run it only when that is part of the task.
- Provider Python dependencies live in provider-specific `requirements.txt` files such as `Node/services/speech_to_text/providers/azure/requirements.txt`. Install only the requirements needed for the service being exercised.
- For Unity validation, prefer opening the `Unity/` project in Unity 6000.0.67f1 and checking that scripts compile. In CI or headless environments, use the local Unity executable path, for example:

```bash
/Applications/Unity/Hub/Editor/6000.0.67f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -projectPath Unity -quit -nographics \
  -runTests -testPlatform EditMode \
  -testResults /tmp/ubiq-genie-editmode-results.xml
```

## Node Architecture Rules

- Keep TypeScript ESM. `Node/package.json` has `"type": "module"` and the CLI uses `ts-node/esm`.
- Existing relative imports usually omit file extensions in TypeScript source. Match local style unless changing build/runtime semantics deliberately.
- Use `path` plus `fileURLToPath(import.meta.url)` where a Node file needs `__dirname`.
- New apps should extend `ApplicationController`, implement `registerComponents()`, `definePipeline()`, and `start()`, then use the existing direct-run guard pattern at the bottom of `app.ts`.
- New reusable services should extend `ServiceController` and live under `Node/services/<service_name>/service.ts`.
- New providers should live under `Node/services/<service_name>/providers/<provider_name>/provider.ts`, with backend scripts and `requirements.txt` in the same provider folder when applicable.
- Provider selection should be config-driven through `services.<serviceKey>.provider` and a provider registry. Avoid hardcoding a provider into app logic when the service already supports config-driven selection.
- Use the service config key names from `Node/config.schema.json`: `base`, `speechToText`, `textGeneration`, `textToSpeech`, `imageGeneration`, `audioToAudio`, and `visualQuestionAnswering`.
- If a new config field is used by code, update `Node/config.schema.json` and any affected sample `config.json` files and READMEs.
- Keep app versioning consistent: versioned apps use `Node/apps/<app-name>/<version>/app.ts` and `config.json`; root-level apps use `Node/apps/<app-name>/app.ts` and `config.json`.

## Implementation Recipes

When adding a Node app:

- Start from `Node/apps/base` or the closest existing sample. If the app needs variants, create `Node/apps/<app-name>/<version>/app.ts` and `config.json` for each variant instead of mixing version-specific logic into one file.
- Define a class that extends `ApplicationController`. Its constructor should call `super(configPath)`.
- Keep `start()` in the established order: `registerComponents()`, log registered components, `definePipeline()`, log pipeline setup, then `joinRoom()`.
- Instantiate services and shared components in `registerComponents()`. Wire event handlers, child-process input/output, and Unity network sends in `definePipeline()`.
- Give `components` a typed shape when the app has more than trivial state, for example optional properties for `voipReceiver`, `speech2text`, or `mediaReceiver`.
- Add `config.json` with the correct relative `"$schema"`, `name`, `roomGuid`, `roomserver`, `status`, `iceservers`, `services`, and `configurationComplete`.
- If credentials are needed, add or update `.env.example` only. Do not commit `.env`.
- For Unity-facing apps, add or update the matching sample scene/scripts under `Unity/Assets/Ubiq-Genie/Apps/<SampleName>/` and document any new network IDs, track IDs, or message formats.

When adding a Node service:

- Start from `Node/services/base` unless another service is a closer match.
- Choose a stable service config key, such as `myService`, and add it to `Node/config.schema.json` if it is part of the public/sample config surface.
- Implement `service.ts` as a small wrapper around `ServiceController`: import provider factories, define a `ProviderRegistry`, resolve the provider with `ServiceController.resolveProvider(serviceKey, providers, defaultProvider)`, then call `super(scene, '<ServiceName>', resolvedProvider, serviceKey)`.
- Put each backend in `providers/<provider-name>/provider.ts`. The provider should describe `name`, `command`, `args`, `processMode`, and optional `requirements`, `env`, `pythonCommand`, or `stdoutMode`.
- Keep backend scripts beside their provider. Include `requirements.txt` when Python packages are needed.
- Define the process protocol before wiring the app: text line protocols should emit `>READY`, `>BUSY`, and `>IDLE`; binary protocols should use `stdoutMode: 'binary'` and an explicit readiness signal.
- Export reusable services/providers from `Node/index.ts` when package consumers should import them.
- Add or update the service README with provider names, config keys, expected input/output protocol, Python requirements, and any external repo/model setup.

When integrating a service into an app:

- Register the service before `joinRoom()` so peer lifecycle hooks are active.
- Use `waitForReady()` before sending work to singleton model backends that need load time.
- Use `sendToChildProcess('default', data)` for singleton/lazy-singleton providers and `sendToChildProcess(peerUuid, data)` for per-peer providers.
- Preserve binary payloads as `Buffer`; only stringify explicit JSON/text headers.
- Keep Unity message IDs and payload shapes as named constants in app code, then mirror them in Unity scripts and docs.

## Service And Provider Rules

- `ServiceProvider` objects should describe command, args, process mode, optional env, requirements path, Python override, and stdout mode. Do not put long-running business logic in provider objects.
- Use `processMode` intentionally:
  - `per-peer`: one child process per peer, keyed by peer UUID.
  - `singleton`: one shared process spawned at service creation.
  - `lazy-singleton`: one shared process spawned on first peer and killed when all peers leave.
- Child processes using text stdout should emit lifecycle markers on their own lines:
  - `>READY`
  - `>BUSY`
  - `>IDLE`
- `ServiceController` strips these markers before emitting data. Do not parse them again in app code.
- For binary stdout providers, set `stdoutMode: 'binary'` and signal readiness explicitly with `setReady()` when a protocol handshake proves the backend is ready.
- Preserve binary data as `Buffer` through Node pipelines. Do not convert audio, image, video, or frame payloads to strings except for explicit JSON/text headers.
- Use `waitForReady()` before sending work to expensive model services when the backend emits readiness markers.
- Use `sendToChildProcess(identifier, data)` for process input. For singleton modes, use identifier `default`; for per-peer services, use peer UUIDs.
- Keep backend protocols simple and documented: JSON or text headers followed by raw bytes are preferred over ad hoc mixed string/binary parsing.
- External ML repositories should be referenced through `services.<key>.externalRepo` config. Do not commit local absolute paths except as empty placeholders in sample configs.
- Python command selection should flow through provider override, per-service config, global `python.command`, then default `python3`. Avoid hardcoding personal venv paths in source.

## Node Style

- Formatting is controlled by `Node/.prettierrc`: 4 spaces, semicolons, single quotes, trailing commas where valid in ES5, print width 120.
- `Node/.eslintrc.json` enables TypeScript, import, and Prettier rules. Keep lint fixes scoped to files you touch unless the task is to clean lint globally.
- TypeScript is strict. Prefer explicit types at public boundaries, especially for events, provider options, config objects, and binary protocol payloads.
- Prefer `unknown` over `any` for errors and external data, then narrow locally.
- Use `EventEmitter` consistently for server components/services that publish data.
- Use the shared `Logger` or controller `log()` helpers for app/service logs. Avoid noisy raw `console.log()` in library code unless matching existing CLI behavior.
- Keep public package exports in `Node/index.ts` synchronized when adding reusable services, providers, or utilities intended for consumers.

## Unity Package Rules

- The package source is `Unity/Assets/Ubiq-Genie/`. The included Unity project references it as an embedded file package from `Unity/Packages/manifest.json`.
- Runtime code belongs in `Unity/Assets/Ubiq-Genie/Runtime/` under namespace `Ubiq.Genie`.
- Optional compatibility code belongs under `Runtime/Compatibility/<integration>/` with its own assembly definition when needed.
- Sample code belongs under `Unity/Assets/Ubiq-Genie/Apps/<SampleName>/Scripts/` under namespace `Ubiq.Genie.Samples.<SampleName>`.
- Editor-only code belongs in `Unity/Assets/Ubiq-Genie/Editor/` under namespace `Ubiq.Genie.Editor`.
- Keep assembly definitions (`*.asmdef`) accurate when moving or adding scripts.
- When adding Unity assets, scenes, prefabs, materials, or scripts, include their `.meta` files. Do not manually regenerate or change GUIDs unless the task explicitly requires it.
- Prefer Unity text-serialized asset edits only when they are simple and reviewable. For scene or prefab work, using the Unity Editor is safer.
- Keep `Unity/Assets/Ubiq-Genie/package.json`, `Unity/Assets/Ubiq-Genie/README.md`, and sample folders in sync when adding/removing samples.
- Do not put runtime code in a sample assembly unless it is sample-specific. Shared behavior belongs in `Runtime/`.
- Keep public Inspector-facing fields intentional and named clearly. Use `[Header]`, `[Tooltip]`, `[Range]`, and `[Min]` where they materially improve editor usability.

## Unity C# Style

- Match existing C# layout: 4-space indentation, braces on their own lines for namespaces/classes/methods, and concise XML docs for public runtime APIs or non-obvious protocols.
- Use Unity lifecycle methods (`Start`, `Update`, `OnDestroy`, `OnAudioFilterRead`, etc.) with the smallest needed visibility.
- Cache expensive component lookups where practical, especially in per-frame and audio paths.
- Avoid allocations in hot paths such as `Update`, `OnAudioFilterRead`, and WebRTC frame/audio callbacks.
- For Ubiq messages, register processors/contexts through Ubiq APIs and keep `ProcessMessage(ReferenceCountedSceneGraphMessage data)` signatures compatible with the receiving component.
- Keep fixed network IDs and protocol names synchronized with Node code and sample scenes. If you change a network ID, track ID, or message shape, update both sides and the relevant README/config/sample assets.

## Known Networking And Protocol Couplings

- `InjectableAudioSource` defaults to network ID `95`; several Node audio senders use this path for PCM playback.
- Scene describer text uses network ID `98`, TTS audio uses `96`, and manual trigger messages use `100`.
- Base sample `MessageReceiver` listens on network ID `99`.
- `MediaTrackManager` and Node `MediaReceiver` must agree on the custom media signaling service ID and track IDs such as `description_stream`.
- The Unity `Room Client` configuration in each sample scene must match the server app `roomserver` settings in the corresponding `Node/apps/.../config.json`.

## Config, Secrets, And Local State

- Never commit real API keys, tokens, certificates, passwords, or personal absolute paths.
- `.env` files under `Node/` are ignored. Only commit `.env.example` with placeholder names and comments.
- Common environment variables include `SPEECH_KEY`, `SPEECH_REGION`, `OPENAI_API_KEY`, `HF_TOKEN`, and `UBIQ_HEARTBEAT_MS`.
- Generated recordings, logs, certificates, model outputs, `Node/dist/`, `Node/node_modules/`, Python venvs, and Unity generated folders should remain uncommitted.
- Keep sample `config.json` values portable. Empty strings are acceptable placeholders for `python.command` and `externalRepo.path` when users must configure local resources.
- If you add a new provider that needs secrets, document the variables in the provider/app README and add a `.env.example`; do not add secret prompts only in code.

## Verification Checklist

Use the narrowest verification that covers the change.

- Documentation-only change: check Markdown rendering mentally and run `git diff --check`.
- TypeScript/library change: run `cd Node && npm run build`; run `cd Node && npm run lint` when lint-relevant files changed.
- Node app pipeline change: run the relevant `npm start <app-name> [version]` only when dependencies, credentials, and model/runtime requirements are available.
- Provider/backend script change: install that provider's `requirements.txt` in the intended Python environment and run the smallest app or backend smoke test that exercises the protocol.
- Unity C# change: open the Unity project or run a Unity batchmode compile/test command with Unity 6000.0.67f1.
- Unity asset/sample scene change: verify the sample scene opens, the `Room Client` config matches the Node app, and relevant `ServerConfig.asset`/scene references are intact.
- Cross-boundary protocol change: test both sides together, or clearly state which side was not run and what remains to verify.

Always report any checks that could not be run and why.

## Package And Release Notes

- The UPM distribution is generated from `Unity/Assets/Ubiq-Genie` by `.github/workflows/build-upm.yml`.
- The workflow renames `Apps` to `Samples~` on the `upm` branch. In this repo's main Unity project, keep sample source under `Unity/Assets/Ubiq-Genie/Apps/`.
- Changes to package metadata should consider both embedded-development usage and UPM installation from `https://github.com/UCL-VR/ubiq-genie.git#upm`.
- Do not edit generated package output on the `upm` branch from this working tree unless the task is specifically about release automation.

## Agent Workflow Expectations

- Read the nearest README before changing a sample, service, provider, or Unity package area.
- Prefer existing app/service/component patterns over new abstractions.
- Keep Node and Unity changes synchronized when behavior crosses the server/client boundary.
- Keep diffs scoped. Do not reformat unrelated files or Unity assets.
- Preserve user edits in the working tree. Do not revert unrelated changes.
- When a change introduces new setup requirements, update the relevant README and this file only if agents need to know the requirement before editing.
