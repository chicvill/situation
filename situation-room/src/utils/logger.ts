/**
 * 🛠️ Global Activity Logger for Debugging
 */
type LogLevel = 'info' | 'warn' | 'error' | 'success';

interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  addLog(level: LogLevel, message: string) {
    const newEntry: LogEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    this.logs = [newEntry, ...this.logs].slice(0, 50); // Keep last 50 logs
    this.notify();
    
    // Also output to real console
    const color = level === 'error' ? 'red' : level === 'success' ? 'green' : level === 'warn' ? 'yellow' : 'cyan';
    console.log(`%c[${newEntry.timestamp}] ${message}`, `color: ${color}; font-weight: bold;`);
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    listener(this.logs);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }

  info(msg: string) { this.addLog('info', msg); }
  success(msg: string) { this.addLog('success', msg); }
  warn(msg: string) { this.addLog('warn', msg); }
  error(msg: string) { this.addLog('error', msg); }
}

export const logger = new Logger();
