import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Card, Button, Badge,
  Alert, Spinner, Accordion, Stack
} from 'react-bootstrap';
import { Basket3Fill } from 'react-bootstrap-icons';
import { getOrders, deleteOrder, getAvailability } from '../API.js';
import { useUser } from '../context/UserContext.jsx';


const SIZE_VARIANT = { S: 'info', M: 'warning', L: 'dark' };

function SandwichRow({ sw }) {
  return (
    <div className="d-flex align-items-start gap-2 mb-2">
      <Badge bg={SIZE_VARIANT[sw.size_id]} className="mt-1" style={{ minWidth: 24 }}>
        {sw.size_id}
      </Badge>
      <div className="small">
        <span className="fw-semibold">{sw.mainIngredient?.name} on {sw.bread?.name}</span>
        {sw.quantity > 1 && (
          <Badge bg="secondary" className="ms-2 fw-normal">x{sw.quantity}</Badge>
        )}
        {sw.optionalIngredients?.length > 0 && (
          <div className="text-success">+ {sw.optionalIngredients.map(i => i.name).join(', ')}</div>
        )}
        {sw.dressings?.length > 0 && (
          <div className="text-warning">+ {sw.dressings.map(d => d.name).join(', ')}</div>
        )}
      </div>
    </div>
  );
}


function OrderCard({ order, canDelete, onDelete, onDuplicate, deleting }) {
  const date = new Date(order.created_at).toLocaleString();
  const totalQty = order.sandwiches.reduce((s, sw) => s + sw.quantity, 0);

  return (
    <Card className="mb-3 shadow-sm">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <span className="fw-bold">Order #{order.id}</span>
          <span className="text-muted small ms-2">{date}</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="fw-bold fs-5 text-success">&euro;{Number(order.total_price).toFixed(2)}</span>
          <Badge bg="success">Confirmed</Badge>
        </div>
      </Card.Header>

      <Card.Body>
        {/* Summary chips */}
        <div className="d-flex flex-wrap gap-1 mb-3">
          {order.sandwiches.map(sw => (
            <Badge key={sw.id} bg={SIZE_VARIANT[sw.size_id]} className="fw-normal px-2 py-1">
              {sw.quantity > 1 ? `${sw.quantity}x ` : ''}{sw.size_id} {sw.mainIngredient?.name}
            </Badge>
          ))}
          <Badge bg="light" text="dark" className="fw-normal px-2 py-1 border">
            {totalQty} sandwich{totalQty !== 1 ? 'es' : ''}
          </Badge>
        </div>

        {/* Expandable details */}
        <Accordion className="mb-3 shadow-sm">
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              <span className="small text-muted">Details</span>
            </Accordion.Header>
            <Accordion.Body className="pt-2 pb-1">
              {order.sandwiches.map(sw => (
                <SandwichRow key={sw.id} sw={sw} />
              ))}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        {/* Actions */}
        <Stack direction="horizontal" gap={2}>
          <Button variant="outline-secondary" size="sm" onClick={() => onDuplicate(order)}>
            Duplicate as Draft
          </Button>
          {canDelete ? (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => onDelete(order.id)}
              disabled={deleting}
            >
              {deleting
                ? <><Spinner animation="border" size="sm" className="me-1" />Deleting...</>
                : 'Delete'}
            </Button>
          ) : (
            <span className="text-muted small ms-1" title="Log in with 2FA to enable deletion">
              🔒 Deletion requires 2FA
            </span>
          )}
        </Stack>
      </Card.Body>
    </Card>
  );
}


function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  const canDelete = user?.has2FA && user?.totpVerified;

  useEffect(() => {
    let cancelled = false;

    async function fetchOrders() {
      try {
        const data = await getOrders();
        if (!cancelled) setOrders(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOrders();

    return () => { cancelled = true; };
  }, []);

  async function handleDelete(orderId) {
    if (!window.confirm('Delete this order? You will receive a 90% refund.'))
      return;
    setDeletingId(orderId);
    setError(''); setMessage('');
    try {
      const result = await deleteOrder(orderId);
      setMessage(`Order deleted. \u20AC${result.refund.toFixed(2)} refunded! New balance: \u20AC${result.newCredit.toFixed(2)}.`);
      setUser(prev => ({ ...prev, credit: result.newCredit }));
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      setError(err.status === 403
        ? 'Deletion requires 2FA. Log out and log in again using 2FA.'
        : err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDuplicate(order) {
    let avail = { S: 999, M: 999, L: 999 };
    try {
      avail = await getAvailability();
    } catch {}

    const needed = { S: 0, M: 0, L: 0 };
    for (const sw of order.sandwiches)
      needed[sw.size_id] = (needed[sw.size_id] || 0) + sw.quantity;

    const unavailable = Object.entries(needed)
      .filter(([sid, n]) => n > (avail[sid] ?? 0))
      .map(([sid, n]) => `${sid} (need ${n}, only ${avail[sid]} left)`);

    if (unavailable.length) {
      setError(`Cannot duplicate: not enough ${unavailable.join(', ')}. Build a new order manually.`);
      return;
    }

    navigate('/order', {
      state: {
        draftItems: order.sandwiches.map(sw => ({
          sizeId: sw.size_id,
          mainIngredientId: sw.main_ingredient_id,
          breadId: sw.bread_id,
          optionalIngredientIds: sw.optionalIngredients.map(i => i.id),
          dressingIds: sw.dressings.map(d => d.id),
          quantity: sw.quantity,
        })),
      },
    });
  }

  if (loading) return (
    <Container className="text-center mt-5">
      <Spinner animation="border" />
    </Container>
  );

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <h1 className="mb-0">My Orders</h1>
        <Button variant="primary" onClick={() => navigate('/order')}>+ New Order</Button>
      </div>
      <p className="text-muted mb-4">Your confirmed sandwich orders.</p>

      {/* 2FA status banners */}
      {user?.has2FA && !canDelete && (
        <Alert variant="info" className="mb-3">
          🔒 You logged in without 2FA. <strong>Log out and log in again with 2FA</strong> to enable order deletion.
        </Alert>
      )}
      {!user?.has2FA && (
        <Alert variant="warning" className="mb-3">
          🔒 Your account does not have 2FA! Order deletion is unavailable.
        </Alert>
      )}

      {message && <Alert variant="success" className="mb-3" onClose={() => setMessage('') } dismissible>{message}</Alert>}
      {error && <Alert variant="danger"  className="mb-3" onClose={() => setError('') } dismissible>{error}</Alert>}

      {orders.length === 0 ? (
        <Card className="text-center py-5 shadow-sm">
          <Card.Body>
            <div className="fs-1 mb-2"><Basket3Fill className="text-black" /></div>
            <h5>No orders yet</h5>
            <p className="text-muted">Place your first order to see it here.</p>
            <Button variant="dark" onClick={() => navigate('/order')}>Build an Order</Button>
          </Card.Body>
        </Card>
      ) : (
        orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            canDelete={canDelete}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            deleting={deletingId === order.id}
          />
        ))
      )}
    </Container>
  );
}


export default OrdersPage