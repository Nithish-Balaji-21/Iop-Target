import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import './Login.css';

// Custom Eye Logo SVG Component
const EyeLogo = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="eyeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00CED1" />
                <stop offset="50%" stopColor="#008B8B" />
                <stop offset="100%" stopColor="#006666" />
            </linearGradient>
            <linearGradient id="irisGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#20B2AA" />
                <stop offset="100%" stopColor="#008080" />
            </linearGradient>
        </defs>
        {/* Outer eye shape */}
        <path
            d="M32 12C18 12 6 32 6 32C6 32 18 52 32 52C46 52 58 32 58 32C58 32 46 12 32 12Z"
            fill="url(#eyeGradient)"
            stroke="#006666"
            strokeWidth="2"
        />
        {/* White of the eye */}
        <ellipse cx="32" cy="32" rx="16" ry="14" fill="white" />
        {/* Iris */}
        <circle cx="32" cy="32" r="10" fill="url(#irisGradient)" />
        {/* Pupil */}
        <circle cx="32" cy="32" r="5" fill="#1a1a2e" />
        {/* Light reflection */}
        <circle cx="35" cy="29" r="2.5" fill="white" opacity="0.9" />
        <circle cx="29" cy="34" r="1" fill="white" opacity="0.5" />
    </svg>
);

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        // Simulate login for any input - just need doctor name
        if (username) {
            onLogin(username);
        }
    };

    return (
        <div className="login-page">
            <div className="login-header">
                Aravind Eye Hospitals & PG Institute of Ophthalmology
            </div>

            <div className="login-content">
                <div className="login-card">
                    {/* Login Form */}
                    <div className="login-form-section">
                        <div className="app-logo">
                            <EyeLogo size={56} />
                            <span className="logo-text">i-Target</span>
                        </div>

                        <form onSubmit={handleLogin} style={{ width: '100%' }}>
                            <div className="form-group">
                                <User size={18} className="input-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <button type="submit" className="login-btn">
                                Login
                            </button>

                            <div className="text-center or-divider">OR</div>

                            <button type="button" className="google-btn">
                                Login Using Google
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
