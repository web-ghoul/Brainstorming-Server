const express = require("express");
const app = express();
require("dotenv").config();
const ip = "localhost";
const Port = process.env.PORT || 3000;
const mongoose = require("mongoose");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const bodyParser = require("body-parser");
const swaggerUI = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");
const path = require("path");
var fs = require("fs");
const morgan = require("morgan");
const xss = require("xss-clean");
const multer = require("multer");
const passport = require("passport");
const rateLimit = require("express-rate-limit");
var hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
const http = require("http");
const compression = require('compression');

const uploadImage = require("./utils/uploadImage");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const privateRoutes = require("./routes/privateRoutes");
const publicRoutes = require("./routes/publicRoutes");
const logger = require("./logger/index");
const Routes = require("./routes/authRoutes");
const GoogleStrategy = require("./utils/google-auth");
const FacebookStrategy = require("./utils/facebook-auth");
const Idea = require("./models/IdeasSchema")

const server = http.createServer(app);

app.use(express.static(__dirname + "/public"));

const corsOptions = {
  origin: [
    "https://brainstorming-omega.vercel.app",
    "http://localhost:4000",
    "http://127.0.0.1:5500",
    "https://brainstorming-ecru.vercel.app",

    // your origins here
  ],
  credentials: true,
  exposedHeaders: ["set-cookie"],
};

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hello World",
      version: "1.0.0",
      description: " A simple Express library api",
    },
    servers: [
      {
        url: "http://localhost:3000/api",
      },
    ],
    //apis: ["./routes/*.js"]
  },
  apis: ["./routes/*.js"], // files containing annotations as above
};

const openapiSpecification = swaggerJsDoc(options);

var accessLogStream = fs.createWriteStream(path.join(__dirname, "access.log"), {
  flags: "a",
});

// setup the logger

const limiter = rateLimit({
  windowMs: 15 * 60 * 100, // 15 minutes
  max: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { message: "Too much request" },
  keyGenerator: (req) => {
    // Use the first IP address from X-Forwarded-For header
    return req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
  },
  // store: ... , // Use an external store for more precise rate limiting
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(openapiSpecification));
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          "http://localhost:4000",
          "http://127.0.0.1:5500",
          "https://brainstorming-omega.vercel.app",
          "https://brainstorming-ecru.vercel.app",
        ],
      },
    },
  })
);
app.use(xss());
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    name: "session",
    resave: false,
    saveUninitialized: false,
    maxAge: 24 * 60 * 60 * 100,
  })
);
app.use(passport.initialize());
app.use(passport.session());

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, __dirname + "/uploads");
  },
  // Sets file(s) to be saved in uploads folder in same directory
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  },
  // Sets saved filename(s) to be original filename(s)
});

// Set saved storage options:
const upload = multer({ storage: storage });

app.post("/api", upload.array("files"), (req, res) => {

  console.log(req.body); // Logs form body values
  console.log(req.files); // Logs any files

  uploadImage(req.files[0])
    .then((url) => console.log(url))
    .catch((err) => res.status(500).send(err));
});

app.post("/uploadImage", (req, res) => {
  uploadImage(req.body.image)
    .then((url) => res.send(url))
    .catch((err) => res.status(500).send(err));
});

app.post("/uploadMultipleImages", upload.array("files"), (req, res) => {
  console.log("hello");
  console.log(req.files);
  console.log(req.body)
  uploadImage
    .uploadMultipleImages(req.files)
    .then((urls) => {
      console.log(urls);
      res.send(urls);
    })
    .catch((err) => res.status(500).send(err));
});

app.get("/", (req, res, next) => {
  const treasureMap = {
    message: "🗺️ Welcome to the Treasure Hunt API! 🏴‍☠️",
    clues: [
      "🌴 Follow the path of 'api/' to start the journey.",
      "🦜 Look out for the 'X marks the spot' at each endpoint!",
      "⚓ More treasures await as you navigate the API seas!",
    ],
    disclaimer: "Remember, only true adventurers can unlock the secrets...",
    documentation: "/api-docs",
  };

  res.status(200).json(treasureMap);
});

app.use("/api", privateRoutes);
app.use("/api", publicRoutes);
app.use("/api", Routes);


app.use(notFound);
app.use(errorHandler);
mongoose
  .connect(process.env.DB_CONN, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    server.listen(Port, () => {
      console.log(`App listening at http://${ip}:${Port}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });