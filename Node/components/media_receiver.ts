import { EventEmitter } from 'node:events';
import { NetworkId, type INetworkComponent, type NetworkContext, type NetworkScene, type Message } from '@ucl-vr/ubiq';
import type { RoomClient, RoomPeer } from '@ucl-vr/ubiq-server/components/roomclient.js';

// We use the @roamhq/wrtc package as the regular wrtc package has been abandoned :(
import wrtc from '@roamhq/wrtc';
import { RTCAudioData, RTCVideoData } from '@roamhq/wrtc/types/nonstandard';
const { RTCPeerConnection, nonstandard } = wrtc;
const { RTCAudioSink, RTCVideoSink } = nonstandard;

// --------------------------------------------------------------------------
// Classification enum — mirrors the one in MediaTrackPeerConnection.cs.
// --------------------------------------------------------------------------
const Classification = {
    Implementation: 0,
    IceCandidate: 1,
    Sdp: 2,
    TrackManifest: 3,
} as const;

// --------------------------------------------------------------------------
// Signaling helpers — mirrors the PeerConnection class from
// ubiq-server/components/peerconnectionmanager but with a different serviceId
// so that signals are routed to MediaTrackManager on Unity instead of VOIP.
// --------------------------------------------------------------------------

class MediaTrackPeerConnection extends EventEmitter implements INetworkComponent {
    networkId: NetworkId;
    scene: NetworkScene;
    uuid: string;
    polite: boolean;
    context: NetworkContext;

    /** Cleanup callbacks for sinks attached to this connection. */
    elements: { remove: () => void }[] = [];

    /** Ordered track IDs from the TrackManifest message. */
    trackManifestIds: string[] = [];
    /** Ordered track kinds from the TrackManifest message. */
    trackManifestKinds: string[] = [];
    /** How many ontrack events we have seen so far — used to index into the manifest. */
    trackIndex = 0;

    // Perfect Negotiation state (set by MediaReceiver)
    makingOffer = false;
    ignoreOffer = false;
    isSettingRemoteAnswerPending = false;
    otherPeerId: string | null | undefined = undefined;

    constructor(scene: NetworkScene, networkId: NetworkId, uuid: string, polite: boolean) {
        super();
        this.networkId = networkId;
        this.scene = scene;
        this.uuid = uuid;
        this.polite = polite;
        this.context = this.scene.register(this);
    }

    processMessage(message: Message): void {
        const obj = message.toObject();

        // Handle TrackManifest before it reaches the signaling handler
        if (obj.cls === Classification.TrackManifest) {
            this.trackManifestIds = obj.trackIds ?? [];
            this.trackManifestKinds = obj.trackKinds ?? [];
            console.log(
                `[MediaTrackPeerConnection] Received TrackManifest from ${this.uuid}: ` +
                    `[${this.trackManifestIds.join(', ')}]`,
            );
            return;
        }

        this.emit('OnSignallingMessage', obj);
    }

    sendIceCandidate(m: any): void {
        if (!m) {
            return;
        }

        this.context.send({
            cls: Classification.IceCandidate,
            hasImplementation: false,
            candidate: m.candidate ? m.candidate : null,
            hasCandidate: !!m.candidate,
            sdpMid: m.sdpMid ? m.sdpMid : null,
            hasSdpMid: !!m.sdpMid,
            sdpMLineIndex: m.sdpMLineIndex ? m.sdpMLineIndex : null,
            hasSdpMLineIndex: m.sdpMLineIndex !== undefined && m.sdpMLineIndex !== null,
            usernameFragment: m.usernameFragment ? m.usernameFragment : null,
            hasUsernameFragment: !!m.usernameFragment,
            hasType: false,
            hasSdp: false,
        });
    }

    sendSdp(m: any): void {
        this.context.send({
            cls: Classification.Sdp,
            hasImplementation: false,
            hasCandidate: false,
            hasSdpMid: false,
            hasSdpMLineIndex: false,
            hasUsernameFragment: false,
            hasType: !!m.type,
            type: m.type ? m.type : null,
            hasSdp: !!m.sdp,
            sdp: m.sdp ? m.sdp : null,
        });
    }

