# Base Application

This folder contains the code for the base application, which serves as a template for creating new applications using the Ubiq-Genie framework. Please refer to the [README](../README.md) to learn how to create your own applications.

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../README.md) file.

## Running the Sample

### Server (Node.js)

1. Open a terminal and navigate to the `Node/apps` directory.
2. Confirm that `Node/apps/base/config.json` contains the correct configuration. Specifically, ensure that `roomserver:uri` points to the correct room server URI, `roomserver:tcp:port` is set to the correct port, and `roomserver:joinExisting` is set to `true` if you want to join an existing server, and `false` if you want to start a new server on `localhost`.
3. Execute the following command:

    ```bash
    npm start transcription
    ```

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/Transcription` directory. Open the `Transcription.unity` scene. Confirm that the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be set to `localhost`.
2. In the Unity Editor, press the `Play` button to launch the application.