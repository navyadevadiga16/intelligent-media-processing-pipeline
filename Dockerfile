FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install --production

COPY . ./

RUN mkdir -p /usr/src/app/uploads

ENV PORT=3000
EXPOSE 3000

CMD ["node", "app.js"]
