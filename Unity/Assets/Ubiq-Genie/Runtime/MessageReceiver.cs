using UnityEngine;
using Ubiq.Messaging;
using System;

namespace Ubiq.Genie
{

public class MessageReceiver : MonoBehaviour
{
    public ushort networkIdValue = 99;
    private NetworkId networkId;
    private NetworkContext context;

    [Serializable]
    private struct Message
    {
        public string data;
    }

    void Start()
    {
        networkId = new NetworkId(networkIdValue);
        context = NetworkScene.Register(this, networkId);
    }

    public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
    {
        Message message = data.FromJson<Message>();
        Debug.Log("Message received: " + message.data);
    }
}

} // namespace Ubiq.Genie
