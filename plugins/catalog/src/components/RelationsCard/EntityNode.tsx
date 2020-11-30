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

import { Entity } from '@backstage/catalog-model';
import { DependencyGraphTypes } from '@backstage/core';
import { BackstageTheme } from '@backstage/theme';
import { makeStyles } from '@material-ui/core';
import React from 'react';
import { EntityLink } from '../EntityLink';

const useStyles = makeStyles((theme: BackstageTheme) => ({
  node: {
    fill: theme.palette.background.paper,
    stroke: theme.palette.border,
  },
  text: {
    fill: theme.palette.textContrast,
  },
}));

export const EntityNode = ({
  node: { id, entity },
}: DependencyGraphTypes.RenderNodeProps<{ entity: Entity }>) => {
  const classes = useStyles();
  const [width, setWidth] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const idRef = React.useRef<SVGTextElement | null>(null);

  React.useLayoutEffect(() => {
    // set the width to the length of the ID
    if (idRef.current) {
      let {
        height: renderedHeight,
        width: renderedWidth,
      } = idRef.current.getBBox();
      renderedHeight = Math.round(renderedHeight);
      renderedWidth = Math.round(renderedWidth);

      if (renderedHeight !== height || renderedWidth !== width) {
        setWidth(renderedWidth);
        setHeight(renderedHeight);
      }
    }
  }, [width, height]);

  const padding = 10;
  const paddedWidth = width + padding * 2;
  const paddedHeight = height + padding * 2;

  return (
    <g>
      <EntityLink entity={entity}>
        <rect
          className={classes.node}
          width={paddedWidth}
          height={paddedHeight}
          rx={10}
        />
        <text
          ref={idRef}
          className={classes.text}
          y={paddedHeight / 2}
          x={paddedWidth / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {id}
        </text>
      </EntityLink>
    </g>
  );
};
