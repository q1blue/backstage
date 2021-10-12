import EventSource from 'eventsource';
import { Logger } from 'winston';
import { EventsHandler } from './EventsHandler';

jest.mock('eventsource');

describe('EventsHandler', () => {
  let handler: EventsHandler;

  beforeEach(() => {
    handler = new EventsHandler(
      'https://argo-workflows.local',
      'ns',
      '<TOKEN>',
    );
  });

  beforeEach(() => jest.resetAllMocks());

  describe('logWorkflowEvents', () => {
    it('should run successfully', async () => {
      const log: jest.Mocked<Partial<Logger>> = {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const stop = handler.logWorkflowEvents({
        name: 'test',
        taskLogger: log as Logger,
      });

      const MockedEventSource: jest.MockedClass<typeof EventSource> =
        EventSource as any;
      const source = MockedEventSource.mock.instances[0];

      source.onmessage(
        new MessageEvent<string>('data', {
          data: '{"result": null}',
        }),
      );
      source.onmessage(
        new MessageEvent<any>('data', {
          data: '{"result": {"reason": "...", "type": "Normal", "message": "log message 1"}}',
        }),
      );
      source.onmessage(
        new MessageEvent<string>('data', {
          data: '{"result": {"reason": "...", "type": "Warning", "message": "log message 2"}}',
        }),
      );
      source.onmessage(
        new MessageEvent<string>('data', {
          data: '{"result": {"reason": "...", "type": "Other", "message": "log message 3"}}',
        }),
      );
      source.onerror(new MessageEvent<any>('end'));

      stop();

      expect(MockedEventSource).toBeCalledWith(
        'https://argo-workflows.local/api/v1/stream/events/ns?listOptions.fieldSelector=involvedObject.kind=Pod,involvedObject.name=test',
        { headers: { Authorization: 'Bearer <TOKEN>' } },
      );

      expect(source.close).toBeCalledTimes(2);

      expect(log.debug).toBeCalledTimes(1);
      expect(log.debug).toBeCalledWith('log message 1');
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith('log message 2');
      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith('Other: (...) "log message 3"');
    });
  });
});
