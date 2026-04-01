class BaseService {
  constructor(db) {
    this.db = db;
  }

  todo(method, extra = {}) {
    return {
      success: false,
      message: `TODO: implement ${method}`,
      method,
      ...extra
    };
  }
}

module.exports = BaseService;
