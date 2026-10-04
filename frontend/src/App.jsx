import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/Register';
import ForgotPassword from './pages/RecoverPassword/Recover';
import Dashboard from './pages/Dashboard/Dashboard';
import OfflineBanner from './components/OfflineBanner/Offline';
import LandingPage from './pages/LandingPage/LandingPage';
import UserProfile from './pages/Profile/Profile';


function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/perfil" element={<UserProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;