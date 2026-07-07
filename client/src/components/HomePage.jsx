import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Row, Col, Card, Badge, Button, Container,
  ProgressBar, Spinner, Alert, Table, ListGroup
} from 'react-bootstrap';
import { getMenu } from '../API.js';
import { useUser } from '../context/UserContext.jsx';



const SIZE_VARIANT = { S: 'info', M: 'warning', L: 'dark' };

function AvailabilityCard({ size }) {
  const avail = size.available;
  const pct = Math.round((avail / size.daily_limit) * 100);
  const variant = avail === 0 ? 'danger' : pct <= 30 ? 'warning' : 'success';

  return (
    <Card className="text-center h-100 shadow-sm">
      <Card.Body>
        <Badge bg={SIZE_VARIANT[size.id]} className="fs-4 px-3 py-2 mb-3 d-block w-50 mx-auto">
          {size.id}
        </Badge>
        <h5 className="fw-bold">{size.label}</h5>
        <div className={`display-5 fw-bold text-${variant} my-1`}>{avail}</div>
        <div className="text-muted small mb-2">available today</div>
        <ProgressBar now={pct} variant={variant} style={{ height: 6 }} />
        <div className="text-muted small mt-2">
          of {size.daily_limit} daily &middot; <strong>&euro;{size.base_price.toFixed(2)}</strong> base
        </div>
      </Card.Body>
    </Card>
  );
}


function HomePage() {
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useUser();

  useEffect(() => {
    let cancelled = false;
    getMenu()
      .then(data => { if (!cancelled) setMenu(data); })
      .catch(err  => { if (!cancelled) setError(err.message); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;
  if (error)   return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;

  const byCategory = cat => menu.ingredients.filter(i => i.category === cat);

  const CAT_GROUPS = [
    { label: 'Main Ingredients', cat: 'main', bg: 'danger' },
    { label: 'Bread Choices', cat: 'bread', bg: 'secondary' },
    { label: 'Optional Ingredients', cat: 'optional', bg: 'success' },
    { label: 'Dressings', cat: 'dressing', bg: 'warning' },
  ];

  return (
    <Container className="py-4">
      <h1 className="mb-1">Today's Availability</h1>
      <p className="text-muted mb-4">Fresh sandwiches made to order.. limited quantities daily.</p>

      {/* Availability cards */}
      <Row className="g-3 mb-4">
        {menu.sizes.map(s => (
          <Col key={s.id} xs={12} md={4}>
            <AvailabilityCard size={s} />
          </Col>
        ))}
      </Row>

      <Row className="g-4 mb-4">
        {/* Pricing table */}
        <Col xs={12} md={5}>
          <Card className="h-100 shadow-sm">
            <Card.Header className="fw-bold">Pricing</Card.Header>
            <Card.Body className="p-0">
              <Table className="mb-0" hover>
                <thead className="table-light">
                  <tr>
                    <th>Size</th>
                    <th>Base price</th>
                    <th>Included</th>
                    <th>Max dressings</th>
                  </tr>
                </thead>
                <tbody>
                  {menu.sizes.map(s => (
                    <tr key={s.id}>
                      <td><Badge bg={SIZE_VARIANT[s.id]}>{s.label}</Badge></td>
                      <td className="fw-bold">&euro;{s.base_price.toFixed(2)}</td>
                      <td>{s.included_ingredients} ingredients</td>
                      <td>{s.max_dressings}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
            <Card.Footer className="small text-muted">
              <ul className="mb-0 ps-3">
                <li>Extra ingredient: <strong>+30%</strong> on base price</li>
                <li>4+ sandwiches: <strong>20% off</strong> total order</li>
                <li>Cancellation: <strong>90% refund</strong></li>
              </ul>
            </Card.Footer>
          </Card>
        </Col>

        {/* Ingredients menu */}
        <Col xs={12} md={7}>
          <Card className="h-100 shadow-sm">
            <Card.Header className="fw-bold">Ingredients</Card.Header>
            <Card.Body>
              {CAT_GROUPS.map(({ label, cat, bg }) => (
                <div key={cat} className="mb-3">
                  <p className="text-uppercase fw-bold text-muted small mb-2">{label}</p>
                  <div className="d-flex flex-wrap gap-1">
                    {byCategory(cat).map(i => (
                      <Badge key={i.id} bg={bg} className="fw-normal fs-6 px-2 py-1">
                        {i.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {!user && (
        <div className="text-center mt-2">
          <Button as={Link} to="/login" variant="primary" size="lg">
            Login to place an order &gt;
          </Button>
        </div>
      )}
    </Container>
  );
}


export default HomePage