/**
 * TypeScript implementation of the PersonaPlex binary framing protocol.
 *
 * Wire format (matches moshi/stdio.py):
 *   [u32 little-endian payload_len][payload bytes]
 *   payload[0] = message kind byte:
 *     0x00 = handshake (stdout only, sent once at startup)
 *     0x01 = audio    (bidirectional), PCM16LE mono at model sample rate (24 kHz)
 *     0x02 = text     (stdout only), UTF-8
 *     0x05 = error    (stdout only), UTF-8
 *     0x06 = ping     (stdin only), ignored by server
 */

// --- Message kind constants ---

export const KIND_HANDSHAKE = 0x00;
export const KIND_AUDIO = 0x01;
export const KIND_TEXT = 0x02;
export const KIND_ERROR = 0x05;
export const KIND_PING = 0x06;

// --- Parsed packet type ---

export interface ParsedPacket {
    kind: number;
    payload: Buffer;
}

// --- Encoding ---

/**
 * Encode a single framed packet: [u32LE payloadLen][kindByte][payload].
 * This is the format expected by PersonaPlex on stdin and produced on stdout.
 */
export function encodePacket(kind: number, payload: Buffer = Buffer.alloc(0)): Buffer {
    if (kind < 0 || kind > 255) {
        throw new RangeError(`Invalid packet kind: ${kind}`);
    }
    const framePayloadLen = 1 + payload.length; // kind byte + payload
    const header = Buffer.alloc(4);
    header.writeUInt32LE(framePayloadLen, 0);
    const kindBuf = Buffer.from([kind]);
    return Buffer.concat([header, kindBuf, payload]);
}

// --- Decoding (streaming parser) ---

/**
 * Streaming parser for length-prefixed binary packets.
 * Mirrors the Python `LengthPrefixedParser` from stdio.py.
 *
 * Feed arbitrary chunks of data via `feed()`. Complete packets are returned
 * as `ParsedPacket[]`. Partial data is buffered internally.
 */
export class LengthPrefixedParser {
    private buffer: Buffer = Buffer.alloc(0);
    private readonly maxPayloadBytes: number;

    constructor(maxPayloadBytes: number = 8 * 1024 * 1024) {
        this.maxPayloadBytes = maxPayloadBytes;
    }

    /** Whether the internal buffer contains unconsumed data. */
    get hasPendingData(): boolean {
        return this.buffer.length > 0;
    }

    /**
     * Feed a chunk of raw bytes from stdout. Returns an array of fully-parsed
     * packets extracted from the accumulated buffer. Any incomplete trailing
     * data is kept for the next `feed()` call.
     */
    feed(data: Buffer): ParsedPacket[] {
        if (data.length > 0) {
            this.buffer = Buffer.concat([this.buffer, data]);
        }

        const packets: ParsedPacket[] = [];

        while (true) {
            // Need at least the 4-byte length header
            if (this.buffer.length < 4) {
                break;
            }

            const payloadLen = this.buffer.readUInt32LE(0);

            if (payloadLen === 0) {
                throw new Error('Invalid zero-length payload.');
            }
            if (payloadLen > this.maxPayloadBytes) {
                throw new Error(
                    `Payload length ${payloadLen} exceeds max_payload_bytes=${this.maxPayloadBytes}.`
                );
            }

            const endIdx = 4 + payloadLen;
            if (this.buffer.length < endIdx) {
                break; // incomplete packet — wait for more data
            }

            // Extract the payload (kind byte + data)
            const rawPayload = this.buffer.subarray(4, endIdx);
            const kind = rawPayload[0];
            const payload = Buffer.from(rawPayload.subarray(1)); // copy to decouple from buffer

            packets.push({ kind, payload });

            // Advance past this packet
            this.buffer = Buffer.from(this.buffer.subarray(endIdx));
        }

        return packets;
    }

    /** Reset the parser, discarding any buffered data. */
    reset(): void {
        this.buffer = Buffer.alloc(0);
    }
}
