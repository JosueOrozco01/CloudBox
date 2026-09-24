import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import LoginPage from '../pages/Login/LoginPage';

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;