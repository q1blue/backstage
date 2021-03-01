/*
 * Copyright 2021 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { UrlPatternDiscovery } from '@backstage/core';
import { msw } from '@backstage/test-utils';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { BitriseClientApi } from './bitriseApi.client';
import { BitriseApi } from './bitriseApi';

const server = setupServer();

describe('BitriseClientApi', () => {
  msw.setupDefaultHandlers(server);

  const mockBaseUrl = 'http://backstage:9191/api/proxy';
  const discoveryApi = UrlPatternDiscovery.compile(mockBaseUrl);
  let client: BitriseApi;

  beforeEach(() => {
    client = new BitriseClientApi(discoveryApi);
  });

  it('should get builds and map the results', async () => {
    server.use(
      rest.get(`${mockBaseUrl}/*`, (_req, res, ctx) => {
        return res(
          ctx.json({
            data: [{ slug: 'some-build-slug' }, { slug: 'some-build-slug-2' }],
          }),
        );
      }),
    );

    const builds = await client.getBuilds('some-app-slug', {
      workflow: '',
    });

    expect(builds.data.length).toBe(2);
    expect(builds.data[0].appSlug).toBe('some-app-slug');
    expect(builds.data[0].buildSlug).toBe('some-build-slug');
    expect(builds.data[1].buildSlug).toBe('some-build-slug-2');
  });

  it('should get builds for given workflow', async () => {
    server.use(
      rest.get(`${mockBaseUrl}/*`, (_req, res, ctx) => {
        return res(
          ctx.json({
            data: [{ slug: 'some-build-slug' }],
          }),
        );
      }),
    );

    const builds = await client.getBuilds('some-app-slug', {
      workflow: 'ios-develop',
    });

    expect(builds.data.length).toBe(1);
    expect(builds.data[0].appSlug).toBe('some-app-slug');
  });

  it('should get the app', async () => {
    server.use(
      rest.get(`${mockBaseUrl}/*`, (_req, res, ctx) => {
        return res(
          ctx.json({
            data: [{ title: 'some-app-title', slug: 'some-app-slug' }],
          }),
        );
      }),
    );

    const app = await client.getApp('some-app-title');

    expect(app).toBeDefined();
    expect(app?.slug).toBe('some-app-slug');
  });

  it('should get workflows', async () => {
    server.use(
      rest.get(`${mockBaseUrl}/*`, (_req, res, ctx) => {
        return res(
          ctx.json({
            data: ['ios-develop', 'ios-master'],
          }),
        );
      }),
    );

    const workflows = await client.getBuildWorkflows('some-app-title');

    expect(workflows).toBeDefined();
    expect(workflows.length).toEqual(2);
    expect(workflows[0]).toBe('ios-develop');
    expect(workflows[1]).toBe('ios-master');
  });

  it('should get the artifact details', async () => {
    server.use(
      rest.get(`${mockBaseUrl}/*`, (_req, res, ctx) => {
        return res(
          ctx.json({
            data: { title: 'some-artifact-title', slug: 'some-artifact-slug' },
          }),
        );
      }),
    );

    const artifact = await client.getArtifactDetails(
      'some-app-slug',
      'some-build-slug',
      'some-artifact-slug',
    );

    expect(artifact).toBeDefined();
    expect(artifact?.title).toBe('some-artifact-title');
  });
});
