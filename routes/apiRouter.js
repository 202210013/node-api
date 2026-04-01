const express = require("express");
const os = require("os");
const path = require("path");
const multer = require("multer");

const db = require("../config/db");
const { requireAuthentication } = require("../middleware/auth");

const ProductService = require("../services/ProductService");
const ProductService1 = require("../services/ProductService1");
const CartService = require("../services/CartService");
const UserService = require("../services/UserService");
const MessageService = require("../services/MessageService");
const OrderService = require("../services/OrderService");
const RatingService = require("../services/RatingService");

const router = express.Router();

const upload = multer({
  dest: path.join(os.tmpdir(), "localfit-node-upload")
});

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function inferErrorStatus(result) {
  const message = String((result && (result.error || result.message)) || "").toLowerCase();
  if (!message) {
    return 400;
  }
  if (message.includes("unauthorized") || message.includes("invalid token") || message.includes("not authenticated")) {
    return 401;
  }
  if (message.includes("invalid email or password")) {
    return 401;
  }
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("missing") || message.includes("already")) {
    return 400;
  }
  if (message.includes("failed") || message.includes("unable")) {
    return 500;
  }
  return 400;
}

function sendResult(res, result, successStatus = 200) {
  const isFailure = Boolean(
    result && (
      result.success === false ||
      (typeof result === "object" && !Array.isArray(result) && Object.prototype.hasOwnProperty.call(result, "error"))
    )
  );

  if (isFailure) {
    return res.status(inferErrorStatus(result)).json(result);
  }

  return res.status(successStatus).json(result);
}

function getUserId(req) {
  return (req.user && req.user.user_id) || req.headers["x-user-id"] || req.query.user_id || req.body.user_id || null;
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  const match = auth.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

router.get("/products", requireAuthentication, asyncHandler(async (req, res) => {
  const productService = new ProductService(db);
  return sendResult(res, await productService.readProducts(getUserId(req), getToken(req)));
}));

router.get("/product-listing", asyncHandler(async (_req, res) => {
  const productService = new ProductService(db);
  return sendResult(res, await productService.readAllProducts());
}));

router.get("/product-listing-offline", asyncHandler(async (_req, res) => {
  const productService1 = new ProductService1(db);
  return sendResult(res, await productService1.readAllProducts1());
}));

router.get("/orders/:id", asyncHandler(async (req, res) => {
  const orderService = new OrderService(db);
  return sendResult(res, await orderService.getOrderById(req.params.id));
}));

router.get("/orders", asyncHandler(async (req, res) => {
  const orderService = new OrderService(db);
  return sendResult(res, await orderService.getAllOrders(req.query.user || null));
}));

router.get("/orders-by-status", asyncHandler(async (req, res) => {
  if (!req.query.status) {
    return res.status(400).json({ error: "Status parameter is required" });
  }
  const orderService = new OrderService(db);
  return sendResult(res, await orderService.getOrdersByStatus(req.query.status));
}));

router.get("/order-stats", asyncHandler(async (_req, res) => {
  const orderService = new OrderService(db);
  return sendResult(res, await orderService.getOrderStats());
}));

router.get("/products-read", asyncHandler(async (req, res) => {
  if (!req.query.id) {
    return res.status(400).json({ error: "Product ID is required" });
  }
  const productService = new ProductService(db);
  return sendResult(res, await productService.readOneProduct(req.query.id));
}));

router.get("/carts", requireAuthentication, asyncHandler(async (req, res) => {
  const cartService = new CartService(db);
  return sendResult(res, await cartService.readCarts(getUserId(req)));
}));

router.get("/carts-read", asyncHandler(async (req, res) => {
  if (!req.query.id) {
    return res.status(400).json({ error: "Cart ID is required" });
  }
  const cartService = new CartService(db);
  return sendResult(res, await cartService.readOneCart(req.query.id));
}));

router.get("/cart-summary", requireAuthentication, asyncHandler(async (req, res) => {
  const cartService = new CartService(db);
  return sendResult(res, await cartService.getCartSummary(getUserId(req)));
}));

router.get("/check_login_status", requireAuthentication, asyncHandler(async (req, res) => {
  const userService = new UserService(db);
  return sendResult(res, await userService.checkLoginStatus(req.user));
}));

router.get("/getAllUserEmails", asyncHandler(async (_req, res) => {
  const userService = new UserService(db);
  return sendResult(res, await userService.getAllEmails());
}));

router.get("/all-users", asyncHandler(async (req, res) => {
  const userService = new UserService(db);
  const currentUser = req.query.currentUser || null;
  return sendResult(res, await userService.getAllUsers(currentUser));
}));

router.get("/messages", asyncHandler(async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) {
    return res.status(400).json({ error: "user1 and user2 required" });
  }
  const messageService = new MessageService(db);
  return sendResult(res, await messageService.getMessagesBetween(user1, user2));
}));

router.get("/ratings", requireAuthentication, asyncHandler(async (_req, res) => {
  const ratingService = new RatingService(db);
  return sendResult(res, await ratingService.getAllRatings());
}));

router.get("/ratings/product/:productId", asyncHandler(async (req, res) => {
  const ratingService = new RatingService(db);
  return sendResult(res, await ratingService.getRatingsByProduct(req.params.productId));
}));

router.get("/ratings/order/:orderId", asyncHandler(async (req, res) => {
  const ratingService = new RatingService(db);
  return sendResult(res, await ratingService.getRatingByOrder(req.params.orderId));
}));

