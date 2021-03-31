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
import { Link, makeStyles } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React from 'react';
import { PageState } from '../hooks';
import { MkDocsRenderer } from './MkDocsRenderer';
import { TechDocsNotFound } from './TechDocsNotFound';
import TechDocsProgressBar from './TechDocsProgressBar';

const useStyles = makeStyles(theme => ({
  alert: {
    marginBottom: theme.spacing(2),
  },
}));

type Props = {
  pageState: PageState;
};

export const Reader = ({ pageState }: Props) => {
  const classes = useStyles();
  const {
    page,
    error,
    loading,
    syncing,
    isNewerVersionAvailable,
    refresh,
  } = pageState;

  return (
    <>
      {error && <TechDocsNotFound errorMessage={`${error}`} />}

      {syncing && (
        <Alert variant="outlined" severity="info" className={classes.alert}>
          A newer version of this documentation is being prepared and will be
          available shortly.
        </Alert>
      )}

      {isNewerVersionAvailable && (
        <Alert variant="outlined" severity="success" className={classes.alert}>
          <span>
            A newer version of this documentation is now available, please{' '}
            <Link onClick={refresh}>refresh to view</Link>.
          </span>
        </Alert>
      )}

      {loading && <TechDocsProgressBar />}

      {page && <MkDocsRenderer rawPage={page.raw} basePath={page.basePath} />}
    </>
  );
};
