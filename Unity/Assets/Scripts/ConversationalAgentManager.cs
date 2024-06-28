using System.Collections.Generic;
using UnityEngine;
using Ubiq.Messaging;
using System;

public class ConversationalAgentManager : MonoBehaviour
{
    private class AssistantSpeechUnit
    {
        public float startTime;
        public int samples;
        public string speechTargetName;

        public float endTime { get { return startTime + samples/(float)AudioSettings.outputSampleRate; } }
    }

    private NetworkId networkId = new NetworkId(95);
    private NetworkContext context;

    public InjectableAudioSource audioSource;
    public VirtualAssistantController assistantController;
    public AudioSourceVolume volume;

    private string speechTargetName;

    private List<AssistantSpeechUnit> speechUnits = new List<AssistantSpeechUnit>();

    [Serializable]
    private struct Message
    {
        public string type;
        public string targetPeer;
        public string audioLength;
    }

    // Start is called before the first frame update
    void Start()
    {
        context = NetworkScene.Register(this,networkId);
    }

    // Update is called once per frame
    void Update()
    {
        while(speechUnits.Count > 0)
        {
            if (Time.time > speechUnits[0].endTime)
            {
                speechUnits.RemoveAt(0);
            }
            else
            {
                break;
            }
        }

        if (assistantController)
        {
            var speechTarget = null as string;
            if (speechUnits.Count > 0)
            {
                speechTarget = speechUnits[0].speechTargetName;
            }

            assistantController.UpdateAssistantSpeechStatus(speechTarget,volume.volume);
        }
    }

    public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
    {
        Debug.Assert(audioSource);

        // If the data is less than 100 bytes, then we have have received the audio info header
        if (data.data.Length < 100)
        {
            // Try to parse the data as a message, if it fails, then we have received the audio data
            Message message;
            try
            {
                message = data.FromJson<Message>();
                speechTargetName = message.targetPeer;
                Debug.Log("Received audio for peer: " + message.targetPeer + " with length: " + message.audioLength);
                return;
            }
            catch (Exception e)
            {
                Debug.Log("Received audio data");
            }
        }

        if (data.data.Length < 200)
        {
            return;
        }

        var speechUnit = new AssistantSpeechUnit();
        var prevUnit = speechUnits.Count > 0 ? speechUnits[speechUnits.Count-1] : null;
        speechUnit.startTime = prevUnit != null ? prevUnit.endTime : Time.time;
        speechUnit.samples = data.data.Length/2;
        speechUnit.speechTargetName = speechTargetName;
        speechUnits.Add(speechUnit);

        audioSource.InjectPcm(data.data.ToArray());
    }
}
