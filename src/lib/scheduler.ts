/**
 * Simple background task scheduler for IPOLENS services.
 * Provides basic interval-based task execution with error handling.
 * For production deployment, use Trigger.dev, Inngest, or cron jobs.
 */

export type ScheduledTask = {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  runImmediately?: boolean;
};

export class Scheduler {
  private tasks: Map<string, { intervalId: NodeJS.Timeout; task: ScheduledTask }>;
  private isRunning: boolean;

  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  /**
   * Add a scheduled task to run at specified intervals.
   */
  addTask(task: ScheduledTask): void {
    if (this.tasks.has(task.name)) {
      console.warn(`Task ${task.name} already exists, replacing it`);
      this.removeTask(task.name);
    }

    const intervalId = setInterval(async () => {
      try {
        await task.handler();
      } catch (error) {
        console.error(`Scheduled task "${task.name}" failed:`, error);
      }
    }, task.intervalMs);

    this.tasks.set(task.name, { intervalId, task });

    // Run immediately if requested
    if (task.runImmediately) {
      task.handler().catch((error) => {
        console.error(`Initial run of task "${task.name}" failed:`, error);
      });
    }

    console.info(`Scheduled task "${task.name}" added with interval ${task.intervalMs}ms`);
  }

  /**
   * Remove a scheduled task.
   */
  removeTask(name: string): boolean {
    const taskEntry = this.tasks.get(name);
    if (!taskEntry) {
      return false;
    }

    clearInterval(taskEntry.intervalId);
    this.tasks.delete(name);
    console.info(`Scheduled task "${name}" removed`);
    return true;
  }

  /**
   * Start the scheduler (starts all added tasks).
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.info('Scheduler started');
  }

  /**
   * Stop the scheduler (stops all tasks).
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Scheduler is not running');
      return;
    }

    for (const [name, { intervalId }] of this.tasks.entries()) {
      clearInterval(intervalId);
      console.info(`Scheduled task "${name}" stopped`);
    }

    this.tasks.clear();
    this.isRunning = false;
    console.info('Scheduler stopped');
  }

  /**
   * Get list of scheduled task names.
   */
  getTaskNames(): string[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * Check if scheduler is running.
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Background worker for token refresh service.
 * Can be run as a standalone process or integrated into main app.
 */
export class TokenRefreshWorker {
  private scheduler: Scheduler;
  private authTokenService: typeof import('./services/auth-token.service').AuthTokenService;

  constructor() {
    this.scheduler = new Scheduler();
    // Dynamic import to avoid circular dependencies
    this.authTokenService = null as any;
  }

  async initialize(): Promise<void> {
    // Lazy load to prevent circular dependency issues
    const { AuthTokenService } = await import('./services/auth-token.service');
    this.authTokenService = AuthTokenService;

    // Add token refresh task (runs every 20 hours)
    this.scheduler.addTask({
      name: 'angel-one-token-refresh',
      intervalMs: 20 * 60 * 60 * 1000, // 20 hours
      handler: async () => {
        console.info('Starting scheduled Angel One token refresh...');
        const result = await this.authTokenService.performScheduledRefresh();

        if (result.success) {
          console.info('Angel One token refresh completed successfully');
        } else {
          console.warn('Angel One token refresh failed:', result.error);
        }
      },
      runImmediately: true, // Run once on startup to ensure we have valid tokens
    });
  }

  start(): void {
    this.scheduler.start();
    console.info('Token refresh worker started');
  }

  stop(): void {
    this.scheduler.stop();
    console.info('Token refresh worker stopped');
  }
}

// Export singleton instances
export const scheduler = new Scheduler();
export const tokenRefreshWorker = new TokenRefreshWorker();

// Allow running as standalone script
if (require.main === module) {
  (async () => {
    await tokenRefreshWorker.initialize();
    tokenRefreshWorker.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.info('Received SIGINT, shutting down...');
      tokenRefreshWorker.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.info('Received SIGTERM, shutting down...');
      tokenRefreshWorker.stop();
      process.exit(0);
    });
  })().catch((error) => {
    console.error('Failed to start token refresh worker:', error);
    process.exit(1);
  });
}