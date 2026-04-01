const BaseService = require("./BaseService");
const fs = require("fs/promises");
const path = require("path");
const UserService = require("./UserService");

class ProductService extends BaseService {
  constructor(db, userId = null, token = null) {
    super(db);
    this.userId = userId;
    this.token = token;
    this.tableName = "products";
    this.uploadDir = path.resolve(__dirname, "../../../ecomm-images");
  }

  async createProduct(payload = {}, imageFile = null, userId = null, token = null) {
    const service = new UserService(this.db);
    const tokenValidation = await service.validateToken(token || this.token);
    if (!tokenValidation.valid) {
      return { error: "Invalid token." };
    }

    if (!imageFile) {
      return { error: "No image uploaded" };
    }

    const name = String(payload.name || "").trim();
    const price = Number(payload.price);
    const description = String(payload.description || "").trim();
    const category = String(payload.category || "").trim();

    if (!name || !description || !Number.isFinite(price) || price <= 0) {
      return { error: "Missing required fields: name, price, or description" };
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(imageFile.mimetype)) {
      return { error: "Invalid image type. Only JPEG, PNG, and GIF are allowed." };
    }

    if (Number(imageFile.size || 0) > 50000000) {
      return { error: "Image size exceeds 50 MB" };
    }

    await fs.mkdir(this.uploadDir, { recursive: true });

    const uniqueName = `${Date.now()}_${Math.floor(Math.random() * 1e6)}_${path.basename(imageFile.originalname || "image.jpg")}`;
    await fs.rename(imageFile.path, path.join(this.uploadDir, uniqueName));

    let availableSizes = ["S", "M", "L", "XL"];
    if (payload.available_sizes) {
      if (typeof payload.available_sizes === "string") {
        try {
          const parsed = JSON.parse(payload.available_sizes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            availableSizes = parsed;
          }
        } catch (_e) {
          availableSizes = ["S", "M", "L", "XL"];
        }
      } else if (Array.isArray(payload.available_sizes) && payload.available_sizes.length > 0) {
        availableSizes = payload.available_sizes;
      }
    }

    const ownerId = userId || this.userId;
    if (!ownerId) {
      await fs.unlink(path.join(this.uploadDir, uniqueName)).catch(() => {});
      return { error: "User context is required" };
    }

    try {
      await this.db.query(
        `INSERT INTO ${this.tableName} (name, price, description, image, category, available_sizes, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, price, description, uniqueName, category, JSON.stringify(availableSizes), ownerId]
      );
    } catch (err) {
      await fs.unlink(path.join(this.uploadDir, uniqueName)).catch(() => {});
      return { error: `Unable to create product: ${err.message}` };
    }

    return { message: "Product was created." };
  }

  async readProducts(userId = null, token = null) {
    const service = new UserService(this.db);
    const tokenValidation = await service.validateToken(token || this.token);
    if (!tokenValidation.valid) {
      return { error: "Invalid token." };
    }

    const rows = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE user_id = ? ORDER BY id DESC`,
      [userId || this.userId]
    );

    const baseUrl = `${(process.env.IMAGE_BASE_URL || "https://images.localfit.store/").replace(/\/+$/, "")}/`;

    return {
      records: rows.map((row) => ({
        ...row,
        image: `${baseUrl}${row.image}`,
        available_sizes: row.available_sizes ? JSON.parse(row.available_sizes) : ["S", "M", "L", "XL"]
      }))
    };
  }

  async readAllProducts() {
    const rows = await this.db.query(
      `SELECT p.*, u.name AS seller_name
       FROM ${this.tableName} p
       JOIN users u ON p.user_id = u.id
       ORDER BY p.id DESC`
    );

    return {
      records: rows.map((row) => ({
        ...row,
        available_sizes: row.available_sizes ? JSON.parse(row.available_sizes) : ["S", "M", "L", "XL"]
      }))
    };
  }

  async readOneProduct(id) {
    const rows = await this.db.query(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    if (!rows[0]) {
      return { message: "Product not found." };
    }
    return rows[0];
  }

  async updateProduct(id, payload = {}, imageFile = null, userId = null, token = null) {
    const service = new UserService(this.db);
    const tokenValidation = await service.validateToken(token || this.token);
    if (!tokenValidation.valid) {
      return { error: "Invalid token." };
    }

    const ownerId = userId || this.userId;
    const rows = await this.db.query(`SELECT * FROM ${this.tableName} WHERE id = ? AND user_id = ?`, [id, ownerId]);
    const product = rows[0];
    if (!product) {
      return { message: "Product not found." };
    }

    const name = payload.name !== undefined ? String(payload.name).trim() : product.name;
    const price = payload.price !== undefined ? Number(payload.price) : Number(product.price);
    const description = payload.description !== undefined ? String(payload.description).trim() : product.description;
    const category = payload.category !== undefined ? String(payload.category).trim() : product.category;

    let imageName = product.image;
    if (imageFile) {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!allowedTypes.includes(imageFile.mimetype)) {
        return { error: "Invalid image type" };
      }
      if (Number(imageFile.size || 0) > 50000000) {
        return { error: "Image size exceeds 50 MB" };
      }

      await fs.mkdir(this.uploadDir, { recursive: true });
      imageName = `${Date.now()}_${Math.floor(Math.random() * 1e6)}_${path.basename(imageFile.originalname || "image.jpg")}`;
      await fs.rename(imageFile.path, path.join(this.uploadDir, imageName));

      if (product.image) {
        const oldPath = path.join(this.uploadDir, product.image);
        await fs.unlink(oldPath).catch(() => {});
      }
    }

    let availableSizes = product.available_sizes ? JSON.parse(product.available_sizes) : ["S", "M", "L", "XL"];
    if (payload.available_sizes !== undefined) {
      if (typeof payload.available_sizes === "string") {
        try {
          const parsed = JSON.parse(payload.available_sizes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            availableSizes = parsed;
          }
        } catch (_e) {
          availableSizes = availableSizes;
        }
      } else if (Array.isArray(payload.available_sizes) && payload.available_sizes.length > 0) {
        availableSizes = payload.available_sizes;
      }
    }

    let sizeQuantitiesJson = null;
    let totalQuantity = null;
    if (payload.size_quantities !== undefined) {
      let parsed = {};
      if (typeof payload.size_quantities === "string") {
        try {
          parsed = JSON.parse(payload.size_quantities) || {};
        } catch (_e) {
          parsed = {};
        }
      } else if (typeof payload.size_quantities === "object" && payload.size_quantities !== null) {
        parsed = payload.size_quantities;
      }
      sizeQuantitiesJson = JSON.stringify(parsed);
      totalQuantity = Object.values(parsed).reduce((sum, v) => sum + Number(v || 0), 0);
    }

    let startingQuantitiesJson = null;
    if (payload.starting_size_quantities !== undefined) {
      let parsed = {};
      if (typeof payload.starting_size_quantities === "string") {
        try {
          parsed = JSON.parse(payload.starting_size_quantities) || {};
        } catch (_e) {
          parsed = {};
        }
      } else if (typeof payload.starting_size_quantities === "object" && payload.starting_size_quantities !== null) {
        parsed = payload.starting_size_quantities;
      }
      startingQuantitiesJson = JSON.stringify(parsed);
    }

    const fields = [
      "name = ?",
      "price = ?",
      "description = ?",
      "image = ?",
      "category = ?",
      "available_sizes = ?"
    ];
    const values = [name, price, description, imageName, category, JSON.stringify(availableSizes)];

    if (sizeQuantitiesJson !== null) {
      fields.push("size_quantities = ?");
      fields.push("quantity = ?");
      values.push(sizeQuantitiesJson, totalQuantity);
    }
    if (startingQuantitiesJson !== null) {
      fields.push("starting_size_quantities = ?");
      values.push(startingQuantitiesJson);
    }

    values.push(id, ownerId);

    await this.db.query(`UPDATE ${this.tableName} SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`, values);
    return { message: "Product was updated." };
  }

  async deleteProduct(id, userId = null, token = null) {
    const service = new UserService(this.db);
    const tokenValidation = await service.validateToken(token || this.token);
    if (!tokenValidation.valid) {
      return { error: "Invalid token." };
    }

    const ownerId = userId || this.userId;
    const rows = await this.db.query(`SELECT image FROM ${this.tableName} WHERE id = ? AND user_id = ?`, [id, ownerId]);
    if (rows[0] && rows[0].image) {
      await fs.unlink(path.join(this.uploadDir, rows[0].image)).catch(() => {});
    }

    await this.db.query("DELETE FROM carts WHERE product_id = ?", [id]);
    await this.db.query(`DELETE FROM ${this.tableName} WHERE id = ? AND user_id = ?`, [id, ownerId]);

    return { message: "Product was deleted." };
  }
}

module.exports = ProductService;
