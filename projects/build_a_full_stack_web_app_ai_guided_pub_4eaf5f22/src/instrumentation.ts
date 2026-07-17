export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertStartupConfig, getAiProvider, getTrustProxy } = await import('@/lib/config');
    assertStartupConfig();
    console.log(`Server boot validation passed: aiMode=${getAiProvider()}, trustProxy=${getTrustProxy()}`);
  }
}