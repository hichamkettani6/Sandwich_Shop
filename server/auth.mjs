import passport from "passport";
import session from "express-session";
import LocalStrategy from "passport-local";
import { TOTP, Secret } from 'otpauth';


/**
 * Helper function to initialize passport authentication with the LocalStrategy
 * 
 * @param app express app
 * @param db instance of an active Database object
**/
function initAuthentication(app, db) {
  // Setup passport
  passport.use(new LocalStrategy((username, password, done) => {
    db.authUser(username, password)
      .then(user => {
        if (user)
            done(null, user);
        else
            done(null, false, {status: 401, message: "Incorrect username and/or password"});
      })
      .catch(() => /* db error */ done({status: 500, message: "Database error"}, false));
  }));

  // Serialization and deserialization of the user to and from a cookie
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser((id, done) => {
    db.getUser(id)
      .then(user => done(null, user))
      .catch(e => done(e, false));
  });

  // Initialize express-session
  app.use(session({
    secret: "586e60fdeb6f34186ae165a0cea7ee1dfa4105354e8c74610671de0ef9662191",
    resave: false,
    saveUninitialized: false
  }));

  // Initialize passport middleware
  app.use(passport.initialize());
  app.use(passport.session());
}


/**
 * Express middleware to check if the user is authenticated.
 * Responds with a 401 Unauthorized in case they're not.
**/
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated())
    return next();
  return res.status(401).json({ error: 'Not authenticated' });
};

const isAuthenticatedWith2FA = (req, res, next) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: 'Not authenticated' });
  if (!req.session.totpVerified)
    return res.status(403).json({ error: '2FA required for this operation' });
  return next();
};


const verifyTotpToken = (user, token) => {
  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: user.totp_secret
  });

  // Validate the code
  const delta = totp.validate({ token, window: 1 });
  if (delta === null) {
    return false; // invalid code
  }

  // Get the CURRENT time-step counter from OTPAuth
  //
  // Important:
  //  - delta tells us how many steps away the provided token is
  //  - counter() gives the *current* step index
  //
  // Therefore: actual_step = current_counter + delta
  //
  const currentCounter = totp.counter();  
  const actualStep = currentCounter + delta;
  //console.log('DEBUG: Token valid for step '+actualStep, ' (current counter: '+currentCounter+', delta: '+delta+')');

  if (actualStep <= user.lastTotpStep)
    return false;  // Reject replay or older step
  
  // Accept : update last-used step
  user.lastTotpStep = actualStep;
  return true;
}


export {
  initAuthentication,
  isAuthenticated,
  isAuthenticatedWith2FA,
  verifyTotpToken
};
