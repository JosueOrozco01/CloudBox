import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import AppTopbar from "./components/Apptopbar/Apptopbar";
import { getMyProfile } from "./services/profileService";

function AuthenticatedPage({ children, requiredPermission = null }) {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      setIsLoading(true);

      try {
        const profile = await getMyProfile();

        if (active) {
          setUser(profile);
        }
      } catch (error) {
        console.error("Error al obtener usuario:", error);

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <AppTopbar user={user} />
      {children}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<AuthenticatedPage><Dashboard /></AuthenticatedPage>} />
        <Route path="/perfil" element={<AuthenticatedPage><UserProfile /></AuthenticatedPage>} />
        <Route path="/terminos" element={<Terms />} />
        <Route path="/privacidad" element={<Privacy />} />
        <Route path="/cookies" element={<Cookies />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;