import { getVoidLogger } from '@backstage/backend-common';
import { ArgoWorkflowsEvents } from './ArgoWorkflowsEvents';
import { EventsHandler } from './EventsHandler';
import { LogsHandler } from './LogsHandler';

jest.mock('./EventsHandler');
jest.mock('./LogsHandler');

describe('ArgoWorkflowsEvents', () => {
  let handler: ArgoWorkflowsEvents;

  beforeEach(() => jest.resetAllMocks());

  beforeEach(() => {
    handler = new ArgoWorkflowsEvents({
      baseUrl: 'https://argo-workflows.local',
      accessToken: '<TOKEN>',
      namespace: 'ns',
    });
  });

  describe('logProgressAndWaitForJobToFinish', () => {
    it('should work', async () => {
      const logger = getVoidLogger();

      const stopEvents = jest.fn();

      const MockedEventsHandler: jest.MockedClass<typeof EventsHandler> =
        EventsHandler as any;
      const MockedLogsHandler: jest.MockedClass<typeof LogsHandler> =
        LogsHandler as any;

      const eventsHandler = MockedEventsHandler.mock
        .instances[0] as jest.Mocked<EventsHandler>;
      const logsHandler = MockedLogsHandler.mock
        .instances[0] as jest.Mocked<LogsHandler>;

      eventsHandler.logWorkflowEvents.mockReturnValue(stopEvents);
      logsHandler.logWorkflowLogs.mockResolvedValue();

      await handler.logProgressAndWaitForJobToFinish({
        name: 'wf-0',
        taskLogger: logger,
      });

      expect(eventsHandler.logWorkflowEvents).toBeCalledTimes(1);
      expect(eventsHandler.logWorkflowEvents).toBeCalledWith({
        name: 'wf-0',
        taskLogger: logger,
      });

      expect(logsHandler.logWorkflowLogs).toBeCalledTimes(1);
      expect(logsHandler.logWorkflowLogs).toBeCalledWith({
        name: 'wf-0',
        taskLogger: logger,
      });

      expect(stopEvents).toBeCalledTimes(1);
    });

    it('should cleanup on exception', async () => {
      const logger = getVoidLogger();

      const stopEvents = jest.fn();

      const MockedEventsHandler: jest.MockedClass<typeof EventsHandler> =
        EventsHandler as any;
      const MockedLogsHandler: jest.MockedClass<typeof LogsHandler> =
        LogsHandler as any;

      const eventsHandler = MockedEventsHandler.mock
        .instances[0] as jest.Mocked<EventsHandler>;
      const logsHandler = MockedLogsHandler.mock
        .instances[0] as jest.Mocked<LogsHandler>;

      eventsHandler.logWorkflowEvents.mockReturnValue(stopEvents);
      logsHandler.logWorkflowLogs.mockRejectedValue(
        new Error('Unexpected Error!'),
      );

      await expect(
        handler.logProgressAndWaitForJobToFinish({
          name: 'wf-0',
          taskLogger: logger,
        }),
      ).rejects.toThrow();

      expect(eventsHandler.logWorkflowEvents).toBeCalledTimes(1);
      expect(eventsHandler.logWorkflowEvents).toBeCalledWith({
        name: 'wf-0',
        taskLogger: logger,
      });

      expect(logsHandler.logWorkflowLogs).toBeCalledTimes(1);
      expect(logsHandler.logWorkflowLogs).toBeCalledWith({
        name: 'wf-0',
        taskLogger: logger,
      });

      expect(stopEvents).toBeCalledTimes(1);
    });
  });
});
