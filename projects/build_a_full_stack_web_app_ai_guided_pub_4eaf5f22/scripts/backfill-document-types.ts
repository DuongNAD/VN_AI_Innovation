import { PrismaClient } from "@prisma/client";
import { inferDocumentType } from "../src/lib/document-types";

async function main() {
  const p = new PrismaClient();
  const apps = await p.application.findMany({
    select: { id: true, documentType: true, formVersionId: true },
  });
  const versions = await p.formVersion.findMany({ include: { form: true } });
  const formByVersion = new Map(versions.map((v) => [v.id, v.form.code]));
  let updated = 0;
  for (const a of apps) {
    const formCode = formByVersion.get(a.formVersionId) || "";
    const next = inferDocumentType(formCode);
    if (a.documentType !== next) {
      await p.application.update({ where: { id: a.id }, data: { documentType: next } });
      updated++;
    }
  }
  console.log("apps", apps.length, "updated", updated);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
