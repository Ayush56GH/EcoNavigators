"use client";

import React from 'react';

interface AuthFormProps {
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  title,
  onSubmit,
  children,
  submitLabel = 'Submit',
  isSubmitting = false,
}) => {
  return (
    <form onSubmit={onSubmit} className="signup-form">
      {children}
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          backgroundColor: '#00d7b2',
          color: '#070e17',
        }}
        className="btn-primary-action"
      >
        {isSubmitting ? 'Processing…' : submitLabel}
      </button>
    </form>
  );
};
