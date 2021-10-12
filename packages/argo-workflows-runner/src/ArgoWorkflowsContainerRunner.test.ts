import { ConfigReader } from '@backstage/config';
import { exponentialBuckets, Gauge, Histogram } from 'prom-client';
import { PassThrough } from 'stream';
import { ArgoWorkflowsContainerRunner } from './ArgoWorkflowsContainerRunner';
import { ArtifactsHelper, Folders } from './ArtifactsHelper';
import { WorkflowRunner } from './WorkflowRunner';

jest.mock('prom-client');

const MockedGauge: jest.MockedClass<typeof Gauge> = Gauge as any;

describe('ArgoWorkflowsContainerRunner', () => {
  const workflowRunner = {
    generateWorkflowSpec: jest.fn(),
    runInArgoWorkflow: jest.fn(),
  } as jest.Mocked<Partial<WorkflowRunner>> as jest.Mocked<WorkflowRunner>;

  const artifactsHelper: jest.Mocked<ArtifactsHelper> = {
    calculateArtifacts: jest.fn(),
    uploadArtifacts: jest.fn(),
    downloadArtifacts: jest.fn(),
    deleteArtifacts: jest.fn(),
  } as jest.Mocked<Partial<ArtifactsHelper>> as jest.Mocked<ArtifactsHelper>;

  const trackDurationFinish = jest.fn();
  let trackDuration: ArgoWorkflowsContainerRunner['metricsContext']['trackDuration'];
  type AnyGauge = Gauge<any>;
  const concurrentJobsGauge: jest.Mocked<AnyGauge> = {
    labels: jest.fn(),
    dec: jest.fn(),
    inc: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
    setToCurrentTime: jest.fn(),
    startTimer: jest.fn(),
    reset: jest.fn(),
  };

  let runner: ArgoWorkflowsContainerRunner;

  beforeEach(() => {
    trackDuration = jest.fn(() => trackDurationFinish);

    runner = new ArgoWorkflowsContainerRunner({
      artifacts: artifactsHelper as ArtifactsHelper,
      workflowRunner: workflowRunner as WorkflowRunner,
      allowedImages: [/^my-image$/],
      metricsContext: {
        trackDuration,
        concurrentJobsGauge,
      },
    });

    concurrentJobsGauge.labels.mockReturnValue(concurrentJobsGauge);
  });

  afterEach(() => jest.resetAllMocks());

  describe('isActive', () => {
    it('should return true if config is available', () => {
      expect(
        ArgoWorkflowsContainerRunner.isActive({
          config: new ConfigReader({
            argoWorkflowsRunner: {},
          }),
        }),
      ).toBe(true);
    });

    it('should return false if config is missing', () => {
      expect(
        ArgoWorkflowsContainerRunner.isActive({ config: new ConfigReader({}) }),
      ).toBe(false);
    });
  });

  describe('createMetrics', () => {
    const getMock = () => {
      const HistogramMock = Histogram as jest.MockedClass<typeof Histogram>;
      const histogram = HistogramMock.mock.instances[0] as jest.Mocked<
        Histogram<any>
      >;

      return { HistogramMock, histogram };
    };

    it('should create histogram', () => {
      (exponentialBuckets as jest.Mock).mockImplementation((...args) => {
        const { exponentialBuckets: actual } =
          jest.requireActual('prom-client');
        return actual(...args);
      });

      ArgoWorkflowsContainerRunner.createMetrics();

      const { HistogramMock } = getMock();

      expect(HistogramMock).toBeCalledTimes(1);
      expect(HistogramMock).toBeCalledWith({
        buckets: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
        help: 'Duration of the execution of argo workflows',
        labelNames: ['imageName', 'status'],
        name: 'backstage_argo_workflows_container_runner_execution_seconds',
      });
    });

    it('should forward image name', () => {
      const { trackDuration: trackDurationFn } =
        ArgoWorkflowsContainerRunner.createMetrics();

      const { histogram } = getMock();

      trackDurationFn('my-image-name');

      expect(histogram.startTimer).toBeCalledTimes(1);
      expect(histogram.startTimer).toBeCalledWith({
        imageName: 'my-image-name',
      });
    });

    it('should forward success metric', () => {
      const { trackDuration: trackDurationFn } =
        ArgoWorkflowsContainerRunner.createMetrics();

      const { histogram } = getMock();

      const endFn = jest.fn();
      histogram.startTimer.mockReturnValue(endFn);

      trackDurationFn('my-image-name')(false);

      expect(endFn).toBeCalledTimes(1);
      expect(endFn).toBeCalledWith({ status: 'success' });
    });

    it('should forward failed metric', () => {
      const { trackDuration: trackDurationFn } =
        ArgoWorkflowsContainerRunner.createMetrics();

      const { histogram } = getMock();

      const endFn = jest.fn();
      histogram.startTimer.mockReturnValue(endFn);

      trackDurationFn('my-image-name')(true);

      expect(endFn).toBeCalledTimes(1);
      expect(endFn).toBeCalledWith({ status: 'failed' });
    });

    it('should return gauge', () => {
      const { concurrentJobsGauge: gauge } =
        ArgoWorkflowsContainerRunner.createMetrics();

      expect(MockedGauge).toBeCalledTimes(1);
      expect(MockedGauge).toBeCalledWith({
        help: 'Number of currently running executions of argo workflows',
        labelNames: ['imageName'],
        name: 'backstage_argo_workflows_container_runner_running_jobs_count',
      });
      expect(gauge).toBe(MockedGauge.mock.instances[0]);
    });
  });

  describe('runContainer', () => {
    it('should reject execution of an unfamiliar image', async () => {
      await expect(
        runner.runContainer({
          imageName: 'my-image:latest',
          command: ['sh'],
          args: ['sleep', '1'],
          logStream: new PassThrough(),
          mountDirs: {
            '/host/input': '/container/input',
            '/host/output': '/container/output',
          },
          workingDir: '/container/input',
          envVars: {
            HOME: '/tmp',
          },
        }),
      ).rejects.toThrow(
        /Container image "my-image:latest" is now allowed. Please check the configuration./,
      );
    });

    it('should run workflow', async () => {
      const folders: Folders = [
        {
          outputKey: 'OUTPUT',
          hostDirectory: 'HOST',
          containerDirectory: 'CONTAINER',
          inputKey: 'INPUT',
        },
      ];
      artifactsHelper.calculateArtifacts.mockReturnValue({
        workDirName: 'mock',
        folders,
      });

      await runner.runContainer({
        imageName: 'my-image',
        command: ['sh'],
        args: ['sleep', '1'],
        logStream: new PassThrough(),
        mountDirs: {
          '/host/input': '/container/input',
          '/host/output': '/container/output',
        },
        workingDir: '/container/input',
        envVars: {
          HOME: '/tmp',
        },
      });

      expect(artifactsHelper.calculateArtifacts).toBeCalledTimes(1);
      expect(artifactsHelper.calculateArtifacts).toBeCalledWith({
        '/host/input': '/container/input',
        '/host/output': '/container/output',
      });

      expect(artifactsHelper.uploadArtifacts).toBeCalledTimes(1);
      expect(artifactsHelper.uploadArtifacts).toBeCalledWith(folders);

      expect(workflowRunner.runInArgoWorkflow).toBeCalledTimes(1);
      expect(workflowRunner.runInArgoWorkflow).toBeCalledWith({
        folders,
        opts: {
          args: ['sleep', '1'],
          command: ['sh'],
          envVars: {
            HOME: '/tmp',
          },
          imageName: 'my-image',
          logStream: expect.anything(),
          mountDirs: {
            '/host/input': '/container/input',
            '/host/output': '/container/output',
          },
          workingDir: '/container/input',
        },
        taskLogger: expect.anything(),
      });

      expect(artifactsHelper.deleteArtifacts).toBeCalledTimes(1);
      expect(artifactsHelper.deleteArtifacts).toBeCalledWith(folders);
    });

    it('should cleanup on error', async () => {
      const folders: Folders = [
        {
          outputKey: 'OUTPUT',
          hostDirectory: 'HOST',
          containerDirectory: 'CONTAINER',
          inputKey: 'INPUT',
        },
      ];
      artifactsHelper.calculateArtifacts.mockReturnValue({
        workDirName: 'mock',
        folders,
      });

      workflowRunner.runInArgoWorkflow.mockRejectedValue(new Error());

      await expect(
        runner.runContainer({
          imageName: 'my-image',
          command: ['sh'],
          args: ['sleep', '1'],
          logStream: new PassThrough(),
          mountDirs: {
            '/host/input': '/container/input',
            '/host/output': '/container/output',
          },
          workingDir: '/container/input',
          envVars: {
            HOME: '/tmp',
          },
        }),
      ).rejects.toThrow();

      expect(artifactsHelper.calculateArtifacts).toBeCalledTimes(1);

      expect(artifactsHelper.uploadArtifacts).toBeCalledTimes(1);

      expect(workflowRunner.runInArgoWorkflow).toBeCalledTimes(1);

      expect(artifactsHelper.deleteArtifacts).toBeCalledTimes(1);
      expect(artifactsHelper.deleteArtifacts).toBeCalledWith(folders);
    });

    it('should emit success metric', async () => {
      const folders: Folders = [
        {
          outputKey: 'OUTPUT',
          hostDirectory: 'HOST',
          containerDirectory: 'CONTAINER',
          inputKey: 'INPUT',
        },
      ];
      artifactsHelper.calculateArtifacts.mockReturnValue({
        workDirName: 'mock',
        folders,
      });

      await runner.runContainer({
        imageName: 'my-image',
        command: ['sh'],
        args: ['sleep', '1'],
        logStream: new PassThrough(),
        mountDirs: {
          '/host/input': '/container/input',
          '/host/output': '/container/output',
        },
        workingDir: '/container/input',
        envVars: {
          HOME: '/tmp',
        },
      });

      expect(trackDuration).toBeCalledTimes(1);
      expect(trackDuration).toBeCalledWith('my-image');

      expect(trackDurationFinish).toBeCalledTimes(1);
      expect(trackDurationFinish).toBeCalledWith(false);
    });

    it('should emit failed metric', async () => {
      const folders: Folders = [
        {
          outputKey: 'OUTPUT',
          hostDirectory: 'HOST',
          containerDirectory: 'CONTAINER',
          inputKey: 'INPUT',
        },
      ];
      artifactsHelper.calculateArtifacts.mockReturnValue({
        workDirName: 'mock',
        folders,
      });

      workflowRunner.runInArgoWorkflow.mockRejectedValue(new Error());

      await expect(
        runner.runContainer({
          imageName: 'my-image',
          command: ['sh'],
          args: ['sleep', '1'],
          logStream: new PassThrough(),
          mountDirs: {
            '/host/input': '/container/input',
            '/host/output': '/container/output',
          },
          workingDir: '/container/input',
          envVars: {
            HOME: '/tmp',
          },
        }),
      ).rejects.toThrow();

      expect(trackDuration).toBeCalledTimes(1);
      expect(trackDuration).toBeCalledWith('my-image');

      expect(trackDurationFinish).toBeCalledTimes(1);
      expect(trackDurationFinish).toBeCalledWith(true);
    });

    it('should increase and reset concurrent count', async () => {
      const folders: Folders = [
        {
          outputKey: 'OUTPUT',
          hostDirectory: 'HOST',
          containerDirectory: 'CONTAINER',
          inputKey: 'INPUT',
        },
      ];
      artifactsHelper.calculateArtifacts.mockReturnValue({
        workDirName: 'mock',
        folders,
      });

      let resolvePromise = () => {};
      workflowRunner.runInArgoWorkflow.mockReturnValue(
        new Promise(resolve => (resolvePromise = resolve)),
      );

      const runnerPromise = runner
        .runContainer({
          imageName: 'my-image',
          command: ['sh'],
          args: ['sleep', '1'],
          logStream: new PassThrough(),
          mountDirs: {
            '/host/input': '/container/input',
            '/host/output': '/container/output',
          },
          workingDir: '/container/input',
          envVars: {
            HOME: '/tmp',
          },
        })
        .then();

      expect(concurrentJobsGauge.inc).toBeCalledTimes(1);
      expect(concurrentJobsGauge.dec).toBeCalledTimes(0);

      // resolve the runner
      resolvePromise();
      await runnerPromise;

      expect(concurrentJobsGauge.dec).toBeCalledTimes(1);

      expect(concurrentJobsGauge.labels.mock.calls).toEqual([
        ['my-image'],
        ['my-image'],
      ]);
    });

    it('should increase and reset concurrent count on error', async () => {
      const folders: Folders = [
        {
          outputKey: 'OUTPUT',
          hostDirectory: 'HOST',
          containerDirectory: 'CONTAINER',
          inputKey: 'INPUT',
        },
      ];
      artifactsHelper.calculateArtifacts.mockReturnValue({
        workDirName: 'mock',
        folders,
      });

      let rejectPromise = (_e: Error) => {};
      workflowRunner.runInArgoWorkflow.mockReturnValue(
        new Promise((_, reject) => (rejectPromise = reject)),
      );

      const runnerPromise = runner
        .runContainer({
          imageName: 'my-image',
          command: ['sh'],
          args: ['sleep', '1'],
          logStream: new PassThrough(),
          mountDirs: {
            '/host/input': '/container/input',
            '/host/output': '/container/output',
          },
          workingDir: '/container/input',
          envVars: {
            HOME: '/tmp',
          },
        })
        .then();

      expect(concurrentJobsGauge.inc).toBeCalledTimes(1);
      expect(concurrentJobsGauge.dec).toBeCalledTimes(0);

      // resolve the runner
      rejectPromise(new Error());
      await expect(runnerPromise).rejects.toThrow();

      expect(concurrentJobsGauge.dec).toBeCalledTimes(1);

      expect(concurrentJobsGauge.labels.mock.calls).toEqual([
        ['my-image'],
        ['my-image'],
      ]);
    });
  });
});
