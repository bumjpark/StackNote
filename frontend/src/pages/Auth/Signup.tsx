import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

const Signup: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email_id: '',
        pw: '',
        confirmPw: ''
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

        if (formData.pw !== formData.confirmPw) {
            setError("Passwords don't match");
            return;
        }

        setLoading(true);

        try {
            // Backend expects email_id, pw
            await authApi.signup({
                email_id: formData.email_id,
                pw: formData.pw
            });
            // On success, redirect to login
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-center w-full h-full" style={{ minHeight: '100vh', background: 'radial-gradient(circle at bottom left, #1e2530 0%, #0f1115 100%)' }}>
            <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Create Account</h2>
                <p style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Join StackNote today
                </p>

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
                        placeholder="Create a password"
                        value={formData.pw}
                        onChange={handleChange}
                        fullWidth
                    />
                    <Input
                        label="Confirm Password"
                        name="confirmPw"
                        type="password"
                        placeholder="Confirm your password"
                        value={formData.confirmPw}
                        onChange={handleChange}
                        fullWidth
                    />

                    <div style={{ marginTop: '1.5rem' }}>
                        <Button type="submit" fullWidth disabled={loading}>
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </Button>
                    </div>
                </form>

                <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Already have an account? <Link to="/login">Log in</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
