import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { ShieldLockFill } from "react-bootstrap-icons";
import { login, verifyTotp } from '../API.js';
import { useUser } from '../context/UserContext.jsx';


function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [phase, setPhase] = useState('credentials'); // 'credentials' | 'totp'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(username, password);
      if (userData.has2FA) {
        setUser({ ...userData, totpVerified: false });
        setPhase('totp');
      } else {
        setUser(userData);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await verifyTotp(totpToken.trim());
      setUser(userData);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid TOTP code');
      setTotpToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 440 }}>
      <Card>
        <Card.Body className="p-4">
          {phase === 'credentials' ? (
            <>
              <Card.Title className="mb-4 fs-4">Sign in</Card.Title>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleCredentials}>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    autoFocus
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </Form.Group>
                <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </Form>
            </>
          ) : (
            <>
              <Card.Title className="mb-3 fs-4 d-flex align-items-center gap-2">
                <ShieldLockFill size={24} className="text-primary" />
                <span>Two-Factor Auth</span>
              </Card.Title>
              <p className="text-muted small">
                Enter the 6-digit code from your authenticator, or skip to continue with limited access (no order deletion).
              </p>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleTotp}>
                <Form.Group className="mb-3">
                  <Form.Label>Authenticator Code</Form.Label>
                  <Form.Control
                    className="text-center fs-4 letter-spacing-wide"
                    value={totpToken}
                    onChange={e => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    style={{ letterSpacing: '0.4em' }}
                  />
                </Form.Group>
                <Button
                  variant="primary"
                  type="submit"
                  className="w-100 mb-2"
                  disabled={loading || totpToken.length !== 6}
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
                <Button variant="outline-secondary" className="w-100" onClick={() => navigate('/')}>
                  Skip 2FA (limited access)
                </Button>
              </Form>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}


export default LoginPage