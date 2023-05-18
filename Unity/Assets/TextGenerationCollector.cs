using System.Collections;
using System.Collections.Generic;
using Ubiq.Networking;
using UnityEngine;
using Ubiq.Dictionaries;
using Ubiq.Messaging;
using Ubiq.Logging.Utf8Json;
using Ubiq.Rooms;
using System;
using System.IO;
using System.Text;

public class TextGenerationCollector : MonoBehaviour
{
    public NetworkId networkId = new NetworkId(96);
    private NetworkContext context;
    public UnityEngine.UI.Text genText;

    [Serializable]
    private struct Message
    {
        public string type;
        public string peer; // TODO: implement the source peer of this text
        public string data;
    }

    // Start is called before the first frame update
    void Start()
    {
        context = NetworkScene.Register(this,networkId);
    }

    public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
    {
        string str = data.FromJson<Message>().data.ToString().Trim('\r', '\n');
        if(str.Length > 0)
        {
            Debug.Log(str);
            genText.text = str;
        }

    }
}
