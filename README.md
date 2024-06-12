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
