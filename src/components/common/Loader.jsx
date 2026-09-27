import { Loader2 } from 'lucide-react';

export function Loader({ size = 32, text = 'Loading...', fullScreen = false }) {
  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px',
        color: 'var(--text-secondary)',
      }}
    >
      <Loader2
        size={size}
        style={{
          animation: 'spin 1s linear infinite',
          color: 'var(--primary)',
        }}
      />
      {text && <span style={{ fontSize: '14px', fontWeight: 500 }}>{text}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-dark)',
          zIndex: 9999,
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}

export default Loader;
