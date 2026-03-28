import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({ 
  title = 'Something went wrong',
  message = 'We encountered an error loading this data.',
  onRetry
}: { 
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        background: 'rgba(239, 68, 68, 0.05)',
        maxWidth: 500,
        margin: '0 auto',
        marginTop: 40
      }}
    >
      <motion.div
        animate={{ rotate: [-2, 2, -2, 2, 0] }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <AlertCircle size={48} color="var(--red)" style={{ marginBottom: 16 }} />
      </motion.div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
        {message}
      </p>
      
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          <RefreshCw size={16} /> Try Again
        </button>
      )}
    </motion.div>
  );
}