router.get("/ratings/summary/:productId", asyncHandler(async (req, res) => {
  const ratingService = new RatingService(db);
  return sendResult(res, await ratingService.getProductRatingSummary(req.params.productId));
}));

router.post("/register", asyncHandler(async (req, res) => {
  const userService = new UserService(db);
  return sendResult(res, await userService.registerUser(req.body), 201);
}));

router.post("/login", asyncHandler(async (req, res) => {
  const userService = new UserService(db);
  return sendResult(res, await userService.loginUser(req.body));
}));

router.post("/logout", asyncHandler(async (_req, res) => {
  const userService = new UserService(db);
  return sendResult(res, await userService.logoutUser());
}));

router.post("/products-create", requireAuthentication, upload.single("image"), asyncHandler(async (req, res) => {
  const productService = new ProductService(db);
  return sendResult(res, await productService.createProduct(req.body, req.file, getUserId(req), getToken(req)), 201);
}));

router.post("/carts-create", requireAuthentication, asyncHandler(async (req, res) => {
  const cartService = new CartService(db);
  return sendResult(res, await cartService.createCart(req.body, getUserId(req), getToken(req)), 201);
}));

router.post("/products-update/:id", requireAuthentication, upload.single("image"), asyncHandler(async (req, res) => {
  const productService = new ProductService(db);
  return sendResult(res, await productService.updateProduct(req.params.id, req.body, req.file, getUserId(req), getToken(req)));
}));

router.post("/carts-update", requireAuthentication, asyncHandler(async (req, res) => {
  const cartService = new CartService(db);
  return sendResult(res, await cartService.updateCart(req.body, getUserId(req)));
}));

router.post("/set_session", asyncHandler(async (req, res) => {
  const userService = new UserService(db);
  return sendResult(res, await userService.setSession(req.body));
}));

router.post("/send-message", asyncHandler(async (req, res) => {
  const messageService = new MessageService(db);
  return sendResult(res, await messageService.saveMessage(req.body));
}));

router.post("/orders", asyncHandler(async (req, res) => {
  const data = req.body;
  const orderService = new OrderService(db);

  if (data && data.action === "approve" && data.orderId) {
    return sendResult(res, await orderService.approveOrder(data.orderId));
  }

  if (data && data.action === "decline" && data.orderId) {
    return sendResult(res, await orderService.declineOrder(data.orderId, data.remarks || null));
  }

  if (data && data.action === "ready-for-pickup" && data.orderId) {
    return sendResult(res, await orderService.markReadyForPickup(data.orderId));
  }

  if (data && data.action === "confirm-pickup" && data.orderId && data.customerEmail) {
    return sendResult(res, await orderService.confirmPickup(data.orderId, data.customerEmail, data.orNumber || null));
  }

  if (data && data.action === "update-completion-remarks" && data.orderId && data.remarks !== undefined) {
    return sendResult(res, await orderService.updateCompletionRemarks(data.orderId, data.remarks, data.size || null));
  }

  if (Array.isArray(data) && data[0] && data[0].customer) {
    return sendResult(res, await orderService.createOrders(data), 201);
  }

  return res.status(400).json({ error: "Invalid order data", received_data: data });
}));

router.post("/messages-unread", requireAuthentication, asyncHandler(async (req, res) => {
  const recipient = getUserId(req);
  if (!recipient) {
    return res.status(401).json({ error: "User not logged in" });
  }
  const messageService = new MessageService(db);
  return sendResult(res, await messageService.getUnreadMessages(recipient));
}));

router.post("/ratings", requireAuthentication, asyncHandler(async (req, res) => {
  const { orderId, productId, rating, review = null } = req.body || {};
  if (!orderId || !productId || !rating) {
    return res.status(400).json({ success: false, error: "Order ID, Product ID, and rating are required" });
  }

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: "User not authenticated" });
  }

  const ratingService = new RatingService(db);
  return sendResult(res, await ratingService.submitRating(orderId, productId, userId, rating, review));
}));

router.put("/users/:userId/password", requireAuthentication, asyncHandler(async (req, res) => {
  const userService = new UserService(db);
  const { currentPassword, newPassword } = req.body || {};
  return sendResult(res, await userService.changeUserPassword(req.params.userId, currentPassword, newPassword));
}));

router.put("/orders/:id", requireAuthentication, asyncHandler(async (req, res) => {
  const orderService = new OrderService(db);
  const orderId = req.params.id;
  const { status = null, pickup_date: pickupDate = null } = req.body || {};
  return sendResult(res, await orderService.updateOrderStatus(orderId, status, pickupDate));
}));

router.delete("/products-delete/:id", requireAuthentication, asyncHandler(async (req, res) => {
  const productService = new ProductService(db);
  return sendResult(res, await productService.deleteProduct(req.params.id, getUserId(req), getToken(req)));
}));

router.delete("/carts-delete/:id", requireAuthentication, asyncHandler(async (req, res) => {
  const cartService = new CartService(db);
  return sendResult(res, await cartService.deleteCart(req.params.id, getUserId(req)));
}));

router.delete("/carts-clear", requireAuthentication, asyncHandler(async (req, res) => {
  const cartService = new CartService(db);
  return sendResult(res, await cartService.clearCart(getUserId(req)));
}));

module.exports = router;
