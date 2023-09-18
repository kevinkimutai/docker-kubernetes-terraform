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

  return messageChannel
    .assertExchange("viewed", "fanout") // Assert that we have a "viewed" exchange.
    .then(() => {
      return messageChannel.assertQueue("", { exclusive: true }); // Create an anonyous queue.
    })
    .then((response) => {
      const queueName = response.queue;
      console.log(
        `Created queue ${queueName}, binding it to "viewed" exchange.`
      );
      return messageChannel
        .bindQueue(queueName, "viewed", "") // Bind the queue to the exchange.
        .then(() => {
          return messageChannel.consume(queueName, consumeViewedMessage); // Start receiving messages from the anonymous queue.
        });
    });
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
