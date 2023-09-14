FROM node:20-alpine3.17

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY ./index.js ./
CMD npm start