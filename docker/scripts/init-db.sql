-- Database initialization script for PostgreSQL
-- This script runs automatically when the PostgreSQL container starts

-- Create the bakery_user if it doesn't exist
-- Note: The password should match what's in the docker-compose.yml
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_user
      WHERE  usename = 'bakery_user') THEN
      CREATE USER bakery_user WITH PASSWORD 'bakery_password';
   END IF;
END
$do$;

-- Create schemas for better organization
CREATE SCHEMA IF NOT EXISTS bakery;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS inventory;

-- Set default search path
SET search_path TO bakery, public;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled');
CREATE TYPE user_role AS ENUM ('customer', 'staff', 'admin', 'super_admin');
CREATE TYPE product_category AS ENUM ('bread', 'pastry', 'cake', 'sandwich', 'beverage', 'other');

-- Users table (moved from SQLite)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'customer',
    phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS bakery.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category product_category NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'piece',
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    allergens TEXT[],
    nutritional_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES bakery.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER DEFAULT 10,
    max_quantity INTEGER DEFAULT 1000,
    unit VARCHAR(50) DEFAULT 'piece',
    last_restocked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS bakery.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID REFERENCES auth.users(id),
    status order_status DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    pickup_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS bakery.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES bakery.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES bakery.products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    special_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recipes table
CREATE TABLE IF NOT EXISTS bakery.recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES bakery.products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    ingredients JSONB NOT NULL,
    instructions TEXT[],
    prep_time_minutes INTEGER,
    bake_time_minutes INTEGER,
    yield_amount INTEGER,
    yield_unit VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cash register/transactions table
CREATE TABLE IF NOT EXISTS bakery.cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES bakery.orders(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat/messages table
CREATE TABLE IF NOT EXISTS bakery.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES auth.users(id),
    recipient_id UUID REFERENCES auth.users(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unsold products tracking
CREATE TABLE IF NOT EXISTS bakery.unsold_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES bakery.products(id),
    quantity INTEGER NOT NULL,
    reason VARCHAR(255),
    recorded_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_orders_customer_id ON bakery.orders(customer_id);
CREATE INDEX idx_orders_status ON bakery.orders(status);
CREATE INDEX idx_orders_created_at ON bakery.orders(created_at);
CREATE INDEX idx_order_items_order_id ON bakery.order_items(order_id);
CREATE INDEX idx_products_category ON bakery.products(category);
CREATE INDEX idx_products_available ON bakery.products(is_available);
CREATE INDEX idx_inventory_product_id ON inventory.items(product_id);
CREATE INDEX idx_chat_messages_sender ON bakery.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_recipient ON bakery.chat_messages(recipient_id);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update timestamp triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON bakery.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory.items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON bakery.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON bakery.recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - should be changed immediately)
INSERT INTO auth.users (email, password, name, role) 
VALUES (
    'admin@bakery.local',
    crypt('admin123', gen_salt('bf')),
    'Admin User',
    'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample products
INSERT INTO bakery.products (name, description, category, price, unit) VALUES
    ('Sourdough Bread', 'Traditional sourdough with a crispy crust', 'bread', 4.50, 'loaf'),
    ('Croissant', 'Buttery French pastry', 'pastry', 2.50, 'piece'),
    ('Chocolate Cake', 'Rich chocolate layer cake', 'cake', 35.00, 'whole'),
    ('Ham & Cheese Sandwich', 'Fresh daily sandwich', 'sandwich', 6.50, 'piece'),
    ('Cappuccino', 'Italian style coffee', 'beverage', 3.50, 'cup')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bakery TO bakery_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO bakery_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA inventory TO bakery_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bakery TO bakery_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO bakery_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA inventory TO bakery_user;
GRANT USAGE ON SCHEMA bakery TO bakery_user;
GRANT USAGE ON SCHEMA auth TO bakery_user;
GRANT USAGE ON SCHEMA inventory TO bakery_user;