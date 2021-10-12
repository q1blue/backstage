import EventSource from 'eventsource';
import { Logger } from 'winston';
import { LogsHandler } from './LogsHandler';

jest.mock('eventsource');

describe('LogsHandler', () => {
  let handler: LogsHandler;

  beforeEach(() => {
    handler = new LogsHandler('https://argo-workflows.local', 'ns', '<TOKEN>');
  });

  beforeEach(() => jest.resetAllMocks());

  describe('logWorkflowLogs', () => {
    it('should run successfully', async () => {
      const log: jest.Mocked<Partial<Logger>> = {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const promise = handler
        .logWorkflowLogs({
          name: 'test',
          taskLogger: log as Logger,
        })
        .then();

      const MockedEventSource: jest.MockedClass<typeof EventSource> =
        EventSource as any;
      const source = MockedEventSource.mock.instances[0];

      source.onmessage(
        new MessageEvent<any>('data', {
          data: '{"result": {"content": "log message 1"}}',
        }),
      );
      source.onmessage(
        new MessageEvent<string>('data', {
          data: '{"result": {"content": "log message 2"}}',
        }),
      );
      source.onmessage(
        new MessageEvent<string>('data', {
          data: '{"result": {}}',
        }),
      );
      source.onerror(new MessageEvent<any>('end'));

      await promise;

      expect(MockedEventSource).toBeCalledWith(
        'https://argo-workflows.local/api/v1/workflows/ns/test/log?logOptions.container=main&logOptions.follow=true',
        { headers: { Authorization: 'Bearer <TOKEN>' } },
      );

      expect(source.close).toBeCalledTimes(1);
      expect(log.info).toBeCalledTimes(2);
      expect(log.info).toBeCalledWith('log message 1');
      expect(log.info).toBeCalledWith('log message 2');
    });
  });
});