    /**
     * Return the track ID for the next received track, according to the
     * manifest order.  Falls back to `"track_N"` if the manifest is
     * missing or exhausted.
     */
    nextTrackId(): string {
        const idx = this.trackIndex++;
        if (idx < this.trackManifestIds.length) {
            return this.trackManifestIds[idx];
        }
        return `track_${idx}`;
    }
}

// --------------------------------------------------------------------------
// MediaTrackPeerConnectionManager — discovers peers and bootstraps WebRTC
// connections for custom media tracks (audio/video from MediaTrackManager).
// Uses a dedicated serviceId so it operates independently of Ubiq VOIP.
// --------------------------------------------------------------------------

class MediaTrackPeerConnectionManager extends EventEmitter implements INetworkComponent {
    networkId: NetworkId;
    serviceId: NetworkId;
    scene: NetworkScene;
    roomclient: RoomClient;
    peers: { [uuid: string]: MediaTrackPeerConnection };

    constructor(scene: NetworkScene) {
        super();

        // IMPORTANT: This serviceId MUST match the one used by MediaTrackManager.cs on the Unity side.
        this.serviceId = new NetworkId('a1b2-c3d4-e5f6-7890');
        this.networkId = NetworkId.Create(scene.networkId, this.serviceId);
        this.scene = scene;
        this.scene.register(this);
        this.roomclient = this.scene.getComponent('RoomClient') as RoomClient;
        this.roomclient.addListener('OnPeerAdded', this.OnPeerAdded.bind(this));
        this.roomclient.addListener('OnPeerRemoved', this.OnPeerRemoved.bind(this));
        this.peers = {};
    }

    OnPeerAdded(peer: RoomPeer): void {
        if (!this.peers.hasOwnProperty(peer.uuid)) {
            if (this.roomclient.peer.uuid.localeCompare(peer.uuid) > 0) {
                const pcid = NetworkId.Unique();
                console.log(
                    `[MediaTrackPeerConnectionManager] Initiating connection to ${peer.uuid} (pcid=${pcid})`,
                );
                this.createPeerConnection(pcid, peer.uuid, true);
                this.scene.send(NetworkId.Create(peer.sceneid, this.serviceId), {
                    type: 'RequestPeerConnection',
                    networkId: pcid,
                    uuid: this.roomclient.peer.uuid,
                });
            }
        }
    }

    OnPeerRemoved(peer: RoomPeer): void {
        if (this.peers[peer.uuid]) {
            console.log(`[MediaTrackPeerConnectionManager] OnPeerRemoved: ${peer.uuid}`);
            this.emit('OnPeerConnectionRemoved', this.peers[peer.uuid]);
            delete this.peers[peer.uuid];
        }
    }

    processMessage(message: Message): void {
        const m = message.toObject();
        switch (m.type) {
            case 'RequestPeerConnection':
                this.createPeerConnection(new NetworkId(m.networkId), m.uuid, false);
                break;
        }
    }

    createPeerConnection(pcid: NetworkId, uuid: string, polite: boolean): void {
        this.peers[uuid] = new MediaTrackPeerConnection(this.scene, pcid, uuid, polite);
        this.emit('OnPeerConnection', this.peers[uuid]);
    }
}

// --------------------------------------------------------------------------
// MediaReceiver — public API for applications.
//
// Emits:
//   'audio'  (trackId: string, uuid: string, data: RTCAudioData)
//   'video'  (trackId: string, uuid: string, frame: RTCVideoData)
//
// Usage:
//   const receiver = new MediaReceiver(scene);
//   receiver.on('audio', (trackId, uuid, data) => { ... });
//   receiver.on('video', (trackId, uuid, frame) => { ... });
// --------------------------------------------------------------------------

export class MediaReceiver extends EventEmitter {
    peerConnectionManager: MediaTrackPeerConnectionManager;

