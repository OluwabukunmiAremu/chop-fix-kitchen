PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  image TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  fulfilment TEXT NOT NULL CHECK(fulfilment IN ('Delivery','Pickup')),
  address TEXT,
  notes TEXT,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status TEXT NOT NULL DEFAULT 'pending_payment',
  paystack_reference TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  line_total INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

INSERT OR IGNORE INTO products (id,name,category,price,image,description,available,sort_order) VALUES
('smoky-jollof-fix','Smoky Jollof Fix','Rice',6500,'/assets/jollof.png','Smoky jollof rice, grilled chicken & sweet plantain.',1,1),
('fried-rice-fix','Fried Rice Fix','Rice',7000,'/assets/fried-rice.png','Nigerian fried rice, grilled chicken & plantain.',1,2),
('spaghetti-fix','Spaghetti Fix','Pasta',6500,'/assets/spaghetti.png','Smoky party spaghetti, grilled chicken & sweet plantain.',1,3);


INSERT OR REPLACE INTO products (id,name,category,price,image,description,available,sort_order) VALUES
('penne-meatballs','Penne Pasta + Meatballs','Pasta',7000,'/assets/menu/penne-meatballs.webp','Saucy penne pasta finished with seasoned beef meatballs.',1,10),
('penne-grilled-chicken','Penne Pasta + Grilled Chicken','Pasta',6500,'/assets/menu/penne-chicken.webp','Saucy penne pasta topped with smoky grilled chicken.',1,11),
('jollof-combo','Jollof Combo','Rice',6500,'/assets/menu/jollof-combo.webp','Jollof rice, sweet plantain and turkey. Minimum order quantity: 5 packs.',1,12),
('party-platter','Party Platter — serves 15','Catering',250000,'/assets/menu/party-platter.webp','5L fried rice, 12 big burgers, 12 chicken kebabs, small chops platter with money bags, 12 cups mixed fruit and 12 complimentary popcorn packs.',1,13);
