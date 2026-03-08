using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Unity.WebRTC;
using Ubiq.Messaging;

/// <summary>
/// Manages a single RTCPeerConnection for sending custom media tracks to one
/// remote peer. Created and owned by <see cref="MediaTrackManager"/>.
///
/// Supports multiple named tracks. Before WebRTC negotiation begins, a
/// TrackManifest message (cls=3) is sent listing all track IDs and kinds
/// in order. The remote receiver uses this to match incoming tracks to
/// their logical IDs.
///
/// Implements the "Perfect Negotiation" pattern for WebRTC signaling, using
/// Ubiq's messaging layer as the signaling transport. The JSON wire format
/// is compatible with the Node-side PeerConnection class from
/// ubiq-server/components/peerconnectionmanager.
/// </summary>
public class MediaTrackPeerConnection : MonoBehaviour
{
    // -------------------------------------------------------------------
    // Signaling message structs — must match the JSON format used by the
    // Node-side PeerConnection.sendIceCandidate / sendSdp.
    //
    // The Node side uses a flat struct with `cls` + `hasX` fields to work
    // around Unity's JsonUtility inability to handle null values.
    // -------------------------------------------------------------------

    private enum Classification
    {
        Implementation = 0,
        IceCandidate = 1,
        Sdp = 2,
        TrackManifest = 3
    }

    [Serializable]
    private struct SignalingMsg
    {
        public int cls;
        public bool hasImplementation;
        public string implementation;
        public bool hasCandidate;
        public string candidate;
        public bool hasSdpMid;
        public string sdpMid;
        public bool hasSdpMLineIndex;
        public int sdpMLineIndex;
        public bool hasUsernameFragment;
        public string usernameFragment;
        public bool hasType;
        public string type;
        public bool hasSdp;
        public string sdp;
    }

    /// <summary>
    /// Sent before SDP negotiation. Lists all track IDs and kinds in the
    /// order they were added to the RTCPeerConnection. The remote side
    /// uses this to associate each <c>ontrack</c> event with a logical
    /// track identifier.
    /// </summary>
    [Serializable]
    private struct TrackManifestMsg
    {
        public int cls;
        public string[] trackIds;
        public string[] trackKinds;
    }

    // -------------------------------------------------------------------
    // Internal Event queue (same pattern as Ubiq's PeerConnectionImpl)
    // -------------------------------------------------------------------

    private class Event
    {
        public enum Type
        {
            NegotiationNeeded,
            OnIceCandidate,
            SignalingMessage
        }

        public readonly Type type;
        public readonly string json;
        public readonly RTCIceCandidate iceCandidate;

        public Event(string json) : this(Type.SignalingMessage, json) { }
        public Event(RTCIceCandidate ic) : this(Type.OnIceCandidate, null, ic) { }
        public Event(Type type, string json = null, RTCIceCandidate ic = null)
        {
            this.type = type;
            this.json = json;
            this.iceCandidate = ic;
        }
    }

    // -------------------------------------------------------------------
    // Fields
    // -------------------------------------------------------------------

    private RTCPeerConnection pc;
    private NetworkId networkId;
    private NetworkScene networkScene;
    private string peerUuid;
    private bool polite;
    private bool debugLog;

    private List<MediaTrackSource> trackSourceRefs;
    private List<AudioStreamTrack> audioTracks = new List<AudioStreamTrack>();
    private List<VideoStreamTrack> videoTracks = new List<VideoStreamTrack>();

    private List<Event> events = new List<Event>();
    private Coroutine signalingCoroutine;
    private bool ignoreOffer;
    private bool isSetup;

    // -------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------

    /// <summary>
    /// Initialise this peer connection. Called by MediaTrackManager after
    /// the GameObject is created.
    /// </summary>
    public void Setup(
        NetworkId networkId,
        NetworkScene scene,
        string peerUuid,
        bool polite,
        List<MediaTrackSource> trackSources,
        bool debugLog)
    {
        if (isSetup) return;
        isSetup = true;

        this.networkId = networkId;
        this.networkScene = scene;
        this.peerUuid = peerUuid;
        this.polite = polite;
        this.trackSourceRefs = trackSources;
        this.debugLog = debugLog;

        // Register for signaling messages on our unique pcid
        networkScene.AddProcessor(networkId, ProcessMessage);

        // Create RTCPeerConnection
        var config = new RTCConfiguration
        {
            iceServers = new[]
            {
                new RTCIceServer { urls = new[] { "stun:stun.l.google.com:19302" } }
            }
        };

        pc = new RTCPeerConnection(ref config)
        {
            OnConnectionStateChange = state =>
            {
                Log($"Connection state: {state}");
            },
            OnIceConnectionChange = state =>
            {
                Log($"ICE state: {state}");
            },
            OnIceCandidate = candidate =>
            {
                events.Add(new Event(candidate));
            },
            OnNegotiationNeeded = () =>
            {
                Log("Negotiation needed");
                events.Add(new Event(Event.Type.NegotiationNeeded));
            },
        };

        // Add configured tracks and send the track manifest
        AddTracks();

        // Start the signaling coroutine
        signalingCoroutine = StartCoroutine(DoSignaling());
    }

