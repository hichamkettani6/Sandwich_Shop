import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Badge,
  Button, Card,
  Row, Col,
  Container,
  ListGroup,
  Spinner,
} from 'react-bootstrap';
import { Basket3Fill } from 'react-bootstrap-icons';
import { useUser } from '../context/UserContext.jsx';
import SandwichConfigurator from './SandwichConfigurator.jsx';
import { orderTotal, sandwichPrice } from '../utils/pricing.js';
import {
  getAvailability,
  getCurrentUser,
  getMenu,
  submitOrder,
} from '../API.js';


const SIZE_VARIANT = { S: 'info', M: 'warning', L: 'dark' };

function BasketItem({ item, menu, index, onRemove, onEdit }) {
  const size = menu.sizes.find(s => s.id === item.sizeId)
  const mainIng = menu.ingredients.find(i => i.id === item.mainIngredientId);
  const bread = menu.ingredients.find(i => i.id === item.breadId);
  const opts = item.optionalIngredientIds.map(id => menu.ingredients.find(i => i.id === id));
  const dress = item.dressingIds.map(id => menu.ingredients.find(i => i.id === id));
  const price = sandwichPrice(size, item.optionalIngredientIds.length);

  return (
    <ListGroup.Item className="px-3 py-2">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div className="d-flex gap-2">
          <Badge bg={SIZE_VARIANT[item.sizeId]} className="mt-1" style={{ minWidth: 24, height: 24, lineHeight: '16px' }}>
            {item.sizeId}
          </Badge>
          <div>
            <div className="fw-semibold small">
              {mainIng?.name} on {bread?.name}
              {item.quantity > 1 && (
                <Badge bg="secondary" className="ms-2 fw-normal">x{item.quantity}</Badge>
              )}
            </div>
            {opts.length > 0 && (
              <div className="text-success small">+ {opts.map(o => o?.name).join(', ')}</div>
            )}
            {dress.length > 0 && (
              <div className="text-warning small">+ {dress.map(d => d?.name).join(', ')}</div>
            )}
          </div>
        </div>
        <div className="text-end flex-shrink-0">
          <div className="fw-bold text-success small">&euro;{(price * item.quantity).toFixed(2)}</div>
          <Button variant="outline-primary" size="sm" className="me-2" onClick={() => onEdit(index)}>
            Edit
          </Button>
          <Button variant="outline-danger" size="sm" onClick={() => onRemove(index)}>
            Remove
          </Button>
        </div>
      </div>
    </ListGroup.Item>
  );
}


