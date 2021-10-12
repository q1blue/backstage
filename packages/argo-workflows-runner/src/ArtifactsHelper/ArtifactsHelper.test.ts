import { Archiver, create } from 'archiver';
import { S3 } from 'aws-sdk';
import * as fs from 'fs/promises';
import mockFs from 'mock-fs';
import recursiveReadDir from 'recursive-readdir';
import tar from 'tar';
import { ArtifactsHelper, Folders } from './ArtifactsHelper';

const archiver_ = jest.requireActual('archiver') as typeof create;

const archiver: jest.Mocked<
  Pick<Archiver, 'directory' | 'append' | 'finalize'>
> = {
  directory: jest.fn(),
  append: jest.fn(),
  finalize: jest.fn(),
};

jest.mock('archiver', () => () => archiver);

const s3: jest.Mocked<
  Pick<S3, 'listObjects' | 'getObject' | 'upload' | 'deleteObjects'>
> = {
  listObjects: jest.fn(),
  getObject: jest.fn(),
  upload: jest.fn(),
  deleteObjects: jest.fn(),
};

jest.mock('uuid', () => ({
  v4: () => 'UUID',
}));

describe('ArtifactsHelper', () => {
  const folders: Folders = [
    {
      inputKey: 'INPUT-IN.tar.gz',
      containerDirectory: '/container/input',
      hostDirectory: '/host/input',
      outputKey: 'INPUT-OUT.tar.gz',
    },
    {
      inputKey: 'OUTPUT-IN.tar.gz',
      containerDirectory: '/container/output',
      hostDirectory: '/host/output',
      outputKey: 'OUTPUT-OUT.tar.gz',
    },
  ];

  let artifactsHelper: ArtifactsHelper;
  beforeEach(() => {
    archiver.finalize.mockImplementation(async () => {});
    artifactsHelper = new ArtifactsHelper(s3 as unknown as S3, 'my-bucket');
  });

  beforeEach(() =>
    mockFs({
      '/host/input/Readme.md': '',
      '/host/output/.gitkeep': '',
    }),
  );
  afterEach(() => jest.resetAllMocks());
  afterEach(() => mockFs.restore());

  describe('calculateArtifacts', () => {
    it('should work', () => {
      const { workDirName, folders: testFolders } =
        artifactsHelper.calculateArtifacts({
          '/host/input': '/container/input',
          '/host/output': '/container/output',
        });

      expect(workDirName).toEqual('backstage-container-runner-UUID/*');
      expect(testFolders).toEqual([
        {
          containerDirectory: '/container/input',
          hostDirectory: '/host/input',
          inputKey: 'backstage-container-runner-UUID/input-0.tar.gz',
          outputKey: 'backstage-container-runner-UUID/output-0.tar.gz',
        },
        {
          containerDirectory: '/container/output',
          hostDirectory: '/host/output',
          inputKey: 'backstage-container-runner-UUID/input-1.tar.gz',
          outputKey: 'backstage-container-runner-UUID/output-1.tar.gz',
        },
      ]);
    });
  });

  describe('uploadArtifacts', () => {
    it('should work', async () => {
      s3.upload.mockReturnValue({
        promise: async () => {},
      } as any);

      await artifactsHelper.uploadArtifacts(folders);

      expect(archiver.directory).toBeCalledTimes(2);
      expect(archiver.directory).toBeCalledWith('/host/input', false);
      expect(archiver.directory).toBeCalledWith('/host/output', false);

      expect(archiver.append).toBeCalledTimes(2);
      expect(archiver.append).toBeCalledWith('', {
        name: '__argo-tmp/__argo-tmp',
      });

      expect(s3.upload).toBeCalledTimes(2);
      expect(s3.upload).toBeCalledWith({
        Bucket: 'my-bucket',
        Key: 'INPUT-IN.tar.gz',
        Body: archiver,
      });
      expect(s3.upload).toBeCalledWith({
        Bucket: 'my-bucket',
        Key: 'OUTPUT-IN.tar.gz',
        Body: archiver,
      });
    });

    it('should send symlinks as symlinks and not as resolved file', async () => {
      s3.upload.mockReturnValue({
        promise: async () => {},
      } as any);

      await fs.mkdir('/extracted');
      await fs.mkdir('/private');
      await fs.writeFile('/private/test', 'PRIVATE');
      await fs.symlink('/private/test', '/host/input/private');

      const archive = archiver_('tar', { gzip: true });
      const extraction = archive.pipe(tar.extract({ cwd: '/extracted' }));

      archiver.directory.mockImplementation(archive.directory.bind(archive));
      archiver.append.mockImplementation(archive.append.bind(archive));

      // upload the artifacts
      await artifactsHelper.uploadArtifacts(folders);

      // for some reason we must call finalize here...
      await archive.finalize();

      // wait until the extraction finished
      await new Promise<void>(resolve =>
        extraction.on('close', () => resolve()),
      );

      const stats = await fs.lstat('/extracted/private');
      expect(stats.isSymbolicLink()).toBe(true);

      expect(await recursiveReadDir('/')).toEqual([
        '/private/test',
        '/extracted/.gitkeep',
        '/extracted/Readme.md',
        '/extracted/private',
        '/extracted/__argo-tmp/__argo-tmp',
        '/host/input/Readme.md',
        '/host/input/private',
        '/host/output/.gitkeep',
      ]);
    });
  });

  describe('downloadArtifacts', () => {
    it('should work', async () => {
      s3.getObject.mockReturnValue({
        createReadStream: () => {
          const archive = archiver_('tar', { gzip: true });
          archive.append('', { name: 'folder/file.md' });
          archive.append('', { name: 'folder/__argo-tmp/__argo-tmp' });
          archive.finalize();
          return archive;
        },
      } as any);

      await artifactsHelper.downloadArtifacts(folders);

      expect(s3.getObject).toBeCalledTimes(2);
      expect(s3.getObject).toBeCalledWith({
        Bucket: 'my-bucket',
        Key: 'INPUT-OUT.tar.gz',
      });
      expect(s3.getObject).toBeCalledWith({
        Bucket: 'my-bucket',
        Key: 'OUTPUT-OUT.tar.gz',
      });

      expect(await recursiveReadDir('/')).toEqual([
        '/host/input/Readme.md',
        '/host/input/file.md',
        '/host/output/.gitkeep',
        '/host/output/file.md',
      ]);
    });
  });

  describe('deleteArtifacts', () => {
    it('should work', async () => {
      s3.deleteObjects.mockReturnValue({
        promise: async () => {},
      } as any);

      await artifactsHelper.deleteArtifacts(folders);

      expect(s3.deleteObjects).toBeCalledTimes(1);
      expect(s3.deleteObjects).toBeCalledWith({
        Bucket: 'my-bucket',
        Delete: {
          Objects: [
            { Key: 'INPUT-IN.tar.gz' },
            { Key: 'INPUT-OUT.tar.gz' },
            { Key: 'OUTPUT-IN.tar.gz' },
            { Key: 'OUTPUT-OUT.tar.gz' },
          ],
        },
      });
    });
  });
});
