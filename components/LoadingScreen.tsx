import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export default function LoadingScreen({ message = 'Loading data...' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      minHeight: '400px',
      width: '100%',
    }}>
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7] 
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        style={{
          width: 60,
          height: 60,
          borderRadius: '18px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 30px var(--accent-glow)',
          marginBottom: 24
        }}
      >
        <img src="/icons/logo.png" alt="HCMS Logo" width={60} height={60} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          letterSpacing: '0.5px'
        }}
      >
        {message}
      </motion.div>
    </div>
  );
}
