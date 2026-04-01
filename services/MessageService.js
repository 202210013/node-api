const BaseService = require("./BaseService");

class MessageService extends BaseService {
  constructor(db) {
    super(db);
  }

  async getMessagesBetween(user1, user2) {
    const rows = await this.db.query(
      `SELECT sender, recipient, content, timestamp FROM messages
       WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
       ORDER BY id ASC`,
      [user1, user2, user2, user1]
    );
    return rows;
  }

  async saveMessage(data) {
    if (!data || !data.sender || !data.recipient || !data.content) {
      return { error: "Missing fields" };
    }

    await this.db.query("INSERT INTO messages (sender, recipient, content) VALUES (?, ?, ?)", [
      data.sender,
      data.recipient,
      data.content
    ]);

    return { success: true };
  }

  async getUnreadMessages(recipient) {
    const rows = await this.db.query(
      "SELECT COUNT(*) as count FROM messages WHERE recipient = ? AND is_read = 0",
      [recipient]
    );
    return rows[0] || { count: 0 };
  }
}

module.exports = MessageService;
