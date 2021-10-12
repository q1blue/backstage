import EventSource from 'eventsource';
import { Logger } from 'winston';

export class EventsHandler {
  constructor(
    private readonly baseUrl: string,
    private readonly namespace: string,
    private readonly accessToken: string,
  ) {}

  /**
   * Log the events (i.e. Pod events) from the selected workflow.
   *
   * @param name the name of the workflow to monitor
   * @param taskLogger the logger to write the events to
   * @return a callback that should be called to cancel the event stream
   */
  logWorkflowEvents({
    name,
    taskLogger,
  }: {
    name: string;
    taskLogger: Logger;
  }): () => void {
    const source = new EventSource(
      `${this.baseUrl}/api/v1/stream/events/${this.namespace}?listOptions.fieldSelector=involvedObject.kind=Pod,involvedObject.name=${name}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    source.onmessage = e => {
      const { result } = JSON.parse(e.data);

      if (result) {
        const { reason, message, type } = result;

        switch (type) {
          case 'Normal':
            taskLogger.debug(message);
            return;

          case 'Warning':
            taskLogger.warn(message);
            return;

          default:
            taskLogger.info(`${type}: (${reason}) "${message}"`);
        }
      }
    };

    source.onerror = () => source.close();

    return () => {
      source.close();
    };
  }
}
