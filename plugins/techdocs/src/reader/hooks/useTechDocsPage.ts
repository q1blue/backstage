// TODO: Loading, Docs,

import { Entity, EntityName, Location } from '@backstage/catalog-model';
import { TechDocsMetadata } from '../../types';

type PageState = {
  entityId: EntityName;
  loading: boolean;
  page?: {
    entity: Entity;
    location?: Location;
    techDocsMetadata: TechDocsMetadata;
    raw: string;
  };
  loadError?: Error;
  syncing: boolean;
  isNewerVersionAvailable: boolean;
  syncError?: Error;

  // TODO: Retry callback to trigger load?
};

export function useTechDocsPage(): PageState {
  // Retry?
  /*

  const [documentReady, setDocumentReady] = useState<boolean>(false);
  const { namespace, kind, name } = useParams();

  const techdocsApi = useApi(techdocsApiRef);

  const techdocsMetadataRequest = useAsync(() => {
    if (documentReady) {
      return techdocsApi.getTechDocsMetadata({ kind, namespace, name });
    }

    return Promise.resolve({ loading: true });
  }, [kind, namespace, name, techdocsApi, documentReady]);

  const entityMetadataRequest = useAsync(() => {
    return techdocsApi.getEntityMetadata({ kind, namespace, name });
  }, [kind, namespace, name, techdocsApi]);

  const onReady = () => {
    setDocumentReady(true);
  };

  const { loading, value: page, error } = useTechDocsPage();
*/
}
