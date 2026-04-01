# LocalFit Node API Scaffold

This folder is a Node.js starter API that mirrors your PHP endpoints and service method names.

## 1-to-1 Endpoint Parity

- GET /products
- GET /product-listing
- GET /product-listing-offline
- GET /orders
- GET /orders/:id
- GET /orders-by-status?status=
- GET /order-stats
- GET /products-read?id=
- GET /carts
- GET /carts-read?id=
- GET /cart-summary
- GET /check_login_status
- GET /getAllUserEmails
- GET /all-users
- GET /messages?user1=&user2=
- GET /ratings
- GET /ratings/product/:productId
- GET /ratings/order/:orderId
- GET /ratings/summary/:productId
- POST /register
- POST /login
- POST /logout
- POST /products-create
- POST /carts-create
- POST /products-update/:id
- POST /carts-update
- POST /set_session
- POST /send-message
- POST /orders
- POST /messages-unread
- POST /ratings
- PUT /users/:userId/password
- PUT /orders/:id
- DELETE /products-delete/:id
- DELETE /carts-delete/:id
- DELETE /carts-clear

## Service Method Parity

The following class files contain the same method names as your PHP classes:

- ProductService
- ProductService1
- CartService
- UserService
- MessageService
- OrderService
- RatingService

## Run

1. Copy .env.example to .env
2. Install dependencies:
   npm install
3. Start dev server:
   npm run dev

Default port is 8080.

## Important

Service logic is fully implemented with SQL behavior matching your PHP services (users, products, carts, orders, ratings, and messages).

Authentication accepts:
- Bearer JWT (decoded via JWT secret)
- Legacy 32-char hex token format (for PHP-compatible token flow)
