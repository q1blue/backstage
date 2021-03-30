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
import { EntityName } from '@backstage/catalog-model';
import { useApi } from '@backstage/core';
import { BackstageTheme } from '@backstage/theme';
import { useTheme } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsync } from 'react-use';
import { techdocsStorageApiRef } from '../../api';
import transformer, {
  addBaseUrl,
  addLinkClickListener,
  injectCss,
  onCssReady,
  removeMkdocsHeader,
  rewriteDocLinks,
  sanitizeDOM,
  simplifyMkdocsFooter
} from '../transformers';
import { MkDocsRenderer } from './MkDocsRenderer';
import { TechDocsNotFound } from './TechDocsNotFound';
import TechDocsProgressBar from './TechDocsProgressBar';

type Props = {
  entityId: EntityName;
  onReady?: () => void;
};

export const Reader = ({ entityId, onReady }: Props) => {
  



  const { kind, namespace, name } = entityId;
  const { '*': path } = useParams();

  const techdocsStorageApi = useApi(techdocsStorageApiRef);
  const [loadedPath, setLoadedPath] = useState('');
  const [atInitialLoad, setAtInitialLoad] = useState(true);
  const [newerDocsExist, setNewerDocsExist] = useState(false);

  const {
    value: isSynced,
    loading: syncInProgress,
    error: syncError,
  } = useAsync(async () => {
    // Attempt to sync only if `techdocs.builder` in app config is set to 'local'
    if ((await techdocsStorageApi.getBuilder()) !== 'local') {
      return Promise.resolve({
        value: true,
        loading: null,
        error: null,
      });
    }
    return techdocsStorageApi.syncEntityDocs({ kind, namespace, name });
  });

  const {
    value: page,
    loading: docLoading,
    error: docLoadError,
  } = useAsync(async () => {
    // do not automatically load same page again if URL has not changed,
    // happens when generating new docs finishes
    if (newerDocsExist && path === loadedPath) {
      return null;
    }

    const rawPage = await techdocsStorageApi.getEntityDocs(
      { kind, namespace, name },
      path,
    );
    const apiOrigin = await techdocsStorageApi.getApiOrigin();
    const basePath = `${apiOrigin}/static/docs/${namespace}/${kind}/${name}/${path}`;

    return {
      rawPage,
      basePath,
    };
  }, [techdocsStorageApi, kind, namespace, name, path, isSynced]);

  useEffect(() => {
    if (page) {
      setLoadedPath(path);
    }
  }, [page, path]);

  useEffect(() => {
    if (atInitialLoad === false) {
      return;
    }
    setTimeout(() => {
      setAtInitialLoad(false);
    }, 5000);
  });

  useEffect(() => {
    if (!atInitialLoad && !!page && syncInProgress) {
      setNewerDocsExist(true);
    }
  }, [atInitialLoad, page, syncInProgress]);

  useEffect(() => {
    if (!page) {
      return;
    }

    if (onReady) {
      onReady();
    }

    console.log('Render');
  }, [
    page,
    onReady,
    //newerDocsExist,
    //isSynced,
  ]);

  // docLoadError not considered an error state if sync request is still ongoing
  // or sync just completed and doc is loading again
  if ((docLoadError && !syncInProgress && !docLoading) || syncError) {
    let errMessage = '';
    if (docLoadError) {
      errMessage += ` Load error: ${docLoadError}`;
    }
    if (syncError) errMessage += ` Build error: ${syncError}`;
    return <TechDocsNotFound errorMessage={errMessage} />;
  }

  return (
    <>
      {newerDocsExist && !isSynced ? (
        <Alert variant="outlined" severity="info">
          A newer version of this documentation is being prepared and will be
          available shortly.
        </Alert>
      ) : null}
      {newerDocsExist && isSynced ? (
        <Alert variant="outlined" severity="success">
          A newer version of this documentation is now available, please refresh
          to view.
        </Alert>
      ) : null}
      {docLoading || (docLoadError && syncInProgress) ? (
        <TechDocsProgressBar />
      ) : null}
      {page && <MkDocsRenderer rawPage={page.rawPage} basePath={page.basePath} />}
    </>
  );
};
