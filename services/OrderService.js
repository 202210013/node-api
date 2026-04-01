const BaseService = require("./BaseService");

class OrderService extends BaseService {
  constructor(db) {
    super(db);
  }

  async deductProductQuantity(productName, size, quantity, dbClient = this.db) {
    const rows = await dbClient.query("SELECT size_quantities FROM products WHERE name = ? LIMIT 1", [productName]);
    const product = rows[0];
    if (!product || !product.size_quantities) {
      return;
    }

    let sizeQuantities;
    try {
      sizeQuantities = JSON.parse(product.size_quantities);
    } catch (_e) {
      sizeQuantities = {};
    }

    if (Object.prototype.hasOwnProperty.call(sizeQuantities, size)) {
      sizeQuantities[size] = Math.max(0, Number(sizeQuantities[size] || 0) - Number(quantity || 0));
      const totalQuantity = Object.values(sizeQuantities).reduce((sum, v) => sum + Number(v || 0), 0);

      await dbClient.query("UPDATE products SET size_quantities = ?, quantity = ? WHERE name = ?", [
        JSON.stringify(sizeQuantities),
        totalQuantity,
        productName
      ]);
    }
  }

  async restoreProductQuantity(productName, size, quantity, dbClient = this.db) {
    const rows = await dbClient.query("SELECT size_quantities FROM products WHERE name = ? LIMIT 1", [productName]);
    const product = rows[0];
    if (!product || !product.size_quantities) {
      return;
    }

    let sizeQuantities;
    try {
      sizeQuantities = JSON.parse(product.size_quantities);
    } catch (_e) {
      sizeQuantities = {};
    }

    if (Object.prototype.hasOwnProperty.call(sizeQuantities, size)) {
      sizeQuantities[size] = Number(sizeQuantities[size] || 0) + Number(quantity || 0);
      const totalQuantity = Object.values(sizeQuantities).reduce((sum, v) => sum + Number(v || 0), 0);

      await dbClient.query("UPDATE products SET size_quantities = ?, quantity = ? WHERE name = ?", [
        JSON.stringify(sizeQuantities),
        totalQuantity,
        productName
      ]);
    }
  }

  async transferProductQuantityForSizeChange(productName, oldSize, newSize, quantity, dbClient = this.db) {
    const rows = await dbClient.query("SELECT size_quantities FROM products WHERE name = ? LIMIT 1", [productName]);
    const product = rows[0];
    if (!product || !product.size_quantities) {
      return { success: false, error: "Product inventory not found" };
    }

    let sizeQuantities;
    try {
      sizeQuantities = JSON.parse(product.size_quantities);
    } catch (_e) {
      sizeQuantities = {};
    }

    const oldSizeKey = String(oldSize || "").trim();
    const newSizeKey = String(newSize || "").trim();
    const qty = Number(quantity || 0);

    if (!Object.prototype.hasOwnProperty.call(sizeQuantities, oldSizeKey)) {
      sizeQuantities[oldSizeKey] = 0;
    }

    if (!Object.prototype.hasOwnProperty.call(sizeQuantities, newSizeKey)) {
      sizeQuantities[newSizeKey] = 0;
    }

    const newSizeStock = Number(sizeQuantities[newSizeKey] || 0);
    if (newSizeStock < qty) {
      return {
        success: false,
        error: `Insufficient stock for size ${newSizeKey}. Available: ${newSizeStock}, needed: ${qty}`
      };
    }

    sizeQuantities[oldSizeKey] = Number(sizeQuantities[oldSizeKey] || 0) + qty;
    sizeQuantities[newSizeKey] = Math.max(0, newSizeStock - qty);

    const totalQuantity = Object.values(sizeQuantities).reduce((sum, v) => sum + Number(v || 0), 0);
    await dbClient.query("UPDATE products SET size_quantities = ?, quantity = ? WHERE name = ?", [
      JSON.stringify(sizeQuantities),
      totalQuantity,
      productName
    ]);

    return { success: true };
  }

