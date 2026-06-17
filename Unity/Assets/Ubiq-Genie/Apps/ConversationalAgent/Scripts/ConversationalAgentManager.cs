using System.Collections.Generic;
using UnityEngine;
using System;
using Ubiq.Genie;

namespace Ubiq.Genie.Samples.ConversationalAgent
{

/// <summary>
/// Manages conversational-agent-specific behaviour: tracks which peer the
/// assistant is speaking to and drives the VirtualAssistantController
/// animations. Audio reception and playback are handled entirely by
/// InjectableAudioSource (with receiveFromNetwork = true).
/// </summary>
public class ConversationalAgentManager : MonoBehaviour
{
    private class AssistantSpeechUnit
    {
        public float startTime;
        public int samples;
        public int sampleRate;
        public string speechTargetName;

        public float endTime { get { return startTime + samples / (float)sampleRate; } }
    }

    public InjectableAudioSource audioSource;
    public VirtualAssistantController assistantController;
    public AudioSourceVolume volume;

    private string speechTargetName;

    private List<AssistantSpeechUnit> speechUnits = new List<AssistantSpeechUnit>();

    void Start()
    {
        if (audioSource == null)
        {
            Debug.LogError("ConversationalAgentManager: audioSource is not assigned.");
            return;
        }

        // Subscribe to audio events from InjectableAudioSource
        audioSource.OnAudioInfoReceived += OnAudioInfoReceived;
        audioSource.OnAudioChunkReceived += OnAudioChunkReceived;
    }

    void OnDestroy()
    {
        if (audioSource != null)
        {
            audioSource.OnAudioInfoReceived -= OnAudioInfoReceived;
            audioSource.OnAudioChunkReceived -= OnAudioChunkReceived;
        }
    }

    void Update()
    {
        while (speechUnits.Count > 0)
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

            assistantController.UpdateAssistantSpeechStatus(speechTarget, volume.volume);
        }
    }

    private void OnAudioInfoReceived(object sender, AudioInfoReceivedEventArgs e)
    {
        speechTargetName = e.TargetPeer;
        Debug.Log("Received audio for peer: " + e.TargetPeer + " with length: " + e.AudioLength);
    }

    private void OnAudioChunkReceived(object sender, AudioChunkReceivedEventArgs e)
    {
        var speechUnit = new AssistantSpeechUnit();
        var prevUnit = speechUnits.Count > 0 ? speechUnits[speechUnits.Count - 1] : null;
        speechUnit.startTime = prevUnit != null ? prevUnit.endTime : Time.time;
        speechUnit.samples = e.SampleCount;
        speechUnit.sampleRate = AudioSettings.outputSampleRate;
        speechUnit.speechTargetName = speechTargetName;
        speechUnits.Add(speechUnit);
    }
}

} // namespace Ubiq.Genie.Samples.ConversationalAgent
