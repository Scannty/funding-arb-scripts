const express = require("express");
const cors = require("cors");
const controllers = require("./controllers");

const app = express();

app.use(cors());

app.get("/getHyperliquidData", controllers.getHyperliquidData);

const server = app.listen(8000, () => {
  console.log("Server is listening on port 8000");
});
