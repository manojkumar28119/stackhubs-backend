const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "database.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

app.get("/", async (request, response) => {
  const buyerQuery = `SELECT * FROM BuyerOrderTable`;

  const buyerData = await db.all(buyerQuery);

  const sellerQuery = `SELECT * FROM SellerOrderTable`;

  const sellerData = await db.all(sellerQuery);

  const completedOrderQ = `SELECT * FROM CompletedOrderTable`;

  const completedOrderData = await db.all(completedOrderQ);

  response.send({ buyerData, sellerData, completedOrderData });
});

app.post("/add-order", async (request, response) => {
  const { type, qty, price } = request.body;

  let addOrderQuery;

  if (type === "buyer") {
    addOrderQuery = `
      INSERT INTO BuyerOrderTable (buyer_price, buyer_qty)
      VALUES ('${price}', '${qty}');
    `;
  } else {
    addOrderQuery = `
      INSERT INTO SellerOrderTable (seller_price, seller_qty)
      VALUES ('${price}', '${qty}');
    `;
  }

  await db.run(addOrderQuery);

  await getData();

  response.send("Order added");
});

const getData = async () => {
  const matechedPriceQuery = `
    SELECT BuyerOrderTable.id as buyer_id,SellerOrderTable.id as seller_id,
    buyer_price, buyer_qty,seller_price,seller_qty FROM BuyerOrderTable INNER JOIN SellerOrderTable ON BuyerOrderTable.buyer_price >= SellerOrderTable.seller_price;
  `;

  const data = await db.get(matechedPriceQuery);
  console.log(data);

  if (data !== undefined) {
    const { buyer_qty, seller_qty, buyer_id, seller_id,buyer_price} = data;

    const new_buyer_qty = buyer_qty >= seller_qty ? buyer_qty - seller_qty : 0;

    const buyerUpdateQuery = `
    UPDATE BuyerOrderTable 
    SET buyer_qty = ${new_buyer_qty}
    WHERE id = ${buyer_id}
  `;

    await db.run(buyerUpdateQuery);

    const new_seller_qty = seller_qty >= buyer_qty ? seller_qty - buyer_qty : 0;

    const sellerUpdateQuery = `
    UPDATE  SellerOrderTable
    SET seller_qty = ${new_seller_qty}
    WHERE id = ${seller_id}
  `;


  const updateSellerTable = `
    DELETE FROM SellerOrderTable 
    WHERE seller_qty = 0
  `

  const updateBuyerTable = `
    DELETE FROM  BuyerOrderTable
    WHERE buyer_qty = 0
  `

    await db.run(sellerUpdateQuery);

    await db.run(updateBuyerTable); 
    await db.run(updateSellerTable); 

    const completedQnty = Math.min(seller_qty,buyer_qty);

      


    const completedTableQ = `INSERT INTO CompletedOrderTable(price,qty)
    VALUES(${buyer_price},${completedQnty})`

    await db.run(completedTableQ)
  }

  
};

initializeDBAndServer();
