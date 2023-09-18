// const express = require("express");
// const bodyParser = require("body-parser");
// const mongodb = require("mongodb");
// const amqp = require("amqplib");

// if (!process.env.DBHOST) {
//   throw new Error(
//     "Please specify the databse host using environment variable DBHOST."
//   );
// }

// if (!process.env.DBNAME) {
//   throw new Error(
//     "Please specify the name of the database using environment variable DBNAME"
//   );
// }

// if (!process.env.RABBIT) {
//   throw new Error(
//     "Please specify the name of the RabbitMQ host using environment variable RABBIT"
//   );
// }

// const DBHOST = process.env.DBHOST;
// const DBNAME = process.env.DBNAME;
// const RABBIT = process.env.RABBIT;

// //
// // Connect to the database.
// //
// function connectDb() {
//   return mongodb.MongoClient.connect(DBHOST).then((client) => {
//     return client.db(DBNAME);
//   });
// }

// //
// // Connect to the RabbitMQ server.
// //
// function connectRabbit() {
//   console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);

//   return amqp
//     .connect(RABBIT) // Connect to the RabbitMQ server.
//     .then((messagingConnection) => {
//       console.log("Connected to RabbitMQ.");

//       return messagingConnection.createChannel(); // Create a RabbitMQ messaging channel.
//     });
// }

// //
// // Setup event handlers.
// //
// function setupHandlers(app, db, messageChannel) {
//   const videosCollection = db.collection("videos");

//   // ... YOU CAN PUT HTTP ROUTES AND OTHER MESSAGE HANDLERS HERE ...

//   function consumeViewedMessage(msg) {
//     // Handler for coming messages.
//     console.log("Received a 'viewed' message");

//     const parsedMsg = JSON.parse(msg.content.toString()); // Parse the JSON message.

//     return videosCollection
//       .insertOne({ videoPath: parsedMsg.videoPath }) // Record the "view" in the database.
//       .then(() => {
//         console.log("Acknowledging message was handled.");

//         messageChannel.ack(msg); // If there is no error, acknowledge the message.
//       });
//   }

//   return messageChannel
//     .assertQueue("viewed", {}) // Assert that we have a "viewed" queue.
//     .then(() => {
//       console.log("Asserted that the 'viewed' queue exists.");

//       return messageChannel.consume("viewed", consumeViewedMessage); // Start receiving messages from the "viewed" queue.
//     });
// }

// //
// // Start the HTTP server.
// //
// function startHttpServer(db, messageChannel) {
//   return new Promise((resolve) => {
//     // Wrap in a promise so we can be notified when the server has started.
//     const app = express();
//     app.use(bodyParser.json()); // Enable JSON body for HTTP requests.
//     setupHandlers(app, db, messageChannel);

//     const port = (process.env.PORT && parseInt(process.env.PORT)) || 3000;
//     app.listen(port, () => {
//       resolve(); // HTTP server is listening, resolve the promise.
//     });
//   });
// }

// //
// // Application entry point.
// //
// function main() {
//   console.log("Hello world!");

//   return connectDb() // Connect to the database...
//     .then((db) => {
//       // then...
//       return connectRabbit() // connect to RabbitMQ...
//         .then((messageChannel) => {
//           // then...
//           return startHttpServer(db, messageChannel); // start the HTTP server.
//         });
//     });
// }

// main()
//   .then(() => console.log("Microservice online."))
//   .catch((err) => {
//     console.error("Microservice failed to start.");
//     console.error((err && err.stack) || err);
//   });

const express = require("express");
const bodyParser = require("body-parser");
const amqp = require("amqplib");
const mongoose = require("mongoose");
const Video = require("./model/video-history");

if (!process.env.MONGODB_URL) {
  throw new Error("Please specify the name MongoDB connection url string");
}

if (!process.env.RABBIT_URL) {
  throw new Error(
    "Please specify the name of the RabbitMQ host using environment variable RABBIT"
  );
}

const RABBIT = process.env.RABBIT_URL;

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Connect to the database.
const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to the database!");
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
};

// Connect to the RabbitMQ server.
async function connectRabbit() {
  console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);
  const messagingConnection = await amqp.connect(RABBIT);
  console.log("Connected to RabbitMQ.");
  return messagingConnection.createChannel();
}

// Setup event handlers.
async function setupHandlers(messageChannel) {
  async function consumeViewedMessage(msg) {
    console.log("Received a 'viewed' message");

    const parsedMsg = JSON.parse(msg.content.toString());

    return await Video.create({ videoPath: parsedMsg.videoPath }).then(() => {
      console.log("Acknowledging message was handled.");
      messageChannel.ack(msg);
    });
  }

  await messageChannel.assertQueue("viewed", {});
  console.log("Asserted that the 'viewed' queue exists.");

  await messageChannel.consume("viewed", consumeViewedMessage);
}

// Define your HTTP routes and message handlers.
async function defineRoutes(messageChannel) {
  // Define your HTTP routes here using app.get(), app.post(), etc.
  // For example:
  app.post("/api/viewed", (req, res) => {
    // Handle HTTP requests related to 'viewed' data.
    // You can interact with the database and RabbitMQ here.
    // Return appropriate responses.
  });

  await setupHandlers(messageChannel);
}

// Start the HTTP server.
async function startHttpServer(messageChannel) {
  await defineRoutes(messageChannel);

  app.listen(port, () => {
    console.log(`Express server is listening on port ${port}`);
  });
}

// Application entry point.
async function main() {
  console.log("Hello world!");

  await dbConnect();
  const messageChannel = await connectRabbit();
  await startHttpServer(messageChannel);
}

main()
  .then(() => console.log("Microservice online."))
  .catch((err) => {
    console.error("Microservice failed to start.");
    console.error((err && err.stack) || err);
  });
