const BaseService = require("./BaseService");
const ProductService = require("./ProductService");

class ProductService1 extends BaseService {
  constructor(db) {
    super(db);
  }

  async createProduct() {
    const service = new ProductService(this.db);
    return service.createProduct(...arguments);
  }

  async readProducts() {
    const userId = arguments[0] || null;
    const rows = await this.db.query("SELECT * FROM products WHERE user_id = ? ORDER BY id DESC", [userId]);
    return { records: rows };
  }

  async readAllProducts() {
    const rows = await this.db.query("SELECT * FROM products ORDER BY id DESC");
    return { records: rows };
  }

  async readAllProducts1() {
    const rows = await this.db.query("SELECT * FROM products ORDER BY id DESC");
    return { records: rows };
  }

  async readOneProduct(id) {
    const rows = await this.db.query("SELECT * FROM products WHERE id = ?", [id]);
    if (!rows[0]) {
      return { message: "Product not found." };
    }
    return rows[0];
  }

  async updateProduct(id) {
    const service = new ProductService(this.db);
    return service.updateProduct(id, arguments[1], arguments[2], arguments[3], arguments[4]);
  }

  async deleteProduct(id) {
    const service = new ProductService(this.db);
    return service.deleteProduct(id, arguments[1], arguments[2]);
  }
}

module.exports = ProductService1;
