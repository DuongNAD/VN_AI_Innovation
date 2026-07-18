import ProcedureCatalog from '@/components/ProcedureCatalog';
import { getProvider } from '@/lib/data-provider';

export const dynamic = 'force-dynamic';

export default async function ProceduresPage() {
  const procedures = await getProvider().listProcedures();
  const catalogItems = procedures
    .map((procedure) => ({
      code: procedure.code,
      name: procedure.name,
      sector: procedure.sector,
      agency: procedure.agency,
      audience: procedure.audience,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'vi'));

  return <ProcedureCatalog procedures={catalogItems} />;
}