    constructor(scene: any) {
        super();
        this.peerConnectionManager = new MediaTrackPeerConnectionManager(scene);

        this.peerConnectionManager.addListener('OnPeerConnectionRemoved', (component: any) => {
            if (component.elements) {
                for (const element of component.elements) {
                    element.remove();
                }
            }
        });

        this.peerConnectionManager.addListener('OnPeerConnection', async (component: MediaTrackPeerConnection) => {
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                ],
            });

            component.elements = [];

            component.makingOffer = false;
            component.ignoreOffer = false;
            component.isSettingRemoteAnswerPending = false;
            component.otherPeerId = undefined;

            pc.onicecandidate = ({ candidate }: any) => {
                component.sendIceCandidate(candidate);
            };

            pc.onnegotiationneeded = async () => {
                try {
                    component.makingOffer = true;
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    component.sendSdp(offer);
                } catch (err) {
                    console.error('[MediaReceiver] onnegotiationneeded error:', err);
                } finally {
                    component.makingOffer = false;
                }
            };

            component.addListener(
                'OnSignallingMessage',
                async (m: {
                    implementation: any;
                    type: any;
                    sdp: any;
                    candidate: any;
                    sdpMid: any;
                    sdpMLineIndex: any;
                    usernameFragment: any;
                }) => {
                    // Special handling for dotnet peers
                    if (component.otherPeerId === undefined) {
                        component.otherPeerId = m.implementation ? m.implementation : null;
                        if (component.otherPeerId == 'dotnet') {
                            component.polite = true;
                        }
                    }

                    const description = m.type ? { type: m.type, sdp: m.sdp } : undefined;
                    const candidate = m.candidate
                        ? {
                              candidate: m.candidate,
                              sdpMid: m.sdpMid,
                              sdpMLineIndex: m.sdpMLineIndex,
                              usernameFragment: m.usernameFragment,
                          }
                        : undefined;

                    try {
                        if (description) {
                            const readyForOffer =
                                !component.makingOffer &&
                                (pc.signalingState == 'stable' ||
                                    component.isSettingRemoteAnswerPending);
                            const offerCollision = description.type == 'offer' && !readyForOffer;

                            component.ignoreOffer = !component.polite && offerCollision;
                            if (component.ignoreOffer) {
                                return;
                            }
                            component.isSettingRemoteAnswerPending =
                                description.type == 'answer';
                            await pc.setRemoteDescription(description);
                            component.isSettingRemoteAnswerPending = false;
                            if (description.type == 'offer') {
                                const answer = await pc.createAnswer();
                                await pc.setLocalDescription(answer);
                                component.sendSdp(answer);
                            }
                        } else if (candidate) {
                            try {
                                await pc.addIceCandidate(candidate);
                            } catch (err) {
                                if (!component.ignoreOffer) throw err;
                            }
                        }
                    } catch (err) {
                        console.error('[MediaReceiver] Signaling error:', err);
                    }
                },
            );

            pc.ontrack = ({ track }: any) => {
                const trackId = component.nextTrackId();
                console.log(
                    `[MediaReceiver] ontrack: kind=${track.kind}, trackId=${trackId}, peer=${component.uuid}`,
                );

                switch (track.kind) {
                    case 'audio': {
                        const audioSink = new RTCAudioSink(track);
                        audioSink.ondata = (data: RTCAudioData) => {
                            this.emit('audio', trackId, component.uuid, data);
                        };
                        component.elements.push({
                            remove: () => audioSink.stop(),
                        });
                        break;
                    }
                    case 'video': {
                        const videoSink = new RTCVideoSink(track);
                        videoSink.onframe = (event: any) => {
                            // RTCVideoSink dispatches an event wrapper;
                            // the actual I420 frame is in event.frame.
                            const frame = event.frame ?? event;
                            this.emit('video', trackId, component.uuid, frame);
                        };
                        component.elements.push({
                            remove: () => videoSink.stop(),
                        });
                        break;
                    }
                }
            };
        });
    }
}
