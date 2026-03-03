import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
    redirectPath?: string;
    children?: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    redirectPath = '/login',
    children,
}) => {
    // Check for authentication (simulated by verifying token/user_id presence)
    const isAuthenticated = !!localStorage.getItem('user_id');

    if (!isAuthenticated) {
        return <Navigate to={redirectPath} replace />;
    }

    return children ? children : <Outlet />;
};

export default ProtectedRoute;
