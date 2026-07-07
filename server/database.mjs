import sqlite from "sqlite3";
import crypto from "crypto";


/**
 * Wrapper around db.all
 */
const dbAllAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

/**
 * Wrapper around db.run
 */
const dbRunAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({
            lastID: this.lastID,
            changes: this.changes,
        });
    });
});

/**
 * Wrapper around db.get
 */
const dbGetAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});


/**
 * Interface to the sqlite database for the application
 *
 * @param dbname name of the sqlite3 database file to open
 */
function Database(dbname) {
    this.db = new sqlite.Database(dbname, err => {
        if (err) throw err;
    });


    /**
     * Authenticate a user from their username and password
     * 
     * @param username username of the user to authenticate
     * @param password password of the user to authenticate
     * 
     * @returns a Promise that resolves to the user object {id, username, credit}
     */
    this.authUser = (username, password) => new Promise((resolve, reject) => {
        // Get the user with the given username
        dbGetAsync(
            this.db,
            "SELECT * FROM users WHERE username = ?",
            [username]
        )
        .then(user => {
            // If there is no such user, resolve to false.
            // This is used instead of rejecting the Promise to differentiate the
            // failure from database errors
            if (!user)
                resolve(false);

            // Verify the password
            crypto.scrypt(password, user.salt, 32, (err, hash) => {
                if (err)
                    reject(err);

                if (crypto.timingSafeEqual(hash, Buffer.from(user.password_hash, "hex")))
                    resolve({id: user.id, username: user.username, credit: user.credit, totp_secret: user.totp_secret, lastTotpStep: user.lastTotpStep});
                else
                    resolve(false);
            });
        })
        .catch(e => reject(e));
    });

    /**
     * Retrieve the user with the specified id
     * 
     * @param id the id of the user to retrieve
     * 
     * @returns a Promise that resolves to the user object {id, username, credit}
     */
    this.getUser = async (id) => {
        return dbGetAsync(
            this.db,
            "SELECT id, username, credit, totp_secret, lastTotpStep FROM users WHERE id = ?",
            [id]
        );
    };

    /**
     * Updates the lastTotpStep for the user in the database.
     * 
     * @param userId id of the user
     * @param lastTotpStep the last TOTP step to set
     * 
     * @returns a Promise that resolves when the update is complete 
     */
    this.updateLastTotpStep = (userId, lastTotpStep) => {
        return dbRunAsync(
            this.db,
            "UPDATE users set lastTotpStep = ? WHERE id = ?",
            [lastTotpStep, userId]
        );
    };

    this.updateUserCredit = async (userId, price) => {
        return dbRunAsync(
            this.db,
            "UPDATE users SET credit = credit + ? WHERE id = ?",
            [price, userId]
        );
    }


    this.getSize = async (id) => {
        return dbGetAsync(
            this.db,
            "SELECT * FROM sizes WHERE id = ?",
            [id]
        );
    }

    this.getSizes = async () => {
        return dbAllAsync(
            this.db,
            "SELECT * FROM sizes",
            []
        );
    }

    this.updateSizeConfirmedToday = async (sizeId, sw_quantity) => {
        return dbRunAsync(
            this.db,
            "UPDATE sizes SET confirmed_today = confirmed_today - ? WHERE id = ?",
            [sw_quantity, sizeId]
        );
    }

    this.getIngredients = async () => {
        return dbAllAsync(
            this.db,
            "SELECT * FROM ingredients ORDER BY category, name",
            []
        );
    }


    this.getUserOrder = async (userId, orderId) => {
        return dbGetAsync(
            this.db,
            "SELECT * FROM orders WHERE user_id = ? AND id = ?",
            [userId, orderId]
        ); 
    }

    this.getUserOrders = async (userId, status) => {
        return dbAllAsync(
            this.db,
            `
            SELECT * 
            FROM orders 
            WHERE user_id = ? AND status = ? 
            ORDER BY created_at DESC
            `,
            [userId, status]
        );
    }

    this.createUserOrder = async (userId, sandwiches, totalPrice) => {
        const { lastID: orderId } = await dbRunAsync(
            this.db,
            "INSERT INTO orders (user_id, status, total_price) VALUES (?, ?, ?)",
            [userId, "confirmed", totalPrice]
        );
        
        // Insert sandwiches
        for (const sw of sandwiches) {
            const {
                sizeId,
                mainIngredientId,
                breadId,
                optionalIngredientIds = [],
                dressingIds = [],
                quantity = 1,
            } = sw;

           const { lastID: swId } = await dbRunAsync(
                this.db,
                `INSERT INTO order_sandwiches
                (order_id, size_id, main_ingredient_id, bread_id, quantity)
                VALUES (?, ?, ?, ?, ?)`,
                [orderId, sizeId, mainIngredientId, breadId, quantity]
            );

            await Promise.all([
                ...optionalIngredientIds.map(ingId =>
                    dbRunAsync(
                    this.db,
                    "INSERT INTO sandwich_optional_ingredients VALUES (?, ?)",
                    [swId, ingId]
                    )
                ),
                ...dressingIds.map(dressingId =>
                    dbRunAsync(
                    this.db,
                    "INSERT INTO sandwich_dressings VALUES (?, ?)",
                    [swId, dressingId]
                    )
                ),
            ]);

            await this.updateSizeConfirmedToday(sizeId, - quantity)
        }

        await this.updateUserCredit(userId, - totalPrice)

        return orderId;
    }

    this.deleteOrder = async (userId, orderId, order_price) => {
        // Get sandwiches to restore availability
        const sandwiches = await this.getOrderSandwiches(orderId);
        for (const sw of sandwiches) {
            await this.updateSizeConfirmedToday(sw.size_id, sw.quantity);
        }

        // Refund 90%
        const refund = Math.round(order_price * 0.9 * 100) / 100;
        await this.updateUserCredit(userId, refund)

        // Delete the order (cascades to sandwiches, ingredients, dressings)
        await dbRunAsync(
            this.db,
            "DELETE FROM orders WHERE id = ?",
            [orderId]
        );

        return { refund }
    }

    
    this.getOrderSandwiches = async (orderId) => {
        return dbAllAsync(
            this.db,
            "SELECT * FROM order_sandwiches WHERE order_id = ?",
            [orderId]
        );
    }

  // fetch all sandwiches of orderIds combined with ingredients and size entries
    this.getOrdersSandwiches = async (orderIds) => {
        const placeholders = orderIds.map(() => '?').join(',');
        return dbAllAsync(
            this.db,
            `
            SELECT 
                os.*,
                b.id AS b_id, b.name AS b_name,
                m.id AS m_id, m.name AS m_name,
                s.id AS s_id, s.label AS s_name, base_price, included_ingredients, max_dressings, daily_limit, s.confirmed_today
            FROM order_sandwiches os
            LEFT JOIN ingredients b ON b.id = os.bread_id
            LEFT JOIN ingredients m ON m.id = os.main_ingredient_id
            LEFT JOIN sizes s ON s.id = os.size_id
            WHERE os.order_id IN (${placeholders})
            `,
            orderIds
        );
    }

    this.getSandwichesOptionals = (sandwichIds) => {
        const swPlaceholders = sandwichIds.map(() => '?').join(',');
        return dbAllAsync(
            this.db,
            `
            SELECT soi.sandwich_id, i.id, i.name 
            FROM sandwich_optional_ingredients soi 
            JOIN ingredients i ON i.id = soi.ingredient_id 
            WHERE soi.sandwich_id IN (${swPlaceholders})
            `,
            sandwichIds
        );
    }

    this.getSandwichesDressings = (sandwichIds) => {
        const swPlaceholders = sandwichIds.map(() => '?').join(',');
        return dbAllAsync(
            this.db,
            `
            SELECT sd.sandwich_id, i.id, i.name 
            FROM sandwich_dressings sd 
            JOIN ingredients i ON i.id = sd.ingredient_id 
            WHERE sd.sandwich_id IN (${swPlaceholders})
            `,
            sandwichIds
        );
    }
  
}


export default Database;
