const express = require("express");
const router = express.Router();
const ContactController = require("../controllers/contacts");

router.post("/identify", ContactController.createContact);

module.exports = router;
