import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/Register';
import ForgotPassword from './pages/RecoverPassword/Recover';
import Dashboard from './pages/Dashboard/Dashboard';
import OfflineBanner from './components/OfflineBanner/Offline';
import LandingPage from './pages/LandingPage/LandingPage';
import UserProfile from './pages/Profile/Profile';
import Terms from './pages/Terms/Terms';
import Privacy from './pages/Privacy/Privacy';
import Cookies from './pages/Cookies/Cookies';

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
        <Route path="/terminos" element={<Terms />} />
        <Route path="/privacidad" element={<Privacy />} />
        <Route path="/cookies" element={<Cookies />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;