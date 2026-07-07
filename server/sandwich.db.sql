BEGIN TRANSACTION;

-- Schema Definition
CREATE TABLE IF NOT EXISTS "sizes" (
	"id"	TEXT PRIMARY KEY,
	"label"	TEXT NOT NULL,
	"base_price"	REAL NOT NULL,
	"included_ingredients"	INTEGER NOT NULL,
	"max_dressings"	INTEGER NOT NULL,
	"daily_limit"	INTEGER NOT NULL,
	"confirmed_today"	INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "ingredients" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"name"	TEXT NOT NULL UNIQUE,
	"category"	TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"username"	TEXT NOT NULL UNIQUE,
	"password_hash"	TEXT NOT NULL,
	"salt"	TEXT NOT NULL,
	"credit"	REAL NOT NULL DEFAULT 100.0,
	"totp_secret"	TEXT,
	"lastTotpStep"	INTEGER
);

CREATE TABLE IF NOT EXISTS "orders" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"user_id"	INTEGER NOT NULL REFERENCES "users"("id"),
	"status"	TEXT NOT NULL DEFAULT 'draft',
	"total_price"	REAL,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY("user_id") REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "order_sandwiches" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"order_id"	INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
	"size_id"	TEXT NOT NULL REFERENCES "sizes"("id"),
	"main_ingredient_id"	INTEGER NOT NULL REFERENCES "ingredients"("id"),
	"bread_id"	INTEGER NOT NULL REFERENCES "ingredients"("id"),
	"quantity"	INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "sandwich_optional_ingredients" (
	"sandwich_id"	INTEGER NOT NULL REFERENCES "order_sandwiches"("id") ON DELETE CASCADE,
	"ingredient_id"	INTEGER NOT NULL REFERENCES "ingredients"("id"),
	PRIMARY KEY("sandwich_id","ingredient_id")
);

CREATE TABLE IF NOT EXISTS "sandwich_dressings" (
	"sandwich_id"	INTEGER NOT NULL REFERENCES "order_sandwiches"("id") ON DELETE CASCADE,
	"ingredient_id"	INTEGER NOT NULL REFERENCES "ingredients"("id"),
	PRIMARY KEY("sandwich_id","ingredient_id")
);

-- Seed Data: Sizes
INSERT INTO "sizes" VALUES ('S','Small',5.0,2,1,10,7);
INSERT INTO "sizes" VALUES ('M','Medium',7.0,3,2,8,4);
INSERT INTO "sizes" VALUES ('L','Large',10.0,4,2,6,6);

-- Seed Data: Ingredients
INSERT INTO "ingredients" VALUES (1,'roast beef','main');
INSERT INTO "ingredients" VALUES (2,'ham','main');
INSERT INTO "ingredients" VALUES (3,'bacon','main');
INSERT INTO "ingredients" VALUES (4,'wheat','bread');
INSERT INTO "ingredients" VALUES (5,'brown','bread');
INSERT INTO "ingredients" VALUES (6,'lettuce','optional');
INSERT INTO "ingredients" VALUES (7,'olives','optional');
INSERT INTO "ingredients" VALUES (8,'onions','optional');
INSERT INTO "ingredients" VALUES (9,'cucumber','optional');
INSERT INTO "ingredients" VALUES (10,'yellow cheese','optional');
INSERT INTO "ingredients" VALUES (11,'tomatoes','optional');
INSERT INTO "ingredients" VALUES (12,'mozzarella','optional');
INSERT INTO "ingredients" VALUES (13,'olive oil','dressing');
INSERT INTO "ingredients" VALUES (14,'mustard','dressing');
INSERT INTO "ingredients" VALUES (15,'mayonnaise','dressing');

-- Seed Data: Users
-- (Note: Using placeholder deterministic hashes/salts derived from standard crypto conventions for seed tracking)
INSERT INTO "users" VALUES (1,'musty','15c0573ac9a7fba27ff949a9a619ff7f8b822266c89247d44007568bb92c08df','fdad6bd25d96cd6858fdddbac01054ef',46.0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0);
INSERT INTO "users" VALUES (2,'hicham','2627c96d83ff0ae68316c6acf92544e2d77db7dcc26c3498f3669e75e1711696','7e344dfa2b6fd9f7f88d02d84bc263f3',38.4,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0);
INSERT INTO "users" VALUES (3,'abdel','7c31046522d8801756e7f9445a947fd311ec1bebe7ea1aabd29869c060fc3e34','70b2d104e161d1e7249defc8a50bd46d',100.0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0);
INSERT INTO "users" VALUES (4,'jaouad','e88022adea4c2335124c851aac88dd4e27a92252662c66ac6d3366baffdab00a','b287d36aa1d78576fb5f8a5c9117b572',100.0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0);

-- Seed Data: Orders
INSERT INTO "orders" VALUES (1,1,'confirmed',12.0,CURRENT_TIMESTAMP);
INSERT INTO "orders" VALUES (2,1,'confirmed',20.0,CURRENT_TIMESTAMP);
INSERT INTO "orders" VALUES (3,1,'confirmed',22.0,CURRENT_TIMESTAMP);
INSERT INTO "orders" VALUES (4,2,'confirmed',16.0,CURRENT_TIMESTAMP);
INSERT INTO "orders" VALUES (5,2,'confirmed',20.0,CURRENT_TIMESTAMP);
INSERT INTO "orders" VALUES (6,2,'confirmed',25.6,CURRENT_TIMESTAMP);

