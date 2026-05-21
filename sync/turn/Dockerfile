FROM debian:bookworm-slim

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends coturn \
  && rm -rf /var/lib/apt/lists/*

COPY etc/coturn/turnserver.conf /etc/coturn/turnserver.conf
COPY etc/coturn/docker-entrypoint-unikraft.sh /etc/coturn/docker-entrypoint-unikraft.sh
RUN chmod +x /etc/coturn/docker-entrypoint-unikraft.sh

EXPOSE 3478/tcp 3478/udp

ENTRYPOINT ["/etc/coturn/docker-entrypoint-unikraft.sh"]
