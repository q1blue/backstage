import {
  ContainerRunner,
  RunContainerOptions,
} from '@backstage/backend-common';
import { Config } from '@backstage/config';
import { S3 } from 'aws-sdk';
import prom from 'prom-client';
import * as winston from 'winston';
import { Logger } from 'winston';
import { ArgoWorkflowsEvents } from './ArgoWorkflowsEvents';
import { ArtifactsHelper } from './ArtifactsHelper';
import { WorkflowRunner } from './WorkflowRunner';

export type ArgoWorkflowsContainerRunnerMetricsContext = {
  trackDuration: (imageName: string) => (failed: boolean) => void;
  concurrentJobsGauge: prom.Gauge<'imageName'>;
};

export class ArgoWorkflowsContainerRunner implements ContainerRunner {
  private readonly allowedImages: RegExp[];
  private readonly artifacts: ArtifactsHelper;
  private readonly workflowRunner: WorkflowRunner;
  private readonly metricsContext: ArgoWorkflowsContainerRunnerMetricsContext;

  static isActive({ config }: { config: Config }) {
    return config.has('argoWorkflowsRunner');
  }

  static createMetrics(): ArgoWorkflowsContainerRunnerMetricsContext {
    const histogram = new prom.Histogram({
      name: 'backstage_argo_workflows_container_runner_execution_seconds',
      help: 'Duration of the execution of argo workflows',
      labelNames: ['imageName', 'status'],
      buckets: prom.exponentialBuckets(1, 2, 10),
    });
    const concurrentJobsGauge = new prom.Gauge({
      name: 'backstage_argo_workflows_container_runner_running_jobs_count',
      help: 'Number of currently running executions of argo workflows',
      labelNames: ['imageName'],
    });

    return {
      trackDuration: (imageName: string) => {
        const end = histogram.startTimer({ imageName });

        return (failed: boolean) => {
          end({ status: failed ? 'failed' : 'success' });
        };
      },
      concurrentJobsGauge,
    };
  }

  static fromConfig({
    config,
    s3Client,
    allowedImages,
    logger,
    metricsContext,
  }: {
    config: Config;
    s3Client: S3;
    allowedImages: RegExp[];
    logger: Logger;
    metricsContext: ArgoWorkflowsContainerRunnerMetricsContext;
  }): ArgoWorkflowsContainerRunner {
    const c = config.getConfig('argoWorkflowsRunner');

    const baseUrl = c.getString('baseUrl');
    const accessToken = c.getString('accessToken');
    const executionNamespace = c.getString('executionNamespace');

    const eventsHandler = new ArgoWorkflowsEvents({
      baseUrl,
      namespace: executionNamespace,
      accessToken: accessToken,
    });

    const artifacts = new ArtifactsHelper(
      s3Client,
      c.getString('artifactS3Config.bucket'),
    );

    const workflowRunner = new WorkflowRunner({
      serviceAccountName: c.getString('serviceAccountName'),
      executorServiceAccountName: c.getString('executorServiceAccountName'),
      workflowPodAnnotations: c.getOptional('workflowPodAnnotations'),
      artifactS3Config: c.get('artifactS3Config'),
      accessToken,
      executionNamespace,
      baseUrl,
      logger,
      eventsHandler,
    });

    return new ArgoWorkflowsContainerRunner({
      allowedImages,
      artifacts,
      workflowRunner,
      metricsContext,
    });
  }

  constructor({
    allowedImages,
    artifacts,
    workflowRunner,
    metricsContext,
  }: {
    allowedImages: RegExp[];
    artifacts: ArtifactsHelper;
    workflowRunner: WorkflowRunner;
    metricsContext: ArgoWorkflowsContainerRunnerMetricsContext;
  }) {
    this.allowedImages = allowedImages;
    this.artifacts = artifacts;
    this.workflowRunner = workflowRunner;
    this.metricsContext = metricsContext;
  }

  async runContainer(opts: RunContainerOptions): Promise<void> {
    if (!this.allowedImages.find(p => p.test(opts.imageName))) {
      throw new Error(
        `Container image "${opts.imageName}" is now allowed. Please check the configuration.`,
      );
    }

    // initialize a logger for messages that should be shown to the user in the execution log
    const taskLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
      defaultMeta: {},
    });
    if (opts.logStream) {
      taskLogger.add(new winston.transports.Stream({ stream: opts.logStream }));
    }

    // compute S3 keys and mount points from the received mountDirs parameter.
    const { workDirName, folders } = this.artifacts.calculateArtifacts(
      opts.mountDirs,
    );

    const endTimer = this.metricsContext.trackDuration(opts.imageName);

    try {
      this.metricsContext.concurrentJobsGauge.labels(opts.imageName).inc();

      taskLogger.info(`Upload artifacts to ${workDirName}`);
      await this.artifacts.uploadArtifacts(folders);

      taskLogger.info('Execute the workflow');
      await this.workflowRunner.runInArgoWorkflow({
        folders,
        opts,
        taskLogger,
      });

      taskLogger.info(`Download artifacts from ${workDirName}`);
      await this.artifacts.downloadArtifacts(folders);

      taskLogger.info('Execution finished');
      endTimer(false);
    } catch (e) {
      endTimer(true);
      throw e;
    } finally {
      taskLogger.info('Cleaning up the artifacts');
      await this.artifacts.deleteArtifacts(folders);
      this.metricsContext.concurrentJobsGauge.labels(opts.imageName).dec();
    }
  }
}
