import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useWorkspace } from '../../context/WorkspaceContext';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { refreshWorkspaces } = useWorkspace();
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
                if (response.nickname) {
                    localStorage.setItem('user_nickname', response.nickname);
                } else {
                    localStorage.removeItem('user_nickname');
                }
                localStorage.setItem('token', 'dummy-token-since-backend-no-jwt');

                // Refresh workspaces before navigating (non-blocking)
                try {
                    await refreshWorkspaces();
                } catch (refreshError) {
                    console.error('Failed to refresh workspaces:', refreshError);
                    // Continue anyway - workspace will load on mount
                }

                navigate('/workspace');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-center w-full h-full" style={{ minHeight: '100vh', background: 'radial-gradient(circle at top right, #1e2530 0%, #0f1115 100%)' }}>
            <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>어서오세요 StackNote 입니다!</h2>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <Input
                        label="이메일"
                        name="email_id"
                        placeholder="이메일을 입력하세요"
                        value={formData.email_id}
                        onChange={handleChange}
                        fullWidth
                    />
                    <Input
                        label="비밀번호"
                        name="pw"
                        type="password"
                        placeholder="비밀번호를 입력하세요"
                        value={formData.pw}
                        onChange={handleChange}
                        fullWidth
                    />

                    <div style={{ marginTop: '1.5rem' }}>
                        <Button type="submit" fullWidth disabled={loading}>
                            {loading ? '로그인 중...' : '로그인'}
                        </Button>
                    </div>
                </form>

                <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    계정이 없으신가요? <Link to="/signup">회원가입</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
