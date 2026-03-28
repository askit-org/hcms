import { motion } from 'framer-motion';

export default function PageTransition({ 
  children, 
  className = '',
  style
}: { 
  children: React.ReactNode, 
  className?: string,
  style?: React.CSSProperties
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ 
        duration: 0.3,
        ease: "easeOut"
      }}
    >
      {children}
    </motion.div>
  );
}
