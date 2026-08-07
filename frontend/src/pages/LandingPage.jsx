import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, GitBranch, Brain, Clock, BarChart2, Shield, ChevronRight, Rocket } from 'lucide-react';
import { getNodeIcon } from '../constants/Icons';

const features = [
  {
    icon: <GitBranch size={22} />,
    title: 'Visual Drag & Drop Builder',
    desc: 'Craft complex workflows visually. Connect triggers, actions, and logic gates with an intuitive canvas.',
    color: '#6c63ff',
  },
  {
    icon: <Brain size={22} />,
    title: 'AI Workflow Generation',
    desc: 'Describe your automation in plain English. Our AI generates a ready-to-run workflow in seconds.',
    color: '#22d3ee',
  },
  {
    icon: <Clock size={22} />,
    title: 'Smart Scheduling',
    desc: 'Schedule workflows to run on a cron schedule, trigger via webhook, or run manually on demand.',
    color: '#22c55e',
  },
  {
    icon: <BarChart2 size={22} />,
    title: 'Execution Monitoring',
    desc: 'Track every step of every run with detailed logs, timings, and error reports in real-time.',
    color: '#f59e0b',
  },
  {
    icon: <Zap size={22} />,
    title: 'Service Connectors',
    desc: 'Connect to HTTP APIs, email services, and more via plug-and-play connector modules.',
    color: '#ec4899',
  },
  {
    icon: <Shield size={22} />,
    title: 'Secure & Scalable',
    desc: 'JWT authentication, user isolation, and modular architecture built for growth.',
    color: '#a78bfa',
  },
];

const steps = [
  { num: '01', title: 'Create a Workflow', desc: 'Click "New Workflow" or describe it to our AI assistant.' },
  { num: '02', title: 'Configure Nodes', desc: 'Add triggers, actions, and logic. Configure each node with your settings.' },
  { num: '03', title: 'Run & Monitor', desc: 'Execute your workflow and watch real-time logs for every step.' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Navbar */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '64px',
        background: 'rgba(10,11,15,0.8)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div className="flex items-center gap-2">
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="#fff" />
          </div>
          <span className="font-display font-bold text-lg">LogicBridge</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-bg" style={{ padding: '100px 40px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background orbs */}
        <div style={{
          position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="animate-fade-in" style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="badge badge-primary" style={{ fontSize: '0.8rem', padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Rocket size={13} /> Team MP_022 · Minor Project
            </span>
          </div>
          <h1 className="font-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
            Automate Anything with<br />
            <span className="gradient-text">Intelligent Workflows</span>
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto 40px' }}>
            LogicBridge combines a visual drag-and-drop builder with AI-powered generation to make workflow automation accessible to everyone.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register" className="btn btn-primary btn-lg animate-pulse-glow">
              Start Building Free <ChevronRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              View Demo
            </Link>
          </div>
        </div>

        {/* Hero visual */}
        <div className="animate-fade-in" style={{ marginTop: 60, position: 'relative', zIndex: 1, animationDelay: '0.2s' }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '8px', maxWidth: 800, margin: '0 auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(108,99,255,0.1)',
          }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 14, height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
              {[
                { type: 'trigger-manual', label: 'Manual Trigger', color: '#22c55e', typeName: 'Trigger' },
                { type: 'action-http',    label: 'HTTP Request',   color: '#6c63ff', typeName: 'Action'  },
                { type: 'logic-condition',label: 'Condition',      color: '#f59e0b', typeName: 'Logic'   },
                { type: 'action-email',   label: 'Send Email',     color: '#22d3ee', typeName: 'Action'  },
              ].map((node, i) => {
                const HeroIcon = getNodeIcon(node.type);
                return (
                  <React.Fragment key={node.label}>
                    <div style={{
                      background: 'var(--bg-card)', border: `1.5px solid ${node.color}40`,
                      borderRadius: 12, padding: '12px 16px', minWidth: 140,
                      boxShadow: `0 0 20px ${node.color}20`,
                      transition: 'transform 0.3s',
                      animationDelay: `${i * 0.1}s`,
                    }} className="animate-fade-in">
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: `${node.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: node.color, marginBottom: 8,
                      }}>
                        <HeroIcon size={18} />
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{node.label}</div>
                      <div style={{ fontSize: '0.7rem', color: node.color, marginTop: 2 }}>{node.typeName}</div>
                    </div>
                    {i < 3 && (
                      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ width: 30, height: 2, background: `linear-gradient(90deg, ${['#22c55e','#6c63ff','#f59e0b'][i]}, ${['#6c63ff','#f59e0b','#22d3ee'][i]})`, borderRadius: 1 }} />
                        <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `7px solid ${['#6c63ff','#f59e0b','#22d3ee'][i]}` }} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="text-center mb-6">
          <h2 className="font-display" style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: 12 }}>
            Everything you need to automate
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
            A powerful platform built for both developers and non-technical users
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginTop: 40 }}>
          {features.map((f) => (
            <div key={f.title} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                background: `${f.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: f.color,
              }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '60px 40px', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 12 }}>How LogicBridge Works</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 48 }}>From idea to automation in 3 simple steps</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {steps.map((s) => (
              <div key={s.num}>
                <div className="gradient-text font-display" style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 8 }}>{s.num}</div>
                <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 16 }}>
            Ready to bridge the gap?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            Join LogicBridge and start automating your workflows in minutes — no code required.
          </p>
          <Link to="/register" className="btn btn-primary btn-lg animate-pulse-glow">
            Create Free Account <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex items-center gap-2">
          <Zap size={16} color="#6c63ff" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>LogicBridge · Team MP_022 · 2024</span>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Minor Project — Software Engineering & AI</span>
      </footer>
    </div>
  );
}
