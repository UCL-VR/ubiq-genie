using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Unity.WebRTC;
using Ubiq.Messaging;
using Ubiq.Rooms;

namespace Ubiq.Genie
{

/// <summary>
/// A single media source to send over WebRTC. Configure one or more of
/// these in the Inspector on <see cref="MediaTrackManager"/>.
///
/// Each entry can have an AudioSource, a RenderTexture, or both. Each
/// non-null source creates one WebRTC track. Both tracks share the same
/// <c>trackId</c>; the server tells them apart by kind (audio / video).
/// </summary>
[Serializable]
public class MediaTrackSource
{
    [Tooltip("Identifier sent to the server so it can distinguish this source from others.")]
    public string trackId = "";

    [Tooltip("Optional AudioSource whose output will be sent as an audio track.")]
    public AudioSource audioSource;

    [Tooltip("Optional RenderTexture whose contents will be sent as a video track.")]
    public RenderTexture videoSource;
}

/// <summary>
/// Manages WebRTC peer connections for sending custom media tracks (audio
/// and/or video) to remote peers. Operates independently of Ubiq's built-in
/// VOIP system by using its own service ID for signaling.
///
/// Drag this component onto a GameObject in your scene, then configure one
/// or more <see cref="MediaTrackSource"/> entries in the Inspector. Each
/// entry has a user-defined <c>trackId</c> and optional audio / video
/// sources. Any connected peer running a matching MediaReceiver on the
/// Node side will receive the tracks and be able to differentiate them by
/// their IDs.
/// </summary>
public class MediaTrackManager : MonoBehaviour
{
    [Header("Media Sources")]
    [Tooltip("Configure one or more track sources. Each entry can have an AudioSource, a RenderTexture, or both.")]
    public List<MediaTrackSource> trackSources = new List<MediaTrackSource>();

    [Header("Debug")]
    [Tooltip("Log signaling and connection state changes to the console.")]
    public bool debugLog = false;

    // ---------------------------------------------------------------
    // This service ID MUST match the one used by MediaReceiver on the
    // Node side (media_receiver.ts). It is deliberately different from
    // the VOIP service ID so the two systems are fully independent.
    // ---------------------------------------------------------------
    private readonly NetworkId serviceId = new NetworkId("a1b2-c3d4-e5f6-7890");

    private NetworkScene networkScene;
    private RoomClient roomClient;

    private Dictionary<string, MediaTrackPeerConnection> peerConnections
        = new Dictionary<string, MediaTrackPeerConnection>();

    /// <summary>
    /// Shared coroutine handle for <see cref="WebRTC.Update"/>. This
    /// static coroutine pumps all <see cref="VideoStreamTrack"/> instances
    /// at the end of each frame, encoding GPU textures into WebRTC video
    /// frames. Without it, no video data is sent.
    /// </summary>
    private static Coroutine webRtcUpdateCoroutine;
    private static MediaTrackManager webRtcUpdateCoroutineOwner;

    // -------------------------------------------------------------------
    // Unity lifecycle
    // -------------------------------------------------------------------

    private void Start()
    {
        networkScene = NetworkScene.Find(this);
        if (networkScene == null)
        {
            Debug.LogError("[MediaTrackManager] No NetworkScene found in parents.");
            enabled = false;
            return;
        }

        // Start the global WebRTC.Update() coroutine if any track source
        // has a video RenderTexture assigned.  This only needs to run once
        // across the entire application.
        if (webRtcUpdateCoroutine == null)
        {
            bool hasVideo = false;
            foreach (var src in trackSources)
            {
                if (src.videoSource != null) { hasVideo = true; break; }
            }

            if (hasVideo)
            {
                webRtcUpdateCoroutine = StartCoroutine(WebRTC.Update());
                webRtcUpdateCoroutineOwner = this;
                Log("Started global WebRTC.Update() coroutine for video encoding");
            }
        }

        var id = NetworkId.Create(networkScene.Id, serviceId);
        networkScene.AddProcessor(id, ProcessMessage);

        roomClient = networkScene.GetComponent<RoomClient>();
        if (roomClient == null)
        {
            Debug.LogError("[MediaTrackManager] No RoomClient found on the NetworkScene.");
            enabled = false;
            return;
        }

        roomClient.OnPeerAdded.AddListener(OnPeerAdded);
        roomClient.OnPeerRemoved.AddListener(OnPeerRemoved);

        Log($"Initialised – scene {networkScene.Id}, listening at {id}, " +
            $"{trackSources.Count} track source(s) configured");
    }

