using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Ubiq.Avatars;
using Ubiq.Voip;

// Genie port of SpeechIndicator to add EstimateCurrentVolume()
public class SpeechVolumeEstimator : MonoBehaviour
{
    public float sampleSecondsPerIndicator;

    private Ubiq.Avatars.Avatar avatar;
    private VoipAvatar voipAvatar;

    private float currentFrameVolumeSum = 0;
    private int currentFrameSampleCount = 0;
    private float[] volumeFrames;

    public float EstimateCurrentVolume()
    {
        if (volumeFrames != null)
        {
            return volumeFrames[0];
        }
        return 0;
    }

    private void Start()
    {
        avatar = GetComponentInParent<Ubiq.Avatars.Avatar>();
        voipAvatar = GetComponentInParent<VoipAvatar>();

        var speechIndicator = GetComponent<Ubiq.Samples.SpeechIndicator>();
        sampleSecondsPerIndicator = speechIndicator ? speechIndicator.sampleSecondsPerIndicator : 2.0f;
    }

    private void LateUpdate()
    {
        if (!avatar || avatar.IsLocal || !voipAvatar)
        {
            enabled = false;
            return;
        }

        if (!voipAvatar.peerConnection)
        {
            return;
        }

        UpdateSamples();
    }

    private void UpdateSamples()
    {
        if (volumeFrames == null)
        {
            volumeFrames = new float[1];
        }

        var volumeWindowSampleCount = 0;

        var stats = voipAvatar.peerConnection.GetLastFramePlaybackStats();
        currentFrameVolumeSum += stats.volume;
        currentFrameSampleCount += stats.samples;
        volumeWindowSampleCount = (int)(sampleSecondsPerIndicator * stats.sampleRate);

        if (currentFrameSampleCount > volumeWindowSampleCount)
        {
            PushVolumeSample(currentFrameVolumeSum / currentFrameSampleCount);
            currentFrameVolumeSum = 0;
            currentFrameSampleCount = 0;
        }
    }

    private void PushVolumeSample(float sample)
    {
        for (int i = volumeFrames.Length - 1; i >= 1; i--)
        {
            volumeFrames[i] = volumeFrames[i-1];
        }
        volumeFrames[0] = sample;
    }
}