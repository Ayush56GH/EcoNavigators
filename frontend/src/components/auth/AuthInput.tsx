"use client";

import { Eye, EyeOff } from 'lucide-react';
import React from 'react';

interface AuthInputProps {
  id: string;
  name: string;
  type?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showToggle?: boolean;
  toggleState?: boolean;
  onToggle?: () => void;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  id,
  name,
  type = 'text',
  label,
  placeholder,
  value,
  onChange,
  showToggle = false,
  toggleState = false,
  onToggle,
}) => {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <div className="password-input-wrapper">
        <input
          id={id}
          name={name}
          type={showToggle ? (toggleState ? 'text' : 'password') : type}
          required
          placeholder={placeholder}
          className="form-input"
          value={value}
          onChange={onChange}
        />
        {showToggle && onToggle && (
          <button
            type="button"
            className="password-toggle-btn"
            onClick={onToggle}
            aria-label={toggleState ? 'Hide password' : 'Show password'}
          >
            {toggleState ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
