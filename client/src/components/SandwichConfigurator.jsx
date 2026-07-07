import { useEffect, useState } from 'react';
import {
  Card, Badge, Form, Button,
  Row, Col, InputGroup,
} from 'react-bootstrap';
import { sandwichPrice } from '../utils/pricing.js';


/**
 * SandwichConfigurator: configures a single sandwich entry.
 * Props:
 *   menu              { sizes, ingredients }
 *   availability      { S, M, L }
 *   onAdd             (sandwichConfig) => void
 *   initialConfig     optional - pre-fills the form (for edit / duplicate)
 *   submitLabel       string - defaults to 'Add to Order'
 *   onCancel          optional callback - shows a Cancel button when editing
 */
function SandwichConfigurator({
  menu,
  availability,
  onAdd,
  initialConfig = null,
  submitLabel = 'Add to Order',
  onCancel = null,
}) {
  const [sizeId, setSizeId] = useState('');
  const [mainIngredientId, setMainIngredientId] = useState(null);
  const [breadId, setBreadId] = useState(null);
  const [selectedOptionals, setSelectedOptionals] = useState(new Set());
  const [selectedDressings, setSelectedDressings] = useState(new Set());
  const [quantity, setQuantity] = useState(1);

  const mainIngredients = menu.ingredients.filter(i => i.category === 'main');
  const breads = menu.ingredients.filter(i => i.category === 'bread');
  const optionals = menu.ingredients.filter(i => i.category === 'optional');
  const dressings = menu.ingredients.filter(i => i.category === 'dressing');

  const sizeConfig  = sizeId ? menu.sizes.find(s => s.id === sizeId) : null;
  const isEditing   = Boolean(initialConfig);

  function resetForm() {
    setSizeId('');
    setMainIngredientId(null);
    setBreadId(null);
    setSelectedOptionals(new Set());
    setSelectedDressings(new Set());
    setQuantity(1);
  }

  // Load initialConfig when it changes (editing / duplicating)
  useEffect(() => {
    if (initialConfig) {
      setSizeId(initialConfig.sizeId || '');
      setMainIngredientId(initialConfig.mainIngredientId ?? null);
      setBreadId(initialConfig.breadId ?? null);
      setSelectedOptionals(new Set(initialConfig.optionalIngredientIds || []));
      setSelectedDressings(new Set(initialConfig.dressingIds || []));
      setQuantity(initialConfig.quantity || 1);
    } else {
      resetForm();
    }
  }, [
    initialConfig?.sizeId,
    initialConfig?.mainIngredientId,
    initialConfig?.breadId,
    initialConfig?.optionalIngredientIds?.join(','),
    initialConfig?.dressingIds?.join(','),
    initialConfig?.quantity,
  ]);

  // Clear optional/dressing when size changes, unless we're loading the same size from initialConfig
  useEffect(() => {
    if (!sizeId) return;
    if (initialConfig && initialConfig.sizeId === sizeId) return;
    setSelectedOptionals(new Set());
    setSelectedDressings(new Set());
  }, [sizeId, initialConfig]);

  const optCount = selectedOptionals.size;
  const extraIngredients = sizeConfig ? Math.max(0, optCount - sizeConfig.included_ingredients) : 0;
  const unitPrice = sizeConfig ? sandwichPrice(sizeConfig, optCount) : 0;
  const atDressingLimit = !!(sizeConfig && selectedDressings.size >= sizeConfig.max_dressings);
  const isValid = submitLabel === 'Save Changes' || !!(sizeId && mainIngredientId && breadId && (availability[sizeId] ?? 0) > 0);

  function toggleOptional(id) {
    setSelectedOptionals(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleDressing(id) {
    setSelectedDressings(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < (sizeConfig?.max_dressings ?? 0)) {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!isValid) return;
    onAdd({
      sizeId, mainIngredientId, breadId,
      optionalIngredientIds: [...selectedOptionals],
      dressingIds: [...selectedDressings],
      quantity,
    });
    resetForm();
  }


  return (
    <Card className="shadow-sm">
      <Card.Body className="p-4">
        {/* Edit-mode header */}
        {isEditing && (
          <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <span className="small fw-semibold text-primary">✏️ Editing sandwich</span>
            {onCancel && (
              <Button variant="outline-danger" size="sm" onClick={onCancel}>
                Cancel edit
              </Button>
            )}
          </div>
        )}

        {/* Size */}
        <div className="mb-4">
          <p className="text-uppercase fw-bold text-muted small mb-2">1. Choose Size</p>
          <Row className="g-2">
            {menu.sizes.map(s => {
              const avail  = availability[s.id] ?? 0;
              const active = sizeId === s.id;
              const availColor = avail === 0 ? 'text-danger' : avail <= 2 ? 'text-warning' : 'text-muted';
              return (
                <Col key={s.id} xs={4}>
                  <Button
                    variant="light"
                    className={`w-100 size-option-card ${active ? 'active' : ''}`}
                    onClick={() => setSizeId(s.id)}
                    disabled={avail === 0}
                  >
                    <div
                      className={`rounded-circle border d-flex align-items-center justify-content-center fw-bold mx-auto mb-1 size-option-circle ${active ? 'active' : ''}`}
                      style={{ width: 36, height: 36 }}
                    >
                      {s.id}
                    </div>
                    <div className="small fw-semibold">{s.label}</div>
                    <div className="small text-muted">&euro;{s.base_price.toFixed(2)}</div>
                    <div className={`small ${availColor}`}>{avail === 0 ? 'Sold out' : `${avail} left`}</div>
                  </Button>
                </Col>
              );
            })}
          </Row>
        </div>

        {!sizeId && (
          <p className="text-center text-muted py-2">Select a size above to continue.</p>
        )}

        {sizeId && (
          <>
            {/* Main Ingredient */}
            <div className="mb-4">
              <p className="text-uppercase fw-bold text-muted small mb-2">2. Main Ingredient</p>
              <div className="d-flex flex-wrap gap-2">
                {mainIngredients.map(i => (
                  <Button
                    key={i.id}
                    variant={mainIngredientId === i.id ? 'dark' : 'outline-secondary'}
                    className="rounded-pill"
                    onClick={() => setMainIngredientId(i.id)}
                  >
                    {mainIngredientId === i.id && ' '}{i.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Bread */}
            <div className="mb-4">
              <p className="text-uppercase fw-bold text-muted small mb-2">3. Bread Type</p>
              <div className="d-flex flex-wrap gap-2">
                {breads.map(i => (
                  <Button
                    key={i.id}
                    variant={breadId === i.id ? 'dark' : 'outline-secondary'}
                    className="rounded-pill"
                    onClick={() => setBreadId(i.id)}
                  >
                    {breadId === i.id && ' '}{i.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Optional Ingredients */}
            <div className="mb-4">
              <p className="text-uppercase fw-bold text-muted small mb-2">
                4. Optional Ingredients{' '}
                <span className="fw-normal text-muted">
                  ({optCount} selected &middot; {sizeConfig.included_ingredients} included in price
                  {extraIngredients > 0 && (
                    <> &middot; <span className="text-warning fw-semibold">{extraIngredients} extra (+{extraIngredients * 30}%)</span></>
                  )})
                </span>
              </p>
              <div className="d-flex flex-wrap gap-2">
                {optionals.map(i => {
                  const sel = selectedOptionals.has(i.id);
                  const willCost = !sel && optCount >= sizeConfig.included_ingredients;
                  return (
                    <button
                      key={i.id}
                      className={`btn rounded-pill optional-option ${sel ? 'active' : ''}`}
                      onClick={() => toggleOptional(i.id)}
                    >
                      {sel && ''}{i.name}
                      {willCost && <Badge bg="warning" text="dark" className="ms-1 fw-normal">+30%</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dressings */}
            <div className="mb-4">
              <p className="text-uppercase fw-bold text-muted small mb-2">
                5. Dressings{' '}
                <span className="fw-normal text-muted">
                  (max {sizeConfig.max_dressings} &middot; {selectedDressings.size} selected)
                </span>
              </p>
              <div className="d-flex flex-wrap gap-2">
                {dressings.map(i => {
                  const sel      = selectedDressings.has(i.id);
                  const disabled = !sel && atDressingLimit;
                  return (
                    <Button
                      key={i.id}
                      variant={sel ? 'warning' : 'outline-secondary'}
                      className={`rounded-pill ${disabled ? 'opacity-50' : ''}`}
                      onClick={() => !disabled && toggleDressing(i.id)}
                      title={disabled ? `Max ${sizeConfig.max_dressings} dressing${sizeConfig.max_dressings > 1 ? 's' : ''} for ${sizeConfig.label}` : ''}
                    >
                      {sel && ''}{i.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Quantity + Price + Submit */}
            <hr />
            <Row className="align-items-end g-3">
              <Col xs="auto">
                <Form.Label className="text-uppercase fw-bold text-muted small mb-1 d-block">Quantity</Form.Label>
                <InputGroup size="sm">
                  <Button variant="outline-secondary" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>−</Button>
                  <Form.Control
                    value={quantity}
                    readOnly
                    className="text-center fw-bold"
                    style={{ width: 48 }}
                  />
                  <Button variant="outline-secondary" onClick={() => setQuantity(q => q + 1)}>+</Button>
                </InputGroup>
              </Col>

              <Col>
                <Form.Label className="text-uppercase fw-bold text-muted small mb-1 d-block">Unit Price</Form.Label>
                <div className="fs-3 fw-bold text-success lh-1">
                  &euro;{unitPrice.toFixed(2)}
                  <span className="fs-6 fw-normal text-muted ms-2">
                    x {quantity} = &euro;{(unitPrice * quantity).toFixed(2)}
                  </span>
                </div>
              </Col>

              <Col xs="auto">
                <Button variant="primary" size="lg" onClick={handleSubmit} disabled={!isValid}>
                  {submitLabel}
                </Button>
              </Col>
            </Row>

            {!mainIngredientId && (
              <p className="small text-muted mt-2 mb-0">Select a protein to continue!</p>
            )}
            {mainIngredientId && !breadId && (
              <p className="small text-muted mt-2 mb-0">Select a bread type to continue!</p>
            )}

          </>
        )}
      </Card.Body>
    </Card>
  );
}


export default SandwichConfigurator