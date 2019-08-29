const express = require("express");
var sls = require("serverless-http");
const app = express();
let path = require("path");
let bodyParser = require("body-parser");
let FormData = require("form-data");
const Readable = require("stream").Readable;
const xmlparser = require("express-xml-bodyparser");

let constellation = require("./lib/constellation");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set("json spaces", 1);

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(express.static(__dirname + "/demos/static"));
app.use(express.static(__dirname + "/lib/"));

app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname + "/demos/static/client.html"));
});

app.get("/hello", async (req, res, next) => {
  res.status(200).send("Hello World!");
});

app.post("/postSpecs", function(req, res) {
  let designName = req.body.designName;
  let langText = req.body.specification;
  let categories = req.body.categories;
  let numDesigns = req.body.numDesigns;
  let maxCycles = req.body.maxCycles;
  let representation = req.body.representation;
  console.log("---Received new input---");
  console.log("Design Name: ", designName);
  console.log("Specification: ", langText);
  console.log("Categories: ", categories);
  console.log("numDesigns: ", numDesigns);
  console.log("maxCycles: ", maxCycles);
  console.log("Representation:", representation);

  let data;
  try {
    data = constellation.goldbar(
      designName,
      langText,
      categories,
      numDesigns,
      maxCycles,
      representation
    );
    res.status(200).send(data);
  } catch (error) {
    console.log(error);
    res.status(405).send(String(error));
  }
});

app.post("/importSBOL", xmlparser(), async function(req, res) {
  let data;
  try {
    data = await constellation.sbol(req.rawBody);
    res.status(200).send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send(String(error));
  }
});

module.exports.handler = sls(app);
