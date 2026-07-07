import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { check, body, validationResult } from 'express-validator'; // validation middleware
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import crypto from 'crypto';

import { initAuthentication, isAuthenticated, isAuthenticatedWith2FA, verifyTotpToken } from "./auth.mjs";
import Database from "./database.mjs";
import db_init from './db_init.mjs';


/* init express */
const app = express();
const PORT = 3001;

const db = new Database("sandwich.db");

/* Middleware */
app.use(morgan('dev'));
app.use(express.json());

const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};
app.use(cors(corsOptions));

initAuthentication(app, db);


/* Helper Functions */

function calcSandwichPrice(size, extraIngredients) {
  return size.base_price * (1 + 0.3 * extraIngredients);
}

function calcOrderTotal(sandwiches) {
  // sandwiches: [{sizeId, extraIngredients, quantity}]
  let total = 0;
  let totalQty = 0;
  for (const s of sandwiches) {
    total += calcSandwichPrice(s.size, s.extraIngredients) * s.quantity;
    totalQty += s.quantity;
  }
  if (totalQty >= 4) total *= 0.8;
  return Math.round(total * 100) / 100;
}

async function getOrdersDetails(userId, status) {
  // Fetch all root order rows matching filters
  const orders = await db.getUserOrders(userId, status)
  if (orders.length === 0) {
    return [];
  }

  // fetch all sandwiches combined with ingredients and size entries
  const orderIds = orders.map(o => o.id);
  const sandwiches = await db.getOrdersSandwiches(orderIds)
  //console.log(sandwiches)
  if (sandwiches.length === 0) {
    orders.forEach(o => o.sandwiches = []);
    return orders;
  }

  // fetch sandwiches optional ingredients and dressings in parallel
  const sandwichIds = sandwiches.map(sw => sw.id);
  const [allOptionals, allDressings] = await Promise.all([
    db.getSandwichesOptionals(sandwichIds),
    db.getSandwichesDressings(sandwichIds)
  ]);

  // Map everything together into an object tree
  return mapOrderTree(orders, sandwiches, allOptionals, allDressings);
}

function mapOrderTree(orders, sandwiches, allOptionals, allDressings) {
  const optionalMap = {};
  const dressingMap = {};
  const sandwichesByOrder = {};

  allOptionals.forEach(opt => {
    if (!optionalMap[opt.sandwich_id])
      optionalMap[opt.sandwich_id] = [];
    optionalMap[opt.sandwich_id].push({ id: opt.id, name: opt.name });
  });

  allDressings.forEach(dr => {
    if (!dressingMap[dr.sandwich_id])
      dressingMap[dr.sandwich_id] = [];
    dressingMap[dr.sandwich_id].push({ id: dr.id, name: dr.name });
  });

  sandwiches.forEach(sw => {
    sw.bread = { id: sw.b_id, name: sw.b_name };
    sw.mainIngredient = { id: sw.m_id, name: sw.m_name };
    sw.sizeInfo = {
      id: sw.s_id, label: sw.s_name, base_price: sw.base_price, included_ingredients: sw.included_ingredients,
      max_dressings: sw.max_dressings, daily_limit: sw.daily_limit, confirmed_today: sw.confirmed_today
    };
    
    delete sw.b_id; delete sw.b_name; delete sw.m_id; delete sw.m_name;
    delete sw.s_id; delete sw.s_name; delete sw.base_price; delete sw.included_ingredients
    delete sw.max_dressings; delete sw.daily_limit; delete sw.confirmed_today;

    sw.optionalIngredients = optionalMap[sw.id] || [];
    sw.dressings = dressingMap[sw.id] || [];

    if (!sandwichesByOrder[sw.order_id])
      sandwichesByOrder[sw.order_id] = [];
    sandwichesByOrder[sw.order_id].push(sw);
  });

  orders.forEach(order => {
    order.sandwiches = sandwichesByOrder[order.id] || [];
  });

  return orders;
}



/* Public Routes */

// Get availability and menu info
app.get('/api/menu', async (req, res) => {
  const sizes = await db.getSizes()
  const availability = sizes.map(s => ({
    ...s,
    available: s.daily_limit - s.confirmed_today,
  }));

  const ingredients = await db.getIngredients()

  res.json({ sizes: availability, ingredients });
});