  async createOrders(orders) {
    await this.db.withTransaction(async (tx) => {
      for (const order of orders || []) {
        const size = order.size || "M";
        const pickupDate = order.pickup_date || null;
        const orderStatus = pickupDate ? "pending" : "pending-production";

        await tx.query(
          "INSERT INTO orders (customer, product, quantity, size, status, created_at, pickup_date) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
          [order.customer, order.product, order.quantity, size, orderStatus, pickupDate]
        );
      }
    });

    return { success: true };
  }

  async getAllOrders(user = null) {
    if (user) {
      return this.db.query(
        `SELECT o.*, u.name as customer_name, u.cellphone as customer_cellphone
         FROM orders o
         LEFT JOIN users u ON o.customer = u.email
         WHERE o.customer = ?`,
        [user]
      );
    }

    return this.db.query(
      `SELECT o.*, u.name as customer_name, u.cellphone as customer_cellphone
       FROM orders o
       LEFT JOIN users u ON o.customer = u.email`
    );
  }

  async approveOrder(orderId) {
    return this.db.withTransaction(async (tx) => {
      const orderRows = await tx.query("SELECT product, size, quantity FROM orders WHERE id = ?", [orderId]);
      const order = orderRows[0];
      if (!order) {
        return { success: false, error: "Order not found" };
      }

      const pickupRows = await tx.query("SELECT pickup_date FROM orders WHERE id = ?", [orderId]);
      const pickupDate = pickupRows[0] && pickupRows[0].pickup_date
        ? pickupRows[0].pickup_date
        : this.getFutureDate(3);

      await tx.query("UPDATE orders SET status = 'ready-for-pickup', pickup_date = ? WHERE id = ?", [pickupDate, orderId]);
      await this.deductProductQuantity(order.product, order.size, order.quantity, tx);

      return { success: true, pickup_date: pickupDate };
    });
  }

  async declineOrder(orderId, remarks = null) {
    return this.db.withTransaction(async (tx) => {
      const rows = await tx.query("SELECT product, size, quantity, status FROM orders WHERE id = ?", [orderId]);
      const order = rows[0];
      if (!order) {
        return { success: false, error: "Order not found" };
      }

      const shouldRestore = order.status === "ready-for-pickup";

      if (remarks) {
        try {
          await tx.query("UPDATE orders SET status = 'declined', remarks = ? WHERE id = ?", [remarks, orderId]);
        } catch (err) {
          if (String(err.message || "").includes("Unknown column") && String(err.message || "").includes("remarks")) {
            await tx.query("ALTER TABLE orders ADD COLUMN remarks TEXT NULL AFTER status");
            await tx.query("UPDATE orders SET status = 'declined', remarks = ? WHERE id = ?", [remarks, orderId]);
          } else {
            throw err;
          }
        }
      } else {
        await tx.query("UPDATE orders SET status = 'declined' WHERE id = ?", [orderId]);
      }

      if (shouldRestore) {
        await this.restoreProductQuantity(order.product, order.size, order.quantity, tx);
      }

      return { success: true };
    });
  }

  async markReadyForPickup(orderId) {
    return this.db.withTransaction(async (tx) => {
      const rows = await tx.query("SELECT product, size, quantity FROM orders WHERE id = ?", [orderId]);
      const order = rows[0];
      if (!order) {
        return { success: false, error: "Order not found" };
      }

      await tx.query("UPDATE orders SET status = 'ready-for-pickup' WHERE id = ?", [orderId]);
      await this.deductProductQuantity(order.product, order.size, order.quantity, tx);
      return { success: true };
    });
  }

