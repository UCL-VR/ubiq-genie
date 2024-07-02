import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Create certs directory if it doesn't exist
const createCertsDirectory = async () => {
  const certsDir = path.join(process.cwd(), 'certs');
  try {
    await fs.access(certsDir);
  } catch {
    await fs.mkdir(certsDir);
  }
};

// Run npm install in the ubiq-server directory
const installUbiqServerDependencies = async () => {
  const ubiqServerDir = path.join(process.cwd(), 'node_modules', 'ubiq-server');
  execSync('npm install', { cwd: ubiqServerDir, stdio: 'inherit' });
};

// Create symbolic link for certs directory
const createCertsSymlink = async () => {
  const ubiqServerDir = path.join(process.cwd(), 'node_modules', 'ubiq-server');
  const certsLink = path.join(ubiqServerDir, 'certs');
  const certsDir = path.join(process.cwd(), 'certs');

  try {
    await fs.access(certsLink);
  } catch {
    const relativePath = path.relative(ubiqServerDir, certsDir);
    await fs.symlink(relativePath, certsLink, 'junction'); // 'junction' is used for cross-platform compatibility
  }
};

// Execute the functions
const main = async () => {
  await createCertsDirectory();
  await installUbiqServerDependencies();
  await createCertsSymlink();
};

main().catch((err) => {
  console.error('Postinstall script failed:', err);
  process.exit(1);
});