// Get current availability (for real-time checks during order building)
app.get('/api/availability', async (req, res) => {
  const sizes = await db.getSizes();
  const availability = {};
  for (const s of sizes) {
    availability[s.id] = s.daily_limit - s.confirmed_today;
  }
  res.json(availability);
});


/* Auth routes */

// login
app.post('/api/sessions',
  body("username", "username must be a non-empty string").isString().trim().notEmpty(),
  body("password", "password must be a non-empty string").isString().notEmpty(),
  (req, res, next) => {
    // Check if validation is ok
    const err = validationResult(req);
    const errList = [];
    if (!err.isEmpty()) {
      errList.push(...err.errors.map(e => e.msg));
      return res.status(400).json({error: errList});
    }

    // Perform the actual authentication
    passport.authenticate('local', (err, user, info) => {
      if (err)
        return next(err);
      if (!user)
        return res.status(401).json({ error: info.message });

      req.logIn(user, (err) => {
        if (err)
          return next(err);

        req.session.totpVerified = false;

        return res.json({
          id: user.id,
          username: user.username,
          credit: user.credit,
          has2FA: !!user.totp_secret,
          totpVerified: false,
        });
      });
    })(req, res, next);
});

app.post('/api/sessions/totp', isAuthenticated, async (req, res) => {

  if (!req.user.totp_secret) {
    return res.status(400).json({ error: 'This user does not have 2FA enabled' });
  }

  const success = verifyTotpToken(req.user, req.body.token);
  if (success) {
    req.session.totpVerified = true;
    // STORE lastTotpStep in DB for replay protection
    try {
      //console.log('DEBUG: Updating lastTotpStep to '+req.user.lastTotpStep);
      await db.updateLastTotpStep(req.user.id, req.user.lastTotpStep);
    } catch (err) {
      console.log(err);
      return res.status(503).json({error: "Database error"});
    }
    return res.json({
      id: req.user.id,
      username: req.user.username,
      credit: req.user.credit,
      has2FA: !!req.user.totp_secret,
      totpVerified: true,
    });
  } else {
    console.log('Invalid or replayed TOTP code');
    return res.status(401).json({error: "Cannot authenticate with TOTP: invalid code"});
  }
});

app.get('/api/sessions/current', isAuthenticated, (req, res) => {
  const user = req.user
  res.json({
    id: user.id,
    username: user.username,
    credit: user.credit,
    has2FA: !!user.totp_secret,
    totpVerified: req.session.totpVerified || false,
  });
});

app.delete('/api/sessions/current', isAuthenticated, (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
  });
});


/* Order routes (authenticated) */

// Get all confirmed orders for the logged-in user
app.get('/api/orders', isAuthenticated, async (req, res) => {
  try {
    const detailedOrders = await getOrdersDetails(req.user.id, 'confirmed');
    res.json(detailedOrders);
  } catch (error) {
    console.error('Failed to retrieve order history:', error);
    res.status(500).json({ error: 'Internal server error processing history batch' });
  }
});

