import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, User, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    const ok = await register(name, email, password);
    if (ok) {
      toast.success('Account created! 🎉');
      navigate('/dashboard');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 40% 50%, rgba(34,211,238,0.08) 0%, transparent 60%), var(--bg-base)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }} className="animate-fade-in">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#fff" />
          </div>
          <span className="font-display font-bold text-xl">LogicBridge</span>
        </Link>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <h1 className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>Create your account</h1>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 28, fontSize: '0.9rem' }}>
            Start automating workflows for free
          </p>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, marginBottom: 20, color: 'var(--accent-danger)', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="reg-name" type="text" className="form-input" style={{ paddingLeft: 40 }} placeholder="Your Name"
                  value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="reg-email" type="email" className="form-input" style={{ paddingLeft: 40 }} placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(min. 6 chars)</span></label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="reg-password" type={showPass ? 'text' : 'password'} className="form-input" style={{ paddingLeft: 40, paddingRight: 40 }} placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button id="reg-submit" type="submit" className="btn btn-primary w-full" style={{ marginTop: 4 }} disabled={isLoading}>
              {isLoading ? <><span className="spinner" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <div className="divider" style={{ margin: '20px 0' }} />
          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
