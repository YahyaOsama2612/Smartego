import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';
import Button from '../../components/common/Button';

export function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HelpCircle size={36} />
      </div>
      <h2 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
        404 - Page Not Found
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', fontSize: '14px' }}>
        The administrative route you requested does not exist or has been moved.
      </p>
      <Link to="/dashboard" style={{ marginTop: '12px' }}>
        <Button variant="primary" icon={ArrowLeft}>
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}

export default NotFoundPage;