-- Seed Data: Order Sandwiches
-- Order A1 (id=1)
INSERT INTO "order_sandwiches" VALUES (1,1,'S',2,4,1);
INSERT INTO "order_sandwiches" VALUES (2,1,'M',3,5,1);
-- Order A2 (id=2)
INSERT INTO "order_sandwiches" VALUES (3,2,'L',1,4,2);
-- Order A3 (id=3)
INSERT INTO "order_sandwiches" VALUES (4,3,'S',2,5,1);
INSERT INTO "order_sandwiches" VALUES (5,3,'M',1,4,1);
INSERT INTO "order_sandwiches" VALUES (6,3,'L',3,5,1);
-- Order B1 (id=4)
INSERT INTO "order_sandwiches" VALUES (7,4,'S',2,4,4);
-- Order B2 (id=5)
INSERT INTO "order_sandwiches" VALUES (8,5,'M',1,4,1);
INSERT INTO "order_sandwiches" VALUES (9,5,'L',3,5,1);
-- Order B3 (id=6)
INSERT INTO "order_sandwiches" VALUES (10,6,'S',3,5,1);
INSERT INTO "order_sandwiches" VALUES (11,6,'M',2,4,1);
INSERT INTO "order_sandwiches" VALUES (12,6,'L',1,4,2);

-- Seed Data: Sandwich Optional Ingredients
-- Sandwich sw1 (id=1)
INSERT INTO "sandwich_optional_ingredients" VALUES (1,6);
INSERT INTO "sandwich_optional_ingredients" VALUES (1,7);
-- Sandwich sw2 (id=2)
INSERT INTO "sandwich_optional_ingredients" VALUES (2,6);
INSERT INTO "sandwich_optional_ingredients" VALUES (2,11);
INSERT INTO "sandwich_optional_ingredients" VALUES (2,9);
-- Sandwich sw3 (id=3)
INSERT INTO "sandwich_optional_ingredients" VALUES (3,6);
INSERT INTO "sandwich_optional_ingredients" VALUES (3,11);
INSERT INTO "sandwich_optional_ingredients" VALUES (3,9);
INSERT INTO "sandwich_optional_ingredients" VALUES (3,10);
-- Sandwich sw4 (id=4)
INSERT INTO "sandwich_optional_ingredients" VALUES (4,8);
INSERT INTO "sandwich_optional_ingredients" VALUES (4,9);
-- Sandwich sw5 (id=5)
INSERT INTO "sandwich_optional_ingredients" VALUES (5,12);
INSERT INTO "sandwich_optional_ingredients" VALUES (5,11);
INSERT INTO "sandwich_optional_ingredients" VALUES (5,7);
-- Sandwich sw6 (id=6)
INSERT INTO "sandwich_optional_ingredients" VALUES (6,6);
INSERT INTO "sandwich_optional_ingredients" VALUES (6,11);
INSERT INTO "sandwich_optional_ingredients" VALUES (6,9);
INSERT INTO "sandwich_optional_ingredients" VALUES (6,10);
-- Sandwich sw7 (id=7)
INSERT INTO "sandwich_optional_ingredients" VALUES (7,6);
INSERT INTO "sandwich_optional_ingredients" VALUES (7,11);
-- Sandwich sw8 (id=8)
INSERT INTO "sandwich_optional_ingredients" VALUES (8,6);
INSERT INTO "sandwich_optional_ingredients" VALUES (8,12);
INSERT INTO "sandwich_optional_ingredients" VALUES (8,8);
-- Sandwich sw9 (id=9)
INSERT INTO "sandwich_optional_ingredients" VALUES (9,6);
INSERT INTO "sandwich_optional_ingredients" VALUES (9,11);
INSERT INTO "sandwich_optional_ingredients" VALUES (9,9);
INSERT INTO "sandwich_optional_ingredients" VALUES (9,10);
INSERT INTO "sandwich_optional_ingredients" VALUES (9,12);
-- Sandwich sw10 (id=10)
INSERT INTO "sandwich_optional_ingredients" VALUES (10,7);
INSERT INTO "sandwich_optional_ingredients" VALUES (10,8);
-- Sandwich sw11 (id=11)
INSERT INTO "sandwich_optional_ingredients" VALUES (11,9);
INSERT INTO "sandwich_optional_ingredients" VALUES (11,10);
INSERT INTO "sandwich_optional_ingredients" VALUES (11,11);
-- Sandwich sw12 (id=12)
INSERT INTO "sandwich_optional_ingredients" VALUES (12,6);
INSERT INTO "sandwich_optional_ingredients" VALUES (12,11);
INSERT INTO "sandwich_optional_ingredients" VALUES (12,9);
INSERT INTO "sandwich_optional_ingredients" VALUES (12,7);

-- Seed Data: Sandwich Dressings
-- Sandwich sw3 (id=3)
INSERT INTO "sandwich_dressings" VALUES (3,13);
-- Sandwich sw5 (id=5)
INSERT INTO "sandwich_dressings" VALUES (5,14);
-- Sandwich sw6 (id=6)
INSERT INTO "sandwich_dressings" VALUES (6,15);
-- Sandwich sw8 (id=8)
INSERT INTO "sandwich_dressings" VALUES (8,13);
-- Sandwich sw9 (id=9)
INSERT INTO "sandwich_dressings" VALUES (9,15);
INSERT INTO "sandwich_dressings" VALUES (9,14);
-- Sandwich sw12 (id=12)
INSERT INTO "sandwich_dressings" VALUES (12,13);

COMMIT;
