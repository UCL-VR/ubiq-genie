#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { join } from 'path';
const args = process.argv.slice(2);

if (args.length < 1) {
    console.error('Usage: npm start <app-name>, where <app-name> is a directory in the Node/apps directory.');
    process.exit(1);
}

const appName = args[0];
const appDirectory = join(process.cwd(), 'apps', appName);
console.log("Executing: ", `node --loader ts-node/esm ./app.ts in directory ${appDirectory}`);

try {
    execSync(`node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));' ./app.ts`, { stdio: 'inherit', cwd: appDirectory });
} catch (error) {
    process.exit(1);
}
