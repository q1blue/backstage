export interface Config {
  argoWorkflowsRunner?: {
    /**
     * The URL of Argo Workflows
     * @visibility backend
     */
    baseUrl: string;

    /**
     * The secret to access Argo Workflows
     * @visibility secret
     */
    accessToken: string;

    /**
     * The namespace to run Argo Workflows in
     * @visibility backend
     */
    executionNamespace: string;

    /**
     * The service account that is used by the pod.
     * This can be used to access e.g. S3 resources
     *
     * @visibility backend
     */
    serviceAccountName: string;

    /**
     * The service account that should be used by the workflow executor.
     *
     * The service account needs the following permissions:
     *  - pods:
     *    - get
     *    - watch
     *    - patch
     *    - list
     *  - pods/logs:
     *    - get
     *    - watch
     *
     * See also https://argoproj.github.io/argo-workflows/workflow-rbac/
     *
     * @visibility backend
     */
    executorServiceAccountName: string;

    /**
     * A map of annotations that are appended to each pod.
     *
     * @visibility backend
     */
    workflowPodAnnotations?: Record<string, string>;

    /**
     * The configuration for the used artifact repository.
     * It should be the same as in the 'techdocs' key.
     *
     * See https://argoproj.github.io/argo-workflows/fields/#s3artifact
     *
     * @visibility backend
     */
    artifactS3Config: {
      bucket: string;
      endpoint: string;
      useSDKCreds: boolean;
    };
  };
}
