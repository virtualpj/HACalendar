ARG BUILD_FROM
FROM $BUILD_FROM

RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY rootfs/server/package.json ./server/package.json
RUN cd server && npm install --omit=dev --no-audit --no-fund

COPY rootfs/server ./server
COPY rootfs/web ./web
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
