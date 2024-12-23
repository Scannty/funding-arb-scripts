const express = require("express");
const cors = require("cors");
const controllers = require("./controllers");

const app = express();

app.use(express.json());
app.use(cors());

app.get("/getTopVolumePerps", controllers.getTopVolumePerps);
app.get("/getCurrentMidPrice", controllers.getCurrentMidPrice);
app.get("/getPerpsInfo", controllers.getPerpsInfo);
app.post("/storeTradeData", controllers.storeTradeInfo);
app.get("/api/v1/dex/1inch/swap", controllers.get1inchSwapQuote);
app.get("/api/v1/dex/1inch/quote", controllers.get1inchQuote);

app.get("/api/storage/get-portfolio/:user_address", controllers.getPortfolio);
app.post("/api/storage/store-position", controllers.storePosition);
app.post("/api/storage/delete-position", controllers.deletePosition);

app.listen(8000, () => {
  console.log("Server is listening on port 8000");
});

require('./data/fundingFeesCache');
require('./db')