    // -------------------------------------------------------------------
    // Unity lifecycle
    // -------------------------------------------------------------------

    private void OnDestroy()
    {
        if (signalingCoroutine != null)
        {
            StopCoroutine(signalingCoroutine);
            signalingCoroutine = null;
        }

        if (networkScene != null)
        {
            networkScene.RemoveProcessor(networkId, ProcessMessage);
        }

        foreach (var t in audioTracks)
            t?.Dispose();
        foreach (var t in videoTracks)
            t?.Dispose();
        audioTracks.Clear();
        videoTracks.Clear();

        pc?.Dispose();
    }

    // -------------------------------------------------------------------
    // Track management
    // -------------------------------------------------------------------

    private void AddTracks()
    {
        if (trackSourceRefs == null || trackSourceRefs.Count == 0)
        {
            Debug.LogWarning("[MediaTrackPeerConnection] No track sources configured.");
            return;
        }

        // Build the manifest while adding tracks.  The order of entries in
        // the manifest MUST match the order of pc.AddTrack calls because
        // the remote side maps ontrack events to IDs by index.

        var manifestIds = new List<string>();
        var manifestKinds = new List<string>();

        foreach (var src in trackSourceRefs)
        {
            if (src.videoSource != null)
            {
                var vt = new VideoStreamTrack(src.videoSource);
                videoTracks.Add(vt);
                pc.AddTrack(vt);
                manifestIds.Add(src.trackId);
                manifestKinds.Add("video");
                Log($"Added video track '{src.trackId}' " +
                    $"({src.videoSource.width}x{src.videoSource.height})");
            }

            if (src.audioSource != null)
            {
                var at = new AudioStreamTrack(src.audioSource);
                audioTracks.Add(at);
                pc.AddTrack(at);
                manifestIds.Add(src.trackId);
                manifestKinds.Add("audio");
                Log($"Added audio track '{src.trackId}'");
            }
        }

        if (manifestIds.Count == 0)
        {
            Debug.LogWarning("[MediaTrackPeerConnection] " +
                "No audio or video sources assigned — no tracks will be sent.");
            return;
        }

        // Send the track manifest BEFORE the signaling coroutine creates
        // the SDP offer.  Because Ubiq messages are ordered (TCP), the
        // remote side is guaranteed to receive this before the offer.
        var manifest = new TrackManifestMsg
        {
            cls = (int)Classification.TrackManifest,
            trackIds = manifestIds.ToArray(),
            trackKinds = manifestKinds.ToArray()
        };
        networkScene.Send(networkId, JsonUtility.ToJson(manifest));
        Log($"Sent TrackManifest: [{string.Join(", ", manifestIds)}]");
    }

    // -------------------------------------------------------------------
    // Signaling: per-connection messages
    // -------------------------------------------------------------------

    public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
    {
        events.Add(new Event(data.ToString()));
    }

