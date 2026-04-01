const BaseService = require("./BaseService");
const UserService = require("./UserService");

class CartService extends BaseService {
  constructor(db, userId = null, token = null) {
    super(db);
    this.userId = userId;
    this.token = token;
    this.tableName = "carts";
  }

  async createCart(data, userId = null, token = null) {
    const userService = new UserService(this.db);
    const tokenValidation = await userService.validateToken(token || this.token);
    if (!tokenValidation.valid) {
      return { error: "Invalid token." };
    }

    if (!data || !data.product_id || !data.quantity) {
      return { error: "Product ID and quantity are required" };
    }

    const productId = Number(data.product_id);
    const quantity = Number(data.quantity);
    const size = data.size ? String(data.size) : "M";
    const pickupDate = data.pickup_date ? String(data.pickup_date) : null;

    if (pickupDate && !this.isValidPickupDate(pickupDate)) {
      return { error: "Invalid pickup date. Date must be between today and 30 days from now." };
    }

    const products = await this.db.query("SELECT id FROM products WHERE id = ?", [productId]);
    if (!products[0]) {
      return { error: "Product not found" };
    }

    await this.db.query(
      `INSERT INTO ${this.tableName} (product_id, quantity, size, pickup_date, user_id) VALUES (?, ?, ?, ?, ?)`,
      [productId, quantity, size, pickupDate, userId || this.userId]
    );

    return { message: "Cart was created." };
  }

  async readCarts(userId = null) {
    const rows = await this.db.query(
      `SELECT c.id, c.product_id, c.quantity, c.size, c.pickup_date, c.user_id, p.name, p.price, p.description, p.image
       FROM ${this.tableName} c
       INNER JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.id DESC`,
      [userId || this.userId]
    );

    return { records: rows };
  }

  async readOneCart(id) {
    const rows = await this.db.query(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    if (!rows[0]) {
      return { message: "Cart not found." };
    }
    return rows[0];
  }

  async updateCart(data, userId = null) {
    const productId = Number(data.product_id);
    const quantity = Number(data.quantity);
    const size = data.size ? String(data.size) : "M";
    const pickupDate = data.pickup_date ? String(data.pickup_date) : null;
    const id = Number(data.id);

    if (pickupDate && !this.isValidPickupDate(pickupDate)) {
      return { error: "Invalid pickup date. Date must be between today and 30 days from now." };
    }

    await this.db.query(
      `UPDATE ${this.tableName}
       SET product_id = ?, quantity = ?, size = ?, pickup_date = ?
       WHERE id = ? AND user_id = ?`,
      [productId, quantity, size, pickupDate, id, userId || this.userId]
    );

    return { message: "Cart was updated." };
  }

  async deleteCart(id, userId = null) {
    const rows = await this.db.query(`SELECT id FROM ${this.tableName} WHERE id = ? AND user_id = ?`, [id, userId || this.userId]);
    if (!rows[0]) {
      return { message: "Cart not found." };
    }

    await this.db.query(`DELETE FROM ${this.tableName} WHERE id = ? AND user_id = ?`, [id, userId || this.userId]);
    return { message: "Cart was deleted." };
  }

  isValidPickupDate(pickupDate) {
    if (!pickupDate || !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
      return false;
    }

    const inputDate = new Date(`${pickupDate}T00:00:00`);
    if (Number.isNaN(inputDate.getTime())) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);

    return inputDate >= today && inputDate <= maxDate;
  }

  async clearCart(userId = null) {
    await this.db.query(`DELETE FROM ${this.tableName} WHERE user_id = ?`, [userId || this.userId]);
    return {
      success: true,
      message: "Cart cleared successfully"
    };
  }

  async getCartSummary(userId = null) {
    const rows = await this.db.query(
      `SELECT
         COUNT(*) as total_items,
         SUM(c.quantity) as total_quantity,
         SUM(c.quantity * p.price) as total_amount
       FROM ${this.tableName} c
       INNER JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [userId || this.userId]
    );

    const summary = rows[0] || {};
    return {
      success: true,
      summary: {
        total_items: Number(summary.total_items || 0),
        total_quantity: Number(summary.total_quantity || 0),
        total_amount: Number(summary.total_amount || 0)
      }
    };
  }
}

module.exports = CartService;