    private void OnDestroy()
    {
        if (roomClient != null)
        {
            roomClient.OnPeerAdded.RemoveListener(OnPeerAdded);
            roomClient.OnPeerRemoved.RemoveListener(OnPeerRemoved);
        }

        // Clean up all connections
        foreach (var kvp in peerConnections)
        {
            if (kvp.Value != null && kvp.Value.gameObject != null)
            {
                Destroy(kvp.Value.gameObject);
            }
        }
        peerConnections.Clear();

        if (networkScene != null)
        {
            var id = NetworkId.Create(networkScene.Id, serviceId);
            networkScene.RemoveProcessor(id, ProcessMessage);
        }

        if (webRtcUpdateCoroutineOwner == this)
        {
            if (webRtcUpdateCoroutine != null)
            {
                StopCoroutine(webRtcUpdateCoroutine);
            }
            webRtcUpdateCoroutine = null;
            webRtcUpdateCoroutineOwner = null;
        }
    }

    // -------------------------------------------------------------------
    // Peer discovery (mirrors VoipPeerConnectionManager logic)
    // -------------------------------------------------------------------

    private void OnPeerAdded(IPeer peer)
    {
        if (peer.uuid == roomClient.Me.uuid)
            return;

        if (peerConnections.ContainsKey(peer.uuid))
            return;

        Log($"OnPeerAdded: {peer.uuid}  (me={roomClient.Me.uuid})");

        // Higher UUID initiates the connection (same convention as VOIP).
        if (String.Compare(roomClient.Me.uuid, peer.uuid) > 0)
        {
            var pcid = NetworkId.Unique();

            Log($"Initiating media connection to {peer.uuid} (pcid={pcid})");

            // Send RequestPeerConnection BEFORE creating our local peer
            // connection. Setup() sends the TrackManifest on the pcid, and
            // the remote side only registers its listener for that pcid
            // when it processes the RequestPeerConnection. Since Ubiq
            // messages are ordered (TCP), sending the request first
            // guarantees the remote listener exists before the manifest
            // arrives.
            RequestMessage msg;
            msg.type = "RequestPeerConnection";
            msg.networkId = pcid;
            msg.uuid = roomClient.Me.uuid;

            networkScene.SendJson(
                NetworkId.Create(peer.networkId, serviceId), msg);

            CreatePeerConnection(pcid, peer.uuid, polite: true);
        }
        else
        {
            Log($"Waiting for {peer.uuid} to initiate (their UUID is higher)");
        }
    }

    private void OnPeerRemoved(IPeer peer)
    {
        if (peerConnections.TryGetValue(peer.uuid, out var pc))
        {
            Log($"Removing media connection for {peer.uuid}");
            if (pc != null && pc.gameObject != null)
            {
                Destroy(pc.gameObject);
            }
            peerConnections.Remove(peer.uuid);
        }
    }

    // -------------------------------------------------------------------
    // Signaling: manager-level messages
    // -------------------------------------------------------------------

    public void ProcessMessage(ReferenceCountedSceneGraphMessage message)
    {
        var msg = JsonUtility.FromJson<RequestMessage>(message.ToString());
        switch (msg.type)
        {
            case "RequestPeerConnection":
                Log($"Received RequestPeerConnection from {msg.uuid} (pcid={msg.networkId})");
                CreatePeerConnection(msg.networkId, msg.uuid, polite: false);
                break;
        }
    }

    [Serializable]
    private struct RequestMessage
    {
        public string type;
        public NetworkId networkId;
        public string uuid;
    }

    // -------------------------------------------------------------------
    // Peer connection creation
    // -------------------------------------------------------------------

    private MediaTrackPeerConnection CreatePeerConnection(
        NetworkId networkId, string peerUuid, bool polite)
    {
        var go = new GameObject("Media Track Connection " + peerUuid);
        go.transform.SetParent(transform);

        var pc = go.AddComponent<MediaTrackPeerConnection>();
        pc.Setup(networkId, networkScene, peerUuid, polite,
                 trackSources, debugLog);

        peerConnections[peerUuid] = pc;
        return pc;
    }

    // -------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------

    private void Log(string msg)
    {
        if (debugLog)
            Debug.Log($"[MediaTrackManager] {msg}");
    }
}

} // namespace Ubiq.Genie
