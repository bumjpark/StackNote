import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email_id: '',
        pw: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authApi.login(formData);
            if (response.status === 'success') {
                // Store user_id or token
                // Since backend doesn't return token, we just store user_id for now?
                // Actually client.ts interceptor looks for 'token'.
                // We'll store a dummy token or the user_id as token for now to make requests work if they need auth
                // But the backend `get_db` doesn't check token. It just needs DB.
                // Protected routes might need user_id.
                localStorage.setItem('user_id', String(response.user_id));
                localStorage.setItem('user_email', formData.email_id); // Store email for display
                localStorage.setItem('token', 'dummy-token-since-backend-no-jwt');
                navigate('/workspace');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    // State for Check Email Loop
    const [view, setView] = useState<'login' | 'checkEmail'>('login');
    const [checkEmail, setCheckEmail] = useState('');
    const [checkStatus, setCheckStatus] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const handleCheckEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkEmail) return;

        try {
            const response = await authApi.checkEmail(checkEmail);
            if (response.exists) {
                setCheckStatus({ msg: 'This email is already registered.', type: 'success' });
            } else {
                setCheckStatus({ msg: 'This email is NOT registered.', type: 'error' });
            }
        } catch (err) {
            setCheckStatus({ msg: 'Error checking email.', type: 'error' });
        }
    };

    return (
        <div className="flex-center w-full h-full" style={{ minHeight: '100vh', background: 'radial-gradient(circle at top right, #1e2530 0%, #0f1115 100%)' }}>
            <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>

                {view === 'login' ? (
                    <>
                        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Welcome Back</h2>

                        {error && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <Input
                                label="Email"
                                name="email_id"
                                placeholder="Enter your email"
                                value={formData.email_id}
                                onChange={handleChange}
                                fullWidth
                            />
                            <Input
                                label="Password"
                                name="pw"
                                type="password"
                                placeholder="Enter your password"
                                value={formData.pw}
                                onChange={handleChange}
                                fullWidth
                            />

                            <div style={{ marginTop: '1.5rem' }}>
                                <Button type="submit" fullWidth disabled={loading}>
                                    {loading ? 'Logging in...' : 'Log In'}
                                </Button>
                            </div>
                        </form>

                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                            <Button variant="ghost" size="sm" onClick={() => setView('checkEmail')}>
                                Check Registration (이메일 가입 확인)
                            </Button>
                        </div>

                        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Don't have an account? <Link to="/signup">Sign up</Link>
                        </p>
                    </>
                ) : (
                    // Check Email View
                    <>
                        <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Check Registration</h2>
                        <p style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Enter email to check if it's registered.
                        </p>

                        {checkStatus && (
                            <div style={{
                                background: checkStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                color: checkStatus.type === 'success' ? '#10b981' : '#a1a1aa',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                fontSize: '0.9rem',
                                textAlign: 'center'
                            }}>
                                {checkStatus.msg}
                            </div>
                        )}

                        <form onSubmit={handleCheckEmail}>
                            <Input
                                label="Email to Check"
                                value={checkEmail}
                                onChange={(e) => setCheckEmail(e.target.value)}
                                fullWidth
                                placeholder="name@example.com"
                            />
                            <div style={{ marginTop: '1rem' }}>
                                <Button type="submit" fullWidth>Check Status</Button>
                            </div>
                        </form>

                        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <Button variant="ghost" size="sm" onClick={() => { setView('login'); setCheckStatus(null); }}>
                                Back to Login
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Login;
