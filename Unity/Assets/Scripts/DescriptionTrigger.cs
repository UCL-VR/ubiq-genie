using UnityEngine;
using Ubiq.Messaging;

/// <summary>
/// Sends a "trigger" message to the server when the user presses the spacebar.
/// Attach this to any GameObject in the scene. The server-side stream_describer
/// app listens on the same network ID and immediately captures a frame for
/// scene description when it receives this message.
/// </summary>
public class DescriptionTrigger : MonoBehaviour
{
    [Tooltip("The Ubiq network ID used to send the trigger message to the server.")]
    [SerializeField] public ushort networkIdValue = 100;

    private NetworkContext context;

    private void Start()
    {
        var networkId = new NetworkId(networkIdValue);
        context = NetworkScene.Register(this, networkId);
    }

    private void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            Debug.Log("DescriptionTrigger: Spacebar pressed — sending trigger to server");
            context.SendJson(new TriggerMessage { action = "describe" });
        }
    }

    // Required by Ubiq even if we don't receive messages
    public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
    {
    }

    [System.Serializable]
    private struct TriggerMessage
    {
        public string action;
    }
}
