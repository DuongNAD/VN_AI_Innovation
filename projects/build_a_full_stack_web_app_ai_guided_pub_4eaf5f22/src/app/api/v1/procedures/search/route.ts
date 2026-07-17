import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { readJsonBody, requireString, optionalString, aiMeta } from '@/lib/http';
import { getProvider } from '@/lib/data-provider';
import { classifyByKeywords, getLlmProvider, mockLlm } from '@/lib/ai/llm';
import { prisma } from '@/lib/db';

export const POST = handleRoute(async (req: Request) => {
  enforceRateLimit('search', req);

  const body = await readJsonBody(req);
  const message = requireString(body, 'message', 1000);
  const province = optionalString(body, 'province', 100);

  // Stage 1: Deterministic Keyword Matching
  const keywordHit = classifyByKeywords(message);
  if (keywordHit) {
    const code = keywordHit.procedureCode;
    const provider = getProvider();
    const procedure = await provider.getProcedure(code);
    if (procedure) {
      const procRow = await prisma.procedure.findUnique({
        where: { code },
        select: { id: true },
      });
      if (procRow) {
        const activeVersion = await provider.getActiveProcedureVersion(procRow.id);
        if (activeVersion) {
          return jsonOk({
            procedure: {
              code: procedure.code,
              name: procedure.name,
              sector: procedure.sector,
              agency: procedure.agency,
              sourceUrl: procedure.sourceUrl,
              version: activeVersion.version,
              lastCheckedAt: procedure.lastCheckedAt,
            },
            confidence: keywordHit.confidence,
            matchedBy: 'keyword',
            province: province ?? null,
            ...aiMeta('rule', false),
          });
        }
      }
    }
  }

  // Stage 2: LLM Intent Classification
  const provider = getProvider();
  const procedures = await provider.listProcedures();
  const catalog = procedures.map((p) => ({
    code: p.code,
    name: p.name,
  }));

  let llmResult: { procedureCode: string | null; confidence: number };
  let degraded = false;
  let aiProviderName = getLlmProvider().name;

  try {
    llmResult = await getLlmProvider().classifyIntent(message, catalog);
  } catch (err) {
    degraded = true;
    aiProviderName = 'mock';
    llmResult = await mockLlm.classifyIntent(message, catalog);
  }

  if (llmResult.procedureCode !== null && llmResult.confidence >= 0.6) {
    const code = llmResult.procedureCode;
    const procedure = await provider.getProcedure(code);
    if (procedure) {
      const procRow = await prisma.procedure.findUnique({
        where: { code },
        select: { id: true },
      });
      if (procRow) {
        const activeVersion = await provider.getActiveProcedureVersion(procRow.id);
        if (activeVersion) {
          return jsonOk({
            procedure: {
              code: procedure.code,
              name: procedure.name,
              sector: procedure.sector,
              agency: procedure.agency,
              sourceUrl: procedure.sourceUrl,
              version: activeVersion.version,
              lastCheckedAt: procedure.lastCheckedAt,
            },
            confidence: llmResult.confidence,
            matchedBy: 'llm',
            province: province ?? null,
            ...aiMeta(aiProviderName, degraded),
          });
        }
      }
    }
  }

  throw new AppError(
    404,
    'PROCEDURE_NOT_FOUND',
    'Chưa nhận diện được thủ tục. Hiện hỗ trợ: Đăng ký kết hôn, Đăng ký khai sinh.'
  );
});