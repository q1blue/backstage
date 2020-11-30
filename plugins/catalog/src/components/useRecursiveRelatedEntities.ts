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
import { CatalogApi } from '@backstage/catalog-client';
import { Entity, EntityName, getEntityName } from '@backstage/catalog-model';
import { useApi } from '@backstage/core';
import { useAsyncRetry } from 'react-use';
import { catalogApiRef } from '../plugin';

async function resolveRelations(
  catalogApi: CatalogApi,
  entity: Entity,
  remainingDepth: number,
  type?: string | string[],
): Promise<(Entity | undefined)[]> {
  const relations =
    entity.relations &&
    entity.relations.filter(
      r =>
        !type ||
        (typeof type === 'string' ? r.type === type : type.includes(r.type)),
    );

  if (!relations) {
    return [];
  }

  // TODO: It would be useful to have either a call that returns me the related
  //  entities (graphql?) or a call that allows me to reachby multiple entity names?
  const entities = await Promise.all(
    relations?.map(r => catalogApi.getEntityByName(r.target)),
  );

  // Filter relationships that go back to the start
  entities.forEach(e => {
    if (e) {
      const entityName = getEntityName(entity);
      const isEntityNameEqual = (a: EntityName, b: EntityName) => {
        return (
          a.kind.toLowerCase() === b.kind.toLowerCase() &&
          a.namespace.toLowerCase() === b.namespace.toLowerCase() &&
          a.name.toLowerCase() === b.name.toLowerCase()
        );
      };
      e.relations = e.relations?.filter(
        r => !isEntityNameEqual(r.target, entityName),
      );
    }
  });

  if (remainingDepth > 0) {
    const relatedEntities = await Promise.all(
      entities
        .filter(e => e !== undefined)
        .map(e => resolveRelations(catalogApi, e!, remainingDepth - 1, type)),
    );

    relatedEntities.flat().forEach(e => entities.push(e));
  }

  return entities;
}

export function useRecursiveRelatedEntities(
  entity: Entity,
  depth: number,
  type?: string | string[],
): {
  entities: (Entity | undefined)[] | undefined;
  loading: boolean;
  error: Error | undefined;
} {
  const catalogApi = useApi(catalogApiRef);
  const { loading, value, error } = useAsyncRetry<
    (Entity | undefined)[]
  >(async () => {
    return await resolveRelations(catalogApi, entity, depth, type);
  }, [entity, type]);

  return {
    entities: value,
    loading,
    error,
  };
}
