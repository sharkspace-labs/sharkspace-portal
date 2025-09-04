import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, LogIn, Info, Layers, Lightbulb, ShieldCheck, User } from 'lucide-react';

// --- Sub-component for the Login Form (with inline errors) ---
const LoginForm = () => {
  const [error, setError] = useState<string>('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const projectId = (form.elements.namedItem('projectId') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    if (!projectId || !password) {
      setError("All fields are required.");
      return;
    }

    // Clear any previous error before redirecting
    setError('');

    // Set the cookie as requested
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = `lastPresent=${new Date().toISOString()}; expires=${oneYearFromNow.toUTCString()}; path=/`;
    
    // Redirect to the portal page with credentials in the query string
    window.location.href = `/sharkspace-portal/portal?id=${encodeURIComponent(projectId)}&pwd=${encodeURIComponent(password)}`;
  };

  return (
    <motion.div
      key="login"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <h1 className="text-3xl md:text-4xl font-display font-bold text-text-heading text-center mb-2">
        Client Portal
      </h1>
      <p className="text-text-body text-center mb-8">
        Enter your credentials to review your project build.
      </p>

      {/* The form now includes the animated error message container */}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden" // Important for the height animation
            >
              <p className="bg-red-500/10 text-red-300 text-sm rounded-md p-3 text-center border border-red-500/20">
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          name="projectId"
          type="text"
          placeholder="Project ID"
          className="w-full bg-base/50 border border-white/20 rounded-md px-4 py-3 text-text-body placeholder-text-body/50 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="w-full bg-base/50 border border-white/20 rounded-md px-4 py-3 text-text-body placeholder-text-body/50 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
          required
        />
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/30 hover:bg-opacity-90 transition-all duration-300 transform hover:scale-105"
        >
          Access Project
          <LogIn size={20} />
        </button>
      </form>
    </motion.div>
  );
};

// --- Sub-component for the Marketing/Info View ---
const MarketingInfo = () => (
  <motion.div
    key="info"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.5, ease: 'easeInOut' }}
    className="text-center"
  >
    <div className="flex justify-center mb-4">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary">
        <User size={32} className="text-secondary" />
      </div>
    </div>
    <h2 className="text-3xl font-display font-bold text-text-heading mb-2">What is SharkSpace Labs?</h2>
    <p className="text-text-body max-w-2xl mx-auto mb-8">
      We are a modern development partner dedicated to building high-quality, innovative digital solutions. We turn your vision into reality with a process built on transparency, quality, and partnership.
    </p>
    <div className="grid sm:grid-cols-3 gap-6 text-left">
      <div className="space-y-1"><Layers className="text-primary mb-1"/> <h3 className="font-bold text-text-heading">Transparent Process</h3></div>
      <div className="space-y-1"><Lightbulb className="text-primary mb-1"/> <h3 className="font-bold text-text-heading">Innovative Solutions</h3></div>
      <div className="space-y-1"><ShieldCheck className="text-primary mb-1"/> <h3 className="font-bold text-text-heading">Quality First</h3></div>
    </div>
    <a href="mailto:hello.sharkspace@gmail.com" className="inline-block mt-8 text-primary font-bold hover:underline">
      hello.sharkspace@gmail.com
    </a>
  </motion.div>
);

// --- The Main Component ---
export function PortalView() {
  const [isPortalView, setIsPortalView] = useState(true);

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center p-4 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-[80vw] h-[80vh] md:w-[700px] md:h-[700px] bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
      </div>
      <motion.div
        layout
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 w-full max-w-md p-8 rounded-2xl border border-white/10"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <AnimatePresence mode="wait">
          {isPortalView ? <LoginForm /> : <MarketingInfo />}
        </AnimatePresence>
      </motion.div>
      <motion.button
        onClick={() => setIsPortalView(!isPortalView)}
        className="relative z-10 flex items-center gap-2 mt-8 px-4 py-2 text-text-body hover:text-text-heading transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isPortalView ? (
          <> <Info size={16} /> What is this? </>
        ) : (
          <> <ArrowRight size={16} /> Back to Client Portal </>
        )}
      </motion.button>
    </div>
  );
}