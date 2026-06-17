/**
 * PCM16LE audio resampling utilities for converting between
 * 48 kHz (WebRTC/Ubiq) and 24 kHz (PersonaPlex model sample rate).
 *
 * All functions operate on raw Buffers of PCM16 little-endian mono samples.
 * Each sample is 2 bytes (Int16LE).
 */

/**
 * Downsample 48 kHz PCM16LE mono audio to 24 kHz by averaging adjacent
 * sample pairs. The input buffer length must be a multiple of 4 bytes
 * (2 samples × 2 bytes each).
 *
 * Uses a simple 2-tap averaging filter to reduce aliasing compared to
 * naive decimation (dropping every other sample).
 */
export function downsample48kTo24k(input: Buffer): Buffer {
    const sampleCount = input.length / 2;
    // If odd number of samples, process pairs and drop the last sample
    const pairCount = Math.floor(sampleCount / 2);
    const output = Buffer.alloc(pairCount * 2);

    for (let i = 0; i < pairCount; i++) {
        const s0 = input.readInt16LE(i * 4);
        const s1 = input.readInt16LE(i * 4 + 2);
        // Average the two samples (with rounding toward zero)
        const avg = ((s0 + s1) / 2) | 0;
        output.writeInt16LE(avg, i * 2);
    }

    return output;
}

/**
 * Upsample 24 kHz PCM16LE mono audio to 48 kHz using linear interpolation.
 * Each input sample produces two output samples: the original value and an
 * interpolated midpoint between it and the next sample.
 *
 * For the last sample, the interpolated value duplicates the final sample
 * (zero-order hold at the boundary).
 */
export function upsample24kTo48k(input: Buffer): Buffer {
    const sampleCount = input.length / 2;
    if (sampleCount === 0) {
        return Buffer.alloc(0);
    }

    const output = Buffer.alloc(sampleCount * 2 * 2); // 2× samples, 2 bytes each

    for (let i = 0; i < sampleCount; i++) {
        const current = input.readInt16LE(i * 2);
        const next = i + 1 < sampleCount ? input.readInt16LE((i + 1) * 2) : current;

        // First output sample: original value
        output.writeInt16LE(current, i * 4);
        // Second output sample: linear interpolation midpoint
        const midpoint = ((current + next) / 2) | 0;
        output.writeInt16LE(midpoint, i * 4 + 2);
    }

    return output;
}
