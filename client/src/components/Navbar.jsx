import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Nav, Container, Badge, Button } from 'react-bootstrap';
import BSNavbar from 'react-bootstrap/Navbar';
import { Basket3Fill } from 'react-bootstrap-icons';
import { useUser } from '../context/UserContext.jsx';
import { logout } from '../API.js';


function AppNavbar() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {}
    setUser(false);
    navigate('/');
  };

  return (
    <BSNavbar bg="dark" variant="dark" expand="md" sticky="top" className="shadow-sm">
      <Container>
        <BSNavbar.Brand as={Link} to="/" className="fw-bold fs-5 d-flex align-items-center">
          <Basket3Fill className="text-white" size={22} />
          <span className="text-white">Sandwich</span>
          <span className="text-warning">Shop</span>
        </BSNavbar.Brand>
        <BSNavbar.Toggle />
        <BSNavbar.Collapse>
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>Menu</Nav.Link>
            {user && (
              <>
                <Nav.Link as={NavLink} to="/order">Build Order</Nav.Link>
                <Nav.Link as={NavLink} to="/orders">My Orders</Nav.Link>
              </>
            )}
          </Nav>

          <Nav className="align-items-center gap-2 ms-auto">
            {user ? (
              <>
                <Badge bg="warning" text="dark" className="fs-6 px-3 py-2 d-flex align-items-center gap-2">
                  <span>{user.username}</span>
                  <span className="text-muted">&middot;</span>
                  <span>&euro;{Number(user.credit).toFixed(2)}</span>
                </Badge>
                {user.has2FA && (
                  <Badge
                    bg={user.totpVerified ? 'success' : 'secondary'}
                    title={user.totpVerified ? '2FA verified' : '2FA not verified this session'}
                  >
                    {user.totpVerified ? '2FA' : 'No 2FA'}
                  </Badge>
                )}
                <Button variant="danger" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Nav.Link as={NavLink} to="/login">Login</Nav.Link>
            )}
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
}



export default AppNavbar