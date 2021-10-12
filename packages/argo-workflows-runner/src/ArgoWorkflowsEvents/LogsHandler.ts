import EventSource from 'eventsource';
import { Logger } from 'winston';

export class LogsHandler {
  constructor(
    private readonly baseUrl: string,
    private readonly namespace: string,
    private readonly accessToken: string,
  ) {}

  /**
   * Log the log messages that the executed command emitted.
   *
   * @param name the name of the workflow to monitor
   * @param taskLogger the logger to write the events to
   * @return a Promise that resolves when the workflow finishes
   */
  logWorkflowLogs({
    name,
    taskLogger,
  }: {
    name: string;
    taskLogger: Logger;
  }): Promise<void> {
    return new Promise<void>(resolve => {
      const source = new EventSource(
        `${this.baseUrl}/api/v1/workflows/${this.namespace}/${name}/log?logOptions.container=main&logOptions.follow=true`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      source.onmessage = e => {
        const {
          result: { content },
        } = JSON.parse(e.data);

        if (content) {
          taskLogger.info(content);
        }
      };

      // is called when the event-stream is closed -> when the workflow pod has been terminated
      source.onerror = () => {
        source.close();
        resolve();
      };
    });
  }
}
