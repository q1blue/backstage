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

import { Content, Page } from '@backstage/core';
import React from 'react';
import { useTechDocsPage } from '../hooks';
import { Reader } from './Reader';
import { TechDocsPageHeader } from './TechDocsPageHeader';

export const TechDocsPage = () => {
  const {
    entityId,
    loading,
    page,
    loadError,
    syncError,
    syncing,
  } = useTechDocsPage();

  return (
    <Page themeId="documentation">
      <TechDocsPageHeader page={page} entityId={entityId} />
      <Content data-testid="techdocs-content">
        <Reader entityId={entityId} />
      </Content>
    </Page>
  );
};
