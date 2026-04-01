const bcrypt = require("bcrypt");
const crypto = require("crypto");
const BaseService = require("./BaseService");

class UserService extends BaseService {
  constructor(db) {
    super(db);
  }

  async getAllEmails() {
    const rows = await this.db.query("SELECT name, email FROM users");
    return rows;
  }

  async getAllUsers(currentUserEmail = null) {
    let isAdmin = false;

    if (currentUserEmail) {
      const roleRows = await this.db.query("SELECT role FROM users WHERE email = ?", [currentUserEmail]);
      isAdmin = roleRows[0] && roleRows[0].role === "admin";
    }

    if (isAdmin) {
      return this.db.query(
        "SELECT id, name, email, role FROM users WHERE (role IS NULL OR role != 'admin') AND email != ?",
        [currentUserEmail]
      );
    }

    return this.db.query("SELECT id, name, email, role FROM users WHERE role = 'admin'");
  }

  async checkLoginStatus(user = null) {
    return {
      loggedIn: Boolean(user && user.user_id),
      user: user || null
    };
  }

  async loginUser(data) {
    const email = data && data.email ? String(data.email) : "";
    const password = data && data.password ? String(data.password) : "";

    const users = await this.db.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    const user = users[0];

    if (!user) {
      return { error: "Invalid email or password" };
    }

    const storedHash = String(user.password || "");
    const normalizedHash = storedHash.startsWith("$2y$")
      ? `$2b$${storedHash.slice(4)}`
      : storedHash;

    const ok = await bcrypt.compare(password, normalizedHash);
    if (!ok) {
      return { error: "Invalid email or password" };
    }

    const token = crypto.randomBytes(16).toString("hex");
    return {
      token,
      user_id: user.id,
      email: user.email
    };
  }

  async logoutUser() {
    return { success: true, message: "Logged out" };
  }

  async registerUser(data) {
    const name = data && data.name ? String(data.name) : null;
    const email = data && data.email ? String(data.email) : "";
    const cellphone = data && data.cellphone ? String(data.cellphone) : null;
    const password = data && data.password ? String(data.password) : "";
    const hash = await bcrypt.hash(password, 10);

    await this.db.query(
      "INSERT INTO users (name, email, cellphone, password) VALUES (?, ?, ?, ?)",
      [name, email, cellphone, hash]
    );

    return { message: "User was registered successfully." };
  }

  async setSession(data) {
    const userId = data && (data.userId || data.user_id);
    if (!userId) {
      return { success: false, error: "user_id is required" };
    }

    const token = crypto.randomBytes(16).toString("hex");

    return {
      success: true,
      token,
      user_id: userId
    };
  }

  async validateToken(token) {
    if (/^[a-fA-F0-9]{32}$/.test(String(token || ""))) {
      return { valid: true };
    }

    return { valid: false, message: "Invalid token." };
  }

  async changeUserPassword(userId, currentPassword, newPassword) {
    const rows = await this.db.query("SELECT password FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    if (!user) {
      return { error: "User not found." };
    }

    const ok = await bcrypt.compare(String(currentPassword || ""), user.password || "");
    if (!ok) {
      return { error: "Current password is incorrect." };
    }

    const hash = await bcrypt.hash(String(newPassword || ""), 10);
    await this.db.query("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?", [hash, userId]);

    return { message: "Password changed successfully." };
  }

}

module.exports = UserService;
