import { promises as fs } from 'fs';
import path from 'path';

// Paths
const projectRoot = process.cwd();

// Create certs directory if it doesn't exist
const createCertsDirectory = async () => {
  const certsDir = path.join(projectRoot, 'certs');
  try {
    await fs.access(certsDir);
  } catch {
    await fs.mkdir(certsDir);
  }
};

// Main
const main = async () => {
  await createCertsDirectory();
};

main().catch((err) => {
  console.error('Postinstall script failed:', err);
  process.exit(1);
});
