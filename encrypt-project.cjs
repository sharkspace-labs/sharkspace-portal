// A script to encrypt project data for SharkSpace Labs client portal.
// Usage: node encrypt-project.js <projectId> <password> <htmlFilePath>

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const KEY_DERIVATION_ITERATIONS = 120000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ALGORITHM = 'aes-256-gcm';

// --- Main Function ---
async function encryptProject() {
  // 1. Get arguments from command line
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error('Usage: node encrypt-project.js <projectId> <password> <htmlFilePath>');
    process.exit(1);
  }
  const [projectId, password, htmlFilePath] = args;

  // 2. Read the HTML file content
  let htmlContent;
  try {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
  } catch (error) {
    console.error(`Error reading HTML file: ${error.message}`);
    process.exit(1);
  }

  // --- First Encryption (HTML -> Ciphertext) ---
  const htmlSalt = crypto.randomBytes(SALT_BYTES);
  const htmlIv = crypto.randomBytes(IV_BYTES);
  const htmlKey = crypto.pbkdf2Sync(password, htmlSalt, KEY_DERIVATION_ITERATIONS, 32, 'sha256');

  const htmlCipher = crypto.createCipheriv(ALGORITHM, htmlKey, htmlIv);
  const encryptedHtml = Buffer.concat([htmlCipher.update(htmlContent, 'utf8'), htmlCipher.final()]);
  const htmlAuthTag = htmlCipher.getAuthTag();

  // 3. Prepare the JSON payload
  const jsonData = {
    salt: htmlSalt.toString('hex'),
    iv: htmlIv.toString('hex'),
    authTag: htmlAuthTag.toString('hex'),
    ciphertext: encryptedHtml.toString('hex'),
  };

  // --- Second Encryption (JSON -> Final Ciphertext) ---
  // We use a different salt for the second layer for added security.
  const jsonSalt = crypto.randomBytes(SALT_BYTES);
  const jsonIv = crypto.randomBytes(IV_BYTES);
  const jsonKey = crypto.pbkdf2Sync(password, jsonSalt, KEY_DERIVATION_ITERATIONS, 32, 'sha256');

  const jsonCipher = crypto.createCipheriv(ALGORITHM, jsonKey, jsonIv);
  const jsonString = JSON.stringify(jsonData);
  const encryptedJson = Buffer.concat([jsonCipher.update(jsonString, 'utf8'), jsonCipher.final()]);
  const jsonAuthTag = jsonCipher.getAuthTag();

  // 4. Combine all parts into a single string for storage
  // Format: jsonSalt.jsonIv.jsonAuthTag.encryptedJson (hex encoded)
  const finalEncryptedData = [
    jsonSalt.toString('hex'),
    jsonIv.toString('hex'),
    jsonAuthTag.toString('hex'),
    encryptedJson.toString('hex'),
  ].join('.');

  // 5. Write the final encrypted data to a file
  const outputDir = path.join('public', 'projects', projectId);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'data.enc');
  fs.writeFileSync(outputPath, finalEncryptedData);

  console.log(`✅ Success! Encrypted project data written to: ${outputPath}`);
}

encryptProject();