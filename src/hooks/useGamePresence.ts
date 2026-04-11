import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { matrixService } from '../core/matrix';

declare global {
  interface Window {
    gemini?: {
      runShellCommand?: (opts: { command: string; description: string }) => Promise<{ output: string }>;
    };
  }
}

export const useGamePresence = () => {
  const { trackedGames, setDetectedGame, detectedGame } = useAppStore();
  const [runningProcesses, setRunningProcesses] = useState<string[]>([]);
  const lastGameRef = useRef<string | null>(null);

  useEffect(() => {
    const checkProcesses = async () => {
      try {
        // This only works if the environment allows executing shell commands (like our current agent environment)
        // In a real browser, this would requires a companion app or a different approach.
        const response = await window.gemini?.runShellCommand?.({
          command: "ps -e -o comm= | sort | uniq",
          description: "Checking running processes for game presence"
        });

        if (response?.output) {
          const processes = response.output.split('\n').map((p: string) => p.trim()).filter(p => p.length > 0);
          setRunningProcesses(processes);
          
          let foundGame: string | null = null;
          
          // Check for tracked games first
          for (const gameProcess of trackedGames) {
            if (processes.includes(gameProcess)) {
              foundGame = gameProcess; // Just store the process name, service will handle display name
              break;
            }
          }

          if (foundGame !== lastGameRef.current) {
            lastGameRef.current = foundGame;
            setDetectedGame(foundGame);
            
            // Sync with Matrix via the service helper
            await matrixService.syncPresenceWithStore();
          }
        }
      } catch {
        // Silently fail as this is a background task
        // console.error("Process check failed:", e);
      }
    };

    // Initial check
    checkProcesses();

    // Check every 30 seconds
    const interval = setInterval(checkProcesses, 30000);

    return () => clearInterval(interval);
  }, [trackedGames, setDetectedGame]);

  return { detectedGame, runningProcesses };
};
