import { RunContainerOptions } from '@backstage/backend-common';
import fetch from 'cross-fetch';
import { Logger } from 'winston';
import { ArgoWorkflowsEvents } from '../ArgoWorkflowsEvents';
import { Folders } from '../ArtifactsHelper';

export type ArtifactS3Config = {
  bucket: string;
  endpoint: string;
  useSDKCreds: boolean;
};

export class WorkflowRunner {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly executionNamespace: string;
  private readonly serviceAccountName: string;
  private readonly executorServiceAccountName: string;
  private readonly workflowPodAnnotations?: Record<string, string>;
  private readonly artifactS3Config: ArtifactS3Config;
  private readonly logger: Logger;
  private readonly eventsHandler: ArgoWorkflowsEvents;

  constructor({
    executionNamespace,
    serviceAccountName,
    executorServiceAccountName,
    workflowPodAnnotations,
    artifactS3Config,
    baseUrl,
    accessToken,
    logger,
    eventsHandler,
  }: {
    executionNamespace: string;
    serviceAccountName: string;
    executorServiceAccountName: string;
    workflowPodAnnotations?: Record<string, string>;
    artifactS3Config: ArtifactS3Config;
    baseUrl: string;
    accessToken: string;
    logger: Logger;
    eventsHandler: ArgoWorkflowsEvents;
  }) {
    this.executionNamespace = executionNamespace;
    this.serviceAccountName = serviceAccountName;
    this.executorServiceAccountName = executorServiceAccountName;
    this.workflowPodAnnotations = workflowPodAnnotations;
    this.artifactS3Config = artifactS3Config;
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
    this.logger = logger;
    this.eventsHandler = eventsHandler;
  }

  async runInArgoWorkflow({
    folders,
    opts,
    taskLogger,
  }: {
    folders: Folders;
    opts: RunContainerOptions;
    taskLogger: Logger;
  }): Promise<void> {
    const workflowSpec = this.generateWorkflowSpec({ folders, opts });

    const result = await fetch(
      `${this.baseUrl}/api/v1/workflows/${this.executionNamespace}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(workflowSpec),
      },
    );

    if (!result.ok) {
      this.logger.warn(
        `Unexpected error while creating workflow: ${await result.text()}`,
      );
      throw new Error('Unexpected error while creating the workflow');
    }

    const {
      metadata: { name },
    } = await result.json();

    taskLogger.info(`Created worker task with name ${name}. Waiting for logs…`);

    // wait for the execution of the handler
    await this.eventsHandler.logProgressAndWaitForJobToFinish({
      name,
      taskLogger,
    });

    // Get the job result status
    const finished = await fetch(
      `${this.baseUrl}/api/v1/workflows/${this.executionNamespace}/${name}?fields=status.phase,status.message`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!finished.ok) {
      this.logger.warn(
        `Unexpected error while receiving the job result: ${await finished.text()}`,
      );
      throw new Error('Unexpected error while receiving the job result');
    }

    const {
      status: { phase, message },
    } = await finished.json();

    if (phase !== 'Succeeded') {
      throw new Error(message);
    }
  }

  generateWorkflowSpec({
    folders,
    opts,
  }: {
    folders: Folders;
    opts: RunContainerOptions;
  }): any {
    return {
      workflow: {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Workflow',
        metadata: { generateName: 'backstage-container-runner-' },
        spec: {
          activeDeadlineSeconds: 15 * 60,
          automountServiceAccountToken: false,
          serviceAccountName: this.serviceAccountName,
          executor: {
            serviceAccountName: this.executorServiceAccountName,
          },
          ttlStrategy: {
            // Time to live after workflow is completed, replaces ttlSecondsAfterFinished
            secondsAfterCompletion: 60,
            // Time to live after workflow is successful
            secondsAfterSuccess: 60,
            // Time to live after workflow fails
            secondsAfterFailure: 24 * 3600,
          },
          entrypoint: 'run',
          templates: [
            {
              name: 'run',
              metadata: {
                annotations: this.workflowPodAnnotations,
              },
              inputs: {
                artifacts: folders.map(
                  ({ containerDirectory, inputKey }, idx) => ({
                    name: `input-${idx}`,
                    path: containerDirectory,
                    mode: 0o777,
                    recurseMode: true,
                    s3: {
                      ...this.artifactS3Config,
                      key: inputKey,
                    },
                  }),
                ),
              },
              container: {
                image: opts.imageName,
                workingDir: opts.workingDir,
                command: opts.command ? [opts.command].flat() : undefined,
                args: opts.args,
                env:
                  opts.envVars &&
                  Object.entries(opts.envVars).map(([name, value]) => ({
                    name,
                    value,
                  })),
                securityContext: {
                  runAsNonRoot: true,
                  runAsUser: 1001,
                  runAsGroup: 1001,
                },
                resources: {
                  requests: {
                    memory: '512Mi',
                  },
                  limits: {
                    memory: '1.5Gi',
                  },
                },
              },
              outputs: {
                artifacts: folders.map(
                  ({ containerDirectory, outputKey }, idx) => ({
                    name: `output-${idx}`,
                    path: containerDirectory,
                    s3: {
                      ...this.artifactS3Config,
                      key: outputKey,
                    },
                  }),
                ),
              },
            },
          ],
        },
      },
    };
  }
}
