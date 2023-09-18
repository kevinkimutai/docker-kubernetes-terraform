const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const Video = require("./model/video");
const amqp = require("amqplib");

const app = express();

if (!process.env.PORT) {
  throw new Error(
    "Please specify the port number for the HTTP server with the environment variable PORT."
  );
}

if (!process.env.VIDEO_STORAGE_HOST) {
  throw new Error(
    "Please specify the host name for the video storage microservice in variable VIDEO_STORAGE_HOST."
  );
}

if (!process.env.VIDEO_STORAGE_PORT) {
  throw new Error(
    "Please specify the port number for the video storage microservice in variable VIDEO_STORAGE_PORT."
  );
}
if (!process.env.RABBIT_URL) {
  throw new Error("Please specify the RabbitMQ URL server.");
}

//
// Extracts environment variables to globals for convenience.
//
const PORT = process.env.PORT;
const RABBIT = process.env.RABBIT_URL;
const VIDEO_STORAGE_HOST = process.env.VIDEO_STORAGE_HOST;
const VIDEO_STORAGE_PORT = parseInt(process.env.VIDEO_STORAGE_PORT);
console.log(
  `Forwarding video requests to ${VIDEO_STORAGE_HOST}:${VIDEO_STORAGE_PORT}.`
);

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

function sendViewedMessage(messageChannel, videoPath) {
  console.log(`Publishing message on "viewed" queue.`);

  const msg = { videoPath: videoPath };
  const jsonMsg = JSON.stringify(msg);
  messageChannel.publish("", "viewed", Buffer.from(jsonMsg)); // Publish message to the "viewed" queue.
}

// Define your HTTP routes and message handlers.
async function routeHandlers(messageChannel) {
  //
  // Registers a HTTP GET route for video streaming.
  //
  app.get("/video", async (req, res) => {
    const videoId = req.query.id;

    const foundVideo = await Video.findById(videoId);

    if (!foundVideo) {
      res.sendStatus(404);
      return;
    }

    console.log(foundVideo);

    sendViewedMessage(messageChannel, foundVideo.path);

    // const forwardRequest = http.request(
    //   // Forward the request to the video storage microservice.
    //   {
    //     host: VIDEO_STORAGE_HOST,
    //     port: VIDEO_STORAGE_PORT,
    //     path: `/video?path=${foundVideo.path}`, // Video path is hard-coded for the moment.
    //     method: "GET",
    //     headers: req.headers,
    //   },
    //   (forwardResponse) => {
    //     res.writeHeader(forwardResponse.statusCode, forwardResponse.headers);
    //     forwardResponse.pipe(res);
    //   }
    // );

    // req.pipe(forwardRequest);

    res.status(200).json({ message: "success" });
  });
}

// Start the HTTP server.
async function startHttpServer(messageChannel) {
  await routeHandlers(messageChannel);

  app.listen(PORT, () => {
    console.log(`Express server is listening on port ${PORT}`);
  });
}

// Application entry point.
async function main() {
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
