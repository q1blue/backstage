import { getVoidLogger, RunContainerOptions } from '@backstage/backend-common';
import { msw } from '@backstage/test-utils';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { PassThrough } from 'stream';
import { ArgoWorkflowsEvents } from '../ArgoWorkflowsEvents';
import { Folders } from '../ArtifactsHelper';
import { WorkflowRunner } from './WorkflowRunner';

const server = setupServer();

describe('ArgoWorkflowsContainerRunner', () => {
  msw.setupDefaultHandlers(server);

  const logger = getVoidLogger();

  const eventsHandler: jest.Mocked<Partial<ArgoWorkflowsEvents>> = {
    logProgressAndWaitForJobToFinish: jest.fn(),
  };

  const folders: Folders = [
    {
      hostDirectory: 'tmp',
      containerDirectory: '/input',
      inputKey: 'folder/input.tar.gz',
      outputKey: 'folder/output.tar.gz',
    },
  ];

  const opts: RunContainerOptions = {
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
  };

  let runner: WorkflowRunner;

  beforeEach(() => {
    runner = new WorkflowRunner({
      baseUrl: 'https://argo-workflows.local',
      accessToken: '<TOKEN>',
      executionNamespace: 'ns',
      serviceAccountName: 'sa-2',
      executorServiceAccountName: 'sa-1',
      workflowPodAnnotations: {
        'sda.se/test': 'asdf',
      },
      artifactS3Config: {
        bucket: 'my-bucket',
        useSDKCreds: true,
        endpoint: 's3.local',
      },
      logger,
      eventsHandler: eventsHandler as ArgoWorkflowsEvents,
    });
  });

  beforeEach(() => jest.resetAllMocks());

  describe('runInArgoWorkflow', () => {
    it('should run successfully', async () => {
      // mock the internal function since we want to test it separately
      runner.generateWorkflowSpec = jest.fn(() => 'A_GENERATED_JSON_VALUE');

      const taskLogger = getVoidLogger();
      let createBody = undefined;

      server.use(
        rest.post(
          'https://argo-workflows.local/api/v1/workflows/ns',
          (req, res, ctx) => {
            if (req.headers.get('authorization') !== 'Bearer <TOKEN>') {
              return res(ctx.status(403));
            }

            createBody = req.body;

            return res(
              ctx.json({
                metadata: {
                  name: 'test',
                },
              }),
            );
          },
        ),
      );

      server.use(
        rest.get(
          'https://argo-workflows.local/api/v1/workflows/ns/test',
          (req, res, ctx) => {
            if (req.headers.get('authorization') !== 'Bearer <TOKEN>') {
              return res(ctx.status(403));
            }

            const fields = req.url.searchParams.get('fields')!.split(',');

            return res(
              ctx.json({
                status: {
                  phase: fields.includes('status.phase')
                    ? 'Succeeded'
                    : undefined,
                  message: fields.includes('status.message') ? 'ok' : undefined,
                },
              }),
            );
          },
        ),
      );

      await runner.runInArgoWorkflow({
        folders,
        taskLogger,
        opts,
      });

      expect(createBody).toEqual('A_GENERATED_JSON_VALUE');

      expect(eventsHandler.logProgressAndWaitForJobToFinish).toBeCalledTimes(1);
      expect(eventsHandler.logProgressAndWaitForJobToFinish).toBeCalledWith({
        name: 'test',
        taskLogger,
      });
    });

    it('should throw on failed', async () => {
      // mock the internal function since we want to test it separately
      runner.generateWorkflowSpec = jest.fn(() => 'A_GENERATED_JSON_VALUE');

      server.use(
        rest.post(
          'https://argo-workflows.local/api/v1/workflows/ns',
          (_req, res, ctx) =>
            res(
              ctx.json({
                metadata: {
                  name: 'test',
                },
              }),
            ),
        ),
      );

      server.use(
        rest.get(
          'https://argo-workflows.local/api/v1/workflows/ns/test',
          (_req, res, ctx) =>
            res(
              ctx.json({
                status: {
                  phase: 'Failed',
                  message: 'something is wrong',
                },
              }),
            ),
        ),
      );

      await expect(
        runner.runInArgoWorkflow({
          folders,
          taskLogger: getVoidLogger(),
          opts,
        }),
      ).rejects.toThrow(/something is wrong/);
    });

    it('should handle failed start', async () => {
      server.use(
        rest.post(
          'https://argo-workflows.local/api/v1/workflows/ns',
          (_req, res, ctx) => {
            return res(ctx.status(500), ctx.text('something went wrong'));
          },
        ),
      );

      await expect(
        runner.runInArgoWorkflow({
          folders,
          taskLogger: getVoidLogger(),
          opts,
        }),
      ).rejects.toThrow(/Unexpected error while creating the workflow/);
    });

    it('should handle failed finished fetch', async () => {
      // mock the internal function since we want to test it separately
      runner.generateWorkflowSpec = jest.fn(() => 'A_GENERATED_JSON_VALUE');

      server.use(
        rest.post(
          'https://argo-workflows.local/api/v1/workflows/ns',
          (_req, res, ctx) =>
            res(
              ctx.json({
                metadata: {
                  name: 'test',
                },
              }),
            ),
        ),
      );

      server.use(
        rest.get(
          'https://argo-workflows.local/api/v1/workflows/ns/test',
          (_req, res, ctx) => res(ctx.status(500)),
        ),
      );

      await expect(
        runner.runInArgoWorkflow({
          folders,
          taskLogger: getVoidLogger(),
          opts,
        }),
      ).rejects.toThrow(/Unexpected error while receiving the job result/);
    });
  });

  describe('generateWorkflowSpec', () => {
    it('should work', () => {
      const spec = runner.generateWorkflowSpec({
        folders,
        opts,
      });

      expect(spec).toEqual({
        workflow: {
          apiVersion: 'argoproj.io/v1alpha1',
          kind: 'Workflow',
          metadata: {
            generateName: 'backstage-container-runner-',
          },
          spec: {
            activeDeadlineSeconds: 900,
            automountServiceAccountToken: false,
            entrypoint: 'run',
            executor: {
              serviceAccountName: 'sa-1',
            },
            serviceAccountName: 'sa-2',
            templates: [
              {
                container: {
                  args: ['sleep', '1'],
                  command: ['sh'],
                  env: [
                    {
                      name: 'HOME',
                      value: '/tmp',
                    },
                  ],
                  image: 'my-image',
                  resources: {
                    limits: {
                      memory: '1.5Gi',
                    },
                    requests: {
                      memory: '512Mi',
                    },
                  },
                  securityContext: {
                    runAsNonRoot: true,
                    runAsUser: 1001,
                    runAsGroup: 1001,
                  },
                  workingDir: '/container/input',
                },
                inputs: {
                  artifacts: [
                    {
                      mode: 511,
                      name: 'input-0',
                      path: '/input',
                      recurseMode: true,
                      s3: {
                        bucket: 'my-bucket',
                        key: 'folder/input.tar.gz',
                        endpoint: 's3.local',
                        useSDKCreds: true,
                      },
                    },
                  ],
                },
                metadata: {
                  annotations: {
                    'sda.se/test': 'asdf',
                  },
                },
                name: 'run',
                outputs: {
                  artifacts: [
                    {
                      name: 'output-0',
                      path: '/input',
                      s3: {
                        bucket: 'my-bucket',
                        key: 'folder/output.tar.gz',
                        endpoint: 's3.local',
                        useSDKCreds: true,
                      },
                    },
                  ],
                },
              },
            ],
            ttlStrategy: {
              secondsAfterCompletion: 60,
              secondsAfterFailure: 86400,
              secondsAfterSuccess: 60,
            },
          },
        },
      });
    });
  });
});
