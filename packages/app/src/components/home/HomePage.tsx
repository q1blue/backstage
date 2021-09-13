/*
 * Copyright 2021 The Backstage Authors
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
  ComponentAccordion,
  ComponentTab,
  ComponentTabs,
  HomePageRandomJoke,
} from '@backstage/plugin-home';
import { HomePageSearchBar } from '@backstage/plugin-search';
import Grid from '@material-ui/core/Grid';
import {
  Document,
  Page,
  StyleSheet,
  Text,
  usePDF,
  View,
} from '@react-pdf/renderer';
import React, { useRef } from 'react';
import { useAsync } from 'react-use';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: '#E4E4E4',
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
});

// Create Document Component
const MyDocument = () => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text>Section #1</Text>
      </View>
      <View style={styles.section}>
        <Text>Section #2</Text>
      </View>
    </Page>
  </Document>
);

const Test = () => {
  const [{ loading, blob }] = usePDF({ document: <MyDocument /> });

  const iframeRef = useRef<any>();

  useAsync(async () => {
    if (!loading && iframeRef.current) {
      iframeRef.current.src = await blob?.text();
    }
  }, [iframeRef, loading, blob]);

  return <iframe title="asdf" ref={iframeRef} />;
};

export const HomePage = () => (
  <Grid container spacing={3}>
    <Grid item xs={12}>
      <Test />
    </Grid>
    <Grid item xs={12}>
      <HomePageSearchBar />
    </Grid>
    <Grid item xs={12} md={4}>
      <HomePageRandomJoke />
    </Grid>
    <Grid item xs={12} md={4}>
      <HomePageRandomJoke defaultCategory="any" Renderer={ComponentAccordion} />
      <HomePageRandomJoke
        title="Another Random Joke"
        Renderer={ComponentAccordion}
      />
      <HomePageRandomJoke
        title="One More Random Joke"
        defaultCategory="programming"
        Renderer={ComponentAccordion}
      />
    </Grid>
    <Grid item xs={12} md={4}>
      <ComponentTabs
        title="Random Jokes"
        tabs={[
          {
            label: 'Programming',
            Component: () => (
              <HomePageRandomJoke
                defaultCategory="programming"
                Renderer={ComponentTab}
              />
            ),
          },
          {
            label: 'Any',
            Component: () => (
              <HomePageRandomJoke
                defaultCategory="any"
                Renderer={ComponentTab}
              />
            ),
          },
        ]}
      />
    </Grid>
  </Grid>
);
