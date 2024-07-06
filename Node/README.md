# Ubiq-Genie

Ubiq-Genie is a framework that enables you to build server-assisted collaborative mixed reality applications with Unity using the [Ubiq](https://ubiq.online) framework. Ubiq-Genie has a modular architecture designed to facilitate the integration of new services and the ability to update or replace individual services without affecting the entire system. The architecture consists of three main components: the Unity scene, applications, and services.

## System Architecture

- **Unity Scenes** serve as the interface for VR users and contain application-specific Unity components that communicate with a server-side `ApplicationController` through a TCP connection, using Ubiq's `Networking` components. These client-side components are written in C# and ensure that outgoing and incoming data are processed and routed correctly. The Unity scene of each application can be found in the `Unity/Assets/Apps` folder.

- **Applications** should have an associated Unity scene and `ApplicationController`. The `ApplicationController` is responsible for initializing and managing the services that are required by the application. It also handles the communication between the services and the Unity scene. The `ApplicationController` is written in TypeScript (ESM) and runs on the server. The `ApplicationController` of each of the sample applications can be found in the `app.ts` file in the corresponding folder in the `Node/apps` folder.

- **Services** are modular and can be reused in different applications. Each service is responsible for a specific task and is managed by a `ServiceController`. Services typically use child processes to run external applications. For instance, the `ImageGenerationService` spawns a Python child process to generate images with Stable Diffusion 2.0. The `ServiceController` is written in TypeScript (ESM) and runs on the server. The `ServiceController` of each of the sample services can be found in the `service.ts` file in the corresponding folder in the `Node/services` folder.

## Defining New Services

To define a new service, follow these steps:

1. Duplicate the `Node/services/base` folder and rename it to the name of your service (e.g., `my_service`). Also replace the class name `BaseService` in the `service.ts` file with the name of your service (e.g., `MyService`).

2. For any child processes that your service requires (e.g., Python scripts), copy the corresponding files into the folder you just created. For instance, if your service requires a Python script called `example_service.py`, copy this file into the folder you just created.

> [!NOTE]
> The `BaseService` service provides a minimal example of spawning a Python process that periodically sends a message. For more advanced examples, see the existing services in the `Node/services` folder.

You are now ready to use your new service in an application. For more information on how to define a new application, see the `How to Define a New Application` section below.

## Defining New Applications

To define a new application, follow these steps:

1. Duplicate the `Node/apps/base` folder and rename it to the name of your application (e.g., `my_application`). Also replace the class name `BaseApplication` in the `app.ts` file with the name of your application (e.g., `MyApplication`).

> [!NOTE]
> The `BaseApplication` application provides a minimal example of creating an application using the `BaseService` service. For more advanced examples, see the existing applications in the `Node/apps` folder. The `registerComponents` method defines the components of the application, which are stored in a dictionary called `components`. The `definePipeline` method defines the pipeline of the application. The `start` method starts the application by registering the components, defining the pipeline, and joining a room on the specified Ubiq server in the configuration file.

2. Take a look at the `config.json` file in the folder you just created. This file contains the configuration of your application. This includes the name of the application, the GUID of the room that the application will join, the information required to join or start a Ubiq server, and the ICE servers that are used for WebRTC connections. Note that `joinExisting` should be set to `true` if you want to join an existing server, and `false` if you want to start a new server. For more information on Ubiq servers and messages, see the [Ubiq documentation](https://ucl-vr.github.io/ubiq/serverintroduction/).

3. In Unity, duplicate the `Unity/Assets/Apps/Base` folder and rename it to the name of your application (e.g., `MyApplication`). This folder will contain the Unity scene of your application.

4. In the Unity scene hierarchy, navigate to `Ubiq-Genie/`, where we recommend you place any application-specific components that communicate with the server-side process of your Ubiq-Genie application. In the Base application, this is simply a `MessageReceiver` component that listens for messages from the server, which are sent by the Python process of the `BaseService` service that is part of the `BaseApplication` application.
