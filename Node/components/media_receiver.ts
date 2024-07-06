import { EventEmitter } from 'node:events';
import { PeerConnectionManager } from 'ubiq-server/components/peerconnectionmanager.js';

// We use the @roamhq/wrtc package as the regular wrtc package has been abandoned :(
import wrtc from '@roamhq/wrtc';
import { RTCAudioData, RTCVideoData } from '@roamhq/wrtc/types/nonstandard';
const { RTCPeerConnection, nonstandard } = wrtc;
const { RTCAudioSink, RTCVideoSink } = nonstandard;

export class MediaReceiver extends EventEmitter {
    context: any;
    peerConnectionManager: PeerConnectionManager;

    constructor(scene: any) {
        super();
        this.peerConnectionManager = new PeerConnectionManager(scene);

        this.peerConnectionManager.addListener('OnPeerConnectionRemoved', (component) => {
            for (let element of component.elements) {
                element.remove();
            }
        });

        this.peerConnectionManager.addListener('OnPeerConnection', async (component) => {
            let pc = new RTCPeerConnection({
                // sdpSemantics: 'unified-plan',
            });

            component.elements = [];

            component.makingOffer = false;
            component.ignoreOffer = false;
            component.isSettingRemoteAnswerPending = false;

            // Special handling for dotnet peers
            component.otherPeerId = undefined;

            pc.onicecandidate = ({ candidate }) => component.sendIceCandidate(candidate);

            pc.onnegotiationneeded = async () => {
                try {
                    component.makingOffer = true;
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    component.sendSdp(offer);
                } catch (err) {
                    console.error(err);
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
                            // If just one of the two peers is dotnet, the
                            // non-dotnet peer always takes on the role of polite
                            // peer as the dotnet implementaton isn't smart enough
                            // to handle rollback
                            component.polite = true;
                        }
                    }

                    let description = m.type
                        ? {
                              type: m.type,
                              sdp: m.sdp,
                          }
                        : undefined;

                    let candidate = m.candidate
                        ? {
                              candidate: m.candidate,
                              sdpMid: m.sdpMid,
                              sdpMLineIndex: m.sdpMLineIndex,
                              usernameFragment: m.usernameFragment,
                          }
                        : undefined;

                    try {
                        if (description) {
                            // An offer may come in while we are busy processing SRD(answer).
                            // In this case, we will be in "stable" by the time the offer is processed
                            // so it is safe to chain it on our Operations Chain now.
                            const readyForOffer =
                                !component.makingOffer &&
                                (pc.signalingState == 'stable' || component.isSettingRemoteAnswerPending);
                            const offerCollision = description.type == 'offer' && !readyForOffer;

                            component.ignoreOffer = !component.polite && offerCollision;
                            if (component.ignoreOffer) {
                                return;
                            }
                            component.isSettingRemoteAnswerPending = description.type == 'answer';
                            await pc.setRemoteDescription(description); // SRD rolls back as needed
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
                                if (!component.ignoreOffer) throw err; // Suppress ignored offer's candidates
                            }
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
            );

            pc.ontrack = ({ track, streams }) => {
                switch (track.kind) {
                    case 'audio':
                        let audioSink = new RTCAudioSink(track);
                        audioSink.ondata = (data: RTCAudioData) => {
                            this.emit('audio', component.uuid, data);
                        };

                        break;
                    case 'video':
                        let videoSink = new RTCVideoSink(track);
                        videoSink.onframe = (frame: RTCVideoData) => {
                            this.emit('video', component.uuid, frame);
                        };
                }
            };
        });
    }
}