// Submit a new order
app.post('/api/orders',
  isAuthenticated,
  [
    body('sandwiches')
      .exists().withMessage('sandwiches is required')
      .isArray({ min: 1 }).withMessage('sandwiches must be a non-empty array'),
    body('sandwiches.*.sizeId')
      .exists().withMessage('sizeId is required'),
    body('sandwiches.*.mainIngredientId')
      .exists().withMessage('mainIngredientId is required')
      .isInt({ gt: 0 }).withMessage('mainIngredientId must be a positive integer'),
    body('sandwiches.*.breadId')
      .exists().withMessage('breadId is required')
      .isInt({ gt: 0 }).withMessage('breadId must be a positive integer'),
    body('sandwiches.*.optionalIngredientIds')
      .isArray().withMessage('optionalIngredientIds must be an array'),
    body('sandwiches.*.optionalIngredientIds.*')
    .isInt({ min: 1 }).withMessage('each optionalIngredientId must be a positive integer'),
    body('sandwiches.*.dressingIds')
      .isArray().withMessage('dressingIds must be an array'),
    body('sandwiches.*.dressingIds.*')
      .isInt({ min: 1 }).withMessage('each dressingId must be a positive integer'),
    body('sandwiches.*.quantity')
      .exists().withMessage('quantity is required')
      .isInt({ min: 1 }).withMessage('quantity must be >= 1'),
  ],
  async (req, res) => {
    // Check if validation is ok
    const err = validationResult(req);
    const errList = [];
    if (!err.isEmpty()) {
      errList.push(...err.errors.map(e => e.msg));
      return res.status(400).json({error: errList});
    }

    const { sandwiches } = req.body;

    // Validate each sandwich structure
    const [sizes, ingredients] = await Promise.all([
      db.getSizes(),
      db.getIngredients(),
    ]);
    const sizeMap = Object.fromEntries(sizes.map(s => [s.id, s]));
    const ingMap  = Object.fromEntries(ingredients.map(i => [i.id, i]));

    const neededBySize = Object.fromEntries(
      Object.keys(sizes).map(size => [size.id, 0])
    );

    for (const sw of sandwiches) {
      const { sizeId, mainIngredientId, breadId, optionalIngredientIds = [], dressingIds = [], quantity = 1 } = sw;

      const size = sizeMap[sizeId];
      if (!size)
        return res.status(400).json({ error: 'Unknown size' });

      const mainIng = ingMap[mainIngredientId];
      if (!mainIng || mainIng.category !== 'main')
        return res.status(400).json({ error: 'Invalid main ingredient' });

      const bread = ingMap[breadId];
      if (!bread || bread.category !== 'bread')
        return res.status(400).json({ error: 'Invalid bread type' });

      // Optional ingredients
      for (const id of optionalIngredientIds) {
        const ing = ingMap[id];
        if (!ing || ing.category !== 'optional')
          return res.status(400).json({ error: `Invalid optional ingredient: ${id}` });
      }

      // Dressings
      if (dressingIds.length > size.max_dressings) {
        return res.status(400).json({ error: `Too many dressings for ${size.label} (max ${size.max_dressings})` });
      }
      for (const id of dressingIds) {
        const ing = ingMap[id];
        if (!ing || ing.category !== 'dressing')
          return res.status(400).json({ error: `Invalid dressing: ${id}` });
      }

      neededBySize[sizeId] += quantity;
    }


    // Check availability (within a transaction)
    const checkAndInsert = async () => {
      try {
        for (const [sizeId, needed] of Object.entries(neededBySize)) {
          if (needed === 0)
            continue;
          const size = sizeMap[sizeId];
          const available = size.daily_limit - size.confirmed_today;
          if (needed > available) {
            throw new Error(`not_enough:${sizeId}:${size.label}:${available}`);
          }
        }

        // Calculate total price with extra ingredients
        const swDetails = sandwiches.map(sw => {
          const size = sizeMap[sw.sizeId];
          const optCount = (sw.optionalIngredientIds || []).length;
          const extraIngredients = Math.max(0, optCount - size.included_ingredients);
          return { size: size, extraIngredients, quantity: sw.quantity || 1 };
        });
        const totalPrice = calcOrderTotal(swDetails);

        // Check user credit
        if (req.user.credit < totalPrice) {
          throw new Error(`insufficient_credit:${req.user.credit.toFixed(2)}:${totalPrice.toFixed(2)}`);
        }

        // Create order
        const orderId = await db.createUserOrder(req.user.id, sandwiches, totalPrice)
        return { orderId };
      } catch (err) {
        throw err;
      }
    };

    try {
      const result = await checkAndInsert();
      res.status(201).json(result);
    } catch (err) {
      console.error('Order error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a confirmed order (requires 2FA)
app.delete('/api/orders/:id',
  isAuthenticatedWith2FA,
  [ check('id').isInt() ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({error: errors.array()});
    }

    const orderId = parseInt(req.params.id, 10);
    const order = await db.getUserOrder(req.user.id, orderId);
    if (!order)
      return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'confirmed')
      return res.status(400).json({ error: 'Order is not confirmed' });

    try {
      const result = await db.deleteOrder(req.user.id, orderId, order.total_price);
      const updatedUser = await db.getUser(req.user.id);
      res.json({ message: 'Order deleted', refund: result.refund, newCredit: updatedUser.credit });
    } catch (err) {
      console.error('Delete order error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
});



/* Start server */
app.listen(PORT, (err) => {
  if (err)
    console.log(err);
  else
    console.log(`Sandwich server running on http://localhost:${PORT}`);
});
