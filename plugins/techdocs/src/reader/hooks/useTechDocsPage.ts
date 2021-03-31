/*
 * Copyright 2020 Spotify AB
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

import { Entity, EntityName, Location } from '@backstage/catalog-model';
import { useApi } from '@backstage/core';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useAsync, useAsyncRetry } from 'react-use';
import { techdocsApiRef, techdocsStorageApiRef } from '../..';
import { TechDocsMetadata } from '../../types';

export type PageState = {
  entityId: EntityName;
  loading: boolean;
  entity?: Entity;
  location?: Location;
  page?: {
    techDocsMetadata: TechDocsMetadata;
    raw: string;
    basePath: string;
  };
  error?: Error;
  syncing: boolean;
  isNewerVersionAvailable: boolean;
  refresh: () => void;
};

export function useTechDocsPage({
  entityId,
}: {
  entityId: EntityName;
}): PageState {
  const techdocsApi = useApi(techdocsApiRef);
  const techdocsStorageApi = useApi(techdocsStorageApiRef);
  const { '*': path } = useParams();
  const { namespace, kind, name } = entityId;

  const {
    loading: loadingEntity,
    value: entityMetadata,
    error: entityError,
    retry: refreshEntity,
  } = useAsyncRetry(async () => {
    return await techdocsApi.getEntityMetadata({
      kind,
      namespace,
      name,
    });
  }, [kind, namespace, name, path, techdocsApi]);

  const {
    loading: loadingPage,
    value: page,
    error: pageError,
    retry: refreshPage,
  } = useAsyncRetry(async () => {
    const [techDocsMetadata, raw, apiOrigin] = await Promise.all([
      await techdocsApi.getTechDocsMetadata({
        kind,
        namespace,
        name,
      }),
      await techdocsStorageApi.getEntityDocs({ kind, namespace, name }, path),
      await techdocsStorageApi.getApiOrigin(),
    ]);
    const basePath = `${apiOrigin}/static/docs/${namespace}/${kind}/${name}/${path}`;
    return {
      techDocsMetadata,
      raw,
      basePath,
    };
  }, [kind, namespace, name, path, techdocsApi, techdocsStorageApi]);

  const {
    value: isLatestVersion,
    loading: syncing,
    error: syncError,
  } = useAsync(async () => {
    // Attempt to sync only if `techdocs.builder` in app config is set to 'local'
    if ((await techdocsStorageApi.getBuilder()) !== 'local') {
      return true;
    }

    return await techdocsStorageApi.syncEntityDocs({ kind, namespace, name });
  }, [kind, namespace, name, techdocsStorageApi]);

  /*const [isNewerVersionAvailable, setIsNewerVersionAvailable] = useState(false);

  useEffect(() => {
    if (isLatestVersion !== undefined) {
      setIsNewerVersionAvailable(!isLatestVersion);
    }
    console.log('isLatestVersion', isLatestVersion);
  }, [isLatestVersion]);

  useEffect(() => {
    // On navigate, hide the new version message
    setIsNewerVersionAvailable(false);
    console.log('setIsNewerVersionAvailable', isLatestVersion, path);
  }, [path]);*/



  // TODO: Is there a way to delay setting the syncing flag?

  console.log('isLatestVersion', isLatestVersion);

  const isNewerVersionAvailable = isLatestVersion === false;

  // Show loading if we actual loading data or if initial syncing is performed
  const loading = loadingPage || loadingEntity || (syncing && !page);

  let error;
  // loadError not considered an error state if sync request is still ongoing
  // or sync just completed and doc is loading again
  if (
    (pageError && !syncing && !isNewerVersionAvailable) ||
    entityError ||
    syncError
  ) {
    let message = '';
    if (pageError) {
      message += ` Page load error: ${pageError}`;
    }
    if (entityError) {
      message += ` Entity load error: ${entityError}`;
    }
    if (syncError) {
      message += ` Build error: ${syncError}`;
    }
    error = Error(message);
  }

  const refresh = useCallback(() => {
    refreshEntity();
    refreshPage();
  }, [refreshEntity, refreshPage]);

  return {
    loading,
    entityId,
    syncing,
    isNewerVersionAvailable,
    refresh,
    entity: entityMetadata,
    location: entityMetadata?.locationMetadata,
    page,
    error,
  };
}
