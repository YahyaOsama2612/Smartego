import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Input.css';

export function Input({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  error,
  icon: Icon,
  required = false,
  disabled = false,
  helperText,
  className = '',
  autoComplete,
  id,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || name || `input-${Math.random().toString(36).substring(2, 9)}`;
  const isPassword = type === 'password';
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`form-field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label} {required && <span className="required-star">*</span>}
        </label>
      )}

      <div className="input-wrapper">
        {Icon && (
          <span className="input-icon-left">
            <Icon size={18} />
          </span>
        )}

        <input
          id={inputId}
          name={name}
          type={resolvedType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`input-control ${Icon ? 'with-left-icon' : ''} ${isPassword ? 'with-right-icon' : ''}`}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            className="input-icon-right-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error ? (
        <p className="form-error-msg">{error}</p>
      ) : helperText ? (
        <p className="form-helper-msg">{helperText}</p>
      ) : null}
    </div>
  );
}

export default Input;
