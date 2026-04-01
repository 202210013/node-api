const BaseService = require("./BaseService");

class RatingService extends BaseService {
  constructor(db) {
    super(db);
  }

  async submitRating(orderId, productId, userId, rating, review = null) {
    const numericRating = Number(rating);
    if (numericRating < 1 || numericRating > 5) {
      return {
        success: false,
        error: "Rating must be between 1 and 5"
      };
    }

    const existing = await this.db.query("SELECT id FROM ratings WHERE order_id = ? AND user_id = ?", [orderId, userId]);
    if (existing[0]) {
      return {
        success: false,
        error: "You have already rated this order"
      };
    }

    const [result] = await this.db.pool.execute(
      "INSERT INTO ratings (order_id, product_id, user_id, rating, review, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [orderId, productId, userId, numericRating, review]
    );

    return {
      success: true,
      message: "Rating submitted successfully",
      ratingId: result.insertId
    };
  }

  async getRatingsByProduct(productId) {
    const ratings = await this.db.query(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM ratings r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [productId]
    );

    return {
      success: true,
      ratings
    };
  }

  async getRatingByOrder(orderId) {
    const rows = await this.db.query(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM ratings r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.order_id = ?`,
      [orderId]
    );

    return {
      success: true,
      rating: rows[0] || null
    };
  }

  async getAllRatings() {
    const ratings = await this.db.query(
      `SELECT r.*, u.name as user_name, u.email as user_email, p.name as product_name
       FROM ratings r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       ORDER BY r.created_at DESC`
    );

    return {
      success: true,
      ratings
    };
  }

  async getProductRatingSummary(productId) {
    const summaryRows = await this.db.query(
      `SELECT
         COUNT(*) as total_ratings,
         AVG(rating) as average_rating,
         SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
         SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
         SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
       FROM ratings
       WHERE product_id = ?`,
      [productId]
    );

    const productRows = await this.db.query("SELECT id, name FROM products WHERE id = ?", [productId]);
    const summary = summaryRows[0] || {};
    const avg = summary.average_rating ? Number(summary.average_rating).toFixed(1) : 0;

    return {
      success: true,
      summary: {
        product_id: productId,
        product_name: productRows[0] ? productRows[0].name : "Unknown",
        total_ratings: Number(summary.total_ratings || 0),
        average_rating: avg,
        rating_distribution: {
          5: Number(summary.five_star || 0),
          4: Number(summary.four_star || 0),
          3: Number(summary.three_star || 0),
          2: Number(summary.two_star || 0),
          1: Number(summary.one_star || 0)
        }
      }
    };
  }
}

module.exports = RatingService;
