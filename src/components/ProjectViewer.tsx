import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, ShieldOff, Loader, AlertTriangle, CheckCircle, ServerCrash } from 'lucide-react';
import untar from "js-untar";

type Status = 'checking' | 'unsupported' | 'insecure' | 'registering_sw' | 'loading' | 'decrypting' | 'unpacking' | 'error' | 'success';

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
async function decryptPackage(password: string, encryptedDataBlob: string): Promise<ArrayBuffer> {
    const KEY_DERIVATION_ITERATIONS = 120000;
    const [saltHex, ivHex, authTagHex, encryptedArchiveHex] = encryptedDataBlob.split('.');

    const salt = hexToUint8Array(saltHex);
    const iv = hexToUint8Array(ivHex);
    const authTag = hexToUint8Array(authTagHex);
    const encryptedArchive = hexToUint8Array(encryptedArchiveHex);

    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt as BufferSource, iterations: KEY_DERIVATION_ITERATIONS, hash: "SHA-256" },
        await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]),
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const combinedBuffer = concatUint8Arrays(encryptedArchive, authTag);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, combinedBuffer as BufferSource);
}

const SCOPE_PREFIX = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/portal-scope/`;

export function ProjectViewer() {
    const [status, setStatus] = useState<Status>('checking');
    const [errorMessage, setErrorMessage] = useState('');
    const [iframeSrc, setIframeSrc] = useState<string | null>(null);
    const basePath = import.meta.env.BASE_URL;

    useEffect(() => {
        const loadProject = async () => {
            // 1. Prerequisite Checks
            if (!crypto?.subtle) return setStatus('unsupported');
            if (!('serviceWorker' in navigator)) return setStatus('unsupported');
            if (!window.isSecureContext) return setStatus('insecure');

            // 2. Register the Service Worker
            try {
                setStatus('registering_sw');
                const swUrl = `${basePath.replace(/\/$/, '')}/sw.js`;
                const registration = await navigator.serviceWorker.register(swUrl);
                await navigator.serviceWorker.ready;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Give SW time to initialize
                if (registration.active) {
                    console.log('Service Worker is active.');
                }
            } catch (error) {
                setErrorMessage('Could not register the service worker, which is required for project routing.');
                return setStatus('error');
            }

            // 3. Get credentials from URL
            const params = new URLSearchParams(window.location.search);
            const projectId = params.get('id');
            const password = params.get('pwd');

            if (!projectId || !password) {
                setErrorMessage('Project ID or password missing from URL.');
                return setStatus('error');
            }

            try {
                // 4. Fetch and Decrypt Package
                setStatus('loading');
                const pkgUrl = `${basePath.replace(/\/$/, '')}/projects/${projectId}/data.pkg`;
                const response = await fetch(pkgUrl);
                if (!response.ok) throw new Error(`Project '${projectId}' not found.`);
                const encryptedDataBlob = await response.text();

                setStatus('decrypting');
                const decryptedTarBuffer = await decryptPackage(password, encryptedDataBlob);

                // 5. Unpack the TAR archive
                setStatus('unpacking');

                const baseTag = `<base href="${SCOPE_PREFIX}">`;
                const linkFixerRegex = /(href|src)=["']\/([^/][^"']*)["']/g;

                const files = await untar(decryptedTarBuffer); // untar.js returns a promise
                const fileMap = new Map<string, Blob>();
                files.forEach(file => {

                    if (file.name.endsWith('.html') || file.name.endsWith('.css')) {
                        let contentAsString = new TextDecoder().decode(file.buffer);

                        // Dynamically convert root-relative paths to relative paths
                        contentAsString = contentAsString.replace(linkFixerRegex, '$1="$2"');

                        if (file.name.endsWith('.html')) {
                            // Inject the <base> tag right after the opening <head> tag
                            contentAsString = contentAsString.replace(/<head[^>]*>/i, `$&${baseTag}`);
                        }

                        file.buffer = new TextEncoder().encode(contentAsString);
                    }


                    const normalizedPath = file.name.replace(/^\.\//, '');
                    console.log(`Unpacked: ${normalizedPath}`);
                    // Create a Blob with the correct MIME type if possible
                    const mimeType = getMimeType(file.name);
                    fileMap.set(normalizedPath, new Blob([file.buffer], { type: mimeType }));
                });

                // 6. Use a MessageChannel for direct communication with the Service Worker
                const messageChannel = new MessageChannel();

                // 7. Listen for a confirmation message from the SW
                messageChannel.port1.onmessage = (event) => {
                    if (event.data && event.data.type === 'FILE_MAP_SET') {
                        console.log('[ProjectViewer] Service Worker has confirmed receipt of the file map.');
                        // 8. Set the iframe source to the entry point within our virtual scope
                        setIframeSrc(SCOPE_PREFIX + 'index.html');
                        setStatus('success');
                        messageChannel.port1.close(); // Clean up the port
                    }
                };

                // 9. Send the file map to the active Service Worker
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage(
                        {
                            type: 'SET_FILE_MAP',
                            fileMap: fileMap,
                        },
                        [messageChannel.port2] // Transfer port2 to the service worker
                    );
                } else {
                    throw new Error("Service worker is not active or not controlling the page.");
                }




            } catch (err) {
                console.error("Process failed:", err);
                setErrorMessage("Decryption or unpacking failed. Please check credentials and package integrity.");
                setStatus('error');
            }
        };

        loadProject();
    }, []);

    const getMimeType = (filename: string): string => {
        if (filename.endsWith('.html')) return 'text/html';
        if (filename.endsWith('.css')) return 'text/css';
        if (filename.endsWith('.js')) return 'application/javascript';
        if (filename.endsWith('.png')) return 'image/png';
        if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
        if (filename.endsWith('.svg')) return 'image/svg+xml';
        return 'application/octet-stream';
    };

    // The renderStatus switch and JSX are updated for new statuses
    const renderStatus = () => {
        switch (status) {
            case 'unsupported':
                return <StatusDisplay icon={<ShieldOff />} title="Unsupported Browser" message="This feature requires a modern browser with Service Worker and Web Crypto API support." />;
            case 'insecure':
                return <StatusDisplay icon={<WifiOff />} title="Insecure Connection" message="Secure project viewing requires an HTTPS connection." />;
            case 'registering_sw':
                return <StatusDisplay icon={<Loader className="animate-spin" />} title="Initializing Secure Environment..." />;
            case 'loading':
                return <StatusDisplay icon={<Loader className="animate-spin" />} title="Loading Project Package..." />;
            case 'decrypting':
                return <StatusDisplay icon={<Loader className="animate-spin" />} title="Decrypting Package..." />;
            case 'unpacking':
                return <StatusDisplay icon={<Loader className="animate-spin" />} title="Unpacking Project Files..." />;
            case 'error':
                return <StatusDisplay icon={<AlertTriangle />} title="An Error Occurred" message={errorMessage} isError={true} />;
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