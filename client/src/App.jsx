import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppNavbar from './components/Navbar.jsx';
import HomePage from './components/HomePage.jsx';
import LoginPage from './components/LoginPage.jsx';
import OrderPage from './components/OrderPage.jsx';
import OrdersPage from './components/OrdersPage.jsx';
import { UserProvider, useUser } from './context/UserContext.jsx';
import { Spinner, Container } from 'react-bootstrap';


function ProtectedRoute({ children }) {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) return (
    <Container className="text-center mt-5">
      <Spinner animation="border" />
    </Container>
  );
  if (!user)
    return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function OrderPageWithDraft() {
  const location = useLocation();
  const draftItems = location.state?.draftItems ?? null;
  return <OrderPage initialDraft={draftItems} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"        element={<HomePage />} />
      <Route path="/login"   element={<LoginPage />} />
      <Route path="/order"   element={<ProtectedRoute><OrderPageWithDraft /></ProtectedRoute>} />
      <Route path="/orders"  element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="*"        element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <UserProvider>
      <AppNavbar />
      <AppRoutes />
    </UserProvider>
  );
}


export default App