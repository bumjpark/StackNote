import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import WorkspaceView from './pages/Workspace/WorkspaceView';
import { WorkspaceProvider } from './context/WorkspaceContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <WorkspaceProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Route */}
          <Route element={<ProtectedRoute />}>
            <Route path="/workspace/:workspaceId?" element={<WorkspaceView />} />
          </Route>

          {/* Redirect root to login for now */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </WorkspaceProvider>
    </Router>
  );
}

export default App;
