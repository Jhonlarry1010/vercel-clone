"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github, Loader2 } from "lucide-react";
import { Fira_Code } from "next/font/google";
import axios from "axios";
import { toast } from "sonner";

const socket = io("http://localhost:9002", {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const firaCode = Fira_Code({ subsets: ["latin"] });

export default function Home() {
  const [repoURL, setURL] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [deployPreviewURL, setDeployPreviewURL] = useState<string | undefined>();
  const [socketConnected, setSocketConnected] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);

  const isValidURL: [boolean, string | null] = useMemo(() => {
    if (!repoURL || repoURL.trim() === "") return [false, null];
    const regex = new RegExp(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
    );
    return [regex.test(repoURL), "Enter valid Github Repository URL"];
  }, [repoURL]);

  const handleClickDeploy = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.post(`http://localhost:9000/project`, {
        gitURL: repoURL,
        slug: projectId,
      });

      if (data && data.data) {
        const { projectSlug, url } = data.data;
        setProjectId(projectSlug);
        setDeployPreviewURL(url);
        toast.success("Deployment started successfully!");
        socket.emit("subscribe", `logs:${projectSlug}`);
      }
    } catch (error) {
      toast.error("Failed to start deployment");
      console.error("Deploy error:", error);
    }
  }, [projectId, repoURL]);

  const handleSocketIncommingMessage = useCallback((message: string) => {
    try {
      const { log } = JSON.parse(message);
      setLogs((prev) => [...prev, log]);
      
      // Smooth scroll to bottom of logs
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    } catch (error) {
      console.error("Socket message error:", error);
    }
  }, []);

  useEffect(() => {
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("message", handleSocketIncommingMessage);
    socket.on("connect_error", () => {
      toast.error("Socket connection failed");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("message", handleSocketIncommingMessage);
      socket.off("connect_error");
    };
  }, [handleSocketIncommingMessage]);

  return (
    <main className="flex justify-center items-center min-h-screen p-4">
      <div className="w-full max-w-[800px] space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Deployment Platform</h1>
          <p className="text-muted-foreground">Deploy your GitHub projects with ease</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Github className="w-6 h-6" />
            <Input
              disabled={loading}
              value={repoURL}
              onChange={(e) => setURL(e.target.value)}
              type="url"
              placeholder="Enter your GitHub repository URL"
              className="flex-1"
            />
          </div>

          <Button
            onClick={handleClickDeploy}
            disabled={!isValidURL[0] || loading || !socketConnected}
            className="w-full relative"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? "Deploying..." : "Deploy"}
          </Button>

          {!socketConnected && (
            <p className="text-destructive text-sm">Socket connection lost. Reconnecting...</p>
          )}
        </div>

        {deployPreviewURL && (
          <div className="bg-slate-900 p-4 rounded-lg space-y-2">
            <h2 className="font-semibold">Preview URL</h2>
            <a
              target="_blank"
              className="text-sky-400 bg-sky-950 px-3 py-2 rounded-lg block hover:bg-sky-900 transition-colors"
              href={deployPreviewURL}
            >
              {deployPreviewURL}
            </a>
          </div>
        )}

        {logs.length > 0 && (
          <div
            ref={logContainerRef}
            className={`${firaCode.className} text-sm text-green-500 mt-5 border-green-500 border-2 rounded-lg p-4 h-[300px] overflow-y-auto`}
          >
            <pre className="flex flex-col gap-1">
              {logs.map((log, i) => (
                <code key={i}>{`> ${log}`}</code>
              ))}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}