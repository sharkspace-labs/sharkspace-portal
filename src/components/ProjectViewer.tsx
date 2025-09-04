import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, ShieldOff, Loader, AlertTriangle, CheckCircle, ServerCrash } from 'lucide-react';

type Status = 'checking' | 'unsupported' | 'insecure' | 'loading' | 'decrypting' | 'error' | 'success';

// --- Helper to convert a hex string to a Uint8Array ---
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16));
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  bytes.forEach((byte, i) => view[i] = byte);
  return view;
}

// --- BROWSER-COMPATIBLE HELPER to concatenate Uint8Arrays ---
function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const buffer = new ArrayBuffer(a.length + b.length);
  const result = new Uint8Array(buffer);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

// --- The Core Decryption Logic (Browser-Compatible) ---
async function decryptProject(password: string, encryptedDataBlob: string): Promise<string> {
  const KEY_DERIVATION_ITERATIONS = 120000;
  
  // --- First Decryption (Blob -> JSON) ---
  const [jsonSaltHex, jsonIvHex, jsonAuthTagHex, encryptedJsonHex] = encryptedDataBlob.split('.');
  
  const jsonSalt = hexToUint8Array(jsonSaltHex);
  const jsonIv = hexToUint8Array(jsonIvHex);
  const jsonAuthTag = hexToUint8Array(jsonAuthTagHex);
  const encryptedJson = hexToUint8Array(encryptedJsonHex);

  const jsonKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: jsonSalt as BufferSource, iterations: KEY_DERIVATION_ITERATIONS, hash: "SHA-256" },
    await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const combinedJsonBuffer = concatUint8Arrays(encryptedJson, jsonAuthTag);

  const decryptedJsonBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: jsonIv as BufferSource },
    jsonKey,
    combinedJsonBuffer as BufferSource
  );

  const projectData = JSON.parse(new TextDecoder().decode(decryptedJsonBuffer));

  // --- Second Decryption (JSON -> HTML) ---
  const { salt: htmlSaltHex, iv: htmlIvHex, authTag: htmlAuthTagHex, ciphertext: htmlCiphertextHex } = projectData;
  
  const htmlSalt = hexToUint8Array(htmlSaltHex);
  const htmlIv = hexToUint8Array(htmlIvHex);
  const htmlAuthTag = hexToUint8Array(htmlAuthTagHex);
  const encryptedHtml = hexToUint8Array(htmlCiphertextHex);
  
  const htmlKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: htmlSalt as BufferSource, iterations: KEY_DERIVATION_ITERATIONS, hash: "SHA-256" },
    await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const combinedHtmlBuffer = concatUint8Arrays(encryptedHtml, htmlAuthTag);

  const decryptedHtmlBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: htmlIv as BufferSource },
    htmlKey,
    combinedHtmlBuffer as BufferSource
  );

  return new TextDecoder().decode(decryptedHtmlBuffer);
}

export function ProjectViewer() {
  const [status, setStatus] = useState<Status>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      if (!crypto?.subtle) return setStatus('unsupported');
      if (!window.isSecureContext) return setStatus('insecure');

      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('id');
      const password = params.get('pwd');

      if (!projectId || !password) {
        setErrorMessage('Project ID or password missing from URL.');
        return setStatus('error');
      }

      try {
        setStatus('loading');
        const response = await fetch(`/projects/${projectId}/data.enc`);
        if (response.status === 404) {
          setErrorMessage(`A project with the ID '${projectId}' could not be found.`);
          return setStatus('error');
        }
        if (!response.ok) throw new Error('Failed to fetch project data.');

        const encryptedDataBlob = await response.text();
        
        setStatus('decrypting');
        const decryptedHtml = await decryptProject(password, encryptedDataBlob);

        const blob = new Blob([decryptedHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setIframeSrc(url);
        setStatus('success');

      } catch (err) {
        console.error("Decryption failed:", err);
        setErrorMessage("Decryption failed. Please double-check your password and Project ID.");
        setStatus('error');
      }
    };

    loadProject();

    return () => {
      if (iframeSrc) URL.revokeObjectURL(iframeSrc);
    };
  }, []);


  const renderStatus = () => {
    switch (status) {
      case 'unsupported':
        return <StatusDisplay icon={<ShieldOff/>} title="Unsupported Browser" message="The Web Crypto API is required. Please use a modern browser like Chrome, Firefox, or Safari."/>;
      case 'insecure':
        return <StatusDisplay icon={<WifiOff/>} title="Insecure Connection" message="Decryption requires a secure (HTTPS) connection to protect your credentials."/>;
      case 'loading':
        return <StatusDisplay icon={<Loader className="animate-spin"/>} title="Loading Project Data..."/>;
      case 'decrypting':
        return <StatusDisplay icon={<Loader className="animate-spin"/>} title="Decrypting Project..."/>;
      case 'error':
        return <StatusDisplay icon={<AlertTriangle/>} title="Access Denied" message={errorMessage} isError={true}/>;
      default:
        return null;
    }
  }

  return (
    // --- MODIFICATION START ---
    // The main container is now a flex column with a fixed height of 100vh.
    // Padding constrains the content within the viewport.
    // Conditional classes center the status messages, but are removed for the iframe.
    <div className={`h-screen flex flex-col p-4 sm:p-6 md:p-8 bg-base text-text-body overflow-hidden ${status !== 'success' ? 'justify-center items-center' : ''}`}>
      <AnimatePresence>
        {status !== 'success' && (
          <motion.div
            key="status"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {renderStatus()}
          </motion.div>
        )}
      </AnimatePresence>

      {iframeSrc && (
        // The iframe fades in and, because its parent is a flex container,
        // it will automatically fill the available padded space.
        <motion.iframe
          key="project-iframe"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          src={iframeSrc}
          title="Client Project Viewer"
          className="w-full h-full border-4 border-primary/50 rounded-lg bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      )}
    </div>
    // --- MODIFICATION END ---
  );
}

const StatusDisplay = ({ icon, title, message = '', isError = false }: { icon: React.ReactNode; title: string; message?: string; isError?: boolean }) => (
  <div className={`flex flex-col items-center gap-4 text-center p-8 max-w-lg rounded-lg ${isError ? 'bg-red-500/5' : ''}`}>
    <div className={isError ? 'text-red-400' : 'text-primary'}>{icon}</div>
    <h2 className={`text-2xl font-display font-bold ${isError ? 'text-red-300' : 'text-text-heading'}`}>{title}</h2>
    {message && <p className="text-text-body">{message}</p>}
  </div>
);