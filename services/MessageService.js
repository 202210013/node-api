const BaseService = require("./BaseService");

class MessageService extends BaseService {
  constructor(db) {
    super(db);
  }

  async getMessagesBetween(user1, user2) {
    const rows = await this.db.query(
      `SELECT sender, recipient, content, timestamp, is_read FROM messages
       WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
       ORDER BY id ASC`,
      [user1, user2, user2, user1]
    );

 // Mark messages as read where user1 is the recipient

    return rows;
  }

  async saveMessage(data) {
    if (!data || !data.sender || !data.recipient || !data.content) {
      return { error: "Missing fields" };
    }
    await this.db.query(
      "INSERT INTO messages (sender, recipient, content, is_read) VALUES (?, ?, ?, 0)",
      [data.sender, data.recipient, data.content]
    );
    return { success: true };
  }

  async getUnreadMessages(recipient) {
    const rows = await this.db.query(
      "SELECT COUNT(*) as count FROM messages WHERE recipient = ? AND is_read = 0",
      [recipient]
    );
    return rows[0] || { count: 0 };
  }

  async markAsRead(sender, recipient) {
    await this.db.query(
      "UPDATE messages SET is_read = 1 WHERE sender = ? AND recipient = ? AND is_read = 0",
      [sender, recipient]
    );
    return { success: true };
  }
}

module.exports = MessageService;
