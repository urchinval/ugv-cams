import net from 'node:net';

/** True if something already accepts TCP connections on 127.0.0.1:<port>. */
export function isPortListening(port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const done = (listening: boolean) => {
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}
