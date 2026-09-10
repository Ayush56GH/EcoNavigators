"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Compass } from 'lucide-react';
import AuthLayout from '@/app/(auth)/layout';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthInput } from '@/components/auth/AuthInput';
import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { signupUser } from '@/services/api';

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!formData.terms) {
      setError('Please accept the Terms of Service to proceed.');
      return;
    }

    setLoading(true);
    try {
      const data = await signupUser(formData.fullName, formData.email, formData.password);

      if (typeof window !== 'undefined') {
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          document.cookie = `auth_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
        }
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }

      // Immediately redirect to dashboard upon successful account creation
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Unable to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Link href="/" className="back-link">
        <ArrowLeft size={16} />
        <span>Back to Home</span>
      </Link>
      <header className="signup-header">
        <Link href="/" className="signup-logo">
          <Compass size={28} color="#00d7b2" />
          <span>EcoNavigators</span>
        </Link>
      </header>
      <div className="signup-card">
        <h1 className="signup-title">Create Account</h1>
        <p className="signup-subtitle">
          Join the marine intelligence network for real-time oil-spill detection and AIS tracking.
        </p>
        <AuthForm title="" onSubmit={handleSubmit} submitLabel={loading ? "Creating Account..." : "Create Account"}>
            {error && <div className="form-error-alert">{error}</div>}
            <AuthInput
              id="fullName"
              name="fullName"
              label="Full Name"
              placeholder="e.g. Capt. Sarah Jenkins"
              value={formData.fullName}
              onChange={handleChange}
            />
            <AuthInput
              id="email"
              name="email"
              type="email"
              label="Email Address"
              placeholder="sarah@maritime-authority.gov"
              value={formData.email}
              onChange={handleChange}
            />
            <AuthInput
              id="password"
              name="password"
              label="Password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              showToggle={true}
              toggleState={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
            />
            <AuthInput
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              showToggle={true}
              toggleState={showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            />
            <AuthCheckbox
              id="terms"
              name="terms"
              checked={formData.terms}
              onChange={handleChange}
              label={
                <span>
                  I agree to the <a href="#" className="link-terms">Terms of Service</a> and{' '}
                  <a href="#" className="link-terms">Privacy Policy</a>
                </span>
              }
            />
          </AuthForm>
        <div className="signup-footer-text">
          Already have an account?{' '}
          <Link href="/login" className="login-link">
            Log in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
