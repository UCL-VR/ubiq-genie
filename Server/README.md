# Ubiq-Genie

Ubiq-Genie is a framework that enables you to build server-assisted collaborative mixed reality applications with Unity using the [Ubiq](https://ubiq.online) framework.

Ubiq-Genie has a modular architecture designed to facilitate the integration of new services and the ability to update or replace individual services without affecting the entire system. The architecture consists of three main components: the Unity scene, applications, and services.

## System Architecture

-   **Unity Scenes** serve as the interface for VR users and contains application-specific Unity components that communicate with a server-side `ApplicationController` through a TCP connection, using either Ubiq's `Networking` or `Logging` components. These client-side components are written in C# and ensure that outgoing and incoming data are processed and routed correctly.

-   **Applications** should have an associated Unite scene and `ApplicationController`. The `ApplicationController` is responsible for initialising and managing the services that are required by the application. It also handles the communication between the services and the Unity scene. The `ApplicationController` is written in Node.js and runs on the server. The `ApplicationController` of each of the sample applications can be found in the `app.js` file in the corresponding folder in the `Server/samples/apps` folder.

-   **Services** are modular and can be reused in different applications. Each service is responsible for a specific task and is managed by a `ServiceController`. Services typically use child processes to run external applications. For instance, the `ImageGenerationService` spawns a Python child process to generate images with Stable Diffusion 2.0. The `ServiceController` is written in Node.js and runs on the server. The `ServiceController` of each of the sample services can be found in the `service.js` file in the corresponding folder in the `Server/samples/services` folder.

## Defining New Services

To define a new service, follow these steps:

1. To define a new service, create a new folder in the `Server/samples/services` folder with the name of your service.

2. Create a new file in the folder you just created called `service.js`. This file will contain the `ServiceController` of your service. A minimal example of a `ServiceController` is shown below:

    ```javascript
    const { Service } = require("../../components/service");

    class ExampleService extends Service {
        constructor(scene, config = {}) {
            super(scene, "ExampleService", config);

            this.registerChildProcess("default", "python", [
                "-u",
                "../../services/example_service/example_service.py"
                "--example_arg",
                config.example_arg
            ]);
        }
    }

    module.exports = {
        ExampleService
    };
    ```

3. For any child processes that your services requires (e.g., Python scripts), copy the corresponding files into the folder you just created. For instance, if your service requires a Python script called `example_service.py`, copy this file into the folder you just created.

4. Add the following line to the `Server/samples/services/index.js` file:

    ```javascript
    const { ExampleService } = require("./example_service/service");
    ```

    This line will ensure that the `ExampleService` class is exported when the `Server/samples/services/index.js` file is imported.

You are now ready to use your new service in an application. For more information on how to define a new application, see the `How to Define a New Application` section below.

## Defining New Applications

To define a new application, follow these steps:

1. To define a new application, create a new folder in the `Server/samples/apps` folder with the name of your application (e.g., `my_app`). This folder will contains all the files required by your application.

2. Create a new file in the folder you just created called `app.js`. This file will contain the `ApplicationController` of your application. A minimal example of an `ApplicationController` is shown below:

    ```javascript
    const { MessageReader, ApplicationController } = require("ubiq-genie-components");
    const { ExampleService } = require("ubiq-genie-services");
    const fs = require("fs");
    const nconf = require("nconf");

    class ExampleApplication extends ApplicationController {
        constructor(configFile = "config.json") {
            super(configFile);
        }

        registerComponents() {
            // A MessageReader to read messages based on fixed network ID
            this.components.messageReceiver = new MessageReader(this.scene, 98);

            // An ExampleService to process the messages
            this.components.exampleService = new ExampleService(this.scene, nconf.get());

            // A file writer to write the output to a file
            this.components.writer = fs.createWriteStream("output.txt");
        }

        definePipeline() {
            // Step 1: When we receive a message, send it to the example service
            this.components.messageReceiver.on("data", (data) => {
                this.components.exampleService.sendToChildProcess(data.toString() + "\n");
            });

            // Step 2: When we receive a response from the example service, write it to the file
            this.components.speech2text.on("response", (data, identifier) => {
                this.components.writer.write(identifier + ": " + data.toString().substring(1));
            });

            // Step 3: In addition, send the response to the Unity scene based on a fixed network ID
            this.components.speech2text.on("response", (data, identifier) => {
                this.scene.send(new NetworkId(nconf.get("outputNetworkId")), {
                    type: "ExampleApplication",
                    data: data,
                });
            });
        }
    }

    module.exports = { ExampleApplication };

    if (require.main === module) {
        const app = new ExampleApplication();
        app.start();
    }
    ```

    This example application uses the `ExampleService` service that we defined in the previous section. The `ExampleApplication` class extends the `ApplicationController` class and defines the components and pipeline of the application. The `registerComponents` method defines the components of the application, which are stored in a dictionary called `components`. The `definePipeline` method defines the pipeline of the application. The `registerComponents` and `definePipeline` methods are called by `start` method of the `ApplicationController` class.

3. Create a new file in the folder you just created called `config.json`. This file will contain the configuration of your application. For more information on how to define a configuration file, see the `Configuration File` section below. A minimal example of a configuration file is shown below:

    ```json
    {
        "name": "ExampleApplication",
        "roomGuid": "3b8b5f0c-5b9a-4b9a-9c1a-3b8b5f0c5b9a",
        "outputNetworkId": 99,
        "roomserver": {
            "tcp": {
                "port": 8009
            },
            "wss": {
                "port": 8010,
                "cert": "./cert.pem",
                "key": "./key.pem"
            }
        },
        "iceservers": [
            {
                "uri": "stun:stun.l.google.com:19302"
            }
        ]
    }
    ```

    This includes the name of the application, the GUID of the room that the application will join, the information required to start a Ubiq server, and a fixed network ID that is used to send messages to the Unity scene. For more information on Ubiq servers and messages, see the [Ubiq documentation](https://ucl-vr.github.io/ubiq/serverintroduction/).

4. In Unity, create a new scene and set it up for Ubiq. For more information on how to set up a scene for Ubiq, see the [Ubiq documentation](https://ucl-vr.github.io/ubiq/unityintroduction/). We recommend to use the `StartHere` scene as a starting point.

5. In your newly created Unity scene, add a new empty GameObject. To this GameObject, add a new script called with a name of your choice (e.g., `ExampleApplication`). This script will contain the client-side Unity counterpart of your application. A minimal example of a Unity script is shown below:

    ```csharp
    using System;
    using UnityEngine;
    using Ubiq.Networking;
    using Ubiq.Dictionaries;
    using Ubiq.Messaging;

    public class ExampleApplication : MonoBehaviour
    {
        public NetworkId networkId = new NetworkId(99);
        private NetworkContext context;

        [Serializable]
        private struct Message
        {
            public string type;
            public string data;
        }

        void Start()
        {
            context = NetworkScene.Register(this, networkId);
        }

        void Update()
        {

        }

        public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
        {
            Message message = data.FromJson<Message>();
            Debug.Log(message.data);
        }
    }

    ```

    This script registers the `ExampleApplication` class with the Ubiq network with a fixed network ID (corresponding to the network ID we use in the server-side `ApplicationController`). It also defines a `ProcessMessage` method that is called when a message is received from the Ubiq network. Whenever a message is received, the `ProcessMessage` method is called with the message as an argument. This allows the `ExampleApplication` class to process the message and perform any required actions (e.g., display the received data).
