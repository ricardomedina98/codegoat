const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinner(message: string): { stop(): void } {
  if (!process.stderr.isTTY) {
    return { stop() {} };
  }

  let i = 0;
  const interval = setInterval(() => {
    process.stderr.write(`\r${FRAMES[i % FRAMES.length]} ${message}`);
    i++;
  }, 80);

  return {
    stop() {
      clearInterval(interval);
      process.stderr.write("\r\x1b[K"); // clear line
    },
  };
}
