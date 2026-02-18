import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const redirectPath = user.role === 'instructor' ? '/instructor/dashboard' : '/student/dashboard';
      navigate(redirectPath, { replace: true });
    }
  }, [user, navigate]);

  const validateInput = () => {
    if (!email || email.trim().length === 0) {
      setError('Email is required');
      return false;
    }
    if (!password || password.length === 0) {
      setError('Password is required');
      return false;
    }
    if (email.length > 255) {
      setError('Email too long');
      return false;
    }
    if (password.length > 128) {
      setError('Password too long');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateInput()) return;

    setLoading(true);
    try {
      const response = await api.login({ email: email.trim(), password });
      if (!response || !response.token || !response.user) {
        throw new Error('Invalid server response');
      }
      login(response.user, response.token);
      const redirectPath = response.user.role === 'instructor' ? '/instructor/dashboard' : '/student/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              maxLength={255}
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              maxLength={128}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
