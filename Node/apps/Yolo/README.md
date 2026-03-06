# Base Application

This folder contains the code for the base application, which serves as a template for creating new applications using the Ubiq-Genie framework. Please refer to the [README](../README.md) to learn how to create your own applications.

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../../README.md) file.

## Running the Sample

### Server (Node.js)

We recommend using VS Code to run and modify the server application, with the `Node` folder as the workspace root. To run the server application:

1. Open a terminal and navigate to the `Node/apps/base` directory.
2. Execute the below command, which will guide you through the configuration process, including setting up the server information. Configuration will only be run the first time you start the application. Ensure that you apply the same server configuration to the Unity client (in `Unity/Assets/ServerConfig.asset`).

    ```bash
    npm start base
    ```

If you need to reconfigure the application, you can run `npm start base configure`. You may also manually configure the application by changing the `config.json` which contains the server configuration.

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/Base` directory. Open the `Base.unity` scene.
2. Ensure the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`. This should correspond to the configuration on the server side.
3. In the Unity Editor, press the `Play` button to launch the application.
