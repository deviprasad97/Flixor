"use client";

import {
  ReactNode,
  useEffect,
  useState,
  createContext,
  useContext,
} from "react";
import { uuidv4 } from "@/lib/utils";
import { Api } from "@/api";
import { PLEX } from "@/constants";
import axios from "axios";

const LibrariesContext = createContext({ 
  libraries: [],
  servers: [],
  currentServer: null,
  setCurrentServer: () => {},
} as {
  libraries: Plex.LibarySection[];
  servers: Array<{ name: string; uri: string }>;
  currentServer: { name: string; uri: string } | null;
  setCurrentServer: (server: { name: string; uri: string }) => void;
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [libraries, setLibraries] = useState<Plex.LibarySection[]>([]);
  const [servers, setServers] = useState<Array<{ name: string; uri: string }>>([]);
  const [currentServer, setCurrentServer] = useState<{ name: string; uri: string } | null>(null);

  const handleServerChange = async (server: { name: string; uri: string }) => {
    try {
      const { data } = await axios.get<{ MediaContainer: { Directory: Plex.LibarySection[] } }>(
        `${server.uri}/library/sections`,
        {
          headers: {
            "X-Plex-Token": localStorage.getItem("token") as string,
            accept: "application/json",
          },
        }
      );
      
      if (data) {
        localStorage.setItem("server", server.uri);
        localStorage.setItem("server-name", server.name);
        setCurrentServer(server);
        setLibraries(data.MediaContainer.Directory);
      }
    } catch (err) {
      console.error("Failed to load libraries for server:", err);
    }
  };

  useEffect(() => {
    let pin = localStorage.getItem("pin");
    const stored = localStorage.getItem("token");
    const pinId = new URL(location.href).searchParams.get("pinID");
    let uuid = localStorage.getItem("uuid");

    if (!uuid) {
      uuid = uuidv4();
      localStorage.setItem("uuid", uuid);
    }

    if (!stored) {
      if (!pinId) {
        Api.pin({ uuid })
          .then((res) => {
            pin = res.data.code;
            localStorage.setItem("pin", pin);
            window.location.href = `https://app.plex.tv/auth/#!?clientID=${
              uuid
            }&context[device][product]=${
              PLEX.application
            }&context[device][version]=4.118.0&context[device][platform]=Firefox&context[device][platformVersion]=122.0&context[device][device]=Linux&context[device][model]=bundled&context[device][screenResolution]=1920x945,1920x1080&context[device][layout]=desktop&context[device][protocol]=${window.location.protocol.replace(
              ":",
              "",
            )}&forwardUrl=${window.location.protocol}//${
              window.location.host
            }/login?pinID=${res.data.id}&code=${res.data.code}&language=en`;
          })
          .catch((err) => {
            console.error(err);
            // TODO: handle error
          });
      } else {
        Api.token({ uuid, pin: pinId })
          .then(async (res) => {
            // should have the token here
            if (!res.data.authToken) {
              // TODO: handle error
              console.log(res.data);
              return;
            }

            localStorage.setItem("token", res.data.authToken);
            localStorage.setItem("auth-token", res.data.authToken);
            window.location.href = "/";
          })
          .catch((err) => {
            console.error(err);
            // TODO: handle error
          });
      }
    } else {
      Api.servers()
        .then(async (res2) => {
          if (
            !res2.data ||
            res2.data.length === 0 ||
            !res2.data[0].connections ||
            res2.data[0].connections.length === 0
          ) {
            return;
          }

          // Store all available servers
          const availableServers = res2.data.map(server => ({
            name: server.name,
            connections: server.connections
          })).filter(server => server.connections && server.connections.length > 0);

          // Test each server's connection and store working ones
          const workingServers: Array<{ name: string; uri: string }> = [];

          for (const server of availableServers) {
            for (const connection of server.connections) {
              try {
                const response = await axios.get<{ MediaContainer: { Directory: Plex.LibarySection[] } }>(
                  `${connection.uri}/library/sections`,
                  {
                    headers: {
                      "X-Plex-Token": localStorage.getItem("token") as string,
                      accept: "application/json",
                    },
                  }
                );

                if (response.data) {
                  workingServers.push({
                    name: server.name,
                    uri: connection.uri
                  });
                  break; // Found a working connection for this server
                }
              } catch (err) {
                console.error(`Connection failed for ${server.name}:`, err);
                continue;
              }
            }
          }

          setServers(workingServers);

          // Set current server (either from localStorage or first available)
          const savedServerUri = localStorage.getItem("server");
          const savedServerName = localStorage.getItem("server-name");
          const initialServer = savedServerUri && savedServerName
            ? { uri: savedServerUri, name: savedServerName }
            : workingServers[0];

          if (initialServer) {
            await handleServerChange(initialServer);
          } else {
            localStorage.removeItem("token");
            window.location.href = "/";
          }
        })
        .catch((err) => {
          if (err.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log(err.response.data);
            console.log(err.response.status);
            console.log(err.response.headers);
            if (err.response.status === 401) {
              localStorage.removeItem("token");
              window.location.href = "/";
              return;
            }
          } else if (err.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.log(err.request);
          }
          console.error(err);
          // TODO: handle other errors

          localStorage.removeItem("token");
          window.location.href = "/";
          return;
        });
    }
  }, []);

  if (libraries.length === 0) return null;

  return (
    <LibrariesContext.Provider value={{ libraries, servers, currentServer, setCurrentServer: handleServerChange }}>
      {children}
    </LibrariesContext.Provider>
  );
}

export const useLibraries = () => {
  return useContext(LibrariesContext);
};
