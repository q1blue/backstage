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

import {
  ComponentEntity,
  Entity,
  EntityName,
  Location,
  parseEntityName,
  RELATION_OWNED_BY,
} from '@backstage/catalog-model';
import { Header, HeaderLabel, useRouteRef } from '@backstage/core';
import { EntityRefLink, EntityRefLinks } from '@backstage/plugin-catalog-react';
import { getRelations } from '@backstage/plugin-catalog-react/src/hooks/useRelatedEntities';
import CodeIcon from '@material-ui/icons/Code';
import React from 'react';
import { rootRouteRef } from '../../plugin';
import { TechDocsMetadata } from '../../types';

type TechDocsPageHeaderProps = {
  entityId: EntityName;
  page?: {
    location?: Location;
    entity: Entity;
    techDocsMetadata: TechDocsMetadata;
  };
};

export const TechDocsPageHeader = ({
  entityId,
  page,
}: TechDocsPageHeaderProps) => {
  const { name } = entityId;
  const entity = page?.entity as ComponentEntity | undefined;
  const location = page?.location;
  const { site_name: siteName, site_description: siteDescription } =
    page?.techDocsMetadata || {};
  const {
    spec: { owner, lifecycle },
  } = entity || { spec: {} };

  const ownedByRelations = entity
    ? getRelations(entity, {
        type: RELATION_OWNED_BY,
      }).map(r => r.target)
    : [];

  let ownerEntity;
  if (owner) {
    ownerEntity = parseEntityName(owner, { defaultKind: 'group' });
  }

  const docsRootLink = useRouteRef(rootRouteRef)();

  const labels = (
    <>
      <HeaderLabel
        label="Component"
        value={
          <EntityRefLink
            color="inherit"
            entityRef={entityId}
            defaultKind="Component"
          />
        }
      />
      {owner ? (
        <HeaderLabel
          label="Owner"
          value={
            ownerEntity ? (
              <EntityRefLinks
                color="inherit"
                entityRefs={ownedByRelations}
                defaultKind="group"
              />
            ) : (
              owner
            )
          }
        />
      ) : null}
      {lifecycle ? <HeaderLabel label="Lifecycle" value={lifecycle} /> : null}
      {location && location.type !== 'dir' && location.type !== 'file' ? (
        <HeaderLabel
          label=""
          value={
            <a href={location.target} target="_blank" rel="noopener noreferrer">
              <CodeIcon style={{ marginTop: '-25px', fill: '#fff' }} />
            </a>
          }
        />
      ) : null}
    </>
  );

  return (
    <Header
      title={siteName ? siteName : '.'}
      pageTitleOverride={siteName || name}
      subtitle={
        siteDescription && siteDescription !== 'None' ? siteDescription : ''
      }
      type="Docs"
      typeLink={docsRootLink}
    >
      {labels}
    </Header>
  );
};
