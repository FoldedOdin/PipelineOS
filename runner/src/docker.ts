import Docker from "dockerode";

/**
 * Dockerode client bound to the host socket (Compose mounts `/var/run/docker.sock`).
 */
export function createDockerClient(socketPath?: string): Docker {
  const socket = socketPath ?? process.env.DOCKER_SOCKET ?? "/var/run/docker.sock";
  return new Docker({ socketPath: socket });
}
