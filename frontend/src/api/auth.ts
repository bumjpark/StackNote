import client from './client';

export interface LoginParams {
    email_id: string;
    pw: string;
}

export interface SignupParams {
    email_id: string;
    pw: string;
}

export interface LoginResponse {
    status: string;
    message: string;
    user_id: string | number; // Backend schema says int? Adjust if needed
    // If backend returns token, add here. Currently implementation_plan assumed token but backend review showed simple response
    // Wait, backend `login_user` returns `{"status": "success", "message": "...", "user_id": ...}`
    // It does NOT return a token! The backend seems to be session-less or expects basic auth?
    // User asked to "connect well to backend".
    // The backend `auth/service.py` login_user returns a dict.
    // For now we will rely on user_id, but a real app needs a token.
    // I will check if I can use a mock token or if I should just use user_id. 
    // Since I can't modify backend, I will assume user_id is enough for this demo or I'll generate a fake token client side?
    // No, that's bad.
    // But wait, the previous conversation mentioned "API Client (Axios interceptor for JWT/Auth)".
    // Backend code showed: `app/main.py` -> `app.include_router(user_router.router)`
    // `user_router` -> `login_user` -> `UserServices.login_user`
    // `UserServices.login_user` returns dict with user_id. 
    // NO JWT.
    // So we will just store `user_id` and maybe a fake token to satisfy the interceptor if I wrote it that way.
    // I'll adjust the interceptor later if needed, or just store user_id.
}

export const authApi = {
    login: async (data: LoginParams): Promise<LoginResponse> => {
        const response = await client.post('/users/login', data);
        return response.data;
    },

    signup: async (data: SignupParams) => {
        const response = await client.post('/users/signup', data);
        return response.data;
    },

    checkEmail: async (email_id: string) => {
        const response = await client.post('/users/check_email', { email_id });
        return response.data;
    },
};
