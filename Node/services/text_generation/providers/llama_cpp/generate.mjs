#!/usr/bin/env node
/**
 * llama.cpp text generation using node-llama-cpp.
 *
 * Reads prompts from stdin (one per line), streams response tokens to stdout
 * following the >TEXT / >READY convention used by the ubiq-genie pipeline.
 *
 * Usage:
 *   node generate.mjs --model "hf:Qwen/Qwen3-1.7B-GGUF/..." \
 *       [--preprompt "..."] [--thinking]
 */

import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import { getLlama, LlamaChatSession, LlamaLogLevel, resolveModelFile } from "node-llama-cpp";

const { values: opts } = parseArgs({
    options: {
        model:     { type: "string" },
        preprompt: { type: "string", default: "" },
        thinking:  { type: "boolean", default: false },
    },
});

if (!opts.model) {
    console.error("Error: --model is required");
    process.exit(1);
}

// ---- Load model (all output to stderr, nothing to stdout) ----
console.error(`[llama.cpp] Resolving model ${opts.model} ...`);
const modelPath = await resolveModelFile(opts.model, {
    cli: false,  // Suppress progress bars on stdout
    onProgress({ downloadedSize, totalSize }) {
        const pct = totalSize ? ((downloadedSize / totalSize) * 100).toFixed(1) : "?";
        process.stderr.write(`\r[llama.cpp] Downloading: ${pct}%`);
    },
});
process.stderr.write("\n");

console.error(`[llama.cpp] Loading ${modelPath} ...`);
const llama = await getLlama({ logLevel: LlamaLogLevel.warn });
const model = await llama.loadModel({ modelPath });
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt: opts.preprompt || undefined,
});

console.error("[llama.cpp] Model loaded.");
process.stdout.write(">READY\n");

// ---- Main loop: read stdin, stream responses ----
const rl = createInterface({ input: process.stdin, terminal: false });

for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const input = opts.thinking ? trimmed : trimmed + " /no_think";
    console.error(`[llama.cpp] IN: ${JSON.stringify(input)}`);
    process.stdout.write(">BUSY\n");

    let first = true;
    const response = await session.prompt(input, {
        onTextChunk(chunk) {
            if (first) {
                process.stdout.write(">" + chunk);
                first = false;
            } else {
                process.stdout.write(chunk);
            }
        },
    });

    process.stdout.write("\n");
    process.stdout.write(">IDLE\n");
    console.error(`[llama.cpp] OUT: ${JSON.stringify(response.trim())}`);
}