function OrderPage({ initialDraft = null }) {
  const [menu, setMenu] = useState(null);
  const [availability, setAvailability] = useState({ S: 0, M: 0, L: 0 });
  const [basket, setBasket] = useState(initialDraft ?? []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDraftInfo, setShowDraftInfo] = useState(!!initialDraft?.length);
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  // Load menu once
  useEffect(() => {
    let cancelled = false;
    getMenu()
      .then(data => { if (!cancelled) { setMenu(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Sync availability from menu on first load
  useEffect(() => {
    if (menu) {
      const avail = {};
      menu.sizes.forEach(s => { avail[s.id] = s.available; });
      setAvailability(avail);
    }
  }, [menu]);

  useEffect(() => {
    if (basket.length === 0) {
      setShowDraftInfo(false);
    }
  }, [basket]);

  function refreshAvailability() {
    getAvailability()
      .then(setAvailability)
      .catch(() => {});
  }

  function handleAddSandwich(sandwichConfig) {
    const currentIndex = editingIndex;
    let available = availability[sandwichConfig.sizeId];

    if (currentIndex !== null) {
      const old = basket[editingIndex];

      // give back old sandwich availability
      if (old.sizeId === sandwichConfig.sizeId) {
        available += old.quantity;
      }
    }

    if (sandwichConfig.quantity > available) {
      setError(`Not enough ${sandwichConfig.sizeId} sandwiches available. Only ${available} left.`);
      return;
    }
    setError('');

    if (currentIndex !== null) {
      setBasket(prev => prev.map((item, idx) => idx === currentIndex ? sandwichConfig : item));
      setEditingIndex(null);
    } else {
      setBasket(prev => [...prev, sandwichConfig]);
    }

    // Update availability
    setAvailability(prev => {
      const next = { ...prev };

      // Restore edited sandwich availability
      if (currentIndex !== null) {
        const old = basket[currentIndex];
        next[old.sizeId] += old.quantity;
      }

      // Consume new sandwich availability
      next[sandwichConfig.sizeId] -= sandwichConfig.quantity;

      return next;
    });
  }

  function handleEdit(index) {
    setEditingIndex(index);
    setError('');
  }

  function handleEditCancel() {
    setEditingIndex(null);
    setError('');
  }

  function handleRemove(index) {
    const removed = basket[index];

    if (editingIndex === index) {
      setEditingIndex(null);
    }
    setBasket(prev => prev.filter((_, i) => i !== index));

    setAvailability(prev => ({
      ...prev,
      [removed.sizeId]: prev[removed.sizeId] + removed.quantity,
    }));

    setError('');
  }

  async function handleSubmit() {
    if (!basket.length) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    // Re-check availability right before submitting
    try {
      const fresh = await getAvailability();
      setAvailability(fresh);
      const needed = Object.fromEntries(
        Object.keys(availability).map(size => [size, 0])
      );
      for (const item of basket)
        needed[item.sizeId] = (needed[item.sizeId] || 0) + item.quantity;
      for (const [sid, n] of Object.entries(needed)) {
        if (n > (fresh[sid] ?? 0)) {
          setError(`${sid} sandwiches are no longer available (only ${fresh[sid]} left). Adjust your order.`);
          setSubmitting(false);
          return;
        }
      }
    } catch {}

    try {
      await submitOrder(basket);
      setBasket([]);
      setSuccess('Order confirmed! Your sandwiches are being prepared.');
      refreshAvailability();
      const freshUser = await getCurrentUser();
      setUser(prev => ({ ...prev, credit: freshUser.credit }));
    } catch (err) {
      if (err.data?.code === 'not_enough') {
        setError(`${err.message} Please remove some sandwiches.`);
        refreshAvailability();
      } else if (err.data?.code === 'insufficient_credit') {
        setError(err.message);
      } else {
        setError(err.message || 'Failed to submit. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <Container className="text-center mt-5">
      <Spinner animation="border" />
    </Container>
  );
  if (!menu) return (
    <Container className="mt-4">
      <Alert variant="danger" dismissible>Failed to load menu. Please refresh.</Alert>
    </Container>
  );

  const totals = orderTotal(
    basket.map(item => ({
      sizeId: item.sizeId,
      optionalCount: item.optionalIngredientIds.length,
      quantity: item.quantity,
    })),
    menu.sizes
  );

  const creditOk = !user || totals.total <= Number(user.credit);

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <h1 className="mb-0">Build Your Order</h1>
      </div>
      <p className="text-muted mb-4">Configure each sandwich and add it to your basket.</p>

      {showDraftInfo && basket.length > 0 && (
        <Alert variant="info" className="mb-4">
          <strong>Draft loaded</strong> from a previous order! Review and modify, then confirm.
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="d-flex justify-content-between align-items-center mb-4" onClose={() => setSuccess('') } dismissible>
          <span>{success}</span>
          <Button variant="outline-success" size="sm" onClick={() => navigate('/orders')}>
            View My Orders
          </Button>
        </Alert>
      )}
      {error && <Alert variant="danger" className="mb-4" onClose={() => setError('')} dismissible>{error}</Alert>}

      <Row className="g-4">

        {/* Left: configurator */}
        <Col xs={12} lg={8}>
          <h5 className="fw-bold mb-3">Configure a Sandwich</h5>
          <SandwichConfigurator
            menu={menu}
            availability={availability}
            onAdd={handleAddSandwich}
            initialConfig={editingIndex !== null ? basket[editingIndex] : null}
            submitLabel={editingIndex !== null ? 'Save Changes' : 'Add to Order'}
            onCancel={editingIndex !== null ? handleEditCancel : null}
          />
        </Col>

        {/* Right: basket */}
        <Col xs={12} lg={4}>
          <Card className="shadow-sm" style={{ position: 'sticky', top: '5rem' }}>
            <Card.Header className="fw-bold">
              🛒 Your Order{' '}
              <Badge bg="secondary" className="ms-1">{totals.totalQty}</Badge>
            </Card.Header>

            {basket.length === 0 ? (
              <Card.Body className="text-center text-muted py-4">
                <div className="fs-1 mb-2"><Basket3Fill className="text-black" /></div>
                <div className="small">No sandwiches yet.<br />Configure one on the left!</div>
              </Card.Body>
            ) : (
              <>
                <ListGroup variant="flush" className="basket-scroll">
                  {basket.map((item, idx) => (
                    <BasketItem
                      key={idx}
                      item={item}
                      menu={menu}
                      index={idx}
                      onRemove={handleRemove}
                      onEdit={handleEdit}
                    />
                  ))}
                </ListGroup>

                <Card.Body className="pt-2">
                  {/* Subtotal (only when discount applies) */}
                  {totals.discount && (
                    <div className="d-flex justify-content-between text-muted small mb-1">
                      <span>Subtotal</span>
                      <span className="text-decoration-line-through">&euro;{totals.subtotal.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Discount row */}
                  {totals.discount && (
                    <div className="d-flex justify-content-between small mb-1">
                      <span>
                        <Badge bg="success" className="me-1">-20%</Badge>
                        4+ sandwich discount
                      </span>
                      <span className="text-success fw-semibold">
                        -&euro;{(totals.subtotal - totals.total).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="d-flex justify-content-between align-items-center mt-2 mb-1">
                    <span className="fw-bold fs-6">Total</span>
                    <span className="fw-bold fs-4 text-success">&euro;{totals.total.toFixed(2)}</span>
                  </div>

                  {/* Credit indicator */}
                  {user && (
                    <div className={`small mb-2 ${creditOk ? 'text-muted' : 'text-danger fw-semibold'}`}>
                      Your credit: &euro;{Number(user.credit).toFixed(2)}
                      {!creditOk && ' - insufficient ⚠️'}
                    </div>
                  )}

                  {/* Upsell hint */}
                  {totals.totalQty > 0 && totals.totalQty < 4 && (
                    <Alert variant="warning" className="py-2 px-3 small mb-3">
                      💡 Add {4 - totals.totalQty} more for a <strong>20% discount</strong>!
                    </Alert>
                  )}

                  <Button
                    variant="warning"
                    className="w-100"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={submitting || !basket.length || !creditOk}
                  >
                    {submitting
                      ? <><Spinner animation="border" size="sm" className="me-2" />Confirming...</>
                      : 'Confirm Order'}
                  </Button>
                </Card.Body>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}


export default OrderPage