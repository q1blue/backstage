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

import { Entity, EntityName, getEntityName } from '@backstage/catalog-model';
import {
  DependencyGraph,
  DependencyGraphTypes,
  EmptyState,
  Progress,
} from '@backstage/core';
import { useTheme } from '@material-ui/core';
import React from 'react';
import { useRecursiveRelatedEntities } from '../useRecursiveRelatedEntities';
import { Card } from './Card';
import { EntityNode } from './EntityNode';

type Props = {
  entity: Entity;
  title?: string;
  depth?: number;
  relationTypes?: string[];
  variant?: string;
};

export const RelationsCard = ({
  entity,
  relationTypes,
  depth = 2,
  variant = 'gridItem',
}: Props) => {
  const { entities, loading, error } = useRecursiveRelatedEntities(
    entity,
    depth,
    relationTypes,
  );
  const theme = useTheme();

  if (loading) {
    return (
      <Card variant={variant}>
        <Progress />
      </Card>
    );
  }

  if (error || !entities) {
    return (
      <Card variant={variant}>
        <EmptyState
          missing="info"
          title="No information to display"
          description="There was an error while loading the consumed APIs."
        />
      </Card>
    );
  }

  function generateId(name: EntityName): string {
    return `${name.kind}:${name.namespace}/${name.name}`.toLowerCase();
  }

  const includedEntityIds = new Set<string>();
  const includedEntities: Entity[] = [];

  [entity, ...entities].forEach(e => {
    if (!e) {
      return;
    }

    const id = generateId(getEntityName(e!));

    if (includedEntityIds.has(id)) {
      return;
    }

    includedEntityIds.add(id);
    includedEntities.push(e!);
  });

  const nodes: DependencyGraphTypes.DependencyNode<{
    entity: Entity;
  }>[] = includedEntities.map(e => ({
    id: generateId(getEntityName(e!)),
    entity: e,
  }));

  const edges: DependencyGraphTypes.DependencyEdge[] = includedEntities
    .filter(i => i.relations)
    .map(i =>
      i
        .relations!.filter(
          r => !relationTypes || relationTypes.includes(r.type),
        )
        .map(e => ({
          from: generateId(getEntityName(i)),
          to: generateId(e.target),
          label: e.type,
        })),
    )
    .flat();

  return (
    <Card variant={variant} noPadding>
      <DependencyGraph
        direction={DependencyGraphTypes.Direction.TOP_BOTTOM}
        nodes={nodes}
        edges={edges}
        style={{
          width: '100%',
        }}
        paddingX={theme.spacing(2)}
        paddingY={theme.spacing(2)}
        renderNode={EntityNode}
      />
    </Card>
  );
};
