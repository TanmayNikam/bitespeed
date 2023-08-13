const express = require("express");
const { testDbConnection } = require("./dbConfig");
const app = express();
require("dotenv").config();

const contactRouter = require("./routes/contact");

testDbConnection();
app.use(express.json());
app.use("/", contactRouter);

app.listen(process.env.PORT, () => {
  console.log(`Server started on port ${process.env.PORT}`);
});
