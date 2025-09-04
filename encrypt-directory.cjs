// A script to package and encrypt a whole project directory.
// Usage: node encrypt-directory.js <projectId> <password> <directoryPath>

const crypto = require('crypto');
const { Writable } = require('stream');
const fs = require('fs');
const path = require('path');
const tar = require('tar');

const KEY_DERIVATION_ITERATIONS = 120000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ALGORITHM = 'aes-256-gcm';

async function createTarBuffer(pack) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const bufferStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    bufferStream.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });

    bufferStream.on('error', reject);

    // Example: Create a tarball from a directory
    pack.pipe(bufferStream);
  });
}


async function encryptDirectory() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error('Usage: node encrypt-directory.js <projectId> <password> <directoryPath>');
    process.exit(1);
  }
  const [projectId, password, directoryPath] = args;

  try {
    // 1. Create a TAR archive of the directory in memory
    console.log(`Archiving directory: ${directoryPath}...`);
    const archiveBuffer = await createTarBuffer(tar.c({ gzip: false, cwd: directoryPath }, ['.']));
    
    // 2. Encrypt the entire TAR buffer
    console.log('Encrypting archive...');
    const salt = crypto.randomBytes(SALT_BYTES);
    const iv = crypto.randomBytes(IV_BYTES);
    const key = crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, 32, 'sha256');

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encryptedArchive = Buffer.concat([cipher.update(archiveBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. Combine parts into a single string for storage
    // Format: salt.iv.authTag.encryptedArchive (hex encoded)
    const finalEncryptedData = [
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      encryptedArchive.toString('hex'),
    ].join('.');

    // 4. Write to file
    const outputDir = path.join('public', 'projects', projectId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'data.pkg'); // Using .pkg extension now
    fs.writeFileSync(outputPath, finalEncryptedData);

    console.log(`✅ Success! Encrypted package written to: ${outputPath}`);

  } catch (error) {
    console.error(`Error during encryption: ${error.message}`);
    throw error;
    process.exit(1);
  }
}

encryptDirectory();