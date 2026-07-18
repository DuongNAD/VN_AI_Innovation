/**
 * Procedure data provider — re-exports split modules (behavior unchanged).
 */
export type {
  ProcedureDto,
  ProcedureVersionDto,
  DocumentRow,
  FormDto,
  FormVersionDto,
  CatalogOverviewItem,
  CatalogOverviewDto,
  IProcedureDataProvider,
} from './data-provider/types';

import { PrismaProcedureDataProvider } from './data-provider/prisma-provider';

const providerInstance = new PrismaProcedureDataProvider();

export function getProvider(): import('./data-provider/types').IProcedureDataProvider {
  return providerInstance;
}
