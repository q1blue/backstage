import { RunContainerOptions } from '@backstage/backend-common';
import archiver from 'archiver';
import { S3 } from 'aws-sdk';
import fs from 'fs/promises';
import path from 'path';
import { pipeline as streamPipeline } from 'stream';
import tar from 'tar';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const pipeline = promisify(streamPipeline);

export type Folders = Array<{
  hostDirectory: string;
  containerDirectory: string;
  inputKey: string;
  outputKey: string;
}>;

export class ArtifactsHelper {
  constructor(
    private readonly s3Client: S3,
    private readonly bucketName: string,
  ) {}

  calculateArtifacts(mountDirs: RunContainerOptions['mountDirs']): {
    workDirName: string;
    folders: Folders;
  } {
    const workDir = `backstage-container-runner-${uuidv4()}`;
    const folders: Folders = Object.entries(mountDirs || {}).map(
      ([target, source], idx) => ({
        hostDirectory: target,
        containerDirectory: source,
        inputKey: `${workDir}/input-${idx}.tar.gz`,
        outputKey: `${workDir}/output-${idx}.tar.gz`,
      }),
    );

    return { workDirName: `${workDir}/*`, folders };
  }

  async uploadArtifacts(folders: Folders) {
    for (const { hostDirectory, inputKey: Key } of folders) {
      const archive = archiver('tar', {
        gzip: true,
      });

      // add the input directory
      archive.directory(hostDirectory, false);

      // add a temporary file to make sure empty folders are extracted by Argo Workflows correctly
      archive.append('', { name: '__argo-tmp/__argo-tmp' });

      // we don't want to await it
      archive.finalize().then();

      await this.s3Client
        .upload({
          Bucket: this.bucketName,
          Key,
          Body: archive,
        })
        .promise();
    }
  }

  async downloadArtifacts(folders: Folders) {
    for (const { outputKey: Key, hostDirectory } of folders) {
      const outputStream = this.s3Client
        .getObject({
          Bucket: this.bucketName,
          Key,
        })
        .createReadStream();

      await pipeline(
        outputStream,
        tar.extract({
          strip: 1,
          cwd: hostDirectory,
        }),
      );

      // delete the temporary folder/file
      await fs.rm(path.resolve(hostDirectory, '__argo-tmp'), {
        recursive: true,
        force: true,
      });
    }
  }

  async deleteArtifacts(folders: Folders) {
    await this.s3Client
      .deleteObjects({
        Bucket: this.bucketName,
        Delete: {
          Objects: folders.flatMap(({ outputKey, inputKey }) => [
            { Key: inputKey },
            { Key: outputKey },
          ]),
        },
      })
      .promise();
  }
}
