# Cubikor-Ecom API

This project is a user management API built with Node.js and Express, featuring user registration, login, user profile management, shopping cart functionalities, and file upload capabilities.

## Project Structure

- **src/config**: Configuration files (e.g., database connection).
- **src/controllers**: Controller files containing the logic for handling requests.
- **src/middleware**: Middleware files (e.g., authentication).
- **src/models**: Data models and related logic.
- **src/routes**: Route definitions for the API endpoints.
- **src/utils**: Utility functions (e.g., database query execution).
- **uploads**: Directory for storing uploaded files.
- **app.js**: Main application file.

## Endpoints

- **/api/auth/register**: Register a new user.
- **/api/auth/login**: Login an existing user.
- **/api/users**: Get all users.
- **/api/users/:id**: Get, update, or delete a user by ID.
- **/api/users/:id/shopping_cart**: Add to, view, or remove from shopping cart.
- **/api/users/:id/upload**: Upload a file.

## Running the Project

1. Install dependencies:
   ```sh
   npm install
# E-commerce Database Schema

This repository contains the schema for a MariaDB database used in an e-commerce platform. The database includes tables for users, shops, products, categories, shopping carts, and orders. Below is a detailed description of each table and its structure.

## Database Tables

### 1. Users
The `users` table contains information about the users of the system.

| Field             | Type         | Null | Key | Default | Extra          |
|-------------------|--------------|------|-----|---------|----------------|
| id                | int(11)      | NO   | PRI | NULL    | auto_increment |
| username          | varchar(50)  | NO   |     | NULL    |                |
| name              | varchar(100) | YES  |     | NULL    |                |
| auth              | tinyint(1)   | YES  |     | NULL    |                |
| email             | varchar(100) | NO   | UNI | NULL    |                |
| password          | varchar(255) | NO   |     | NULL    |                |
| date_of_birth     | date         | YES  |     | NULL    |                |
| country           | varchar(100) | YES  |     | NULL    |                |
| security_question | varchar(255) | YES  |     | NULL    |                |
| security_answer   | varchar(255) | YES  |     | NULL    |                |
| street            | varchar(255) | YES  |     | NULL    |                |
| city              | varchar(100) | YES  |     | NULL    |                |
| state             | varchar(100) | YES  |     | NULL    |                |
| zipcode           | varchar(20)  | YES  |     | NULL    |                |
| shipping_country  | varchar(100) | YES  |     | NULL    |                |
| mobile_number     | varchar(20)  | YES  |     | NULL    |                |
| last_activity     | timestamp    | YES  |     | NULL    |                |
| user_type         | varchar(255) | YES  |     | NULL    |                |
| verified          | tinyint(1)   | YES  |     | 0       |                |

### 2. Shops
The `shops` table contains information about the shops registered in the system.

| Field    | Type         | Null | Key | Default | Extra          |
|----------|--------------|------|-----|---------|----------------|
| id       | int(11)      | NO   | PRI | NULL    | auto_increment |
| name     | varchar(255) | NO   |     | NULL    |                |
| email    | varchar(255) | NO   |     | NULL    |                |
| mobile   | varchar(255) | NO   |     | NULL    |                |
| address  | text         | YES  |     | NULL    |                |
| password | varchar(255) | NO   |     | NULL    |                |

### 3. Shopping Cart
The `shopping_cart` table contains information about items in users' shopping carts.

| Field      | Type    | Null | Key | Default | Extra          |
|------------|---------|------|-----|---------|----------------|
| id         | int(11) | NO   | PRI | NULL    | auto_increment |
| user_id    | int(11) | NO   | MUL | NULL    |                |
| CategoryId | int(11) | NO   |     | NULL    |                |
| productId  | int(11) | NO   |     | NULL    |                |
| quantity   | int(11) | NO   |     | NULL    |                |
| shopId     | int(11) | NO   |     | NULL    |                |

### 4. Products (prd)
The `prd` table contains information about products.

| Field       | Type          | Null | Key | Default | Extra          |
|-------------|---------------|------|-----|---------|----------------|
| id          | int(11)       | NO   | PRI | NULL    | auto_increment |
| name        | varchar(255)  | NO   |     | NULL    |                |
| href        | varchar(255)  | YES  |     | NULL    |                |
| imageSrc    | varchar(255)  | YES  |     | NULL    |                |
| imageAlt    | varchar(255)  | YES  |     | NULL    |                |
| price       | decimal(10,2) | NO   |     | NULL    |                |
| color       | varchar(255)  | YES  |     | NULL    |                |
| rating      | decimal(3,2)  | YES  |     | NULL    |                |
| reviewCount | int(11)       | YES  |     | NULL    |                |
| description | text          | YES  |     | NULL    |                |
| details     | text          | YES  |     | NULL    |                |
| highlights  | text          | YES  |     | NULL    |                |
| category_id | int(11)       | YES  | MUL | NULL    |                |
| shop_id     | int(11)       | YES  | MUL | NULL    |                |

### 5. Categories (catg)
The `catg` table contains information about product categories.

| Field   | Type         | Null | Key | Default | Extra          |
|---------|--------------|------|-----|---------|----------------|
| id      | int(11)      | NO   | PRI | NULL    | auto_increment |
| name    | varchar(255) | NO   |     | NULL    |                |
| href    | varchar(255) | YES  |     | NULL    |                |
| shop_id | int(11)      | YES  | MUL | NULL    |                |

### 6. Seller Orders (SellerOrders)
The `SellerOrders` table contains information about orders placed with sellers.

| Field             | Type                                                                               | Null | Key | Default             | Extra          |
|-------------------|------------------------------------------------------------------------------------|------|-----|---------------------|----------------|
| order_id          | int(11)                                                                            | NO   | PRI | NULL                | auto_increment |
| seller_id         | int(11)                                                                            | YES  | MUL | NULL                |                |
| customer_id       | int(11)                                                                            | YES  | MUL | NULL                |                |
| product_id        | int(11)                                                                            | YES  | MUL | NULL                |                |
| quantity          | int(11)                                                                            | YES  |     | NULL                |                |
| order_date        | datetime                                                                           | YES  |     | current_timestamp() |                |
| status            | enum('Order Placed','Order Confirmed','Shipped','Delivered','Canceled','Returned') | YES  |     | Order Placed        |                |
| user_address      | varchar(2000)                                                                      | YES  |     | NULL                |                |
| Product_name      | varchar(255)                                                                       | YES  |     | NULL                |                |
| product_imageSrc  | varchar(255)                                                                       | YES  |     | NULL                |                |
| product_price     | decimal(10,2)                                                                      | YES  |     | NULL                |                |
| user_name         | varchar(255)                                                                       | YES  |     | NULL                |                |
| user_mobileNumber | varchar(20)                                                                        | YES  |     | NULL                |                |

### 7. Customer Orders (CustomerOrders)
The `CustomerOrders` table contains information about orders placed by customers.

| Field            | Type                                                                               | Null | Key | Default             | Extra          |
|------------------|------------------------------------------------------------------------------------|------|-----|---------------------|----------------|
| order_id         | int(11)                                                                            | NO   | PRI | NULL                | auto_increment |
| customer_id      | int(11)                                                                            | YES  | MUL | NULL                |                |
| product_id       | int(11)                                                                            | YES  | MUL | NULL                |                |
| Product_name     | varchar(255)                                                                       | YES  |     | NULL                |                |
| product_imageSrc | varchar(255)                                                                       | YES  |     | NULL                |                |
| product_price    | decimal(10,2)                                                                      | YES  |     | NULL                |                |
| seller_id        | int(11)                                                                            | YES  | MUL | NULL                |                |
| quantity         | int(11)                                                                            | YES  |     | NULL                |                |
| order_date       | datetime                                                                           | YES  |     | current_timestamp() |                |
| status           | enum('Order Placed','Order Confirmed','Shipped','Delivered','Canceled','Returned') | YES  |     | Order Placed        |                |

## Getting Started

To set up this database on your local machine, follow these steps:

1. **Install MariaDB**:
   - Follow the official documentation to install MariaDB: [MariaDB Installation Guide](https://mariadb.com/kb/en/getting-installing-and-upgrading-mariadb/).

2. **Create Database**:
   ```sql
   CREATE DATABASE userDB;
