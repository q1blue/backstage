# @internal/argo-workflows-runner

Provides an implementation of the `ContainerRunner` interface that runs containers in Argo Workflows.

Usage:

```tsx

// plugin/backend/plugins/scaffolder.ts

// We rely on the autoconfiguration of the aws-sdk
const s3Client = new S3({ signatureVersion: 'v4' });

// you might want to share this with multiple instances of ArgoWorkflowsContainerRunner if you also use it e.g. in techdocs
const argoMetricsContext = ArgoWorkflowsContainerRunner.createMetrics();

// create the ArgoWorkflowsContainerRunner if configured
let containerRunner: ContainerRunner;
if (ArgoWorkflowsContainerRunner.isActive({ config })) {
    containerRunner = ArgoWorkflowsContainerRunner.fromConfig({
        config,
        // or your own images
        allowedImages: [
            /^spotify\/backstage-cookiecutter$/,
            /^quay\.io\/sdase\/.*/,
        ],
        s3Client,
        logger,
        metricsContext: argoMetricsContext,
    });
} else {
    containerRunner = new DockerContainerRunner({ dockerClient: new Docker() });
}

// ...

return await createRouter({
    containerRunner,
    logger,
    config,
    database,
    catalogClient,
    reader,
    actions,
});
```
