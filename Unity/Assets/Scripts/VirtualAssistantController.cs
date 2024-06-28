using System.Collections;
using System.Collections.Generic;
using Ubiq.Networking;
using UnityEngine;
using Ubiq.Dictionaries;
using Ubiq.Messaging;
using Ubiq.Logging.Utf8Json;
using Ubiq.Rooms;
using System;
using System.Text;
using Ubiq.Voip;
using Ubiq.Samples;
using Ubiq.Avatars;

public class VirtualAssistantController : MonoBehaviour
{
    public HandMover handMover;
    public float turnSpeed = 10.0f;

    private string assistantSpeechTargetPeerName;
    private float assistantSpeechVolume;
    private IPeer lastTargetPeer;
    // private MicrophoneCapture microphoneCapture;

    private RoomClient roomClient;
    private AvatarManager avatarManager;
    private VoipPeerConnectionManager peerConnectionManager;

    private const float SPEECH_VOLUME_FLOOR = 0.005f;

    public void UpdateAssistantSpeechStatus(string targetPeerName, float volume)
    {
        assistantSpeechTargetPeerName = targetPeerName;
        assistantSpeechVolume = volume;
    }

    void Update()
    {
        UpdateHands();
        UpdateTurn();
    }

    void UpdateHands()
    {
        if (handMover)
        {
            if (assistantSpeechVolume > SPEECH_VOLUME_FLOOR)
            {
                handMover.Play();
            }
            else
            {
                handMover.Stop();
            }
        }
    }

    void UpdateTurn()
    {
        if (!roomClient)
        {
            roomClient = NetworkScene.Find(this).GetComponent<RoomClient>();
            if (!roomClient)
            {
                return;
            }
        }
        if (!avatarManager)
        {
            avatarManager = roomClient.GetComponentInChildren<AvatarManager>();
            if (!avatarManager)
            {
                return;
            }
        }

        var targetPeer = null as IPeer;
        if (!string.IsNullOrEmpty(assistantSpeechTargetPeerName))
        {
            // Speech target specified: find the corresponding peer
            foreach(var peer in roomClient.Peers)
            {
                if (peer["ubiq.samples.social.name"] == assistantSpeechTargetPeerName)
                {
                    targetPeer = peer;
                    break;
                }
            }
            if (roomClient.Me["ubiq.samples.social.name"] == assistantSpeechTargetPeerName)
            {
                targetPeer = roomClient.Me;
            }
        }
        else
        {
            var loudestVolume = 0.0f;
            // TODO: Replace MicrophoneCapture with volume from new WebRTC library
            // No speech target specified: find the loudest current peer
            // if (!microphoneCapture)
            // {
            //     microphoneCapture = FindObjectOfType<MicrophoneCapture>();
            // }

            // if (microphoneCapture)
            // {
            //     var stats = microphoneCapture.lastFrameStats;
            //
            //     if (stats.sampleCount > 0)
            //     {
            //         var volume = stats.volumeSum / stats.sampleCount;
            //         if (volume > 0.01f)
            //         {
            //             targetPeer = roomClient.Me;
            //             loudestVolume = volume;
            //         }
            //     }
            // }

            foreach(var avatar in avatarManager.Avatars)
            {
                var audioSource = avatar.GetComponentInChildren<AudioSource>();
                if (!audioSource)
                {
                    continue;
                }

                var volume = audioSource.GetComponent<AudioSourceVolume>();
                if (!volume)
                {
                    volume = audioSource.gameObject.AddComponent<AudioSourceVolume>();
                }

                var vol = volume.volume;
                if (vol > loudestVolume && vol > SPEECH_VOLUME_FLOOR)
                {
                    targetPeer = avatar.Peer;
                    loudestVolume = vol;
                }
            }
        }

        if (targetPeer == null)
        {
            targetPeer = lastTargetPeer;

            if (targetPeer == null)
            {
                return;
            }
        }

        var targetAvatar = null as Ubiq.Avatars.Avatar;
        foreach(var avatar in avatarManager.Avatars)
        {
            if (avatar.Peer == targetPeer)
            {
                targetAvatar = avatar;
                break;
            }
        }

        if (!targetAvatar)
        {
            return;
        }

        var floatingAvatar = targetAvatar.GetComponentInChildren<FloatingAvatar>();
        if (!floatingAvatar)
        {
            return;
        }

        var position = floatingAvatar.head.position;

        var facingDirection = position - transform.position;
        facingDirection = new Vector3(facingDirection.x, 0, facingDirection.z);

        transform.rotation = Quaternion.Slerp(transform.rotation,
            Quaternion.LookRotation(facingDirection), turnSpeed * Time.deltaTime);

        lastTargetPeer = targetPeer;

        // var assistantFloatingAvatar = GetComponent<FloatingAvatar>();
        // if (!assistantFloatingAvatar)
        // {
        //     return;
        // }
        // facingDirection = position - transform.position;
        // var assistantHead = assistantFloatingAvatar.head;
        // assistantHead.rotation = Quaternion.Slerp(assistantHead.rotation,
        //     Quaternion.LookRotation(facingDirection,Vector3.up), turnSpeed * Time.deltaTime);
    }
}
