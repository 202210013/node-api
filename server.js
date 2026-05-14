require('dotenv').config({ path: __dirname + '/.env' });

const app = require("./app");

// Use 3000 to match Apache proxy
const port = Number(process.env.PORT || 3000);

// Listen on all network interfaces
app.listen(port, '0.0.0.0', () => {
  console.log(`Node API running on port ${port}`);
});