  async confirmPickup(orderId, customerEmail, orNumber = null) {
    return this.db.withTransaction(async (tx) => {
      const rows = await tx.query("SELECT * FROM orders WHERE id = ?", [orderId]);
      const order = rows[0];
      if (!order) {
        return { success: false, error: "Order not found" };
      }

      if (order.customer !== customerEmail) {
        return { success: false, error: "Order does not belong to this customer" };
      }

      if (order.status !== "ready-for-pickup") {
        return {
          success: false,
          error: "Order is not ready for pickup",
          current_status: order.status
        };
      }

      await tx.query("UPDATE orders SET status = 'completed', or_number = ? WHERE id = ?", [orNumber, orderId]);
      return {
        success: true,
        message: "Order pickup confirmed successfully",
        or_number: orNumber
      };
    });
  }

  async updateCompletionRemarks(orderId, remarks, size = null) {
    if (!orderId) {
      return { success: false, error: "Order ID is required" };
    }

    return this.db.withTransaction(async (tx) => {
      const rows = await tx.query("SELECT status, size, product, quantity FROM orders WHERE id = ?", [orderId]);
      const order = rows[0];
      if (!order) {
        return { success: false, error: "Order not found" };
      }

      if (order.status !== "completed") {
        return { success: false, error: "Only completed orders can have completion remarks" };
      }

      const newSize = size && String(size).trim() !== "" ? String(size).trim() : null;
      const currentSize = String(order.size || "").trim();
      const hasSizeChange = newSize && currentSize !== "" && newSize !== currentSize;

      if (hasSizeChange) {
        const transferResult = await this.transferProductQuantityForSizeChange(
          order.product,
          currentSize,
          newSize,
          order.quantity,
          tx
        );

        if (!transferResult.success) {
          return transferResult;
        }
      }

      if (newSize) {
        await tx.query("UPDATE orders SET completion_remarks = ?, size = ? WHERE id = ?", [remarks || "", newSize, orderId]);
      } else {
        await tx.query("UPDATE orders SET completion_remarks = ? WHERE id = ?", [remarks || "", orderId]);
      }

      return { success: true, message: "Completion remarks updated successfully" };
    });
  }

  async updateOrderStatus(orderId, status, pickupDate = null) {
    const rows = await this.db.query("SELECT id, status as current_status FROM orders WHERE id = ?", [orderId]);
    if (!rows[0]) {
      return { success: false, error: "Order not found" };
    }

    if (pickupDate) {
      await this.db.query("UPDATE orders SET status = ?, pickup_date = ? WHERE id = ?", [status, pickupDate, orderId]);
    } else {
      await this.db.query("UPDATE orders SET status = ? WHERE id = ?", [status, orderId]);
    }

    return {
      success: true,
      message: "Order updated successfully",
      pickup_date: pickupDate
    };
  }

  async getOrderById(orderId) {
    if (!orderId) {
      return { success: false, error: "Order ID is required" };
    }

    const rows = await this.db.query(
      `SELECT o.*, u.name as customer_name, u.cellphone as customer_cellphone
       FROM orders o
       LEFT JOIN users u ON o.customer = u.email
       WHERE o.id = ?`,
      [orderId]
    );

    if (!rows[0]) {
      return { success: false, error: "Order not found" };
    }

    return {
      success: true,
      order: rows[0]
    };
  }

  async getOrdersByStatus(status) {
    const rows = await this.db.query(
      `SELECT o.*, u.name as customer_name, u.cellphone as customer_cellphone
       FROM orders o
       LEFT JOIN users u ON o.customer = u.email
       WHERE o.status = ?
       ORDER BY o.created_at DESC`,
      [status]
    );

    return {
      success: true,
      orders: rows
    };
  }

  async getOrderStats() {
    const rows = await this.db.query(
      `SELECT
         COUNT(*) as total_orders,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
         SUM(CASE WHEN status = 'pending-production' THEN 1 ELSE 0 END) as pending_production_orders,
         SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_orders,
         SUM(CASE WHEN status = 'ready-for-pickup' THEN 1 ELSE 0 END) as ready_orders,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
         SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined_orders
       FROM orders`
    );

    return {
      success: true,
      stats: rows[0] || {}
    };
  }

  getFutureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 0));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}

module.exports = OrderService;
