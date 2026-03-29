export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background shapes */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, var(--accent) 0%, transparent 60%)',
        opacity: 0.1, filter: 'blur(80px)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-5%', width: '30vw', height: '30vw',
        background: 'radial-gradient(circle, var(--blue) 0%, transparent 60%)',
        opacity: 0.08, filter: 'blur(60px)', pointerEvents: 'none'
      }} />
      
      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
