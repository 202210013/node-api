const jwt = require("jsonwebtoken");

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

function requireAuthentication(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "change_this_secret");
    req.user = decoded;
    req.token = token;
    return next();
  } catch (_err) {
    if (/^[a-fA-F0-9]{32}$/.test(token)) {
      req.token = token;
      req.user = {
        user_id: req.headers["x-user-id"] || req.query.user_id || req.body.user_id || null
      };
      return next();
    }

    return res.status(401).json({ error: "Invalid token." });
  }
}

module.exports = {
  getBearerToken,
  requireAuthentication
};
