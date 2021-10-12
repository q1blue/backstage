import { Logger } from 'winston';
import { EventsHandler } from './EventsHandler';
import { LogsHandler } from './LogsHandler';

export class ArgoWorkflowsEvents {
  private readonly eventsHandler: EventsHandler;
  private readonly logsHandler: LogsHandler;

  constructor({
    baseUrl,
    namespace,
    accessToken,
  }: {
    baseUrl: string;
    namespace: string;
    accessToken: string;
  }) {
    this.eventsHandler = new EventsHandler(baseUrl, namespace, accessToken);
    this.logsHandler = new LogsHandler(baseUrl, namespace, accessToken);
  }

  async logProgressAndWaitForJobToFinish({
    name,
    taskLogger,
  }: {
    name: string;
    taskLogger: Logger;
  }): Promise<void> {
    // the stream of events needs to be manually closed
    const stopEvents = this.eventsHandler.logWorkflowEvents({
      name,
      taskLogger,
    });

    try {
      // the stream of logs is closed as soon as the workflow finished
      await this.logsHandler.logWorkflowLogs({ name, taskLogger });
    } finally {
      stopEvents();
    }
  }
}
