import client from './client';

export interface LoginParams {
    email_id: string;
    pw: string;
}

export interface SignupParams {
    email_id: string;
    pw: string;
    nickname: string;
}

export interface LoginResponse {
    status: string;
    message: string;
    user_id: string | number;
    nickname?: string;
    access_token?: string;
    token_type?: string;
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
