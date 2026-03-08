# Ubiq-Genie

Ubiq-Genie is a framework that enables you to build server-assisted collaborative mixed reality applications with Unity using the [Ubiq](https://ubiq.online) framework. Ubiq-Genie has a modular architecture designed to facilitate the integration of new services and the ability to update or replace individual services without affecting the entire system. The architecture consists of three main components: the Unity scene, applications, and services.

## System Architecture

- **Unity Scenes** serve as the interface for VR users and contain application-specific Unity components that communicate with a server-side `ApplicationController` through a TCP connection, using Ubiq's `Networking` components. These client-side components are written in C# and ensure that outgoing and incoming data are processed and routed correctly. The Unity scenes are distributed as importable samples in the `com.ucl.ubiq-genie` package (see the [package README](../Unity/Assets/Ubiq-Genie/README.md)).

- **Applications** should have an associated Unity scene and `ApplicationController`. The `ApplicationController` is responsible for initializing and managing the services that are required by the application. It also handles the communication between the services and the Unity scene. The `ApplicationController` is written in TypeScript (ESM) and runs on the server. The `ApplicationController` of each of the sample applications can be found in the `app.ts` file in the corresponding folder in the `Node/apps` folder.

- **Services** are modular and can be reused in different applications. Each service is responsible for a specific task and is managed by a `ServiceController`. Services use **providers** — lightweight configuration objects that define what backend to run and how to manage its lifecycle. For instance, the `ImageGenerationService` uses a Stable Diffusion provider that spawns a Python child process to generate images. Providers can be swapped without changing the service or application code, making it easy to switch backends (e.g., Azure Speech vs. Whisper.cpp for speech-to-text). The `ServiceController` is written in TypeScript (ESM) and runs on the server. The `ServiceController` of each of the sample services can be found in the `service.ts` file in the corresponding folder in the `Node/services` folder.

## Defining New Services

To define a new service, follow these steps:

1. Duplicate the `Node/services/base` folder and rename it to the name of your service (e.g., `my_service`). Replace the class name `BaseService` in the `service.ts` file with the name of your service (e.g., `MyService`).

2. Create a provider for your service. A provider is a `ServiceProvider` object that specifies the command to run, its arguments, and a process mode. Create a folder under `providers/` (e.g., `providers/my_provider/`) and add a `provider.ts` file that exports your provider configuration. Place any backend scripts (e.g., Python) and a `requirements.txt` in the same folder.

    ```typescript
    import type { ServiceProvider } from '../../../../components/service';
    import path from 'path';
    import { fileURLToPath } from 'url';

    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    export const MyProvider: ServiceProvider = {
        name: 'my-provider',
        command: 'python',
        args: ['-u', path.join(__dirname, 'my_script.py')],
        processMode: 'singleton',
        requirements: path.join(__dirname, 'requirements.txt'),
    };
    ```

3. Import this provider in your `service.ts` and pass it to the `ServiceController`:

    ```typescript
    import { ServiceController } from '../../components/service';
    import { NetworkScene } from 'ubiq-server/ubiq';
    import { MyProvider } from './providers/my_provider/provider';

    class MyService extends ServiceController {
        constructor(scene: NetworkScene) {
            super(scene, 'MyService', MyProvider);
        }
    }
    ```

### Process Modes

Each provider must specify a `processMode` that determines how child processes are managed:

| Mode | Behaviour |
| --- | --- |
| `per-peer` | One child process per connected peer. Spawned on peer join, killed on peer leave. Use when each peer needs an isolated backend (e.g., speech-to-text). |
| `singleton` | A single child process spawned immediately when the service is created. Use for shared stateful backends (e.g., text generation). |
| `lazy-singleton` | A single child process spawned when the first peer joins and killed when all peers leave. Use for resource-heavy backends that should only run when needed (e.g., image generation). |

### Provider Directory Structure

Each provider is self-contained in its own folder:

```text
services/my_service/
├── service.ts
└── providers/
    └── my_provider/
        ├── provider.ts        # ServiceProvider configuration
        ├── my_script.py       # Backend script
        └── requirements.txt   # Python dependencies
```

When a provider specifies a `requirements` path, the `ServiceController` will automatically check whether the required Python packages are installed at startup and log a warning if any are missing.

> [!NOTE]
> The `BaseService` provides a minimal example of a service with a provider. For more advanced examples, see the existing services in the `Node/services` folder. Not all services require a provider — for instance, the `AudioRecorder` records audio natively in TypeScript without spawning any child processes.

You are now ready to use your new service in an application. For more information on how to define a new application, see the `How to Define a New Application` section below.

## Defining New Applications

To define a new application, follow these steps:

1. Duplicate the `Node/apps/base` folder and rename it to the name of your application (e.g., `my_application`). Also replace the class name `BaseApplication` in the `app.ts` file with the name of your application (e.g., `MyApplication`).

> [!NOTE]
> The `BaseApplication` application provides a minimal example of creating an application using the `BaseService` service. For more advanced examples, see the existing applications in the `Node/apps` folder. The `registerComponents` method defines the components of the application, which are stored in a dictionary called `components`. The `definePipeline` method defines the pipeline of the application. The `start` method starts the application by registering the components, defining the pipeline, and joining a room on the specified Ubiq server in the configuration file.

2. Take a look at the `config.json` file in the folder you just created. This file contains the configuration of your application. This includes the name of the application, the GUID of the room that the application will join, the information required to join or start a Ubiq server, and the ICE servers that are used for WebRTC connections. Note that `joinExisting` should be set to `true` if you want to join an existing server, and `false` if you want to start a new server. For more information on Ubiq servers and messages, see the [Ubiq documentation](https://ucl-vr.github.io/ubiq/serverintroduction/).

3. In Unity, duplicate the **Base** sample folder as a starting point for your application. If you installed the package via git URL (UPM), first import the **Base** sample from **Window → Package Manager → Ubiq-Genie → Samples**.

4. In the Unity scene hierarchy, navigate to `Ubiq-Genie/`, where we recommend you place any application-specific components that communicate with the server-side process of your Ubiq-Genie application. In the Base application, this is simply a `MessageReceiver` component that listens for messages from the server, which are sent by the Python process of the `BaseService` service that is part of the `BaseApplication` application.
