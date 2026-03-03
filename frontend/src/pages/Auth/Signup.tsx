import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

const Signup: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email_id: '',
        nickname: '',
        pw: '',
        confirmPw: ''
    });
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        email_id?: string;
        nickname?: string;
        pw?: string;
        confirmPw?: string;
    }>({});
    const [loading, setLoading] = useState(false);
    const [emailCheck, setEmailCheck] = useState<{
        status: 'idle' | 'checking' | 'available' | 'exists' | 'error';
        msg?: string;
    }>({ status: 'idle' });

    const validateEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    const validatePassword = (value: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,32}$/.test(value);
    const validateNickname = (value: string) => /^[a-zA-Z0-9가-힣_]{2,20}$/.test(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setFieldErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
        if (e.target.name === 'email_id') {
            setEmailCheck({ status: 'idle' });
        }
    };

    const checkEmailAvailability = async () => {
        if (!formData.email_id) return false;
        if (!validateEmail(formData.email_id)) {
            setFieldErrors((prev) => ({ ...prev, email_id: '이메일 형식이 올바르지 않습니다.' }));
            return false;
        }

        setEmailCheck({ status: 'checking' });
        try {
            const response = await authApi.checkEmail(formData.email_id);
            if (response.exists) {
                setEmailCheck({ status: 'exists', msg: '이미 가입된 이메일입니다.' });
                return false;
            }
            setEmailCheck({ status: 'available', msg: '사용 가능한 이메일입니다.' });
            return true;
        } catch (err) {
            setEmailCheck({ status: 'error', msg: '이메일 확인 중 오류가 발생했습니다.' });
            return false;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});

        const nextErrors: typeof fieldErrors = {};
        if (!validateEmail(formData.email_id)) {
            nextErrors.email_id = '이메일 형식이 올바르지 않습니다.';
        }
        if (!validateNickname(formData.nickname)) {
            nextErrors.nickname = '닉네임은 2-20자, 영문/숫자/언더바만 가능합니다.';
        }
        if (!validatePassword(formData.pw)) {
            nextErrors.pw = '비밀번호는 8-32자이며 영문과 숫자를 포함해야 합니다.';
        }
        if (formData.pw !== formData.confirmPw) {
            nextErrors.confirmPw = '비밀번호가 일치하지 않습니다.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            return;
        }

        if (emailCheck.status !== 'available') {
            setFieldErrors((prev) => ({
                ...prev,
                email_id: prev.email_id || '중복 확인을 완료해주세요.'
            }));
            return;
        }

        setLoading(true);

        try {
            // Backend expects email_id, pw
            await authApi.signup({
                email_id: formData.email_id,
                pw: formData.pw,
                nickname: formData.nickname
            });
            // On success, redirect to login
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.detail || '회원가입에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-center w-full h-full" style={{ minHeight: '100vh', background: 'radial-gradient(circle at bottom left, #1e2530 0%, #0f1115 100%)' }}>
            <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>회원가입</h2>
                <p style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    StackNote에 오신 것을 환영합니다
                </p>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-wrapper">
                        <label className="input-label">이메일</label>
                        <div className="email-group">
                            <input
                                className={`input-field ${fieldErrors.email_id ? 'input-error' : ''}`}
                                name="email_id"
                                placeholder="이메일을 입력해주세요"
                                value={formData.email_id}
                                onChange={handleChange}
                            />
                            <Button
                                type="button"
                                size="md"
                                variant="ghost"
                                onClick={checkEmailAvailability}
                                disabled={emailCheck.status === 'checking'}
                                className="email-check-btn"
                            >
                                {emailCheck.status === 'checking' ? '확인 중...' : '중복확인'}
                            </Button>
                        </div>
                        {fieldErrors.email_id && <span className="input-error-msg">{fieldErrors.email_id}</span>}
                    </div>
                    {emailCheck.msg && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: emailCheck.status === 'available' ? '#10b981' : '#ef4444' }}>
                            {emailCheck.msg}
                        </div>
                    )}
                    <Input
                        label="닉네임"
                        name="nickname"
                        placeholder="닉네임을 입력해주세요"
                        value={formData.nickname}
                        onChange={handleChange}
                        error={fieldErrors.nickname}
                        fullWidth
                    />
                    <Input
                        label="비밀번호"
                        name="pw"
                        type="password"
                        placeholder="비밀번호를 입력해주세요"
                        value={formData.pw}
                        onChange={handleChange}
                        error={fieldErrors.pw}
                        fullWidth
                    />
                    <Input
                        label="비밀번호 확인"
                        name="confirmPw"
                        type="password"
                        placeholder="비밀번호를 다시 입력해주세요"
                        value={formData.confirmPw}
                        onChange={handleChange}
                        error={fieldErrors.confirmPw}
                        fullWidth
                    />

                    <div style={{ marginTop: '1.5rem' }}>
                        <Button type="submit" fullWidth disabled={loading}>
                            {loading ? '회원가입 중...' : '회원가입'}
                        </Button>
                    </div>
                </form>

                <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    이미 계정이 있으신가요? <Link to="/login">로그인</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
