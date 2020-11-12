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
/* eslint-disable guard-for-in */
import {
  Checkbox,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
} from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import produce from 'immer';
import { isEqual } from 'lodash';
import React, { useEffect, useState, useReducer } from 'react';
import { usePrevious } from 'react-use';
import { useSet } from 'react-use';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
      minWidth: 10,
      maxWidth: 360,
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'transparent',
      },
      '&:active': {
        animation: 'none',
        transform: 'none',
      },
    },
    nested: {
      paddingLeft: theme.spacing(5),
      height: '32px',
      '&:hover': {
        backgroundColor: 'transparent',
      },
    },
    listItemIcon: {
      minWidth: 10,
    },
    listItem: {
      '&:hover': {
        backgroundColor: 'transparent',
      },
    },
    text: {
      '& span, & svg': {
        fontWeight: 'normal',
        fontSize: 14,
      },
    },
  }),
);

// TODO: Rename TO Category
// TODO: Rename isInitialOpen/Checked

// TODO: Why is this a SUB category?
type SubCategory = {
  label: string;
  isChecked?: boolean;
  isOpen?: boolean;
  options?: Option[];
};

type Option = {
  label: string;
  // TODO: What is value used for? Right now everything is build upon the label, but if we want to fix that, we need a value for subcatgeory too!
  value: string | number;
  isChecked?: boolean;
};

// TODO: Rename to state? handle as map? better usability...
export type CheckboxTreeSelection = {
  category: string;
  isChecked?: boolean;
  // TODO: Add isOpen state here
  selectedChildren?: string[];
}[];

export type CheckboxTreeProps = {
  subCategories: SubCategory[];
  label: string;
  onChange: (arg: CheckboxTreeSelection) => any;
};

export const CheckboxTree = ({
  subCategories,
  label,
  onChange,
}: CheckboxTreeProps) => {
  const classes = useStyles();

  // TODO: Reconsider if the open state should also be controlled?
  const [
    ,
    {
      add: addOpenCategoryLabel,
      has: hasOpenCategoryLabel,
      toggle: toggleOpenCategoryLabel,
      reset: resetOpenCategoryLabel,
    },
  ] = useSet(
    new Set<string>(subCategories.filter(c => c.isOpen).map(c => c.label)),
  );

  useEffect(() => {
    resetOpenCategoryLabel();

    subCategories
      .filter(c => c.isOpen)
      .map(c => c.label)
      .forEach(addOpenCategoryLabel);
  }, [subCategories]);

  const handleOpen = (event: any, category: SubCategory) => {
    event.stopPropagation();
    toggleCategory(category);
  };

  const toggleCategory = (category: SubCategory) => {
    toggleOpenCategoryLabel(category.label);

    // TODO: Maybe expose open state?
  };

  const updateSelection = () => {
    onChange(
      subCategories.map(c => ({
        category: c.label,
        isChecked: c.isChecked,
        selectedChildren: c.options?.filter(o => o.isChecked).map(o => o.label),
      })),
    );
  };

  const checkCategory = (category: SubCategory) => {
    category.isChecked = !category.isChecked;

    console.log('Check C');

    if (category.isChecked && category.options) {
      category.options.forEach(o => (o.isChecked = true));
    }

    updateSelection();
  };

  const checkOption = (category: SubCategory, option: Option) => {
    option.isChecked = !option.isChecked;
    category.isChecked = category.options?.every(o => o.isChecked);

    console.log('Check O', category);

    updateSelection();
  };

  const isCategoryOpen = (category: SubCategory): boolean => {
    return hasOpenCategoryLabel(category.label);
  };

  return (
    <div>
      <Typography variant="button">{label}</Typography>
      <List className={classes.root}>
        {subCategories.map(category => (
          <div key={category.label}>
            <ListItem
              className={classes.listItem}
              dense
              button
              onClick={() => checkCategory(category)}
            >
              <ListItemIcon className={classes.listItemIcon}>
                <Checkbox
                  color="primary"
                  edge="start"
                  checked={category.isChecked || false}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText className={classes.text} primary={category.label} />
              {category.options?.length ? (
                <IconButton
                  size="small"
                  onClick={event => handleOpen(event, category)}
                >
                  {isCategoryOpen(category) ? (
                    <ExpandLess data-testid="expandable" />
                  ) : (
                    <ExpandMore data-testid="expandable" />
                  )}
                </IconButton>
              ) : null}
            </ListItem>
            <Collapse
              in={isCategoryOpen(category)}
              timeout="auto"
              unmountOnExit
            >
              <List component="div" disablePadding>
                {category.options?.map(option => (
                  <ListItem
                    button
                    key={option.label}
                    className={classes.nested}
                    onClick={() => checkOption(category, option)}
                  >
                    <ListItemIcon className={classes.listItemIcon}>
                      <Checkbox
                        color="primary"
                        edge="start"
                        checked={option.isChecked || false}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      className={classes.text}
                      primary={option.label}
                    />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </div>
        ))}
      </List>
    </div>
  );
};
