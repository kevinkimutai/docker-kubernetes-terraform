FROM node:20-alpine3.17

COPY package*.json ./
RUN npm install --only=production
COPY ./index.js ./
COPY ./videos ./videos
CMD npm start