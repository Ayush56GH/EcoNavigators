"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, Eye, EyeOff } from 'lucide-react';
import AuthLayout from '@/app/(auth)/layout';
import { loginUser } from '@/services/api';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });

  const [showPassword, setShowPassword] = useState(false);
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

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser(formData.email, formData.password);

      if (typeof window !== 'undefined') {
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          document.cookie = `auth_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
        }
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }

      // Immediately redirect to dashboard upon successful authentication
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Unable to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <header className="signup-header">
        <Link href="/" className="signup-logo">
          <Compass size={28} color="#00d7b2" />
          <span>EcoNavigators</span>
        </Link>
      </header>

      <div className="signup-card">
        <h1 className="signup-title">Log In</h1>
        <p className="signup-subtitle">
          Access your dashboard to monitor marine intelligence.
        </p>

        <form className="signup-form" onSubmit={handleSubmit}>
          {error && <div className="form-error-alert">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className="form-input"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-terms flex items-center justify-between">
            <label className="terms-label">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                checked={formData.remember}
                onChange={handleChange}
                className="terms-checkbox"
              />
              <span>Remember me</span>
            </label>
            <Link href="/forgot-password" className="link-terms text-sm">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="btn-primary-action" disabled={loading}>
            {loading ? 'Authenticating...' : 'Log In'}
          </button>
          <div className="signup-footer-text">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="login-link">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
