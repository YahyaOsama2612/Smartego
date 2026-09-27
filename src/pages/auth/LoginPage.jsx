import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, AlertCircle, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginDemo, isAuthenticated, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: true,
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Destination after login
  const from = location.state?.from?.pathname || '/dashboard';

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error for edited field
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    try {
      await login({
        email: formData.email.trim(),
        password: formData.password,
        remember: formData.remember,
      });
      setSuccessMessage('Authentication successful! Redirecting...');
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 500);
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        // Map backend errors (e.g., Laravel errors object)
        const mapped = {};
        Object.entries(err.fieldErrors).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        });
        setFieldErrors(mapped);
      }
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    }
  };

 
  return (
    <div className="login-container">
      {/* Background ambient lighting */}
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      <div className="login-card-wrapper">
        <div className="login-card">
          {/* Brand header */}
          <div className="login-brand-section">
            <div className="login-logo-container">
              <ShieldCheck size={32} className="login-logo-icon" />
            </div>
            <h1 className="login-title">Smartego Admin</h1>
           
          </div>

       

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="login-alert alert-error">
              <AlertCircle size={18} className="alert-icon" />
              <div className="alert-text">{errorMessage}</div>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="login-alert alert-success">
              <CheckCircle size={18} className="alert-icon" />
              <div className="alert-text">{successMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <Input
              id="login-email"
              label="Email Address"
              name="email"
              type="email"
              icon={Mail}
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@smartego.com"
              error={fieldErrors.email}
              autoComplete="email"
              required
            />

            <Input
              id="login-password"
              label="Password"
              name="password"
              type="password"
              icon={Lock}
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••••••"
              error={fieldErrors.password}
              autoComplete="current-password"
              required
            />

            <div className="form-meta-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="remember"
                  checked={formData.remember}
                  onChange={handleChange}
                  className="custom-checkbox"
                />
                <span>Remember this session</span>
              </label>

        
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="login-submit-btn"
              isLoading={isLoading}
              icon={ArrowRight}
            >
              Sign In to Admin Portal
            </Button>
          </form>

          {/* Demo helper card */}
      
        </div>

        {/* Footer info */}
        <div className="login-footer">
          <span>&copy; {new Date().getFullYear()} Smartego. High-Security Enterprise Admin Console.</span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