    /// <summary>
    /// Coroutine implementing Perfect Negotiation for WebRTC signaling.
    /// Processes events sequentially to avoid race conditions.
    /// </summary>
    private IEnumerator DoSignaling()
    {
        while (true)
        {
            if (events.Count == 0)
            {
                yield return null;
                continue;
            }

            var e = events[0];
            events.RemoveAt(0);

            // --- ICE candidate to send ---
            if (e.type == Event.Type.OnIceCandidate)
            {
                SendIceCandidate(e.iceCandidate);
                continue;
            }

            // --- Negotiation needed (create offer / implicit rollback) ---
            if (e.type == Event.Type.NegotiationNeeded)
            {
                Log("Creating SDP offer via SetLocalDescription()");
                var op = pc.SetLocalDescription();
                yield return op;
                if (op.IsError)
                {
                    Debug.LogError($"[MediaTrackPeerConnection] SetLocalDescription failed: {op.Error.message}");
                    continue;
                }
                Log($"Sending SDP {pc.LocalDescription.type}");
                SendSdp(pc.LocalDescription);
                continue;
            }

            // --- Incoming signaling message ---
            var msg = JsonUtility.FromJson<SignalingMsg>(e.json);

            // Identify implementation (dotnet workaround)
            if (msg.cls == (int)Classification.Implementation)
            {
                if (msg.hasImplementation && msg.implementation == "dotnet")
                {
                    polite = true;
                }
                continue;
            }

            // Track manifest from remote (informational for this end)
            if (msg.cls == (int)Classification.TrackManifest)
            {
                Log("Received TrackManifest from remote (ignored on sender side)");
                continue;
            }

            // SDP (offer / answer)
            if (msg.hasType && msg.type != null)
            {
                Log($"Received SDP {msg.type}");

                ignoreOffer = !polite
                    && msg.type == "offer"
                    && pc.SignalingState != RTCSignalingState.Stable;

                if (ignoreOffer)
                {
                    Log("Ignoring glare offer (impolite peer)");
                    continue;
                }

                var desc = new RTCSessionDescription
                {
                    type = StringToSdpType(msg.type),
                    sdp = msg.hasSdp ? msg.sdp : null
                };

                var op = pc.SetRemoteDescription(ref desc);
                yield return op;
                if (op.IsError)
                {
                    Debug.LogError($"[MediaTrackPeerConnection] SetRemoteDescription failed: {op.Error.message}");
                    continue;
                }

                if (msg.type == "offer")
                {
                    Log("Creating SDP answer");
                    op = pc.SetLocalDescription();
                    yield return op;
                    if (op.IsError)
                    {
                        Debug.LogError($"[MediaTrackPeerConnection] SetLocalDescription (answer) failed: {op.Error.message}");
                        continue;
                    }
                    SendSdp(pc.LocalDescription);
                }
                continue;
            }

            // ICE candidate received
            if (msg.hasCandidate && msg.candidate != null
                && !string.IsNullOrWhiteSpace(msg.candidate))
            {
                if (!ignoreOffer)
                {
                    var init = new RTCIceCandidateInit
                    {
                        candidate = msg.candidate,
                        sdpMid = msg.hasSdpMid ? msg.sdpMid : null,
                        sdpMLineIndex = msg.hasSdpMLineIndex ? msg.sdpMLineIndex : 0
                    };
                    pc.AddIceCandidate(new RTCIceCandidate(init));
                }
                continue;
            }
        }
    }

    // -------------------------------------------------------------------
    // Send helpers — build JSON compatible with Node-side PeerConnection
    // -------------------------------------------------------------------

    private void SendSdp(RTCSessionDescription sd)
    {
        var msg = new SignalingMsg
        {
            cls = (int)Classification.Sdp,
            hasImplementation = false,
            hasCandidate = false,
            hasSdpMid = false,
            hasSdpMLineIndex = false,
            hasUsernameFragment = false,
            hasType = true,
            type = SdpTypeToString(sd.type),
            hasSdp = true,
            sdp = sd.sdp
        };
        networkScene.Send(networkId, JsonUtility.ToJson(msg));
    }

    private void SendIceCandidate(RTCIceCandidate ic)
    {
        var msg = new SignalingMsg
        {
            cls = (int)Classification.IceCandidate,
            hasImplementation = false,
            hasCandidate = true,
            candidate = ic.Candidate,
            hasSdpMid = true,
            sdpMid = ic.SdpMid,
            hasSdpMLineIndex = true,
            sdpMLineIndex = ic.SdpMLineIndex ?? 0,
            hasUsernameFragment = true,
            usernameFragment = ic.UserNameFragment,
            hasType = false,
            hasSdp = false
        };
        networkScene.Send(networkId, JsonUtility.ToJson(msg));
    }

    // -------------------------------------------------------------------
    // SDP type conversion helpers
    // -------------------------------------------------------------------

    private static string SdpTypeToString(RTCSdpType type)
    {
        switch (type)
        {
            case RTCSdpType.Answer: return "answer";
            case RTCSdpType.Offer: return "offer";
            case RTCSdpType.Pranswer: return "pranswer";
            case RTCSdpType.Rollback: return "rollback";
            default: return null;
        }
    }

    private static RTCSdpType StringToSdpType(string type)
    {
        switch (type)
        {
            case "answer": return RTCSdpType.Answer;
            case "offer": return RTCSdpType.Offer;
            case "pranswer": return RTCSdpType.Pranswer;
            case "rollback": return RTCSdpType.Rollback;
            default: return RTCSdpType.Offer;
        }
    }

    // -------------------------------------------------------------------
    // Debug logging
    // -------------------------------------------------------------------

    private void Log(string msg)
    {
        if (debugLog)
            Debug.Log($"[MediaTrackPeerConnection:{peerUuid}] {msg}");
    }
}