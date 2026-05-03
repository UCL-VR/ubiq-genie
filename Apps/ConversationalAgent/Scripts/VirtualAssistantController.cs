using System.Collections.Generic;
using UnityEngine;
using Ubiq.Messaging;
using Ubiq.Rooms;
using Ubiq.Voip;
using Ubiq.Samples;
using Ubiq.Avatars;

namespace Ubiq.Genie.Samples.ConversationalAgent
{

public class VirtualAssistantController : MonoBehaviour
{
    public HandMover handMover;
    public float turnSpeed = 10.0f;
    public float gestureStartVolume = 0.006f;
    public float gestureStopVolume = 0.003f;
    public float minGestureHoldTime = 0.2f;

    private string assistantSpeechTargetPeerName;
    private float assistantSpeechVolume;
    private bool handsPlaying;
    private float handsHoldUntilTime;
    private IPeer lastTargetPeer;

    private RoomClient roomClient;
    private AvatarManager avatarManager;

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
        if (!handMover)
        {
            return;
        }

        var startThreshold = Mathf.Max(gestureStartVolume, gestureStopVolume);
        var stopThreshold = Mathf.Min(gestureStartVolume, gestureStopVolume);

        if (assistantSpeechVolume >= startThreshold)
        {
            handsPlaying = true;
            handsHoldUntilTime = Time.time + minGestureHoldTime;
        }
        else if (assistantSpeechVolume <= stopThreshold && Time.time >= handsHoldUntilTime)
        {
            handsPlaying = false;
        }

        if (handsPlaying)
        {
            handMover.Play();
        }
        else
        {
            handMover.Stop();
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
    }
}

} // namespace Ubiq.Genie.Samples.ConversationalAgent
